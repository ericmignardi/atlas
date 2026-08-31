package com.ericmignardi.atlas.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.common.error.NotFoundException;
import com.ericmignardi.atlas.common.error.ValidationException;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.task.dto.BoardColumn;
import com.ericmignardi.atlas.task.dto.BoardResponse;
import com.ericmignardi.atlas.task.dto.CreateTaskRequest;
import com.ericmignardi.atlas.task.dto.MoveTaskRequest;
import com.ericmignardi.atlas.task.dto.NeedsAttention;
import com.ericmignardi.atlas.task.dto.TaskFilter;
import com.ericmignardi.atlas.task.dto.TaskResponse;
import com.ericmignardi.atlas.task.dto.UpdateTaskRequest;
import com.ericmignardi.atlas.user.UserRepository;

import lombok.RequiredArgsConstructor;

/** FR-4.1 – FR-4.14. */
@Service
@RequiredArgsConstructor
public class TaskService {

	/** FR-4.10. */
	private static final int ATTENTION_HORIZON_DAYS = 8;

	/** FR-4.12. */
	private static final int DONE_WINDOW_DAYS = 7;

	/**
	 * Everything is stored in UTC; only "is this today?" needs a zone, and it has
	 * to be the user's. Fixed for now, and a future per-user setting — a server in
	 * UTC would start calling tasks overdue at eight in the evening, local time.
	 */
	private static final ZoneId USER_ZONE = ZoneId.of("America/Toronto");

	private final TaskRepository tasks;
	private final ProjectRepository projects;
	private final UserRepository users;

	@Transactional(readOnly = true)
	public List<TaskResponse> list(UUID userId, TaskFilter filter) {
		Instant now = Instant.now();

		return tasks.search(userId, filter.projectId(), filter.status(), filter.priority(),
				filter.completedVisible()).stream()
				.sorted(filter.order().comparator())
				.map(task -> TaskResponse.from(task, now))
				.toList();
	}

	@Transactional(readOnly = true)
	public TaskResponse get(UUID userId, UUID id) {
		return TaskResponse.from(require(userId, id), Instant.now());
	}

	/** FR-4.11 and FR-4.12. All four columns, always, in board order. */
	@Transactional(readOnly = true)
	public BoardResponse board(UUID userId, UUID projectId) {
		Instant now = Instant.now();
		Instant doneSince = now.minus(DONE_WINDOW_DAYS, ChronoUnit.DAYS);

		List<Task> found = tasks.findBoard(userId, projectId, doneSince);

		List<BoardColumn> columns = new ArrayList<>();
		for (TaskStatus status : TaskStatus.values()) {
			columns.add(new BoardColumn(status, found.stream()
					.filter(task -> task.getStatus() == status)
					.map(task -> TaskResponse.from(task, now))
					.toList()));
		}
		return new BoardResponse(columns);
	}

	/**
	 * FR-4.10. The boundary is the end of today in the user's zone, converted
	 * back to an instant — comparing the stored UTC timestamp against a UTC
	 * midnight would move the cut-off by five hours.
	 */
	@Transactional(readOnly = true)
	public NeedsAttention needsAttention(UUID userId) {
		Instant now = Instant.now();
		Instant horizon = now.plus(ATTENTION_HORIZON_DAYS, ChronoUnit.DAYS);
		Instant endOfToday = LocalDate.now(USER_ZONE).plusDays(1).atStartOfDay(USER_ZONE).toInstant();

		List<Task> open = tasks.findOpenDueBefore(userId, horizon);

		// Disjoint and exhaustive: every task in the window lands in exactly one
		// bucket, so the three counts add up to the size of the list.
		return new NeedsAttention(
				bucket(open, now, due -> due.isBefore(now)),
				bucket(open, now, due -> !due.isBefore(now) && due.isBefore(endOfToday)),
				bucket(open, now, due -> !due.isBefore(endOfToday)));
	}

