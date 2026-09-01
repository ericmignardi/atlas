package com.ericmignardi.atlas.security;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.ericmignardi.atlas.user.User;

/**
 * The adapter between the {@link User} entity and Spring Security. The entity
 * implements no framework interface of its own — persistence and authentication
 * are two different concerns, and a {@code UserDetails} entity ends up with
 * {@code getUsername()} meaning "email" forever.
 *
 * <p>Deliberately not the entity itself: a detached entity parked in the
 * security context for the life of a request is a lazy-loading trap.
 *
 * <p>FR-1.9 is enforced by every service taking {@link #id()} and passing it
 * into a user-scoped repository lookup, rather than by explicit ownership
 * checks after the fact.
 *
 * @param passwordHash present only on the instance
 *                     {@link CustomUserDetailsService} loads for a password
 *                     check. The one {@link JwtAuthenticationFilter} builds
 *                     leaves it null: a bearer token has already proved the
 *                     password, so re-reading the hash on every request would
 *                     be a database round trip and a needless copy of the
 *                     secret.
 */
public record UserPrincipal(
		UUID id,
		String email,
		String passwordHash,
		List<GrantedAuthority> authorities,
		boolean enabled) implements UserDetails {

	private static final long serialVersionUID = 1L;

	public UserPrincipal {
		authorities = List.copyOf(authorities);
	}

	public static UserPrincipal of(User user) {
		return new UserPrincipal(user.getId(), user.getEmail(), user.getPasswordHash(),
				authorities(user.roleNames()), user.isEnabled());
	}

	/** The token path: everything here came out of verified claims. */
	public static UserPrincipal fromToken(UUID id, String email, List<String> roles) {
		return new UserPrincipal(id, email, null, authorities(roles), true);
	}

	private static List<GrantedAuthority> authorities(List<String> roles) {
		return roles.stream().map(role -> (GrantedAuthority) new SimpleGrantedAuthority(role)).toList();
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return authorities;
	}

	@Override
	public String getPassword() {
		return passwordHash;
	}

	/** Email is the login identifier; there is no separate username. */
	@Override
	public String getUsername() {
		return email;
	}

	@Override
	public boolean isEnabled() {
		return enabled;
	}
}
