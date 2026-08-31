package com.ericmignardi.atlas.task;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ericmignardi.atlas.security.CurrentUser;
import com.ericmignardi.atlas.security.UserPrincipal;
import com.ericmignardi.atlas.task.dto.BoardResponse;
import com.ericmignardi.atlas.task.dto.CreateTaskRequest;
import com.ericmignardi.atlas.task.dto.MoveTaskRequest;
import com.ericmignardi.atlas.task.dto.NeedsAttention;
import com.ericmignardi.atlas.task.dto.TaskFilter;
import com.ericmignardi.atlas.task.dto.TaskResponse;
import com.ericmignardi.atlas.task.dto.UpdateTaskRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@Tag(name = "Tasks", description = "The board, the list, and what needs attention")
public class TaskController {

	private final TaskService taskService;

	@GetMapping
	@Operation(summary = "List tasks, filtered and sorted")
	public List<TaskResponse> list(@CurrentUser UserPrincipal user,
			@ModelAttribute TaskFilter filter) {

		return taskService.list(user.id(), filter);
	}

	@GetMapping("/board")
	@Operation(summary = "The four board columns; Done holds only the last seven days")
	public BoardResponse board(@CurrentUser UserPrincipal user,
			@RequestParam(required = false) UUID projectId) {

		return taskService.board(user.id(), projectId);
	}

	@GetMapping("/needs-attention")
	@Operation(summary = "Open tasks due within eight days, split into overdue, today, and soon")
	public NeedsAttention needsAttention(@CurrentUser UserPrincipal user) {
		return taskService.needsAttention(user.id());
	}

	@PostMapping
	@Operation(summary = "Create a task at the top of its column")
	public ResponseEntity<TaskResponse> create(@CurrentUser UserPrincipal user,
			@Valid @RequestBody CreateTaskRequest request) {

		TaskResponse created = taskService.create(user.id(), request);
		return ResponseEntity
				.created(URI.create("/api/tasks/" + created.id()))
				.body(created);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get one task")
	public TaskResponse get(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		return taskService.get(user.id(), id);
	}

	@PatchMapping("/{id}")
	@Operation(summary = "Partially update a task; an absent key changes nothing")
	public TaskResponse update(@CurrentUser UserPrincipal user, @PathVariable UUID id,
			@Valid @RequestBody UpdateTaskRequest request) {

		return taskService.update(user.id(), id, request);
	}

	/** FR-4.8. Status and position in one call, persisted immediately. */
	@PutMapping("/{id}/move")
	@Operation(summary = "Move a task to a new column and position in one operation")
	public TaskResponse move(@CurrentUser UserPrincipal user, @PathVariable UUID id,
			@Valid @RequestBody MoveTaskRequest request) {

		return taskService.move(user.id(), id, request);
	}

	@DeleteMapping("/{id}")
	@Operation(summary = "Delete a task")
	public ResponseEntity<Void> delete(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		taskService.delete(user.id(), id);
		return ResponseEntity.noContent().build();
	}
}
