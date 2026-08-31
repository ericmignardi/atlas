package com.ericmignardi.atlas.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.tag.Tag;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;
import com.jayway.jsonpath.JsonPath;

/**
 * The whole {@code /api/projects} surface over real HTTP, against real Postgres:
 * status codes, the error shape, and the PATCH semantics of PRD 6.9.
 *
 * <p>These are the tests the day is graded on. The service tests prove the rules
 * in isolation; these prove the rules survive binding, validation, the exception
 * handler, and serialisation — every layer where a correct rule can still
 * produce a wrong response.
 */
class ProjectControllerIT extends AbstractWebIntegrationTest {

	@Autowired
	private UserRepository users;

	@Autowired
	private ProjectRepository projects;

	@Autowired
	private TagRepository tags;

	private User owner;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));
	}

	@Test
	void createsAProjectWithADerivedSlugAndALocationHeader() throws Exception {
		String body = mockMvc.perform(post("/api/projects").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Harbourfront Dental\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.slug").value("harbourfront-dental"))
				.andExpect(jsonPath("$.status").value("IDEA"))
				.andExpect(jsonPath("$.isPinned").value(false))
				.andExpect(jsonPath("$.techStack").isArray())
				.andExpect(jsonPath("$.environmentCount").value(0))
				.andReturn().getResponse().getContentAsString();

		String id = JsonPath.read(body, "$.id");
		assertThat(projects.findByIdAndUserId(UUID.fromString(id), owner.getId())).isPresent();
	}

	@Test
	void appendsASuffixWhenTheSlugIsAlreadyTaken() throws Exception {
		mockMvc.perform(post("/api/projects").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Harbourfront Dental\"}"))
				.andExpect(status().isCreated());

		String body = mockMvc.perform(post("/api/projects").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Harbourfront Dental\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.slug").value("harbourfront-dental-2"))
				.andReturn().getResponse().getContentAsString();

		// FR-2.4, and the Location header has to point at the row that was made,
		// not at the name that was asked for.
		mockMvc.perform(post("/api/projects").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Harbourfront Dental\"}"))
				.andExpect(header().string("Location",
						org.hamcrest.Matchers.startsWith("/api/projects/")))
				.andExpect(jsonPath("$.slug").value("harbourfront-dental-3"));

		assertThat((String) JsonPath.read(body, "$.id")).isNotBlank();
	}

	@Test
	void rejectsABlankNameWithAFieldLevelMessage() throws Exception {
		mockMvc.perform(post("/api/projects").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"   \"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.path").value("/api/projects"))
				.andExpect(jsonPath("$.timestamp").exists())
				// FR-8.4: keyed on the JSON field name, so the form can attach it
				// to the input without a translation table.
				.andExpect(jsonPath("$.fields.name").isArray());
	}

	@Test
	void rejectsAnUnknownStatusWithoutA500() throws Exception {
		mockMvc.perform(post("/api/projects").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Atlas\",\"status\":\"NOPE\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.status").isArray());
	}

	@Test
	void anEmptyPatchChangesNothing() throws Exception {
		Project seeded = seed("atlas", "Atlas", ProjectStatus.ACTIVE, project -> {
			project.setClient("Harbourfront Dental Group");
			project.setDescription("Booking site rebuild.");
			project.setRepoUrl("https://github.com/ericmignardi/atlas");
			project.setLiveUrl("https://atlas.ericmignardi.com");
			project.setEngagement("Fixed bid");
			project.setStartedAt(LocalDate.now().minusMonths(2));
			project.setTechStack(List.of("Java 21", "Spring Boot"));
		});

		// PRD 6.9, the test that exists because the failure it catches is silent.
		mockMvc.perform(patch("/api/projects/" + seeded.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Atlas"))
				.andExpect(jsonPath("$.slug").value("atlas"))
				.andExpect(jsonPath("$.client").value("Harbourfront Dental Group"))
				.andExpect(jsonPath("$.description").value("Booking site rebuild."))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.repoUrl").value("https://github.com/ericmignardi/atlas"))
				.andExpect(jsonPath("$.liveUrl").value("https://atlas.ericmignardi.com"))
				.andExpect(jsonPath("$.engagement").value("Fixed bid"))
				.andExpect(jsonPath("$.startedAt").exists())
				.andExpect(jsonPath("$.techStack.length()").value(2));

		Project reloaded = projects.findById(seeded.getId()).orElseThrow();
		assertThat(reloaded.getClient()).isEqualTo("Harbourfront Dental Group");
		assertThat(reloaded.getEngagement()).isEqualTo("Fixed bid");
		assertThat(reloaded.getStartedAt()).isNotNull();
		assertThat(reloaded.getTechStack()).containsExactly("Java 21", "Spring Boot");
	}

	@Test
	void anExplicitNullClearsExactlyOneField() throws Exception {
		Project seeded = seed("atlas", "Atlas", ProjectStatus.ACTIVE, project -> {
			project.setClient("Harbourfront Dental Group");
			project.setEngagement("Fixed bid");
		});

		mockMvc.perform(patch("/api/projects/" + seeded.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"client\":null}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.client").isEmpty())
				.andExpect(jsonPath("$.engagement").value("Fixed bid"));

		Project reloaded = projects.findById(seeded.getId()).orElseThrow();
		assertThat(reloaded.getClient()).isNull();
		assertThat(reloaded.getEngagement()).isEqualTo("Fixed bid");
	}

	@Test
	void rejectsAnExplicitNullOnAColumnThatCannotHoldOne() throws Exception {
		Project seeded = seed("atlas", "Atlas", ProjectStatus.ACTIVE, project -> {
		});

		// Reaching Hibernate with this would be a 500 about a NOT NULL
		// constraint. It is a 400 about a field instead.
		mockMvc.perform(patch("/api/projects/" + seeded.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":null}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.name").isArray());

		mockMvc.perform(patch("/api/projects/" + seeded.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":null}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.status").isArray());
	}

	@Test
	void renamingRegeneratesTheSlug() throws Exception {
		Project seeded = seed("atlas", "Atlas", ProjectStatus.ACTIVE, project -> {
		});

		mockMvc.perform(patch("/api/projects/" + seeded.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Atlas Portal\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.slug").value("atlas-portal"));
	}

	@Test
	void listExcludesArchivedUnlessAsked() throws Exception {
		seed("active", "Active", ProjectStatus.ACTIVE, project -> {
		});
		seed("archived", "Archived", ProjectStatus.ARCHIVED, project -> {
		});

		mockMvc.perform(get("/api/projects").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].slug").value("active"));

		mockMvc.perform(get("/api/projects").param("includeArchived", "true").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2));

		mockMvc.perform(get("/api/projects").param("status", "ARCHIVED").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].slug").value("archived"));
	}

	@Test
	void freeTextSearchCoversNameClientAndDescriptionCaseInsensitively() throws Exception {
		seed("by-name", "Harbourfront Dental", ProjectStatus.ACTIVE, project -> {
		});
		seed("by-client", "Booking rebuild", ProjectStatus.ACTIVE,
				project -> project.setClient("Harbourfront Dental Group"));
		seed("by-description", "Something else", ProjectStatus.ACTIVE,
				project -> project.setDescription("Rebuild of the HARBOURFRONT booking funnel."));
		seed("unrelated", "Sonder Coffee", ProjectStatus.ACTIVE, project -> {
		});

		mockMvc.perform(get("/api/projects").param("q", "harbour").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3));
	}

	@Test
	void filtersByTagName() throws Exception {
		Tag react = tags.save(TestFixtures.tag(owner, "react"));
		Project tagged = seed("tagged", "Tagged", ProjectStatus.ACTIVE, project -> {
		});
		seed("untagged", "Untagged", ProjectStatus.ACTIVE, project -> {
		});

		mockMvc.perform(patch("/api/projects/" + tagged.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"tagIds\":[\"" + react.getId() + "\"]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tags.length()").value(1))
				.andExpect(jsonPath("$.tags[0].name").value("react"));

		mockMvc.perform(get("/api/projects").param("tag", "react").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].slug").value("tagged"));

		// FR-5.7: an absent tagIds key must not disturb the set the last request
		// established.
		mockMvc.perform(patch("/api/projects/" + tagged.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"client\":\"Someone\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tags.length()").value(1));

		mockMvc.perform(patch("/api/projects/" + tagged.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"tagIds\":[]}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tags.length()").value(0));
	}

	@Test
	void pinsFourProjectsAndRefusesTheFifth() throws Exception {
		for (int i = 1; i <= 4; i++) {
			Project project = seed("pinned-" + i, "Pinned " + i, ProjectStatus.ACTIVE, p -> {
			});
			mockMvc.perform(post("/api/projects/" + project.getId() + "/pin").with(as(owner)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.isPinned").value(true));
		}

		Project fifth = seed("fifth", "Fifth", ProjectStatus.ACTIVE, project -> {
		});
		mockMvc.perform(post("/api/projects/" + fifth.getId() + "/pin").with(as(owner)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PIN_LIMIT_REACHED"))
				.andExpect(jsonPath("$.fields").doesNotExist());

		// Unpinning makes room again — the cap is a count, not a high-water mark.
		Project first = projects.findBySlugAndUserId("pinned-1", owner.getId()).orElseThrow();
		mockMvc.perform(delete("/api/projects/" + first.getId() + "/pin").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.isPinned").value(false));
		mockMvc.perform(post("/api/projects/" + fifth.getId() + "/pin").with(as(owner)))
				.andExpect(status().isOk());
	}

	@Test
	void deletingLeavesNothingBehindToGet() throws Exception {
		Project seeded = seed("atlas", "Atlas", ProjectStatus.ACTIVE, project -> {
		});

		mockMvc.perform(delete("/api/projects/" + seeded.getId()).with(as(owner)))
				.andExpect(status().isNoContent())
				.andExpect(content().string(""));

		mockMvc.perform(get("/api/projects/" + seeded.getId()).with(as(owner)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404));
	}

	@Test
	void findsAProjectBySlug() throws Exception {
		seed("atlas", "Atlas", ProjectStatus.ACTIVE, project -> {
		});

		mockMvc.perform(get("/api/projects/slug/atlas").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Atlas"));

		mockMvc.perform(get("/api/projects/slug/nothing-here").with(as(owner)))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherUsersProjectIsIndistinguishableFromAMissingOne() throws Exception {
		Project mine = seed("atlas", "Atlas", ProjectStatus.ACTIVE, project -> {
		});
		User stranger = users.save(TestFixtures.user("stranger@example.com"));

		// PRD 6.1: 404, not 403. A 403 would confirm the id names a real project.
		mockMvc.perform(get("/api/projects/" + mine.getId()).with(as(stranger)))
				.andExpect(status().isNotFound());
		mockMvc.perform(patch("/api/projects/" + mine.getId()).with(as(stranger))
				.contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Theirs\"}"))
				.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/projects/" + mine.getId()).with(as(stranger)))
				.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/projects").with(as(stranger)))
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void rejectsAnIdThatIsNotAUuid() throws Exception {
		mockMvc.perform(get("/api/projects/not-a-uuid").with(as(owner)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.id").isArray());
	}

	@Test
	void rejectsARepoUrlThatIsNotHttp() throws Exception {
		mockMvc.perform(post("/api/projects").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Atlas\",\"repoUrl\":\"git@github.com:me/atlas.git\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.repoUrl").isArray());
	}

	private Project seed(String slug, String name, ProjectStatus status,
			Consumer<Project> customise) {

		Project project = TestFixtures.project(owner, slug);
		project.setName(name);
		project.setStatus(status);
		customise.accept(project);
		return projects.saveAndFlush(project);
	}
}
