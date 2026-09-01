package com.ericmignardi.atlas.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Import;

import com.ericmignardi.atlas.config.AtlasProperties;

/**
 * NFR-2.2, from both ends: a secret that is too short, and no secret at all.
 *
 * <p>"No secret at all" is the second case, and it is not a separate code path:
 * with {@code JWT_SECRET} unset the property binds to the literal
 * {@code ${JWT_SECRET}} text, which is 13 characters and so fails the same length
 * check. The test below pins that, and the last one pins the configuration rule
 * the whole thing rests on.
 */
class JwtSecretStartupTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withConfiguration(org.springframework.boot.autoconfigure.AutoConfigurations
					.of(ConfigurationPropertiesAutoConfiguration.class))
			.withUserConfiguration(JwtOnlyConfiguration.class)
			.withPropertyValues("atlas.jwt.access-token-ttl=PT15M", "atlas.jwt.refresh-token-ttl=P7D",
					"atlas.cors.allowed-origin=http://localhost:5173");

	@org.springframework.boot.context.properties.EnableConfigurationProperties(AtlasProperties.class)
	@Import(JwtService.class)
	static class JwtOnlyConfiguration {
	}

	@Test
	void aSecretShorterThan256BitsFailsTheContextWithAnActionableMessage() {
		runner.withPropertyValues("atlas.jwt.secret=too-short").run(context -> {
			assertThat(context).hasFailed();
			assertThat(context.getStartupFailure())
					.rootCause()
					.isInstanceOf(IllegalStateException.class)
					.hasMessageContaining("atlas.jwt.secret must be at least 256 bits");
		});
	}

	/**
	 * What a deployment that forgot the variable actually looks like: the
	 * placeholder arrives verbatim, and the length check catches it.
	 */
	@Test
	void anUnresolvedPlaceholderFailsTheSameWay() {
		runner.withPropertyValues("atlas.jwt.secret=$" + "{JWT_SECRET}").run(context -> {
			assertThat(context).hasFailed();
			assertThat(context.getStartupFailure())
					.rootCause()
					.hasMessageContaining("atlas.jwt.secret must be at least 256 bits");
		});
	}

	@Test
	void aLongEnoughSecretStarts() {
		runner.withPropertyValues(
				"atlas.jwt.secret=a-signing-key-that-is-comfortably-over-32-bytes-long")
				.run(context -> assertThat(context).hasSingleBean(JwtService.class));
	}

	/**
	 * A default here would mean a deployment that forgot to set JWT_SECRET signs
	 * tokens anyone who has read this repository can forge.
	 */
	@Test
	void theConfigurationGivesTheSecretNoDefaultValue() throws Exception {
		String yaml = Files.readString(Path.of("src/main/resources/application.yml"));

		assertThat(yaml).contains("${JWT_SECRET}");
		assertThat(yaml).doesNotContain("${JWT_SECRET:");
	}
}
