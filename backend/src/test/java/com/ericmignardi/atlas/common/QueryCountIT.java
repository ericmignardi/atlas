package com.ericmignardi.atlas.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.task.TaskStatus;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

import jakarta.persistence.EntityManagerFactory;

/**
 * NFR-1.2, as a test rather than as a reading of the log.
 *
 * <p>An N+1 is invisible from outside: the endpoint returns exactly the same
 * JSON whether it issued two statements or two hundred, and it stays correct
 * while getting slower with every row added. Turning on {@code show-sql} and
 * counting by eye finds one today; this finds the next one, on the commit that
 * introduces it.
 *
 * <p>The assertion is deliberately <strong>not</strong> an exact number. Pinning
 * "the dashboard is fourteen statements" makes every legitimate refactor a
 * failing test for no reason. What matters is the <em>shape</em>: the cost must
 * not grow with the number of rows. So each endpoint is measured twice against
 * very different amounts of data, and the two counts have to be equal.
 */
class QueryCountIT extends AbstractWebIntegrationTest {

	/** One project's worth of rows, against twelve. An N+1 cannot hide across that gap. */
	private static final int SMALL = 1;
	private static final int LARGE = 12;

	@Autowired
	private UserRepository users;

	@Autowired
	private ProjectRepository projects;

	@Autowired
	private TaskRepository tasks;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	private Statistics statistics;
	private User owner;
	private int seeded;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));
		seeded = 0;

		statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.setStatisticsEnabled(true);
	}

	@Test
	void theDashboardCostsTheSameWhateverTheAccountHolds() throws Exception {
		assertConstantCost("/api/dashboard");
	}

	@Test
	void searchCostsTheSameWhateverMatches() throws Exception {
		// Three capped queries, and the cap is the point: the twelfth project
		// cannot add a statement because only five rows are ever returned.
		assertConstantCost("/api/search?q=seed");
	}

	@Test
	void listingProjectsCostsTheSameWhateverTheCount() throws Exception {
		// The one that would break first. Every card carries an environment
		// count, an open-task count and an overdue count, and the obvious way to
		// compute those is three statements per row.
		assertConstantCost("/api/projects?includeArchived=true");
	}

	@Test
	void listingTasksCostsTheSameWhateverTheCount() throws Exception {
		// Every row embeds its project, a lazy to-one — the exact shape that
		// becomes one extra SELECT per task without the JOIN FETCH.
		assertConstantCost("/api/tasks?includeCompleted=true");
	}

	@Test
	void theTaskBoardCostsTheSameWhateverItHolds() throws Exception {
		assertConstantCost("/api/tasks/board");
	}

	private void assertConstantCost(String path) throws Exception {
		seed(SMALL);
		// Discarded: the first request through a path prepares statements the
		// second one reuses, and that one-off is not what is being measured.
		statementsFor(path);
		long small = statementsFor(path);

		seed(LARGE);
		long large = statementsFor(path);

		assertThat(large)
				.as("%s issued %d statements for %d projects and %d for %d", path, small, SMALL,
						large, SMALL + LARGE)
				.isEqualTo(small);
	}

	/**
	 * The counter is cleared immediately before the request, so the number
	 * belongs to the request and not to the seeding that preceded it.
	 */
	private long statementsFor(String path) throws Exception {
		statistics.clear();
		mockMvc.perform(get(path).with(as(owner))).andExpect(status().isOk());
		return statistics.getPrepareStatementCount();
	}

	/** Projects with environments and tasks — the associations an N+1 hides in. */
	private void seed(int count) {
		for (int i = 0; i < count; i++) {
			int n = seeded++;

			Project project = TestFixtures.project(owner, "seed-" + n);
			// One pinned project is enough for the dashboard to have a card to
			// build; the query behind it does not care how many there are.
			project.setPinned(n == 0);
			TestFixtures.environment(project, "Web " + n, EnvironmentType.PRODUCTION, Platform.VERCEL);
			TestFixtures.environment(project, "Db " + n, EnvironmentType.PRODUCTION, Platform.NEON);
			Project saved = projects.save(project);

			// Overdue, so it lands in a needs-attention bucket as well as the list.
			Task open = TestFixtures.task(owner, saved, "seed task " + n, TaskStatus.TODO, n);
			open.setDueDate(Instant.now().minus(1, ChronoUnit.DAYS));
			tasks.save(open);

			tasks.save(TestFixtures.task(owner, saved, "seed done " + n, TaskStatus.DONE, n + 1000));
		}
	}
}
