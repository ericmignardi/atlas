package com.ericmignardi.atlas;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * NFR-3.4: real Postgres, not H2 — the schema uses {@code text[]}, {@code uuid}
 * defaults, and a self-referencing unique foreign key, none of which H2 models
 * faithfully.
 *
 * <p>The container is a {@code static final} singleton rather than a plain
 * {@code @Bean} instance: a fresh object per context would mean a fresh
 * container. {@code withReuse(true)} keeps it alive between Maven runs, but only
 * if the developer opted in with {@code testcontainers.reuse.enable=true} in
 * {@code ~/.testcontainers.properties}, so CI is unaffected.
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
