package com.ericmignardi.atlas.auth.dto;

import com.ericmignardi.atlas.user.User;

/**
 * PRD §6.2. {@code expiresIn} is seconds, and it is derived from the configured
 * TTL rather than hard-coded, so a client that schedules its refresh off this
 * number stays correct when the TTL changes.
 */
public record AuthResponse(
		String accessToken,
		String refreshToken,
		String tokenType,
		long expiresIn,
		UserResponse user) {

	public static AuthResponse of(String accessToken, String refreshToken, long expiresInSeconds,
			User user) {

		return new AuthResponse(accessToken, refreshToken, "Bearer", expiresInSeconds,
				UserResponse.from(user));
	}
}
