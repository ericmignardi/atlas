package com.ericmignardi.atlas.config;

import org.openapitools.jackson.nullable.JsonNullableJackson3Module;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.databind.JacksonModule;

/**
 * Without this module every {@code JsonNullable} deserialises to a plain null,
 * every PATCH looks like "clear this", and the mechanism the whole update path
 * rests on fails silently.
 *
 * <p>Spring Boot 4 ships Jackson 3, so the type is
 * {@code tools.jackson.databind.JacksonModule} and the implementation is
 * {@code JsonNullableJackson3Module}, not the Jackson 2 {@code JsonNullableModule}
 * most examples still show.
 */
@Configuration
public class JacksonConfig {

	@Bean
	JacksonModule jsonNullableModule() {
		return new JsonNullableJackson3Module();
	}
}
