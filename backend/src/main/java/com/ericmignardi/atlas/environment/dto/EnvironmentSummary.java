package com.ericmignardi.atlas.environment.dto;

import java.util.UUID;

import com.ericmignardi.atlas.environment.Environment;
import com.ericmignardi.atlas.environment.Platform;

public record EnvironmentSummary(UUID id, String name, Platform platform, String branch) {

	public static EnvironmentSummary from(Environment environment) {
		if (environment == null) {
			return null;
		}
		return new EnvironmentSummary(
				environment.getId(),
				environment.getName(),
				environment.getPlatform(),
				environment.getBranch());
	}
}
