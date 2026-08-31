package com.ericmignardi.atlas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

/**
 * The document behind {@code /swagger-ui.html} (FR-8.6). springdoc derives every
 * path, schema, and status code from the controllers and DTOs; all this supplies
 * is the title block, so the two can never disagree about what the API does.
 */
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
