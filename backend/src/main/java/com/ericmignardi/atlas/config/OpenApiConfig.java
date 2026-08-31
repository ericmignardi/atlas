package com.ericmignardi.atlas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

/** FR-8.6. springdoc derives the rest from the controllers and DTOs. */
@Configuration
public class OpenApiConfig {

	@Bean
	OpenAPI atlasOpenApi() {
		return new OpenAPI().info(new Info()
				.title("Atlas API")
				.version("v1")
				.description("Personal developer portal: projects, environments, tasks, and tags."));
	}
}
