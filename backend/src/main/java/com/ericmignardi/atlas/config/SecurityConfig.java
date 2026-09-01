package com.ericmignardi.atlas.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.ericmignardi.atlas.security.JwtAuthenticationFilter;
import com.ericmignardi.atlas.security.SecurityErrorHandler;

import lombok.RequiredArgsConstructor;

/**
 * FR-1.7, FR-1.8, NFR-2.1 to NFR-2.5.
 *
 * <p>Order in {@code authorizeHttpRequests} is significant: the first matcher
 * that matches wins, so the {@code permitAll} rules have to come before
 * {@code anyRequest().authenticated()}. Putting {@code anyRequest} first would
 * lock out registration and there would be no way to obtain a token at all.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

	private final JwtAuthenticationFilter jwtFilter;
	private final SecurityErrorHandler securityErrorHandler;
	private final AtlasProperties properties;

	@Bean
	SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		return http
				/*
				 * NFR-2.5. CSRF protection defends against a browser attaching an
				 * ambient credential (a cookie) to a request the user did not mean to
				 * make. This API carries its credential in an Authorization header that
				 * a cross-site form cannot set, so there is nothing to ride on. Move the
				 * token into a cookie and this line becomes a vulnerability.
				 */
				.csrf(csrf -> csrf.disable())
				.cors(cors -> cors.configurationSource(corsConfigurationSource()))
				// NFR-2.3: no HttpSession, no JSESSIONID, nothing to replicate.
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.httpBasic(basic -> basic.disable())
				.formLogin(form -> form.disable())
				.logout(logout -> logout.disable())
				.authorizeHttpRequests(auth -> auth
						// A CORS preflight carries no Authorization header by definition, so
						// it has to be reachable or every cross-origin call fails.
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers(HttpMethod.POST,
								"/api/auth/register", "/api/auth/login", "/api/auth/refresh").permitAll()
						// The Day 1 walking skeleton, and what Day 10 curls first.
						.requestMatchers(HttpMethod.GET, "/api/ping").permitAll()
						.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
						.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
						// FR-1.7. Everything not named above, including /api/auth/logout
						// and /api/auth/me.
						.anyRequest().authenticated())
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(securityErrorHandler)
						.accessDeniedHandler(securityErrorHandler))
				.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
				.build();
	}

	/**
	 * NFR-2.4: exactly the configured origin. No wildcard, and no list, because
	 * Atlas has one frontend.
	 *
	 * <p>This is untestable locally: the Vite dev proxy makes every call
	 * same-origin and no preflight is ever sent. It is configured properly now
	 * anyway, because the alternative is discovering it on deployment day, when
	 * the frontend and the API are finally on different Azure domains and the
	 * browser console is the only diagnostic available.
	 */
	@Bean
	CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(List.of(properties.cors().allowedOrigin()));
		configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
		// Only what the frontend actually sends. A wildcard here is also
		// incompatible with allowCredentials.
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		configuration.setAllowCredentials(true);
		// Cache the preflight for an hour so a PATCH-heavy screen is not sending
		// two requests for every one.
		configuration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}

	/**
	 * Built explicitly rather than pulled off {@code AuthenticationConfiguration}
	 * so the provider chain is visible: one provider, backed by the
	 * application's own {@code UserDetailsService} and the strength-12 encoder
	 * below.
	 */
	@Bean
	AuthenticationManager authenticationManager(UserDetailsService userDetailsService,
			PasswordEncoder passwordEncoder) {

		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
		provider.setPasswordEncoder(passwordEncoder);
		return new ProviderManager(provider);
	}

	/**
	 * NFR-2.1: strength 12, not the default 10. Each increment doubles the work;
	 * 12 costs roughly a quarter of a second per hash on modest hardware, which
	 * is unnoticeable on a login and ruinous for an offline dictionary attack.
	 * BCrypt rather than SHA-256 precisely because it is slow and salted, and a
	 * fast hash is the wrong tool for a low-entropy secret.
	 */
	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(12);
	}
}
