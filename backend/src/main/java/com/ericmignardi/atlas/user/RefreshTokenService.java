package com.ericmignardi.atlas.user;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.common.error.ApiException;
import com.ericmignardi.atlas.config.AtlasProperties;

import lombok.RequiredArgsConstructor;

/**
 * Issues, rotates, and revokes refresh tokens (FR-1.5, FR-1.6).
 *
 * <p>A refresh token is 256 bits of {@link SecureRandom}, base64url-encoded —
 * <strong>not</strong> a JWT. A JWT is a self-contained assertion the server
 * cannot take back before it expires, which is the opposite of what a
 * seven-day credential needs. This is an opaque handle; the server owns the
 * state, so "log out" is a real thing that happens rather than advice to the
 * client.
 *
 * <p>Only the SHA-256 hash is stored, for the same reason passwords are hashed:
 * a database leak must not hand out working sessions. SHA-256 rather than BCrypt
 * because the input is already 256 bits of entropy — there is no dictionary to
 * defend against, and the lookup has to be an indexed equality match.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

	private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

	private static final int TOKEN_BYTES = 32;
	private static final String INVALID = "Refresh token is invalid or expired";

	private static final SecureRandom RANDOM = new SecureRandom();
	private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

	private final RefreshTokenRepository refreshTokens;
	private final AtlasProperties properties;

	/** The raw token, returned to the caller exactly once and never stored. */
	public record IssuedToken(String value, Instant expiresAt) {
	}

	/** The owner plus the replacement, so the caller can mint a matching access token. */
	public record RotatedToken(User user, IssuedToken token) {
	}

	@Transactional
	public IssuedToken issue(User user) {
		byte[] raw = new byte[TOKEN_BYTES];
		RANDOM.nextBytes(raw);
		String value = ENCODER.encodeToString(raw);
		Instant expiresAt = Instant.now().plus(properties.jwt().refreshTokenTtl());

		RefreshToken token = new RefreshToken();
		token.setUser(user);
		token.setTokenHash(sha256(value));
		token.setExpiresAt(expiresAt);
		refreshTokens.save(token);

		return new IssuedToken(value, expiresAt);
	}

	/**
	 * Rotation, not reuse: the presented token is revoked and a new one issued in
	 * the same transaction. A stolen token is then good for one use at most, and
	 * whoever gets there second is detected.
	 *
	 * <p>That detection is the {@code revokedAt != null} branch. A token presented
	 * after it was already rotated means either a replay or a leak, so every token
	 * the user holds is revoked and they sign in again.
	 *
	 * <p>{@code noRollbackFor} is what makes that revocation stick. Spring rolls
	 * back on any unchecked exception by default, so throwing right after the
	 * bulk update would undo it and the attacker would keep the session — the
	 * failure is silent, and the test that catches it is the one that presents
	 * the *replacement* token afterwards. Nothing is written on the other two
	 * failure paths, so committing them costs nothing.
	 */
	@Transactional(noRollbackFor = ApiException.class)
	public RotatedToken rotate(String presented) {
		RefreshToken existing = refreshTokens.findByTokenHashWithUser(sha256(presented))
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, INVALID));

		Instant now = Instant.now();
		if (existing.getRevokedAt() != null) {
			log.warn("Refresh token reuse detected for user {}; revoking every session",
					existing.getUser().getId());
			refreshTokens.revokeAllForUser(existing.getUser().getId(), now);
			throw new ApiException(HttpStatus.UNAUTHORIZED, INVALID);
		}
		if (existing.getExpiresAt().isBefore(now)) {
			throw new ApiException(HttpStatus.UNAUTHORIZED, INVALID);
		}

		existing.setRevokedAt(now);
		refreshTokens.save(existing);

		User user = existing.getUser();
		return new RotatedToken(user, issue(user));
	}

	/**
	 * FR-1.6. Idempotent on purpose: logging out twice, or with a token that was
	 * already rotated away, is not an error the client can act on — and answering
	 * differently would tell an unauthenticated caller which tokens are real.
	 */
	@Transactional
	public void revoke(String presented) {
		Optional<RefreshToken> token = refreshTokens.findByTokenHash(sha256(presented));
		token.filter(candidate -> candidate.getRevokedAt() == null).ifPresent(candidate -> {
			candidate.setRevokedAt(Instant.now());
			refreshTokens.save(candidate);
		});
	}

	/** Hex, so it fits the {@code VARCHAR(64)} the migration declares. */
	private static String sha256(String value) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException e) {
			// Every JVM ships SHA-256; this is unreachable.
			throw new IllegalStateException("SHA-256 is unavailable", e);
		}
	}
}
