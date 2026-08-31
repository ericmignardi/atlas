package com.ericmignardi.atlas.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;

/**
 * FR-8.6. Not a test of springdoc: a controller left out of the component scan,
 * or a DTO springdoc cannot introspect, shows up here and nowhere else.
 */
class OpenApiDocumentIT extends AbstractWebIntegrationTest {

	@Test
	void publishesEveryProjectAndTagEndpointWithItsSchemas() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.info.title").value("Atlas API"))
				.andExpect(jsonPath("$.paths['/api/projects'].get").exists())
				.andExpect(jsonPath("$.paths['/api/projects'].post").exists())
				.andExpect(jsonPath("$.paths['/api/projects/{id}'].get").exists())
				.andExpect(jsonPath("$.paths['/api/projects/{id}'].patch").exists())
				.andExpect(jsonPath("$.paths['/api/projects/{id}'].delete").exists())
				.andExpect(jsonPath("$.paths['/api/projects/slug/{slug}'].get").exists())
				.andExpect(jsonPath("$.paths['/api/projects/{id}/pin'].post").exists())
				.andExpect(jsonPath("$.paths['/api/projects/{id}/pin'].delete").exists())
				.andExpect(jsonPath("$.paths['/api/tags'].get").exists())
				.andExpect(jsonPath("$.paths['/api/tags'].post").exists())
				.andExpect(jsonPath("$.paths['/api/tags/{id}'].patch").exists())
				.andExpect(jsonPath("$.paths['/api/tags/{id}'].delete").exists())
				.andExpect(jsonPath("$.components.schemas.ProjectResponse").exists())
				.andExpect(jsonPath("$.components.schemas.TagResponse").exists());
	}

	@Test
	void servesTheInteractiveDocumentation() throws Exception {
		mockMvc.perform(get("/swagger-ui.html"))
				.andExpect(status().is3xxRedirection());
	}
}
