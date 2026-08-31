package com.ericmignardi.atlas.project;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Note {@code findByIdAndUserId} rather than {@code findById}. <em>Every</em>
 * lookup carries the user id, so ownership (FR-1.9) is enforced at the lowest
 * layer and a service that forgets to check cannot leak another user's row —
 * it simply gets an empty Optional and returns 404.
 */
public interface ProjectRepository extends JpaRepository<Project, UUID> {

	Optional<Project> findByIdAndUserId(UUID id, UUID userId);

	Optional<Project> findBySlugAndUserId(String slug, UUID userId);

	/** Backs slug de-duplication: "atlas" taken means the next one is "atlas-2". */
	List<Project> findByUserIdAndSlugStartingWith(UUID userId, String slugPrefix);

	long countByUserIdAndPinnedTrue(UUID userId);

	/**
	 * The list view in one query. The JOIN FETCHes are the point: without them
	 * rendering N projects with their tags costs 1 + 2N queries (NFR-1.2).
	 * DISTINCT is needed because the join multiplies each project by its tag
	 * count.
	 */
	@Query("""
			SELECT DISTINCT p FROM Project p
			LEFT JOIN FETCH p.tags t
			LEFT JOIN FETCH t.tag
			WHERE p.user.id = :userId
			  AND (:includeArchived = true OR p.status <> 'ARCHIVED')
			ORDER BY p.updatedAt DESC
			""")
	List<Project> findAllForUser(UUID userId, boolean includeArchived);
}
