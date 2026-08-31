package com.ericmignardi.atlas.environment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ericmignardi.atlas.project.dto.ProjectCountRow;

/**
 * An environment is owned transitively — through its project's user — so the
 * scoped lookups join up one level rather than carrying a user_id column that
 * would only be able to disagree with the project's.
 */
public interface EnvironmentRepository extends JpaRepository<Environment, UUID> {

	List<Environment> findByProjectIdOrderByTypeAscNameAsc(UUID projectId);

	@Query("SELECT e FROM Environment e WHERE e.id = :id AND e.project.user.id = :userId")
	Optional<Environment> findByIdAndUserId(UUID id, UUID userId);

	/**
	 * The other half of a pair, found from the inverse side. Used by the
	 * release-before-assign step (FR-3.11): before A can point at B, whoever is
	 * currently pointing at B has to let go, or the UNIQUE constraint rejects
	 * the update.
	 */
	Optional<Environment> findByPairedWithId(UUID pairedWithId);

	long countByProjectId(UUID projectId);

	/** Every project's environment count in one query, for the list view. */
	@Query("""
			SELECT new com.ericmignardi.atlas.project.dto.ProjectCountRow(e.project.id, COUNT(e))
			FROM Environment e
			WHERE e.project.user.id = :userId
			GROUP BY e.project.id
			""")
	List<ProjectCountRow> countByProjectForUser(UUID userId);
}
