package com.ericmignardi.atlas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/** FR-8.6. springdoc derives the rest from the controllers and DTOs. */
@Configuration
public class OpenApiConfig {

	private static final String BEARER = "bearerAuth";

	@Bean
	OpenAPI atlasOpenApi() {
		return new OpenAPI()
				.info(new Info()
						.title("Atlas API")
						.version("v1")
						.description("Personal developer portal: projects, environments, tasks, and tags."))
				// Declared and applied globally: every endpoint but the three on
				// /api/auth needs a token, so listing the exceptions in prose is
				// shorter and harder to get wrong than annotating the forty that do.
				.components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
						.type(SecurityScheme.Type.HTTP)
						.scheme("bearer")
						.bearerFormat("JWT")
						.description("The accessToken from POST /api/auth/login.")))
				.addSecurityItem(new SecurityRequirement().addList(BEARER));
	}
}
