package com.ericmignardi.atlas.config;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.ericmignardi.atlas.security.CurrentUserArgumentResolver;

import lombok.RequiredArgsConstructor;

/**
 * Implementing {@link WebMvcConfigurer} rather than annotating the class
 * {@code @EnableWebMvc} is deliberate: {@code @EnableWebMvc} switches Boot
 * auto-configuration off and takes the message converters, the content
 * negotiation, and the static resource handling with it.
 *
 * <p>CORS used to be configured here as well. It moved to {@link SecurityConfig}
 * on Day 5, because two sources of CORS truth is one too many and the security
 * filter chain is the one that runs first: a rejection there never reaches an
 * MVC mapping.
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

	private final CurrentUserArgumentResolver currentUserArgumentResolver;

	@Override
	public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
		resolvers.add(currentUserArgumentResolver);
	}
}
