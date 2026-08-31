package com.ericmignardi.atlas.security;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.ericmignardi.atlas.common.error.ApiException;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Day 5 adds the JWT filter that puts a {@link UserPrincipal} in the security
 * context, and this class does not change: deleting {@code seedAccount()} is the
 * whole of the migration.
 */
@Component
@RequiredArgsConstructor
public class CurrentUserResolver {

	private final UserRepository users;

	public UserPrincipal require() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.isAuthenticated()
				&& authentication.getPrincipal() instanceof UserPrincipal principal) {
			return principal;
		}
		return seedAccount();
	}

	/**
	 * Day 3 only. Ambiguity is a 401 rather than a guess: picking "the first
	 * user" out of several would hand one account another account's data, which
	 * is the failure mode FR-1.9 exists to prevent.
	 */
	private UserPrincipal seedAccount() {
		List<User> all = users.findAll();
		if (all.size() != 1) {
			throw new ApiException(HttpStatus.UNAUTHORIZED,
					all.isEmpty() ? "No account exists yet" : "Sign in to continue");
		}
		return UserPrincipal.of(all.get(0));
	}
}
