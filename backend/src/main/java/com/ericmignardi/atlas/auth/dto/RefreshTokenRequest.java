package com.ericmignardi.atlas.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** The body of both {@code /refresh} and {@code /logout}. */
public record RefreshTokenRequest(

		@NotBlank(message = "must not be blank")
		String refreshToken) {
}
