package com.ericmignardi.atlas.task.dto;

import java.time.Instant;
import java.util.UUID;

import org.openapitools.jackson.nullable.JsonNullable;

import com.ericmignardi.atlas.task.TaskPriority;
import com.ericmignardi.atlas.task.TaskStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * A class, not a record, because every field has to default to
 * {@code undefined()}. {@code completedAt} and {@code sortOrder} are absent for
 * the same reason as on the create request (FR-4.6, FR-4.7).
 */
@Getter
@Setter
public class UpdateTaskRequest {

	@NotBlank(message = "must not be blank")
	@Size(max = 200, message = "must be at most 200 characters")
	private JsonNullable<String> title = JsonNullable.undefined();

	@Size(max = 4000, message = "must be at most 4000 characters")
	private JsonNullable<String> description = JsonNullable.undefined();

	/** FR-4.6: crossing the DONE boundary stamps or clears completed_at. */
	@NotNull(message = "must not be null")
	private JsonNullable<TaskStatus> status = JsonNullable.undefined();

	@NotNull(message = "must not be null")
	private JsonNullable<TaskPriority> priority = JsonNullable.undefined();

	private JsonNullable<Instant> dueDate = JsonNullable.undefined();

	/** FR-4.5: an explicit null moves the task to Unassigned. */
	private JsonNullable<UUID> projectId = JsonNullable.undefined();
}
