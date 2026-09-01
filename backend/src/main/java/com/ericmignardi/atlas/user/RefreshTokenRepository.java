package com.ericmignardi.atlas.user;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

/**
 * Refresh tokens are looked up by hash — never by the raw token, which is not
 * stored. {@code revokeAllForUser} is the reuse-detection response: a rotated
 * token presented a second time means a replay or a leak, and neither is safe
 * to keep any session alive through.
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

	Optional<RefreshToken> findByTokenHash(String tokenHash);

	/**
	 * The owner comes back in the same query. The {@code @ManyToOne} is lazy, so
	 * without the fetch join the caller gets a proxy that only resolves while the
	 * transaction is still open — and rotation hands its result to a caller that
	 * has left it.
	 */
	@Query("SELECT t FROM RefreshToken t JOIN FETCH t.user WHERE t.tokenHash = :tokenHash")
	Optional<RefreshToken> findByTokenHashWithUser(String tokenHash);

	@Modifying
	@Query("UPDATE RefreshToken t SET t.revokedAt = :now WHERE t.user.id = :userId AND t.revokedAt IS NULL")
	int revokeAllForUser(UUID userId, Instant now);

	@Modifying
	@Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :cutoff")
	int deleteExpiredBefore(Instant cutoff);
}
