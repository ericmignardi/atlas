package com.ericmignardi.atlas.task;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

class TaskRepositoryTest extends AbstractIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private TaskRepository taskRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private User owner;
	private Project project;

	@BeforeEach
	void reset() {
		userRepository.deleteAll();
		owner = userRepository.save(TestFixtures.user());
		project = projectRepository.save(TestFixtures.project(owner, "atlas"));
	}

	@Test
	void savesAndReloadsATask() {
		Task saved = taskRepository.save(
				TestFixtures.task(owner, project, "Write the migrations", TaskStatus.IN_PROGRESS, 3));

		Task reloaded = taskRepository.findById(saved.getId()).orElseThrow();

		assertThat(reloaded.getTitle()).isEqualTo("Write the migrations");
		assertThat(reloaded.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
		assertThat(reloaded.getPriority()).isEqualTo(TaskPriority.MEDIUM);
		assertThat(reloaded.getSortOrder()).isEqualTo(3);
		assertThat(reloaded.getCompletedAt()).isNull();
	}

	@Test
	void keepsATaskWithoutAProject() {
		// FR-4.5: an unassigned task is a normal task, not an error.
		Task saved = taskRepository.save(
				TestFixtures.task(owner, null, "Read up on partial indexes", TaskStatus.TODO, 0));

		assertThat(taskRepository.findById(saved.getId()).orElseThrow().getProject()).isNull();
	}

	@Test
	void deletingAProjectNullsItsTasksRatherThanDeletingThem() {
		Task task = taskRepository.save(
				TestFixtures.task(owner, project, "Survives the project", TaskStatus.TODO, 0));

		// Native, so this asserts the ON DELETE SET NULL in V6 rather than any
		// entity-level cascade. A project is a container for work; deleting the
		// container must not destroy the work.
		jdbcTemplate.update("DELETE FROM projects WHERE id = ?", project.getId());

		assertThat(taskRepository.findById(task.getId()))
				.get()
				.extracting(Task::getProject)
				.isNull();
	}

	@Test
	void deletingAUserDeletesTheirTasks() {
		taskRepository.save(TestFixtures.task(owner, project, "Goes with the account", TaskStatus.TODO, 0));

		jdbcTemplate.update("DELETE FROM users WHERE id = ?", owner.getId());

		assertThat(taskRepository.count()).isZero();
	}

	@Test
	void returnsNullMinSortOrderForAnEmptyColumn() {
		// MIN over no rows is null, not zero — which is why the query returns a
		// boxed Integer and the caller has to decide what an empty column means.
		assertThat(taskRepository.findMinSortOrder(owner.getId(), TaskStatus.BLOCKED)).isNull();
	}

	@Test
	void findsTheMinimumSortOrderWithinOneStatusForOneUser() {
		taskRepository.save(TestFixtures.task(owner, project, "Top", TaskStatus.TODO, -4));
		taskRepository.save(TestFixtures.task(owner, project, "Middle", TaskStatus.TODO, 0));
		taskRepository.save(TestFixtures.task(owner, project, "Other column", TaskStatus.DONE, -99));
		User stranger = userRepository.save(TestFixtures.user());
		taskRepository.save(TestFixtures.task(stranger, null, "Someone else's", TaskStatus.TODO, -50));

		// FR-4.7: a new TODO lands at -5, above "Top", and nothing else moves.
		assertThat(taskRepository.findMinSortOrder(owner.getId(), TaskStatus.TODO)).isEqualTo(-4);
	}

	@Test
	void findsOpenOverdueTasksOnly() {
		Instant now = Instant.now();
		Task overdue = TestFixtures.task(owner, project, "Overdue", TaskStatus.TODO, 0);
		overdue.setDueDate(now.minus(2, ChronoUnit.DAYS));
		taskRepository.save(overdue);
		Task doneButLate = TestFixtures.task(owner, project, "Done, was late", TaskStatus.DONE, 1);
		doneButLate.setDueDate(now.minus(3, ChronoUnit.DAYS));
		doneButLate.setCompletedAt(now);
		taskRepository.save(doneButLate);
		Task upcoming = TestFixtures.task(owner, project, "Upcoming", TaskStatus.TODO, 2);
		upcoming.setDueDate(now.plus(2, ChronoUnit.DAYS));
		taskRepository.save(upcoming);

		// FR-4.9: overdue means "past due and not DONE". A finished task that
		// was late is history, not a thing to nag about.
		assertThat(taskRepository.findByUserIdAndStatusNotAndDueDateBeforeOrderByDueDateAsc(
				owner.getId(), TaskStatus.DONE, now))
				.extracting(Task::getTitle)
				.containsExactly("Overdue");
	}
}
