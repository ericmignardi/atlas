package com.ericmignardi.atlas.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Service;

import com.ericmignardi.atlas.config.AtlasProperties;
import com.ericmignardi.atlas.user.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;

/**
 * Signs and verifies the access token (FR-1.4). Refresh tokens are not JWTs —
 * see {@link com.ericmignardi.atlas.user.RefreshTokenService} for why.
 *
 * <p>Everything this class can reject — expired, tampered, malformed, signed
 * with another key — comes back as an empty {@link Optional}. The filter turns
 * that into "no authentication", and the authorization layer turns *that* into
 * a 401. One component decides the status code.
 */
@Service
public class JwtService {

	/**
	 * 256 bits, per NFR-2.2. Checked in the constructor so a misconfigured
	 * deployment dies at startup rather than at the first login, when the person
	 * who deployed it has moved on.
	 */
	private static final int MINIMUM_SECRET_BYTES = 32;

	/** The JCA name for HS256. Matching it exactly is what stops jjwt inferring HS512. */
	private static final String HS256_JCA_NAME = "HmacSHA256";

	private static final String ROLES_CLAIM = "roles";
	private static final String EMAIL_CLAIM = "email";

	private final SecretKey key;
	private final Duration accessTtl;

	public JwtService(AtlasProperties properties) {
		byte[] secret = properties.jwt().secret().getBytes(StandardCharsets.UTF_8);
		if (secret.length < MINIMUM_SECRET_BYTES) {
			throw new IllegalStateException(
					"atlas.jwt.secret must be at least 256 bits (32 bytes); it is "
							+ (secret.length * 8) + " bits. Set JWT_SECRET, e.g. `openssl rand -base64 48`.");
		}
		// Built by hand rather than with Keys.hmacShaKeyFor, which infers the
		// algorithm from the key length and would quietly sign with HS512 given a
		// 64-byte secret. FR-1.4 says HS256, so the algorithm is pinned in the
		// key and again at signing time.
		this.key = new SecretKeySpec(secret, HS256_JCA_NAME);
		this.accessTtl = properties.jwt().accessTokenTtl();
	}

	public Duration accessTokenTtl() {
		return accessTtl;
	}

	/**
	 * The payload is base64, not encrypted: anyone holding the token can read
	 * the claims. Nothing secret goes in — an id, an email the holder already
	 * knows, and the roles the server would grant anyway.
	 */
	public String generateAccessToken(User user) {
		Instant now = Instant.now();
		return Jwts.builder()
				.subject(user.getId().toString())
				.claim(EMAIL_CLAIM, user.getEmail())
				.claim(ROLES_CLAIM, user.roleNames())
				.issuedAt(Date.from(now))
				.expiration(Date.from(now.plus(accessTtl)))
				.signWith(key, Jwts.SIG.HS256)
				.compact();
	}

	/** Empty means expired, tampered with, or not a token at all. */
	public Optional<Claims> parse(String token) {
		try {
			return Optional.of(Jwts.parser()
					.verifyWith(key)
					.build()
					.parseSignedClaims(token)
					.getPayload());
		} catch (JwtException | IllegalArgumentException e) {
			return Optional.empty();
		}
	}

	/**
	 * Claims are strings on the wire, so the list comes back as {@code ?}. A
	 * token that has been through {@link #parse(String)} is signed by this
	 * server, so the shape is ours — but the cast is still guarded.
	 */
	public List<String> roles(Claims claims) {
		Object raw = claims.get(ROLES_CLAIM);
		if (raw instanceof List<?> list) {
			return list.stream().filter(String.class::isInstance).map(String.class::cast).toList();
		}
		return List.of();
	}

	public String email(Claims claims) {
		return claims.get(EMAIL_CLAIM, String.class);
	}
}
