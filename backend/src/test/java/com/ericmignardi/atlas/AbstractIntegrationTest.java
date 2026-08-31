package com.ericmignardi.atlas;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * Base class for every test that needs the real thing: Flyway-migrated schema,
 * Hibernate validating its mappings against it, repositories wired up.
 *
 * <p>Extending this rather than repeating the annotations is not only tidier —
 * an identical annotation set is what lets Spring's test framework hand every
 * subclass the <em>same</em> cached application context, so the suite starts one
 * container and one Spring context no matter how many test classes there are.
 * Changing the profile or adding a {@code @MockBean} in a subclass silently
 * forks that cache key and costs another full startup.
 *
 * <p>The {@code test} profile keeps {@link com.ericmignardi.atlas.config.DevDataSeeder}
 * out of the way: assertions want an empty database they populate themselves,
 * not five projects they did not create.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {
}
