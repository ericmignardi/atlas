package com.ericmignardi.atlas.config;

import org.openapitools.jackson.nullable.JsonNullableJackson3Module;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.databind.JacksonModule;

/**
 * Registers the module that makes {@code JsonNullable} work (PRD 6.9). Without
 * it every {@code JsonNullable} field deserialises to a plain null, every PATCH
 * looks like "clear this", and the mechanism the whole update path is built on
 * fails <em>silently</em> — the tests pass at compile time and the data goes
 * missing at runtime. That is why it is a bean and not a comment.
 *
 * <p>Two details differ from the usual snippet. Spring Boot 4 ships Jackson 3,
 * so the module type is {@code tools.jackson.databind.JacksonModule} and the
 * implementation is {@code JsonNullableJackson3Module}, not the Jackson 2
 * {@code JsonNullableModule} that most examples still show. And
 * {@code spring.jackson.find-and-add-modules} defaults to true, so this module
 * would in fact be discovered through {@code META-INF/services} anyway —
 * declaring it explicitly means the application does not quietly lose correct
 * PATCH semantics if that property is ever turned off. Jackson ignores the
 * duplicate registration.
 */
@Configuration
public class JacksonConfig {

	@Bean
	JacksonModule jsonNullableModule() {
		return new JsonNullableJackson3Module();
	}
}
