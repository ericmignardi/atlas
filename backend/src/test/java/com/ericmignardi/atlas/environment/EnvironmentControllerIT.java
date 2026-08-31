package com.ericmignardi.atlas.environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

class EnvironmentControllerIT extends AbstractWebIntegrationTest {

	private static final String CONNECTION_PREFIX = "postgresql://atlas_owner:npg_R7xQ2mVt"
			+ "@ep-shy-frost-a8k3n1qz-pooler.us-east-2.aws.neon.tech/atlas?sslmode=require&options=";

	/** Exactly the column's limit: a pooled Neon string with every parameter set. */
	private static final String LONG_CONNECTION_STRING =
			CONNECTION_PREFIX + "x".repeat(600 - CONNECTION_PREFIX.length());

	@Autowired
	private UserRepository users;

	@Autowired
	private ProjectRepository projects;

	@Autowired
	private EnvironmentRepository environments;

	private User owner;
	private Project project;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));
		project = projects.save(TestFixtures.project(owner, "atlas"));
	}

	@Test
	void createsAnEnvironmentAndReportsWhetherItIsADatabase() throws Exception {
		mockMvc.perform(post("/api/environments").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"projectId":"%s","name":"Neon — main","platform":"NEON",
						 "type":"PRODUCTION","branch":"main"}
						""".formatted(project.getId())))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("Neon — main"))
				// FR-3.6 is a server rule, so the client is told the answer.
				.andExpect(jsonPath("$.isDatabase").value(true))
				.andExpect(jsonPath("$.pairedWith").doesNotExist());
	}

	@Test
	void acceptsASixHundredCharacterConnectionString() throws Exception {
		assertThat(LONG_CONNECTION_STRING).hasSize(600);

		// Free text: validating it as an HTTP URL would reject the single most
		// common value the field ever holds.
		mockMvc.perform(post("/api/environments").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"projectId":"%s","name":"Neon — main","platform":"NEON",
						 "type":"PRODUCTION","url":"%s"}
						""".formatted(project.getId(), LONG_CONNECTION_STRING)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.url").value(LONG_CONNECTION_STRING));
	}

	@Test
	void rejectsAnEnvironmentUnderSomebodyElsesProject() throws Exception {
		User stranger = users.save(TestFixtures.user("stranger@example.com"));

		// NFR-2.7: a 403 would confirm the id names a real project.
		mockMvc.perform(post("/api/environments").with(as(stranger))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"projectId":"%s","name":"Production","platform":"VERCEL","type":"PRODUCTION"}
						""".formatted(project.getId())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.projectId[0]").value("does not exist"));
	}

	@Test
	void anEmptyPatchChangesNothing() throws Exception {
		Environment environment = environments.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));
		environment.setUrl(LONG_CONNECTION_STRING);
		environment.setNotes("Point-in-time restore kept at 7 days.");
		environments.saveAndFlush(environment);

		// The risk the JsonNullable shape exists to remove: an absent key must be
		// distinguishable from an explicit null.
		mockMvc.perform(patch("/api/environments/" + environment.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.url").value(LONG_CONNECTION_STRING))
				.andExpect(jsonPath("$.notes").value("Point-in-time restore kept at 7 days."))
				.andExpect(jsonPath("$.branch").value("main"));
	}

	@Test
	void clearsAFieldOnlyWhenTheKeyIsExplicitlyNull() throws Exception {
		Environment environment = environments.save(TestFixtures.environment(
				project, "Preview", EnvironmentType.PREVIEW, Platform.VERCEL));

		mockMvc.perform(patch("/api/environments/" + environment.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"branch\":null}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.branch").doesNotExist());
	}

	@Test
	void pairsOverHttpAndReturnsBothSides() throws Exception {
		Environment app = environments.save(TestFixtures.environment(
				project, "Production", EnvironmentType.PRODUCTION, Platform.VERCEL));
		Environment database = environments.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));

		mockMvc.perform(put("/api/environments/" + app.getId() + "/pair").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"targetId\":\"%s\"}".formatted(database.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.environment.pairedWith.id").value(database.getId().toString()))
				.andExpect(jsonPath("$.partner.pairedWith.id").value(app.getId().toString()));
	}

	@Test
	void reportsEachInvariantBreachWithItsOwnCode() throws Exception {
		Project other = projects.save(TestFixtures.project(owner, "sonder"));
		Environment app = environments.save(TestFixtures.environment(
				project, "Production", EnvironmentType.PRODUCTION, Platform.VERCEL));
		Environment wrongType = environments.save(TestFixtures.environment(
				project, "Preview", EnvironmentType.PREVIEW, Platform.NEON));
		Environment wrongProject = environments.save(TestFixtures.environment(
				other, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));

		// Messages get rewritten; the codes are the contract.
		expectConflict(app, app, "PAIR_SELF");
		expectConflict(app, wrongProject, "PAIR_DIFFERENT_PROJECT");
		expectConflict(app, wrongType, "PAIR_DIFFERENT_TYPE");
	}

	@Test
	void unpairsAndReturnsThePartnerThatWasReleased() throws Exception {
		Environment app = environments.save(TestFixtures.environment(
				project, "Production", EnvironmentType.PRODUCTION, Platform.VERCEL));
		Environment database = environments.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));
		pair(app, database);

		mockMvc.perform(delete("/api/environments/" + app.getId() + "/pair").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.environment.pairedWith").doesNotExist())
				.andExpect(jsonPath("$.partner.id").value(database.getId().toString()));

		mockMvc.perform(get("/api/environments/" + database.getId()).with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pairedWith").doesNotExist());
	}

	@Test
	void groupsByTypeInTheFixedDisplayOrder() throws Exception {
		environments.save(TestFixtures.environment(
				project, "Local", EnvironmentType.DEVELOPMENT, Platform.LOCAL));
		environments.save(TestFixtures.environment(
				project, "Preview", EnvironmentType.PREVIEW, Platform.VERCEL));

		// FR-3.5. Both enums persist as strings, so a database ORDER BY would put
		// DEVELOPMENT first: the display order is the declaration order.
		mockMvc.perform(get("/api/environments/grouped").param("projectId", project.getId().toString())
				.with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.groups.length()").value(3))
				.andExpect(jsonPath("$.groups[0].type").value("PRODUCTION"))
				.andExpect(jsonPath("$.groups[1].type").value("PREVIEW"))
				.andExpect(jsonPath("$.groups[2].type").value("DEVELOPMENT"))
				.andExpect(jsonPath("$.groups[0].rows.length()").value(0));
	}

	@Test
	void pairsApplicationsWithDatabasesAndLeavesTheRestVisible() throws Exception {
		Environment app = environments.save(TestFixtures.environment(
				project, "Production", EnvironmentType.PRODUCTION, Platform.VERCEL));
		Environment database = environments.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));
		pair(app, database);

		environments.save(TestFixtures.environment(
				project, "Admin", EnvironmentType.PRODUCTION, Platform.VERCEL));
		environments.save(TestFixtures.environment(
				project, "Neon — analytics", EnvironmentType.PRODUCTION, Platform.NEON));

		mockMvc.perform(get("/api/environments/grouped").param("projectId", project.getId().toString())
				.with(as(owner)))
				.andExpect(status().isOk())
				// Sorted by name within the group, so "Admin" leads "Production".
				.andExpect(jsonPath("$.groups[0].rows.length()").value(2))
				.andExpect(jsonPath("$.groups[0].rows[0].application.name").value("Admin"))
				// FR-3.15: the dashed empty slot is an explicit null.
				.andExpect(jsonPath("$.groups[0].rows[0].database").doesNotExist())
				.andExpect(jsonPath("$.groups[0].rows[1].application.name").value("Production"))
				.andExpect(jsonPath("$.groups[0].rows[1].database.name").value("Neon — main"))
				.andExpect(jsonPath("$.groups[0].orphanDatabases.length()").value(1))
				.andExpect(jsonPath("$.groups[0].orphanDatabases[0].name").value("Neon — analytics"));
	}

	@Test
	void filtersTheFlatListByTypeAndPlatform() throws Exception {
		environments.save(TestFixtures.environment(
				project, "Production", EnvironmentType.PRODUCTION, Platform.VERCEL));
		environments.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));
		environments.save(TestFixtures.environment(
				project, "Local", EnvironmentType.DEVELOPMENT, Platform.LOCAL));

		mockMvc.perform(get("/api/environments")
				.param("projectId", project.getId().toString())
				.param("platform", "NEON")
				.with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].name").value("Neon — main"));

		mockMvc.perform(get("/api/environments")
				.param("projectId", project.getId().toString())
				.with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3))
				// FR-3.5 again: type order, then name.
				.andExpect(jsonPath("$[0].type").value("PRODUCTION"))
				.andExpect(jsonPath("$[2].type").value("DEVELOPMENT"));
	}

	@Test
	void doesNotRevealAnotherAccountsEnvironment() throws Exception {
		Environment environment = environments.save(TestFixtures.environment(
				project, "Production", EnvironmentType.PRODUCTION, Platform.VERCEL));
		User stranger = users.save(TestFixtures.user("stranger@example.com"));

		mockMvc.perform(get("/api/environments/" + environment.getId()).with(as(stranger)))
				.andExpect(status().isNotFound());
	}

	private void pair(Environment app, Environment database) throws Exception {
		mockMvc.perform(put("/api/environments/" + app.getId() + "/pair").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"targetId\":\"%s\"}".formatted(database.getId())))
				.andExpect(status().isOk());
	}

	private void expectConflict(Environment from, Environment to, String code) throws Exception {
		mockMvc.perform(put("/api/environments/" + from.getId() + "/pair").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"targetId\":\"%s\"}".formatted(to.getId())))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value(code));
	}
}
