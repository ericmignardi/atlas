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
	 *
	 * <p>The tag filter is an EXISTS subquery rather than a condition on the
	 * fetched join. A condition there would narrow the <em>fetched collection</em>
	 * as well as the result set, and every returned project would come back
	 * carrying only the one tag that was searched for — the classic way to
	 * corrupt an entity by filtering a fetch join.
	 *
	 * <p>{@code q} arrives pre-wrapped in wildcards and lower-cased; doing it in
	 * the query would need a second parameter binding for the same value.
	 */
	@Query("""
			SELECT DISTINCT p FROM Project p
			LEFT JOIN FETCH p.tags pt
			LEFT JOIN FETCH pt.tag
			WHERE p.user.id = :userId
			  AND (:includeArchived = true OR p.status <> com.ericmignardi.atlas.project.ProjectStatus.ARCHIVED)
			  AND (:status IS NULL OR p.status = :status)
			  AND (:tag IS NULL OR EXISTS (
			        SELECT 1 FROM ProjectTag f WHERE f.project = p AND f.tag.name = :tag))
			  AND (:q IS NULL
			        OR LOWER(p.name) LIKE :q
			        OR LOWER(p.client) LIKE :q
			        OR LOWER(p.description) LIKE :q)
			""")
	List<Project> search(UUID userId, boolean includeArchived, ProjectStatus status, String tag, String q);

	/** The unfiltered list, which is the common case and the one the tests pin. */
	default List<Project> findAllForUser(UUID userId, boolean includeArchived) {
		return search(userId, includeArchived, null, null, null);
	}
}
