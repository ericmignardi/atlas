package com.ericmignardi.atlas.task;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ericmignardi.atlas.project.dto.ProjectCountRow;

public interface TaskRepository extends JpaRepository<Task, UUID> {

	Optional<Task> findByIdAndUserId(UUID id, UUID userId);

	List<Task> findByUserIdOrderByStatusAscSortOrderAsc(UUID userId);

	List<Task> findByUserIdAndProjectIdOrderBySortOrderAsc(UUID userId, UUID projectId);

	List<Task> findByUserIdAndStatusNotAndDueDateBeforeOrderByDueDateAsc(
			UUID userId, TaskStatus status, Instant before);

	/**
	 * FR-4.13, FR-4.14. The join is aliased and the project filter written
	 * against the alias: {@code t.project.id} would be an inner join through a
	 * nullable association, and every unassigned task would vanish from the
	 * unfiltered list (FR-4.5).
	 */
	@Query("""
			SELECT t FROM Task t
			LEFT JOIN FETCH t.project p
			WHERE t.user.id = :userId
			  AND (:projectId IS NULL OR p.id = :projectId)
			  AND (:status IS NULL OR t.status = :status)
			  AND (:priority IS NULL OR t.priority = :priority)
			  AND (:includeCompleted = TRUE OR t.status <> com.ericmignardi.atlas.task.TaskStatus.DONE)
			""")
	List<Task> search(UUID userId, UUID projectId, TaskStatus status, TaskPriority priority,
			boolean includeCompleted);

	/** FR-4.11, with the Done column narrowed to FR-4.12's seven-day window. */
	@Query("""
			SELECT t FROM Task t
			LEFT JOIN FETCH t.project p
			WHERE t.user.id = :userId
			  AND (:projectId IS NULL OR p.id = :projectId)
			  AND (t.status <> com.ericmignardi.atlas.task.TaskStatus.DONE
			       OR (t.completedAt IS NOT NULL AND t.completedAt >= :doneSince))
			ORDER BY t.sortOrder ASC
			""")
	List<Task> findBoard(UUID userId, UUID projectId, Instant doneSince);

	/** FR-4.10's candidate set; the three-way split is timezone-dependent and happens in the service. */
	@Query("""
			SELECT t FROM Task t
			LEFT JOIN FETCH t.project
			WHERE t.user.id = :userId
			  AND t.status <> com.ericmignardi.atlas.task.TaskStatus.DONE
			  AND t.dueDate IS NOT NULL AND t.dueDate < :horizon
			ORDER BY t.dueDate ASC
			""")
	List<Task> findOpenDueBefore(UUID userId, Instant horizon);

	/**
	 * Returns null when the column is empty — an aggregate over no rows is null,
	 * not zero — which is why the return type is the boxed Integer (FR-4.7).
	 */
	@Query("SELECT MIN(t.sortOrder) FROM Task t WHERE t.user.id = :userId AND t.status = :status")
	Integer findMinSortOrder(UUID userId, TaskStatus status);

	long countByProjectIdAndStatusNot(UUID projectId, TaskStatus status);

	long countByProjectIdAndStatusNotAndDueDateBefore(UUID projectId, TaskStatus status, Instant before);

	/** Open tasks per project, grouped rather than counted per row (NFR-1.2). */
	@Query("""
			SELECT new com.ericmignardi.atlas.project.dto.ProjectCountRow(t.project.id, COUNT(t))
			FROM Task t
			WHERE t.user.id = :userId AND t.project IS NOT NULL AND t.status <> com.ericmignardi.atlas.task.TaskStatus.DONE
			GROUP BY t.project.id
			""")
	List<ProjectCountRow> countOpenByProjectForUser(UUID userId);

	/** The same, narrowed to what is past its due date (FR-4.11). */
	@Query("""
			SELECT new com.ericmignardi.atlas.project.dto.ProjectCountRow(t.project.id, COUNT(t))
			FROM Task t
			WHERE t.user.id = :userId AND t.project IS NOT NULL AND t.status <> com.ericmignardi.atlas.task.TaskStatus.DONE
			  AND t.dueDate < :before
			GROUP BY t.project.id
			""")
	List<ProjectCountRow> countOverdueByProjectForUser(UUID userId, Instant before);
}
