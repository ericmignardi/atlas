package com.ericmignardi.atlas.environment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ericmignardi.atlas.project.dto.ProjectCountRow;

public interface EnvironmentRepository extends JpaRepository<Environment, UUID> {

	List<Environment> findByProjectIdOrderByTypeAscNameAsc(UUID projectId);

	@Query("SELECT e FROM Environment e WHERE e.id = :id AND e.project.user.id = :userId")
	Optional<Environment> findByIdAndUserId(UUID id, UUID userId);

	/**
	 * The fetch join keeps a project with twelve environments at one query rather
	 * than thirteen (NFR-1.2). No ORDER BY: both enums persist as strings, so the
	 * database would sort DEVELOPMENT ahead of PRODUCTION, and the display order
	 * of FR-3.5 is the declaration order.
	 */
	@Query("""
			SELECT e FROM Environment e
			LEFT JOIN FETCH e.pairedWith
			WHERE e.project.id = :projectId AND e.project.user.id = :userId
			  AND (:type IS NULL OR e.type = :type)
			  AND (:platform IS NULL OR e.platform = :platform)
			""")
	List<Environment> findForProject(UUID projectId, UUID userId, EnvironmentType type,
			Platform platform);

	/** FR-3.11: before A can point at B, whoever points at B has to let go. */
	Optional<Environment> findByPairedWithId(UUID pairedWithId);

	long countByProjectId(UUID projectId);

	/** Every project's environment count in one query (NFR-1.2). */
	@Query("""
			SELECT new com.ericmignardi.atlas.project.dto.ProjectCountRow(e.project.id, COUNT(e))
			FROM Environment e
			WHERE e.project.user.id = :userId
			GROUP BY e.project.id
			""")
	List<ProjectCountRow> countByProjectForUser(UUID userId);
}
