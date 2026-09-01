package com.ericmignardi.atlas;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * {@code @ConfigurationPropertiesScan} binds
 * {@link com.ericmignardi.atlas.config.AtlasProperties} while the context is
 * still starting, which is what makes a missing or short {@code JWT_SECRET} a
 * startup failure rather than a first-login failure (NFR-2.2).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class AtlasApplication {

	public static void main(String[] args) {
		SpringApplication.run(AtlasApplication.class, args);
	}

}
