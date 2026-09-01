package com.ericmignardi.atlas.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.ericmignardi.atlas.config.AtlasProperties;
import com.ericmignardi.atlas.user.User;

import io.jsonwebtoken.Claims;

/**
 * No Spring context: the class takes its configuration through the constructor,
 * which is the point of {@link AtlasProperties}.
 */
class JwtServiceTest {

	private static final String SECRET = "a-test-signing-key-that-is-comfortably-over-32-bytes";

	private final JwtService jwtService = serviceWith(SECRET, Duration.ofMinutes(15));

	private static JwtService serviceWith(String secret, Duration accessTtl) {
		return new JwtService(new AtlasProperties(
				new AtlasProperties.Jwt(secret, accessTtl, Duration.ofDays(7)),
				new AtlasProperties.Cors("http://localhost:5173")));
	}

	private static User user() {
		User user = new User();
		user.setId(UUID.randomUUID());
		user.setEmail("owner@example.com");
		user.setPasswordHash("irrelevant");
		return user;
	}

	@Test
	void refusesToStartWithASecretShorterThan256Bits() {
		assertThatThrownBy(() -> serviceWith("too-short", Duration.ofMinutes(15)))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("at least 256 bits")
				.hasMessageContaining("JWT_SECRET");
	}

	@Test
	void roundTripsTheSubjectEmailAndRoles() {
		User user = user();

		Claims claims = jwtService.parse(jwtService.generateAccessToken(user)).orElseThrow();

		assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
		assertThat(jwtService.email(claims)).isEqualTo("owner@example.com");
		assertThat(jwtService.roles(claims)).isEqualTo(List.of("ROLE_USER"));
		assertThat(claims.getExpiration()).isAfter(claims.getIssuedAt());
	}

	@Test
	void rejectsATokenWhoseSignatureDoesNotMatch() {
		String token = jwtService.generateAccessToken(user());
		JwtService other = serviceWith("a-completely-different-key-also-over-32-bytes-long",
				Duration.ofMinutes(15));

		assertThat(other.parse(token)).isEmpty();
	}

	/** The payload is readable, so flipping a claim is trivial; the signature is what stops it. */
	@Test
	void rejectsATokenWithAnEditedPayload() {
		String token = jwtService.generateAccessToken(user());
		String[] parts = token.split("[.]");
		String tampered = parts[0] + "." + parts[1].substring(0, parts[1].length() - 2) + "AB."
				+ parts[2];

		assertThat(jwtService.parse(tampered)).isEmpty();
	}

	@Test
	void rejectsAnExpiredToken() {
		JwtService alreadyExpired = serviceWith(SECRET, Duration.ofSeconds(-1));

		assertThat(jwtService.parse(alreadyExpired.generateAccessToken(user()))).isEmpty();
	}

	@Test
	void rejectsSomethingThatIsNotAToken() {
		assertThat(jwtService.parse("not-a-jwt")).isEmpty();
		assertThat(jwtService.parse("")).isEmpty();
	}

	@Test
	void reportsTheConfiguredAccessTokenTtl() {
		assertThat(jwtService.accessTokenTtl()).isEqualTo(Duration.ofMinutes(15));
	}
}
