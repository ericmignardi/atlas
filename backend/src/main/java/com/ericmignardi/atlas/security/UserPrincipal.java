package com.ericmignardi.atlas.security;

import java.util.UUID;

import com.ericmignardi.atlas.user.User;

/**
 * FR-1.9 is enforced by every service taking the id off this and passing it into
 * a user-scoped repository lookup, rather than by explicit ownership checks.
 *
 * <p>Deliberately not the {@link User} entity: a detached entity in the security
 * context would be a lazy-loading trap.
 */
public record UserPrincipal(UUID id, String email) {

	public static UserPrincipal of(User user) {
		return new UserPrincipal(user.getId(), user.getEmail());
	}
}
