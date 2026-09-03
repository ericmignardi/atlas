package com.ericmignardi.atlas.search;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.project.ProjectStatus;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.task.TaskStatus;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

class SearchControllerIT extends AbstractWebIntegrationTest {

	@Autowired
	private UserRepository users;

	@Autowired
	private ProjectRepository projects;

	@Autowired
	private TaskRepository tasks;

	private User owner;
	private Project project;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));

		project = TestFixtures.project(owner, "harbour-atlas");
		project.setName("Harbour Atlas");
		project.setClient("Harbourfront Dental");
		TestFixtures.environment(project, "Atlas web", EnvironmentType.PRODUCTION, Platform.VERCEL);
		project = projects.save(project);

		tasks.save(TestFixtures.task(owner, project, "Write the atlas README", TaskStatus.TODO, 0));
	}

	@Test
	void returnsAllThreeGroups() throws Exception {
		mockMvc.perform(get("/api/search").param("q", "atlas").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.projects.length()").value(1))
				.andExpect(jsonPath("$.projects[0].slug").value("harbour-atlas"))
				.andExpect(jsonPath("$.environments.length()").value(1))
				// The palette navigates to an environment through its project.
				.andExpect(jsonPath("$.environments[0].project.slug").value("harbour-atlas"))
				.andExpect(jsonPath("$.tasks.length()").value(1))
				.andExpect(jsonPath("$.tasks[0].title").value("Write the atlas README"));
	}

	@Test
	void matchesCaseInsensitivelyAndOnASubstring() throws Exception {
		mockMvc.perform(get("/api/search").param("q", "ATL").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.projects.length()").value(1));
	}

	@Test
	void matchesAProjectOnItsClient() throws Exception {
		mockMvc.perform(get("/api/search").param("q", "dental").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.projects[0].client").value("Harbourfront Dental"));
	}

	@Test
	void excludesArchivedProjects() throws Exception {
		// FR-2.7 keeps archived projects out of search, so the palette cannot be
		// the one route back to something the user deliberately put away.
		project.setStatus(ProjectStatus.ARCHIVED);
		projects.save(project);

		mockMvc.perform(get("/api/search").param("q", "atlas").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.projects").isEmpty())
				// The project's tasks and environments are still findable; only the
				// project itself is hidden.
				.andExpect(jsonPath("$.tasks.length()").value(1));
	}

	@Test
	void capsEachGroupAtFive() throws Exception {
		for (int i = 0; i < 8; i++) {
			tasks.save(TestFixtures.task(owner, project, "Atlas chore " + i, TaskStatus.TODO, i + 1));
		}

		mockMvc.perform(get("/api/search").param("q", "atlas").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tasks.length()").value(5));
	}

	@Test
	void treatsAWildcardAsLiteralText() throws Exception {
		Task odd = TestFixtures.task(owner, project, "Ship the 100% case", TaskStatus.TODO, 20);
		tasks.save(odd);

		// Unescaped, "100%" would be "starts with 100" and would match nothing
		// extra here — but "%" alone would match every row in the table, which is
		// the failure this guards.
		mockMvc.perform(get("/api/search").param("q", "%").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tasks").isEmpty())
				.andExpect(jsonPath("$.projects").isEmpty());
	}

	@Test
	void returnsEmptyGroupsForABlankQuery() throws Exception {
		mockMvc.perform(get("/api/search").param("q", "   ").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.projects").isEmpty())
				.andExpect(jsonPath("$.environments").isEmpty())
				.andExpect(jsonPath("$.tasks").isEmpty());
	}

	@Test
	void returnsEmptyGroupsWhenQIsAbsent() throws Exception {
		mockMvc.perform(get("/api/search").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.projects").isEmpty());
	}

	@Test
	void neverReturnsAnotherUsersRecords() throws Exception {
		User stranger = users.save(TestFixtures.user("stranger@example.com"));
		Project theirs = TestFixtures.project(stranger, "atlas-clone");
		theirs.setName("Atlas Clone");
		TestFixtures.environment(theirs, "Atlas mirror", EnvironmentType.PRODUCTION);
		projects.save(theirs);
		tasks.save(TestFixtures.task(stranger, theirs, "Atlas secret", TaskStatus.TODO, 0));

		mockMvc.perform(get("/api/search").param("q", "atlas").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.projects.length()").value(1))
				.andExpect(jsonPath("$.projects[0].slug").value("harbour-atlas"))
				.andExpect(jsonPath("$.environments.length()").value(1))
				.andExpect(jsonPath("$.tasks.length()").value(1));
	}

	@Test
	void requiresAuthentication() throws Exception {
		mockMvc.perform(get("/api/search").param("q", "atlas"))
				.andExpect(status().isUnauthorized());
	}
}
