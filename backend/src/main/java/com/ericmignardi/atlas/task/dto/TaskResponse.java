package com.ericmignardi.atlas.task.dto;

import java.time.Instant;
import java.util.UUID;

import com.ericmignardi.atlas.project.dto.ProjectSummary;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskPriority;
import com.ericmignardi.atlas.task.TaskStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

public record TaskResponse(
		UUID id,
		String title,
		String description,
		TaskStatus status,
		TaskPriority priority,
		Instant dueDate,
		int sortOrder,

		/** FR-4.6. Reported, never accepted. */
		Instant completedAt,

		/** FR-4.9, derived rather than stored: it depends on the current time. */
		@JsonProperty("isOverdue") boolean overdue,

		/** FR-4.5. Null for the Unassigned bucket. */
		ProjectSummary project,

		Instant createdAt,
		Instant updatedAt) {

	public static TaskResponse from(Task task, Instant now) {
		return new TaskResponse(
				task.getId(),
				task.getTitle(),
				task.getDescription(),
				task.getStatus(),
				task.getPriority(),
				task.getDueDate(),
				task.getSortOrder(),
				task.getCompletedAt(),
				isOverdue(task, now),
				ProjectSummary.from(task.getProject()),
				task.getCreatedAt(),
				task.getUpdatedAt());
	}

	private static boolean isOverdue(Task task, Instant now) {
		return task.getDueDate() != null
				&& task.getStatus() != TaskStatus.DONE
				&& task.getDueDate().isBefore(now);
	}
}
