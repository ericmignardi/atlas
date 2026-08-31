package com.ericmignardi.atlas.task.dto;

import java.time.Instant;
import java.util.UUID;

import com.ericmignardi.atlas.task.TaskPriority;
import com.ericmignardi.atlas.task.TaskStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code completedAt} and {@code sortOrder} are absent on purpose. Leaving them
 * out is stronger than accepting and discarding them: there is no field to
 * forget to ignore, so FR-4.6 and FR-4.7 hold by construction.
 */
public record CreateTaskRequest(

		@NotBlank(message = "must not be blank")
		@Size(max = 200, message = "must be at most 200 characters")
		String title,

		@Size(max = 4000, message = "must be at most 4000 characters")
		String description,

		/** FR-4.3: null takes the default of TODO. */
		TaskStatus status,

		/** FR-4.4: null takes the default of MEDIUM. */
		TaskPriority priority,

		Instant dueDate,

		/** FR-4.5. Optional; must belong to the caller when supplied. */
		UUID projectId) {
}
