package com.ericmignardi.atlas.security;

import java.util.UUID;

import com.ericmignardi.atlas.user.User;

/**
 * The authenticated caller, reduced to what a service actually needs. Every
 * service method takes the id off this and passes it into a user-scoped
 * repository lookup, which is how FR-1.9 is enforced without a single explicit
 * ownership check.
 *
 * <p>Deliberately not the {@link User} entity: a detached entity in the
 * security context would be a lazy-loading trap and a way for the persistence
 * layer to leak into the controller signature.
 */
public record UserPrincipal(UUID id, String email) {

	public static UserPrincipal of(User user) {
		return new UserPrincipal(user.getId(), user.getEmail());
	}
}
