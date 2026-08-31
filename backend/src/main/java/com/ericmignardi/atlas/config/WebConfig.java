package com.ericmignardi.atlas.config;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.ericmignardi.atlas.security.CurrentUserArgumentResolver;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;

/**
 * NFR-2.4: exactly the configured frontend origin, no wildcard.
 *
 * <p>Implementing {@link WebMvcConfigurer} rather than annotating the class
 * {@code @EnableWebMvc} is deliberate — {@code @EnableWebMvc} switches Boot
 * auto-configuration off and takes the message converters, the content
 * negotiation, and the static resource handling with it.
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

	private final CurrentUserArgumentResolver currentUserArgumentResolver;

	@Value("${atlas.cors.allowed-origin}")
	private String allowedOrigin;

	@Override
	public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
		resolvers.add(currentUserArgumentResolver);
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOrigins(allowedOrigin)
				.allowedMethods("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
				.allowedHeaders("*")
				.allowCredentials(true);
	}
}
