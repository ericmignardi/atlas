package com.ericmignardi.atlas.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;

class UserRepositoryTest extends AbstractIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private RefreshTokenRepository refreshTokenRepository;

	@BeforeEach
	void reset() {
		userRepository.deleteAll();
	}

	@Test
	void savesAndReloadsAUser() {
		User saved = userRepository.save(TestFixtures.user("Eric@Example.COM"));

		User reloaded = userRepository.findById(saved.getId()).orElseThrow();

		assertThat(reloaded.getEmail()).isEqualTo("Eric@Example.COM");
		assertThat(reloaded.getDisplayName()).isEqualTo("Test User");
		assertThat(reloaded.getRoles()).isEqualTo("ROLE_USER");
		assertThat(reloaded.isEnabled()).isTrue();
	}

	@Test
	void populatesBothAuditColumnsOnInsert() {
		User saved = userRepository.save(TestFixtures.user());

		// Proves @EnableJpaAuditing is actually switched on: without it these
		// stay null and the NOT NULL constraint rejects the insert instead.
		assertThat(saved.getCreatedAt()).isNotNull();
		assertThat(saved.getUpdatedAt()).isNotNull();
	}

	@Test
	void rejectsATwoCaseDuplicateOfTheSameEmail() {
		userRepository.save(TestFixtures.user("eric@example.com"));

		// The unique index is on lower(email), so a different casing is the
		// same account and the database is what says so.
		assertThatThrownBy(() -> userRepository.saveAndFlush(TestFixtures.user("ERIC@example.com")))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void findsAUserByEmailIgnoringCase() {
		userRepository.save(TestFixtures.user("eric@example.com"));

		assertThat(userRepository.findByEmailIgnoreCase("ERIC@EXAMPLE.COM")).isPresent();
		assertThat(userRepository.existsByEmailIgnoreCase("Eric@Example.com")).isTrue();
		assertThat(userRepository.findByEmailIgnoreCase("someone@example.com")).isEmpty();
	}

	@Test
	void deletingAUserCascadesToTheirRefreshTokens() {
		User user = userRepository.save(TestFixtures.user());
		RefreshToken token = new RefreshToken();
		token.setUser(user);
		token.setTokenHash("a".repeat(64));
		token.setExpiresAt(Instant.now().plus(7, ChronoUnit.DAYS));
		refreshTokenRepository.save(token);

		userRepository.delete(user);

		assertThat(refreshTokenRepository.count()).isZero();
	}
}
