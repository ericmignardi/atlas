package com.ericmignardi.atlas.task;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

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
}
