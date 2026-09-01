package com.ericmignardi.atlas.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.common.error.ApiException;
import com.ericmignardi.atlas.user.RefreshTokenService.IssuedToken;

/** PRD 5.7: the storage rule the endpoint tests cannot see from outside. */
class RefreshTokenServiceIT extends AbstractIntegrationTest {

	@Autowired
	private RefreshTokenService refreshTokenService;

	@Autowired
	private RefreshTokenRepository refreshTokens;

	@Autowired
	private UserRepository users;

	private User user;

	@BeforeEach
	void reset() {
		users.deleteAll();
		user = users.save(TestFixtures.user("token-owner@example.com"));
	}

	/**
	 * The whole point of hashing the token: a dump of this table hands an
	 * attacker nothing they can present to the API.
	 */
	@Test
	void storesOnlyTheHashNeverTheTokenItself() {
		IssuedToken issued = refreshTokenService.issue(user);

		RefreshToken stored = refreshTokens.findAll().get(0);
		assertThat(stored.getTokenHash()).hasSize(64).isNotEqualTo(issued.value());
		assertThat(refreshTokens.findByTokenHash(issued.value())).isEmpty();
		assertThat(issued.expiresAt()).isAfter(Instant.now().plus(6, ChronoUnit.DAYS));
	}

	/** 256 bits of SecureRandom, so two tokens never collide. */
	@Test
	void issuesADistinctOpaqueTokenEveryTime() {
		assertThat(refreshTokenService.issue(user).value())
				.isNotEqualTo(refreshTokenService.issue(user).value());
		// Opaque, not a JWT: no dots, nothing to decode.
		assertThat(refreshTokenService.issue(user).value()).doesNotContain(".");
	}

	@Test
	void rejectsAnExpiredToken() {
		IssuedToken issued = refreshTokenService.issue(user);
		RefreshToken stored = refreshTokens.findAll().get(0);
		stored.setExpiresAt(Instant.now().minusSeconds(1));
		refreshTokens.save(stored);

		assertThatThrownBy(() -> refreshTokenService.rotate(issued.value()))
				.isInstanceOf(ApiException.class)
				.extracting(exception -> ((ApiException) exception).getStatus())
				.isEqualTo(HttpStatus.UNAUTHORIZED);
	}

	/** FR-1.6, and idempotent: a second logout is not an error. */
	@Test
	void revokeIsIdempotentAndSurvivesAnUnknownToken() {
		IssuedToken issued = refreshTokenService.issue(user);

		refreshTokenService.revoke(issued.value());
		Instant firstRevocation = refreshTokens.findAll().get(0).getRevokedAt();
		refreshTokenService.revoke(issued.value());
		refreshTokenService.revoke("a-token-that-was-never-issued");

		assertThat(refreshTokens.findAll().get(0).getRevokedAt()).isEqualTo(firstRevocation);
	}
}
