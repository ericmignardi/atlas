package com.ericmignardi.atlas;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * An identical annotation set is what lets Spring hand every subclass the same
 * cached application context. Changing the profile or adding a mock in a
 * subclass silently forks that cache key and costs another full startup.
 *
 * <p>The {@code test} profile keeps {@link com.ericmignardi.atlas.config.DevDataSeeder}
 * out of the way.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {
}
