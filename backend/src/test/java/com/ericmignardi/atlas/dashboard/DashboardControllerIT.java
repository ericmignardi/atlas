package com.ericmignardi.atlas.dashboard;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.project.ProjectStatus;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.task.TaskStatus;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

class DashboardControllerIT extends AbstractWebIntegrationTest {

	@Autowired
	private UserRepository users;

	@Autowired
	private ProjectRepository projects;

	@Autowired
	private EnvironmentRepository environments;

	@Autowired
	private TaskRepository tasks;

	@Autowired
	private TagRepository tags;

	private User owner;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));
	}

	@Test
	void reportsANewAccountRatherThanAGridOfZeroes() throws Exception {
		// FR-6.4. Every count is zero *and* the flag is set: the client needs the
		// second one, because "all my projects are archived" is also all zeroes on
		// the first tile and wants a different screen entirely.
		mockMvc.perform(get("/api/dashboard").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.isNewAccount").value(true))
				.andExpect(jsonPath("$.stats.totalProjects").value(0))
				.andExpect(jsonPath("$.pinnedProjects").isEmpty())
				.andExpect(jsonPath("$.needsAttention.overdue").isEmpty());
	}

	@Test
	void anAccountWithOnlyAnArchivedProjectIsNotNew() throws Exception {
		Project archived = TestFixtures.project(owner, "old");
		archived.setStatus(ProjectStatus.ARCHIVED);
		projects.save(archived);

		mockMvc.perform(get("/api/dashboard").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.isNewAccount").value(false))
				.andExpect(jsonPath("$.stats.totalProjects").value(1))
				// FR-6.1 counts what is active, and an archived project is not.
				.andExpect(jsonPath("$.stats.activeProjects").value(0));
	}

	@Test
	void countsTheFourTiles() throws Exception {
		Project active = projects.save(TestFixtures.project(owner, "atlas"));
		Project idea = TestFixtures.project(owner, "sketch");
		idea.setStatus(ProjectStatus.IDEA);
		projects.save(idea);

		// Two platforms across three environments — the tile shows both numbers.
		TestFixtures.environment(active, "Web", EnvironmentType.PRODUCTION, Platform.VERCEL);
		TestFixtures.environment(active, "Preview", EnvironmentType.PREVIEW, Platform.VERCEL);
		TestFixtures.environment(active, "Db", EnvironmentType.PRODUCTION, Platform.NEON);
		projects.save(active);

		tasks.save(TestFixtures.task(owner, active, "Open one", TaskStatus.TODO, 0));
		tasks.save(TestFixtures.task(owner, active, "Open two", TaskStatus.IN_PROGRESS, 1));
		tasks.save(TestFixtures.task(owner, active, "Finished", TaskStatus.DONE, 2));

		Task late = TestFixtures.task(owner, active, "Late", TaskStatus.TODO, 3);
		late.setDueDate(Instant.now().minus(2, ChronoUnit.DAYS));
		tasks.save(late);

		tags.save(TestFixtures.tag(owner, "client-work"));

		mockMvc.perform(get("/api/dashboard").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.stats.activeProjects").value(1))
				.andExpect(jsonPath("$.stats.totalProjects").value(2))
				// Three open, one done, and the overdue one is open too.
				.andExpect(jsonPath("$.stats.openTasks").value(3))
				.andExpect(jsonPath("$.stats.overdueTasks").value(1))
				.andExpect(jsonPath("$.stats.environments").value(3))
				.andExpect(jsonPath("$.stats.platforms").value(2))
				.andExpect(jsonPath("$.stats.tags").value(1))
				.andExpect(jsonPath("$.needsAttention.overdue.length()").value(1))
				.andExpect(jsonPath("$.needsAttention.overdue[0].title").value("Late"));
	}

	@Test
	void returnsPinnedProjectsWithTheirCounts() throws Exception {
		Project pinned = TestFixtures.project(owner, "atlas");
		pinned.setPinned(true);
		TestFixtures.environment(pinned, "Web", EnvironmentType.PRODUCTION);
		projects.save(pinned);
		projects.save(TestFixtures.project(owner, "unpinned"));

		tasks.save(TestFixtures.task(owner, pinned, "Open", TaskStatus.TODO, 0));

		mockMvc.perform(get("/api/dashboard").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pinnedProjects.length()").value(1))
				.andExpect(jsonPath("$.pinnedProjects[0].slug").value("atlas"))
				// The card shows the same counts the projects list does, because it
				// is built by the same service.
				.andExpect(jsonPath("$.pinnedProjects[0].environmentCount").value(1))
				.andExpect(jsonPath("$.pinnedProjects[0].openTaskCount").value(1));
	}

	@Test
	void neverCountsAnotherUsersData() throws Exception {
		User stranger = users.save(TestFixtures.user("stranger@example.com"));
		Project theirs = TestFixtures.project(stranger, "theirs");
		theirs.setPinned(true);
		TestFixtures.environment(theirs, "Web", EnvironmentType.PRODUCTION);
		projects.save(theirs);
		tasks.save(TestFixtures.task(stranger, theirs, "Not mine", TaskStatus.TODO, 0));
		tags.save(TestFixtures.tag(stranger, "theirs"));

		mockMvc.perform(get("/api/dashboard").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.isNewAccount").value(true))
				.andExpect(jsonPath("$.stats.environments").value(0))
				.andExpect(jsonPath("$.stats.tags").value(0))
				.andExpect(jsonPath("$.pinnedProjects").isEmpty());
	}

	@Test
	void requiresAuthentication() throws Exception {
		mockMvc.perform(get("/api/dashboard"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error", Matchers.not(Matchers.emptyString())));
	}

	@Test
	void partitionsNeedsAttentionIntoThreeDisjointBuckets() throws Exception {
		Project project = projects.save(TestFixtures.project(owner, "atlas"));

		Task overdue = TestFixtures.task(owner, project, "Yesterday", TaskStatus.TODO, 0);
		overdue.setDueDate(Instant.now().minus(1, ChronoUnit.DAYS));
		tasks.save(overdue);

		Task soon = TestFixtures.task(owner, project, "Next week", TaskStatus.TODO, 1);
		soon.setDueDate(Instant.now().plus(5, ChronoUnit.DAYS));
		tasks.save(soon);

		// Outside FR-4.10's eight-day window, so it is in no bucket at all.
		Task far = TestFixtures.task(owner, project, "Next month", TaskStatus.TODO, 2);
		far.setDueDate(Instant.now().plus(30, ChronoUnit.DAYS));
		tasks.save(far);

		mockMvc.perform(get("/api/dashboard").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.needsAttention.overdue.length()").value(1))
				.andExpect(jsonPath("$.needsAttention.dueSoon.length()").value(1))
				.andExpect(jsonPath("$.needsAttention.dueSoon[0].title").value("Next week"));
	}
}
