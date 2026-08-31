package com.ericmignardi.atlas;

import org.junit.jupiter.api.Test;

/**
 * The cheapest regression test there is. Booting the context runs Flyway and
 * then Hibernate's {@code ddl-auto: validate}, so a migration that drifts from
 * an entity mapping fails here rather than on startup in production.
 */
class AtlasApplicationTests extends AbstractIntegrationTest {

	@Test
	void contextLoads() {
	}

}
