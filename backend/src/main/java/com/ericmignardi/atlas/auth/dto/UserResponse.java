package com.ericmignardi.atlas.auth.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.ericmignardi.atlas.user.User;

/**
 * PRD §6.2. There is no password field to forget to exclude — the DTO simply
 * has no way to carry one (FR-1.2).
 */
public record UserResponse(
		UUID id,
		String email,
		String displayName,
		List<String> roles,
		Instant createdAt) {

	public static UserResponse from(User user) {
		return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(),
				user.roleNames(), user.getCreatedAt());
	}
}
