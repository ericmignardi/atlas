package com.ericmignardi.atlas.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.environment.Environment;
import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.tag.Tag;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.task.TaskStatus;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;
import com.jayway.jsonpath.JsonPath;

/**
 * FR-1.9, across every aggregate at once.
 *
 * <p>The answer is <strong>404, not 403</strong>. A 403 says "this exists and it
 * is not yours", which hands an attacker a way to enumerate which ids are real;
 * a 404 says nothing at all. That is why ownership is a {@code …AndUserId}
 * repository lookup returning empty rather than a permission check on a row that
 * was already loaded (NFR-2.8).
 *
 * <p>Environments have no {@code user_id} of their own. They are reached through
 * their project, so the scoping goes through {@code project.user.id} — which is
 * exactly the case most likely to have been missed, hence its own assertions
 * below.
 */
class CrossUserAccessIT extends AbstractWebIntegrationTest {

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

	private User alice;
	private User bob;
	private Project aliceProject;
	private Environment aliceEnvironment;
	private Task aliceTask;
	private Tag aliceTag;

	@BeforeEach
	void twoAccountsOneOfThemWithData() {
		users.deleteAll();
		alice = users.save(TestFixtures.user("alice@example.com"));
		bob = users.save(TestFixtures.user("bob@example.com"));

		aliceProject = projects.save(TestFixtures.project(alice, "alice-project"));
		aliceEnvironment = environments.save(
				TestFixtures.environment(aliceProject, "Production", EnvironmentType.PRODUCTION));
		aliceTask = tasks.save(
				TestFixtures.task(alice, aliceProject, "Alice task", TaskStatus.TODO, 1));
		aliceTag = tags.save(TestFixtures.tag(alice, "alice-tag"));
	}

	/** The check the Day 5 plan names explicitly. */
	@Test
	void userBRequestingUserAsProjectGets404() throws Exception {
		mockMvc.perform(get("/api/projects/" + aliceProject.getId()).with(as(bob)))
				.andExpect(status().isNotFound());
	}

	@Test
	void aSlugLookupIsScopedToo() throws Exception {
		mockMvc.perform(get("/api/projects/slug/alice-project").with(as(bob)))
				.andExpect(status().isNotFound());

		mockMvc.perform(get("/api/projects/slug/alice-project").with(as(alice)))
				.andExpect(status().isOk());
	}

	@Test
	void listsOnlyEverContainTheCallersOwnRows() throws Exception {
		mockMvc.perform(get("/api/projects").with(as(bob)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));

		mockMvc.perform(get("/api/tags").with(as(bob)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));

		mockMvc.perform(get("/api/tasks").with(as(bob)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));

		mockMvc.perform(get("/api/projects").with(as(alice)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
	}

	@Test
	void writesAreScopedAsWellAsReads() throws Exception {
		mockMvc.perform(patch("/api/projects/" + aliceProject.getId()).with(as(bob))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Stolen\"}"))
				.andExpect(status().isNotFound());

		mockMvc.perform(delete("/api/projects/" + aliceProject.getId()).with(as(bob)))
				.andExpect(status().isNotFound());

		mockMvc.perform(get("/api/projects/" + aliceProject.getId()).with(as(alice)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("alice-project"));
	}

	/**
	 * Ownership through the parent project, not through a column of its own.
	 *
	 * <p>The list endpoint takes the project as a query parameter, so a project
	 * that is not the caller's comes back the way Day 4 answers any unusable
	 * filter value: 400 with {@code fields.projectId}. What matters for FR-1.9 is
	 * that it is the *same* answer an id that never existed gets — the response
	 * still says nothing about whether the row is real.
	 */
	@Test
	void environmentsAreScopedThroughTheirProject() throws Exception {
		mockMvc.perform(get("/api/environments/" + aliceEnvironment.getId()).with(as(bob)))
				.andExpect(status().isNotFound());

		String strangersProject = listEnvironments(bob, aliceProject.getId());
		String neverExisted = listEnvironments(bob, UUID.randomUUID());
		assertThat(JsonPath.<String>read(strangersProject, "$.fields.projectId[0]"))
				.isEqualTo(JsonPath.read(neverExisted, "$.fields.projectId[0]"));

		mockMvc.perform(get("/api/environments/" + aliceEnvironment.getId()).with(as(alice)))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/environments").param("projectId", aliceProject.getId().toString())
				.with(as(alice)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
	}

	private String listEnvironments(User caller, UUID projectId) throws Exception {
		return mockMvc.perform(get("/api/environments").param("projectId", projectId.toString())
				.with(as(caller)))
				.andExpect(status().isBadRequest())
				.andReturn().getResponse().getContentAsString();
	}

	@Test
	void tasksAndTagsAreScopedToo() throws Exception {
		mockMvc.perform(get("/api/tasks/" + aliceTask.getId()).with(as(bob)))
				.andExpect(status().isNotFound());

		mockMvc.perform(patch("/api/tags/" + aliceTag.getId()).with(as(bob))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"stolen\"}"))
				.andExpect(status().isNotFound());
	}
}
