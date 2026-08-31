package com.ericmignardi.atlas.task.dto;

import com.ericmignardi.atlas.task.TaskStatus;

import jakarta.validation.constraints.NotNull;

/** FR-4.8. Plain fields: a PUT with half its body missing is not a partial update. */
public record MoveTaskRequest(

		@NotNull(message = "must not be null")
		TaskStatus status,

		@NotNull(message = "must not be null")
		Integer sortOrder) {
}
