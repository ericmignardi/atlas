package com.ericmignardi.atlas.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;
import com.jayway.jsonpath.JsonPath;

class TaskControllerIT extends AbstractWebIntegrationTest {

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
		project = projects.save(TestFixtures.project(owner, "atlas"));
	}

	@Test
	void createsATaskWithTheDefaultsAndALocationHeader() throws Exception {
		String body = mockMvc.perform(post("/api/tasks").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"Write the pairing service\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("TODO"))
				.andExpect(jsonPath("$.priority").value("MEDIUM"))
				.andExpect(jsonPath("$.sortOrder").value(0))
				.andExpect(jsonPath("$.isOverdue").value(false))
				// FR-4.5: no project is a valid answer, not a missing one.
				.andExpect(jsonPath("$.project").doesNotExist())
				.andReturn().getResponse().getContentAsString();

		String id = JsonPath.read(body, "$.id");
		assertThat(tasks.findByIdAndUserId(UUID.fromString(id), owner.getId())).isPresent();
	}

	@Test
	void ignoresAClientSuppliedCompletedAt() throws Exception {
		// FR-4.6: the create DTO has no such field, so there is nothing to
		// remember to ignore — Jackson drops the key.
		mockMvc.perform(post("/api/tasks").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"Ship it\",\"completedAt\":\"2020-01-01T00:00:00Z\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.completedAt").doesNotExist());
	}

	@Test
	void ignoresAClientSuppliedSortOrder() throws Exception {
		tasks.save(TestFixtures.task(owner, project, "Existing", TaskStatus.TODO, -3));

		// FR-4.7: position is computed, never accepted.
		mockMvc.perform(post("/api/tasks").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"Newest\",\"sortOrder\":999}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.sortOrder").value(-4));
	}

	@Test
	void movesATaskToANewColumnAndPosition() throws Exception {
		var task = tasks.save(TestFixtures.task(owner, project, "Ship it", TaskStatus.TODO, 0));

		mockMvc.perform(put("/api/tasks/" + task.getId() + "/move").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"DONE\",\"sortOrder\":3}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DONE"))
				.andExpect(jsonPath("$.sortOrder").value(3))
				.andExpect(jsonPath("$.completedAt").isNotEmpty());

		// FR-4.8: persisted immediately, not on some later save.
		mockMvc.perform(get("/api/tasks/" + task.getId()).with(as(owner)))
				.andExpect(jsonPath("$.status").value("DONE"))
				.andExpect(jsonPath("$.sortOrder").value(3));
	}

	@Test
	void anEmptyPatchChangesNothing() throws Exception {
		var task = TestFixtures.task(owner, project, "Ship it", TaskStatus.IN_PROGRESS, 0);
		task.setDescription("Half done already.");
		task.setDueDate(Instant.parse("2026-09-30T12:00:00Z"));
		tasks.save(task);

		mockMvc.perform(patch("/api/tasks/" + task.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("Ship it"))
				.andExpect(jsonPath("$.description").value("Half done already."))
				.andExpect(jsonPath("$.dueDate").isNotEmpty())
				.andExpect(jsonPath("$.status").value("IN_PROGRESS"))
				.andExpect(jsonPath("$.project.slug").value("atlas"));
	}

	@Test
	void anExplicitNullClearsTheDueDateAndTheProject() throws Exception {
		var task = TestFixtures.task(owner, project, "Ship it", TaskStatus.TODO, 0);
		task.setDueDate(Instant.parse("2026-09-30T12:00:00Z"));
		tasks.save(task);

		// The two fields a user genuinely wants to clear, and the two a plain DTO
		// would wipe on every unrelated edit.
		mockMvc.perform(patch("/api/tasks/" + task.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"dueDate\":null,\"projectId\":null}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.dueDate").doesNotExist())
				.andExpect(jsonPath("$.project").doesNotExist());
	}

	@Test
	void returnsFourBoardColumnsInOrderAndOnlyARecentDoneColumn() throws Exception {
		tasks.save(TestFixtures.task(owner, project, "To do", TaskStatus.TODO, 0));
		tasks.save(completed("Done yesterday", Instant.now().minus(1, ChronoUnit.DAYS)));
		tasks.save(completed("Done last month", Instant.now().minus(30, ChronoUnit.DAYS)));

		// FR-4.11 and FR-4.12.
		mockMvc.perform(get("/api/tasks/board").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.columns.length()").value(4))
				.andExpect(jsonPath("$.columns[0].status").value("TODO"))
				.andExpect(jsonPath("$.columns[1].status").value("IN_PROGRESS"))
				.andExpect(jsonPath("$.columns[2].status").value("BLOCKED"))
				.andExpect(jsonPath("$.columns[3].status").value("DONE"))
				.andExpect(jsonPath("$.columns[1].tasks.length()").value(0))
				.andExpect(jsonPath("$.columns[3].tasks.length()").value(1))
				.andExpect(jsonPath("$.columns[3].tasks[0].title").value("Done yesterday"));
	}

	@Test
	void hidesCompletedWorkFromTheListUnlessItIsAskedFor() throws Exception {
		tasks.save(TestFixtures.task(owner, project, "Open", TaskStatus.TODO, 0));
		tasks.save(completed("Finished", Instant.now().minus(1, ChronoUnit.DAYS)));

		mockMvc.perform(get("/api/tasks").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].title").value("Open"));

		mockMvc.perform(get("/api/tasks").param("includeCompleted", "true").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));
	}

	@Test
	void keepsUnassignedTasksInTheUnfilteredList() throws Exception {
		tasks.save(TestFixtures.task(owner, null, "Unassigned", TaskStatus.TODO, 0));
		tasks.save(TestFixtures.task(owner, project, "Assigned", TaskStatus.TODO, 1));

		// FR-4.5, and the reason the list query left-joins the project with an
		// alias: an implicit path expression would inner-join it away.
		mockMvc.perform(get("/api/tasks").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));

		mockMvc.perform(get("/api/tasks").param("projectId", project.getId().toString()).with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].title").value("Assigned"));
	}

	@Test
	void partitionsNeedsAttentionOverHttp() throws Exception {
		tasks.save(due("Overdue", Instant.now().minus(2, ChronoUnit.DAYS)));
		tasks.save(due("Soon", Instant.now().plus(3, ChronoUnit.DAYS)));
		tasks.save(due("Far off", Instant.now().plus(30, ChronoUnit.DAYS)));

		mockMvc.perform(get("/api/tasks/needs-attention").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.overdue.length()").value(1))
				.andExpect(jsonPath("$.overdue[0].title").value("Overdue"))
				.andExpect(jsonPath("$.overdue[0].isOverdue").value(true))
				.andExpect(jsonPath("$.dueSoon.length()").value(1))
				.andExpect(jsonPath("$.dueSoon[0].title").value("Soon"));
	}

	@Test
	void rejectsAProjectThatBelongsToSomebodyElse() throws Exception {
		User stranger = users.save(TestFixtures.user("stranger@example.com"));

		mockMvc.perform(post("/api/tasks").with(as(stranger))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"Nice try\",\"projectId\":\"%s\"}".formatted(project.getId())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.projectId[0]").value("does not exist"));
	}

	@Test
	void rejectsABlankTitleWithAFieldLevelMessage() throws Exception {
		mockMvc.perform(post("/api/tasks").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"   \"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.title[0]").value("must not be blank"));
	}

	@Test
	void deletesATaskAndDoesNotRevealAnotherAccountsTask() throws Exception {
		var task = tasks.save(TestFixtures.task(owner, project, "Ship it", TaskStatus.TODO, 0));
		User stranger = users.save(TestFixtures.user("stranger@example.com"));

		mockMvc.perform(delete("/api/tasks/" + task.getId()).with(as(stranger)))
				.andExpect(status().isNotFound());

		mockMvc.perform(delete("/api/tasks/" + task.getId()).with(as(owner)))
				.andExpect(status().isNoContent());

		assertThat(tasks.findById(task.getId())).isEmpty();
	}

	private Task completed(String title, Instant completedAt) {
		Task task = TestFixtures.task(owner, project, title, TaskStatus.DONE, 0);
		task.setCompletedAt(completedAt);
		return task;
	}

	private Task due(String title, Instant dueDate) {
		Task task = TestFixtures.task(owner, project, title, TaskStatus.TODO, 0);
		task.setDueDate(dueDate);
		return task;
	}
}
