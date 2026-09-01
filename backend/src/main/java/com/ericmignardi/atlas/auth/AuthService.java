package com.ericmignardi.atlas.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.auth.dto.AuthResponse;
import com.ericmignardi.atlas.auth.dto.LoginRequest;
import com.ericmignardi.atlas.auth.dto.RegisterRequest;
import com.ericmignardi.atlas.auth.dto.UserResponse;
import com.ericmignardi.atlas.common.error.ApiException;
import com.ericmignardi.atlas.common.error.ValidationException;
import com.ericmignardi.atlas.security.JwtService;
import com.ericmignardi.atlas.security.UserPrincipal;
import com.ericmignardi.atlas.user.RefreshTokenService;
import com.ericmignardi.atlas.user.RefreshTokenService.IssuedToken;
import com.ericmignardi.atlas.user.RefreshTokenService.RotatedToken;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * FR-1.1 to FR-1.6, and FR-1.11.
 *
 * <p>Registration and login both end in the same place: a fresh access token, a
 * fresh refresh token, and the user. Keeping that in one private method is what
 * stops the two paths from drifting into returning different shapes.
 *
 * <p>Emails arrive already lowercased and trimmed — the DTOs normalise in their
 * canonical constructors, so it happens before Bean Validation rather than after.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

	/**
	 * PRD 6.2: the same words for an unknown email and for a wrong password. A
	 * login endpoint that distinguishes them is an account-enumeration oracle —
	 * an attacker can harvest which addresses have accounts here without ever
	 * guessing a password.
	 */
	private static final String INVALID_CREDENTIALS = "Invalid email or password";

	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;
	private final JwtService jwtService;
	private final RefreshTokenService refreshTokens;

	@Transactional
	public AuthResponse register(RegisterRequest request) {
		// Checked here for the field-level 400 the form needs. The unique index on
		// lower(email) is still the thing that makes it true: two concurrent
		// registrations both pass this check, and one of them then loses to the
		// database and comes back as a 409.
		if (users.existsByEmailIgnoreCase(request.email())) {
			throw ValidationException.of("email", "is already registered");
		}

		User user = new User();
		user.setEmail(request.email());
		user.setPasswordHash(passwordEncoder.encode(request.password()));
		user.setDisplayName(request.displayName());
		// FR-1.10. ROLE_ADMIN is never self-assigned; it is a database update.
		user.setRoles("ROLE_USER");
		users.save(user);

		return issue(user);
	}

	@Transactional
	public AuthResponse login(LoginRequest request) {
		try {
			// Delegating to the AuthenticationManager rather than calling
			// passwordEncoder.matches directly is what puts CustomUserDetailsService
			// and DaoAuthenticationProvider in the path — including the constant-time
			// dummy hash it runs for an unknown email, which closes the timing side
			// channel the identical message above would otherwise leave open.
			authenticationManager.authenticate(
					new UsernamePasswordAuthenticationToken(request.email(), request.password()));
		} catch (AuthenticationException e) {
			throw new ApiException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
		}

		User user = users.findByEmailIgnoreCase(request.email())
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS));
		return issue(user);
	}

	/**
	 * FR-1.5. The old refresh token is dead by the time this returns.
	 *
	 * <p>Deliberately <em>not</em> {@code @Transactional}: rotation manages its
	 * own boundary, including the {@code noRollbackFor} rule that lets it revoke
	 * a reused token and still reject the request. An outer transaction here
	 * would wrap that one and roll the revocation back on the way out.
	 */
	public AuthResponse refresh(String presented) {
		RotatedToken rotated = refreshTokens.rotate(presented);
		return AuthResponse.of(jwtService.generateAccessToken(rotated.user()), rotated.token().value(),
				jwtService.accessTokenTtl().toSeconds(), rotated.user());
	}

	/**
	 * FR-1.6. The access token is deliberately left alive for the rest of its 15
	 * minutes: revoking it would need the server-side session this design does
	 * not have. Logout ends the ability to get a <em>new</em> access token, which
	 * is what makes the short TTL matter.
	 */
	public void logout(String presented) {
		refreshTokens.revoke(presented);
	}

	/** FR-1.11. Reads the database, not the token, so a display-name change shows up. */
	@Transactional(readOnly = true)
	public UserResponse me(UserPrincipal principal) {
		return users.findById(principal.id())
				.map(UserResponse::from)
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required"));
	}

	private AuthResponse issue(User user) {
		IssuedToken refreshToken = refreshTokens.issue(user);
		return AuthResponse.of(jwtService.generateAccessToken(user), refreshToken.value(),
				jwtService.accessTokenTtl().toSeconds(), user);
	}
}
