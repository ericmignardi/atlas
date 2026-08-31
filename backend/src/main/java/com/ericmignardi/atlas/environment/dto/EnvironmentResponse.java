package com.ericmignardi.atlas.environment.dto;

import java.time.Instant;
import java.util.UUID;

import com.ericmignardi.atlas.environment.Environment;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;
import com.fasterxml.jackson.annotation.JsonProperty;

public record EnvironmentResponse(
		UUID id,
		UUID projectId,
		String name,
		Platform platform,
		EnvironmentType type,
		String branch,
		String url,
		String notes,

		/** FR-3.6, derived on the server so a client cannot disagree with it. */
		@JsonProperty("isDatabase") boolean database,

		EnvironmentSummary pairedWith,

		Instant createdAt,
		Instant updatedAt) {

	public static EnvironmentResponse from(Environment environment, Environment partner) {
		return new EnvironmentResponse(
				environment.getId(),
				environment.getProject().getId(),
				environment.getName(),
				environment.getPlatform(),
				environment.getType(),
				environment.getBranch(),
				environment.getUrl(),
				environment.getNotes(),
				environment.getPlatform().isDatabase(),
				EnvironmentSummary.from(partner),
				environment.getCreatedAt(),
				environment.getUpdatedAt());
	}
}
