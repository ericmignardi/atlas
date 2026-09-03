package com.ericmignardi.atlas.project;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * FR-1.9 is enforced at the lowest layer: every lookup carries the user id, so a
 * service that forgets to check gets an empty Optional and returns 404.
 */
public interface ProjectRepository extends JpaRepository<Project, UUID> {

	Optional<Project> findByIdAndUserId(UUID id, UUID userId);

	Optional<Project> findBySlugAndUserId(String slug, UUID userId);

	/** FR-2.4: "atlas" taken means the next one is "atlas-2". */
	List<Project> findByUserIdAndSlugStartingWith(UUID userId, String slugPrefix);

	long countByUserIdAndPinnedTrue(UUID userId);

	long countByUserId(UUID userId);

	/** FR-6.1 and FR-6.5: the tile and the header are counting the same thing. */
	long countByUserIdAndStatus(UUID userId, ProjectStatus status);

	/**
	 * FR-6.2. The tags come along because the dashboard card shows them, and four
	 * projects fetched with their tags is one query rather than five.
	 */
	@Query("""
			SELECT DISTINCT p FROM Project p
			LEFT JOIN FETCH p.tags pt
			LEFT JOIN FETCH pt.tag
			WHERE p.user.id = :userId AND p.pinned = TRUE
			""")
	List<Project> findPinnedForUser(UUID userId);

	/**
	 * FR-7.2, capped at five by the caller's {@link Limit}. Archived projects are
	 * excluded because FR-2.7 keeps them out of search.
	 *
	 * <p>No {@code JOIN FETCH} here, unlike {@link #search}: a palette row shows a
	 * name and a status and no tags, and a fetched collection under a row limit
	 * forces Hibernate to read the whole result set and page it in memory.
	 *
	 * <p>{@code q} arrives pre-wrapped in wildcards and lower-cased.
	 */
	@Query("""
			SELECT p FROM Project p
			WHERE p.user.id = :userId
			  AND p.status <> com.ericmignardi.atlas.project.ProjectStatus.ARCHIVED
			  AND (LOWER(p.name) LIKE :q
			        OR LOWER(p.client) LIKE :q
			        OR LOWER(p.description) LIKE :q)
			ORDER BY p.name ASC
			""")
	List<Project> searchByText(UUID userId, String q, Limit limit);

	/**
	 * The JOIN FETCHes keep rendering N projects with their tags at one query
	 * rather than 1 + 2N (NFR-1.2). DISTINCT because the join multiplies each
	 * project by its tag count.
	 *
	 * <p>The tag filter is an EXISTS subquery rather than a condition on the
	 * fetched join: a condition there would narrow the fetched collection as well
	 * as the result set, and every returned project would come back carrying only
	 * the one tag that was searched for.
	 *
	 * <p>{@code q} arrives pre-wrapped in wildcards and lower-cased.
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

	default List<Project> findAllForUser(UUID userId, boolean includeArchived) {
		return search(userId, includeArchived, null, null, null);
	}
}
