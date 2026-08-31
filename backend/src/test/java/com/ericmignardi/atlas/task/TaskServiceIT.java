package com.ericmignardi.atlas.task;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openapitools.jackson.nullable.JsonNullable;
import org.springframework.beans.factory.annotation.Autowired;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.task.dto.CreateTaskRequest;
import com.ericmignardi.atlas.task.dto.MoveTaskRequest;
import com.ericmignardi.atlas.task.dto.NeedsAttention;
import com.ericmignardi.atlas.task.dto.TaskResponse;
import com.ericmignardi.atlas.task.dto.UpdateTaskRequest;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

/** FR-4.6, FR-4.7, FR-4.9, FR-4.10. */
class TaskServiceIT extends AbstractIntegrationTest {

	private static final ZoneId USER_ZONE = ZoneId.of("America/Toronto");

	@Autowired
	private TaskService service;

	@Autowired
	private TaskRepository tasks;

	@Autowired
	private ProjectRepository projects;

	@Autowired
	private UserRepository users;

	private User owner;
	private Project project;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));
		project = projects.save(TestFixtures.project(owner, "atlas"));
	}

	@Test
	void theFirstTaskInAnEmptyColumnDoesNotThrow() {
		// MIN over no rows is null, not zero. Unbox it and every first task in
		// every column is a NullPointerException (FR-4.7).
		TaskResponse created = service.create(owner.getId(), create("Write the migrations", null));

		assertThat(created.sortOrder()).isZero();
	}

	@Test
	void aNewTaskLandsAboveEveryOtherTaskInItsColumn() {
		tasks.save(TestFixtures.task(owner, project, "Existing", TaskStatus.TODO, 0));
		tasks.save(TestFixtures.task(owner, project, "Also existing", TaskStatus.TODO, -4));
		// A different column's minimum must not be consulted.
		tasks.save(TestFixtures.task(owner, project, "In flight", TaskStatus.IN_PROGRESS, -99));

		TaskResponse created = service.create(owner.getId(), create("Newest", TaskStatus.TODO));

		assertThat(created.sortOrder()).isEqualTo(-5);
		assertThat(tasks.findMinSortOrder(owner.getId(), TaskStatus.TODO)).isEqualTo(-5);
		// The IN_PROGRESS column is untouched: -99 stays where it was, which is
		// the whole point of "top of its column" rather than "top of the board".
		assertThat(tasks.findMinSortOrder(owner.getId(), TaskStatus.IN_PROGRESS)).isEqualTo(-99);
	}

	@Test
	void stampsCompletedAtOnTheWayIntoDoneAndClearsItOnTheWayOut() {
		TaskResponse created = service.create(owner.getId(), create("Ship it", TaskStatus.TODO));
		assertThat(created.completedAt()).isNull();

		TaskResponse done = service.update(owner.getId(), created.id(), status(TaskStatus.DONE));
		assertThat(done.completedAt()).isNotNull();

		TaskResponse reopened = service.update(owner.getId(), created.id(), status(TaskStatus.TODO));
		assertThat(reopened.completedAt()).isNull();
	}

	@Test
	void doesNotResetCompletedAtWhenADoneTaskIsEditedAgain() {
		TaskResponse created = service.create(owner.getId(), create("Ship it", TaskStatus.DONE));
		// Read the stamp back from the column rather than from the create
		// response: timestamptz holds microseconds and an in-memory Instant holds
		// nanoseconds, so the two differ in precision for the same moment.
		Instant stamped = tasks.findById(created.id()).orElseThrow().getCompletedAt();
		assertThat(stamped).isNotNull();

		UpdateTaskRequest rename = new UpdateTaskRequest();
		rename.setTitle(JsonNullable.of("Ship it, properly"));
		TaskResponse renamed = service.update(owner.getId(), created.id(), rename);

		// The stamp marks a transition, not a save: if editing moved it, FR-4.12
		// would mean "touched in the last seven days".
		assertThat(renamed.completedAt()).isEqualTo(stamped);
	}

	@Test
	void aMovePersistsBothTheColumnAndThePosition() {
		TaskResponse created = service.create(owner.getId(), create("Ship it", TaskStatus.TODO));

		service.move(owner.getId(), created.id(), new MoveTaskRequest(TaskStatus.DONE, 7));

		Task reloaded = tasks.findById(created.id()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(TaskStatus.DONE);
		assertThat(reloaded.getSortOrder()).isEqualTo(7);
		// A move across the DONE boundary stamps, like any other transition.
		assertThat(reloaded.getCompletedAt()).isNotNull();
	}

	@Test
	void overdueIsADueDateInThePastAndAStatusThatIsNotDone() {
		Instant yesterday = Instant.now().minus(1, ChronoUnit.DAYS);
		Task open = tasks.save(due(TestFixtures.task(owner, project, "Late", TaskStatus.TODO, 0), yesterday));
		Task finished = tasks.save(
				due(TestFixtures.task(owner, project, "Late but done", TaskStatus.DONE, 1), yesterday));

		// FR-4.9. Same due date, opposite answers: the status is half the rule.
		assertThat(service.get(owner.getId(), open.getId()).overdue()).isTrue();
		assertThat(service.get(owner.getId(), finished.getId()).overdue()).isFalse();
	}

	@Test
	void partitionsNeedsAttentionIntoOverdueTodayAndSoon() {
		Instant now = Instant.now();
		Instant endOfToday = LocalDate.now(USER_ZONE).plusDays(1).atStartOfDay(USER_ZONE).toInstant();

		tasks.save(due(task("Overdue", TaskStatus.TODO, 0), now.minus(2, ChronoUnit.DAYS)));
		// Halfway between now and the end of the day in the user's zone, so this
		// is still today no matter what time the suite happens to run.
		tasks.save(due(task("Due later today", TaskStatus.TODO, 1),
				now.plus(java.time.Duration.between(now, endOfToday).dividedBy(2))));
		tasks.save(due(task("Due in three days", TaskStatus.TODO, 2), now.plus(3, ChronoUnit.DAYS)));
		// Outside the eight-day horizon, and therefore in no bucket at all.
		tasks.save(due(task("Due in three weeks", TaskStatus.TODO, 3), now.plus(21, ChronoUnit.DAYS)));
		// Overdue on paper, but finished, so not open work.
		tasks.save(due(task("Done and late", TaskStatus.DONE, 4), now.minus(2, ChronoUnit.DAYS)));
		// No due date at all: the third list state, and not an attention item.
		tasks.save(task("Someday", TaskStatus.TODO, 5));

		NeedsAttention attention = service.needsAttention(owner.getId());

		assertThat(titles(attention.overdue())).containsExactly("Overdue");
		assertThat(titles(attention.dueToday())).containsExactly("Due later today");
		assertThat(titles(attention.dueSoon())).containsExactly("Due in three days");
	}

	@Test
	void aTaskDueEarlierTodayIsOverdueRatherThanDueToday() {
		Instant now = Instant.now();
		Instant startOfToday = LocalDate.now(USER_ZONE).atStartOfDay(USER_ZONE).toInstant();
		// Still "today" by the calendar and still late by the clock. Appearing in
		// both buckets would double every count on the dashboard.
		tasks.save(due(task("Was due at nine", TaskStatus.TODO, 0),
				now.minusSeconds(2).isAfter(startOfToday) ? now.minusSeconds(2) : startOfToday));

		NeedsAttention attention = service.needsAttention(owner.getId());

		assertThat(titles(attention.overdue())).containsExactly("Was due at nine");
		assertThat(attention.dueToday()).isEmpty();
	}

	private CreateTaskRequest create(String title, TaskStatus status) {
		return new CreateTaskRequest(title, null, status, null, null, project.getId());
	}

	private static UpdateTaskRequest status(TaskStatus status) {
		UpdateTaskRequest request = new UpdateTaskRequest();
		request.setStatus(JsonNullable.of(status));
		return request;
	}

	private Task task(String title, TaskStatus status, int sortOrder) {
		return TestFixtures.task(owner, project, title, status, sortOrder);
	}

	private static Task due(Task task, Instant dueDate) {
		task.setDueDate(dueDate);
		if (task.getStatus() == TaskStatus.DONE) {
			task.setCompletedAt(Instant.now());
		}
		return task;
	}

	private static List<String> titles(List<TaskResponse> found) {
		return found.stream().map(TaskResponse::title).toList();
	}
}
