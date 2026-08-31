package com.ericmignardi.atlas.user;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/**
 * Refresh tokens are looked up by hash — never by the raw token, which is not
 * stored. Day 5 uses {@code revokeAllForUser} for logout-everywhere and for the
 * reuse-detection response.
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

	Optional<RefreshToken> findByTokenHash(String tokenHash);

	@Modifying
	@Query("UPDATE RefreshToken t SET t.revokedAt = :now WHERE t.user.id = :userId AND t.revokedAt IS NULL")
	int revokeAllForUser(UUID userId, Instant now);

	@Modifying
	@Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :cutoff")
	int deleteExpiredBefore(Instant cutoff);
}
