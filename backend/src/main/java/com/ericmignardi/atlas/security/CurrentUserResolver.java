package com.ericmignardi.atlas.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.ericmignardi.atlas.common.error.ApiException;

/**
 * The single read of the security context. Everything downstream takes a
 * {@link UserPrincipal} as a parameter, which keeps the services testable
 * without a thread-local and makes NFR-2.8 structural: there is no code path
 * that could take a user id from the request body instead.
 *
 * <p>The Day 3 stub that resolved an unauthenticated request to "the only
 * account in the database" is gone. {@link JwtAuthenticationFilter} now puts the
 * real principal in the context, and the filter chain rejects the request before
 * it ever reaches a controller — so the throw below is a guard against a
 * misconfigured {@code SecurityConfig}, not an expected path.
 */
@Component
public class CurrentUserResolver {

	public UserPrincipal require() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.isAuthenticated()
				&& authentication.getPrincipal() instanceof UserPrincipal principal) {
			return principal;
		}
		throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required");
	}
}
