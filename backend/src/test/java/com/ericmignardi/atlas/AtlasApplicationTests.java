package com.ericmignardi.atlas;

import org.junit.jupiter.api.Test;

/**
 * NFR-3.1: booting the context runs Flyway and then {@code ddl-auto: validate},
 * so a migration that drifts from an entity mapping fails here.
 */
class AtlasApplicationTests extends AbstractIntegrationTest {

	@Test
	void contextLoads() {
	}

}
