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
	 * Returns null when the column is empty — an aggregate over no rows is null,
	 * not zero — which is why the return type is the boxed Integer. A new task
	 * takes this minus one and lands on top without renumbering (FR-4.7).
	 */
	@Query("SELECT MIN(t.sortOrder) FROM Task t WHERE t.user.id = :userId AND t.status = :status")
	Integer findMinSortOrder(UUID userId, TaskStatus status);

	long countByProjectIdAndStatusNot(UUID projectId, TaskStatus status);

	long countByProjectIdAndStatusNotAndDueDateBefore(UUID projectId, TaskStatus status, Instant before);

	/**
	 * Open tasks per project, for the project list. Grouped rather than counted
	 * per row: twenty projects would otherwise mean twenty round trips for a
	 * number that appears on a card (NFR-1.2).
	 */
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
