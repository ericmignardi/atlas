package com.ericmignardi.atlas;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Real Postgres for the test suite. Not H2 — the schema uses {@code text[]},
 * {@code uuid} defaults, and a self-referencing unique foreign key, none of
 * which H2 models faithfully (NFR-3.4). A test that passes against a database
 * that is not the production database proves less than it appears to.
 *
 * <p>The container is a {@code static final} singleton rather than a plain
 * {@code @Bean} instance. Spring caches application contexts per configuration,
 * but a fresh {@code PostgreSQLContainer} object per context would still mean a
 * fresh container; sharing one field means every context that imports this
 * configuration reuses the same running database. {@code start()} on an
 * already-started container is a no-op, so the first context pays the ~2 s
 * startup and the rest pay nothing.
 *
 * <p>{@code withReuse(true)} goes one step further and keeps the container alive
 * <em>between</em> Maven runs — but only if the developer has opted in by
 * putting {@code testcontainers.reuse.enable=true} in {@code ~/.testcontainers.properties}.
 * Without that file the flag is ignored and the container is torn down as usual,
 * so CI is unaffected.
 *
 * <p>{@code @ServiceConnection} is what wires the container's JDBC URL,
 * username, and password into the context. It replaces the older
 * {@code @DynamicPropertySource} block by hand: same effect, one annotation, and
 * no property names to typo.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	static final PostgreSQLContainer POSTGRES =
			new PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine")).withReuse(true);

	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		return POSTGRES;
	}

}
