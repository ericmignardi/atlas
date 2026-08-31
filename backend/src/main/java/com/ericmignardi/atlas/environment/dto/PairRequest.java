package com.ericmignardi.atlas.environment.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

public record PairRequest(

		@NotNull(message = "must not be null")
		UUID targetId) {
}
