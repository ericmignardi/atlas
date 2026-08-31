package com.ericmignardi.atlas.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Turns on the {@code AuditingEntityListener}. Without this annotation somewhere
 * in the context the audit fields stay null and every insert fails the NOT NULL
 * constraint — a failure that looks like a mapping bug and is not.
 */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
