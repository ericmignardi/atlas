package com.ericmignardi.atlas.tag;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ericmignardi.atlas.tag.dto.TagUsage;

/**
 * {@code project_tags} has no repository of its own: the join rows are only ever
 * reached through {@code Project.getTags()}, which cascades them.
 */
public interface TagRepository extends JpaRepository<Tag, UUID> {

	Optional<Tag> findByIdAndUserId(UUID id, UUID userId);

	Optional<Tag> findByUserIdAndName(UUID userId, String name);

	List<Tag> findByUserIdOrderByNameAsc(UUID userId);

	/** The autocomplete behind FR-5.10. */
	List<Tag> findByUserIdAndNameContainingIgnoreCaseOrderByNameAsc(UUID userId, String fragment);

	/** The palette cycle of FR-5.4 is a function of this number. */
	long countByUserId(UUID userId);

	List<Tag> findByIdInAndUserId(List<UUID> ids, UUID userId);

	/**
	 * FR-5.6 in one query. Tags used by nothing are absent from the result rather
	 * than present with a zero — an inner join cannot produce a row for them — so
	 * the caller defaults a miss to zero.
	 */
	@Query("""
			SELECT new com.ericmignardi.atlas.tag.dto.TagUsage(pt.tag.id, COUNT(pt))
			FROM ProjectTag pt
			WHERE pt.tag.user.id = :userId
			GROUP BY pt.tag.id
			""")
	List<TagUsage> countUsageForUser(UUID userId);

	@Query("SELECT COUNT(pt) FROM ProjectTag pt WHERE pt.tag.id = :tagId")
	long countUsageForTag(UUID tagId);
}
