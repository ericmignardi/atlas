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
 * The shape the real configuration takes on Day 5: stateless, no session, no
 * form login, no CSRF token — a token-based API has no cookie for an attacker
 * to ride.
 *
 * <p><strong>{@code /api/**} is open until Day 5.</strong> There is no way to
 * obtain a token yet, so requiring one would mean no endpoint could be exercised
 * at all. Ownership is still enforced underneath: every service call is scoped
 * to a {@link com.ericmignardi.atlas.security.UserPrincipal}, and
 * {@link com.ericmignardi.atlas.security.CurrentUserResolver} refuses to guess
 * when more than one account exists. Day 5 replaces the {@code permitAll} with
 * the JWT filter and nothing below this line has to change.
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

	/**
	 * Strength 12, not the default 10 (PRD 5.2). Each increment doubles the work
	 * factor; 12 costs roughly a quarter of a second per hash, which is
	 * unnoticeable on a login and expensive on an offline dictionary attack.
	 */
	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(12);
	}
}
