package com.ericmignardi.atlas.task.dto;

import java.util.UUID;

import com.ericmignardi.atlas.task.TaskPriority;
import com.ericmignardi.atlas.task.TaskStatus;

/**
 * FR-4.13, FR-4.14. {@code includeCompleted} is boxed, not primitive: an absent
 * query parameter binds as null, and constructor binding has nowhere to put a
 * null in a {@code boolean}.
 */
public record TaskFilter(
		UUID projectId,
		TaskStatus status,
		TaskPriority priority,
		Boolean includeCompleted,
		String sort) {

	public boolean completedVisible() {
		return Boolean.TRUE.equals(includeCompleted) || status == TaskStatus.DONE;
	}

	public TaskSort order() {
		return TaskSort.from(sort);
	}
}
