package com.ericmignardi.atlas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * NFR-2.3 stateless, NFR-2.5 no CSRF token — correct only because the API is
 * stateless and token-bearing, so there is no cookie for an attacker to ride.
 *
 * <p><strong>{@code /api/**} is open until Day 5.</strong> There is no way to
 * obtain a token yet. Ownership is still enforced underneath: every service call
 * is scoped to a {@link com.ericmignardi.atlas.security.UserPrincipal}, and
 * {@link com.ericmignardi.atlas.security.CurrentUserResolver} refuses to guess
 * when more than one account exists.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		return http
				.csrf(csrf -> csrf.disable())
				.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.httpBasic(basic -> basic.disable())
				.formLogin(form -> form.disable())
				.cors(cors -> {
				})
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.GET, "/api/ping").permitAll()
						// Day 5: replace with .authenticated() plus the JWT filter.
						.requestMatchers("/api/**").permitAll()
						.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
						.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
						.anyRequest().authenticated())
				.build();
	}

	/** NFR-2.1: strength 12, not the default 10. */
	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(12);
	}
}