	@Transactional
	public TaskResponse create(UUID userId, CreateTaskRequest request) {
		Task task = new Task();
		task.setUser(users.getReferenceById(userId));
		task.setProject(resolveProject(userId, request.projectId()));
		task.setTitle(request.title().trim());
		task.setDescription(blankToNull(request.description()));
		task.setPriority(request.priority() == null ? TaskPriority.MEDIUM : request.priority());
		task.setDueDate(request.dueDate());

		// FR-4.7: the status is applied first, because the minimum that matters
		// is the one in the column the task actually lands in.
		applyStatus(task, request.status() == null ? TaskStatus.TODO : request.status());
		task.setSortOrder(topOfColumn(userId, task.getStatus()));

		return TaskResponse.from(tasks.save(task), Instant.now());
	}

	@Transactional
	public TaskResponse update(UUID userId, UUID id, UpdateTaskRequest request) {
		Task task = require(userId, id);

		request.getTitle().ifPresent(title -> task.setTitle(title.trim()));
		request.getDescription().ifPresent(value -> task.setDescription(blankToNull(value)));
		request.getPriority().ifPresent(task::setPriority);
		request.getDueDate().ifPresent(task::setDueDate);
		request.getProjectId().ifPresent(projectId -> task.setProject(resolveProject(userId, projectId)));

		// A position is only meaningful within one column, so a status change
		// behaves like a move. This is the path the keyboard-accessible status
		// control uses (NFR-4.6).
		request.getStatus().ifPresent(status -> {
			if (status != task.getStatus()) {
				applyStatus(task, status);
				task.setSortOrder(topOfColumn(userId, status));
			}
		});

		return TaskResponse.from(tasks.save(task), Instant.now());
	}

	/** FR-4.8. Column and position together, persisted immediately. */
	@Transactional
	public TaskResponse move(UUID userId, UUID id, MoveTaskRequest request) {
		Task task = require(userId, id);

		applyStatus(task, request.status());
		task.setSortOrder(request.sortOrder());

		return TaskResponse.from(tasks.save(task), Instant.now());
	}

	@Transactional
	public void delete(UUID userId, UUID id) {
		tasks.delete(require(userId, id));
	}

	/**
	 * FR-4.6, and the only place {@code completedAt} is written. It moves on a
	 * transition, not on a value: re-saving a task that is already DONE must not
	 * reset the stamp, or FR-4.12 would mean "edited in the last 7 days".
	 */
	private static void applyStatus(Task task, TaskStatus next) {
		TaskStatus previous = task.getStatus();
		task.setStatus(next);

		if (next == TaskStatus.DONE && previous != TaskStatus.DONE) {
			task.setCompletedAt(Instant.now());
		}
		else if (next != TaskStatus.DONE && previous == TaskStatus.DONE) {
			task.setCompletedAt(null);
		}
	}

	/**
	 * FR-4.7. {@code min} is null for an empty column — an aggregate over no rows
	 * is null, not zero — so the first task in a column starts at 0 rather than
	 * throwing on the unboxing.
	 */
	private int topOfColumn(UUID userId, TaskStatus status) {
		Integer min = tasks.findMinSortOrder(userId, status);
		return min == null ? 0 : min - 1;
	}

	private List<TaskResponse> bucket(List<Task> open, Instant now, Predicate<Instant> when) {
		return open.stream()
				.filter(task -> when.test(task.getDueDate()))
				.map(task -> TaskResponse.from(task, now))
				.toList();
	}

	private Task require(UUID userId, UUID id) {
		return tasks.findByIdAndUserId(id, userId)
				.orElseThrow(() -> NotFoundException.of("Task", id));
	}

	/** FR-4.5: null is the Unassigned bucket, not a missing project. */
	private Project resolveProject(UUID userId, UUID projectId) {
		if (projectId == null) {
			return null;
		}
		return projects.findByIdAndUserId(projectId, userId)
				.orElseThrow(() -> ValidationException.of("projectId", "does not exist"));
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
