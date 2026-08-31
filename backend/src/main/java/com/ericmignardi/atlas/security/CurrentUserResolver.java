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
 * Answers "who is calling" for the rest of the application.
 *
 * <p>The real half is already here: if the security context holds a
 * {@link UserPrincipal}, that is the caller, full stop. Day 5 adds the JWT
 * filter that puts one there, and this class does not change.
 *
 * <p>The stub is the fallback. There is no login yet, so an unauthenticated
 * request resolves to the single account in the database — which is exactly
 * right for a single-user portal being built locally, and exactly wrong the
 * moment a second account exists, hence the guard below. Deleting
 * {@code seedAccount()} on Day 5 is the whole of the migration.
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
	 * user" out of several would silently hand one account another account's
	 * data, which is the one failure mode this whole layer exists to prevent.
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
