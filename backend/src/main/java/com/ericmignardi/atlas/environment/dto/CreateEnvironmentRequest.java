package com.ericmignardi.atlas.environment.dto;

import java.util.UUID;

import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code pairedWithId} is absent on purpose: pairing is four invariants
 * (FR-3.7 – FR-3.10) plus a release-before-assign sequence, and it lives behind
 * {@code PUT /api/environments/{id}/pair} and nowhere else.
 */
public record CreateEnvironmentRequest(

		@NotNull(message = "must not be null")
		UUID projectId,

		@NotBlank(message = "must not be blank")
		@Size(max = 120, message = "must be at most 120 characters")
		String name,

		@NotNull(message = "must not be null")
		Platform platform,

		@NotNull(message = "must not be null")
		EnvironmentType type,

		@Size(max = 200, message = "must be at most 200 characters")
		String branch,

		/** Free text, deliberately not URL-validated: a Neon connection string is not a URL. */
		@Size(max = 600, message = "must be at most 600 characters")
		String url,

		@Size(max = 4000, message = "must be at most 4000 characters")
		String notes) {
}
