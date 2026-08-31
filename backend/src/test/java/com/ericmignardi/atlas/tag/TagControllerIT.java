package com.ericmignardi.atlas.tag;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

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

class TagControllerIT extends AbstractWebIntegrationTest {

	@Autowired
	private UserRepository users;

	@Autowired
	private TagRepository tags;

	@Autowired
	private ProjectRepository projects;

	private User owner;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));
	}

	@Test
	void createsOnceThenReturnsTheSameTag() throws Exception {
		String first = mockMvc.perform(post("/api/tags").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"React\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("react"))
				.andReturn().getResponse().getContentAsString();

		String second = mockMvc.perform(post("/api/tags").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"  REACT \"}"))
				// FR-5.3: not a 409 and not a duplicate. 200 rather than 201 is the
				// only way the caller can tell nothing new was made.
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();

		assertThat((String) JsonPath.read(second, "$.id")).isEqualTo(JsonPath.read(first, "$.id"));
		assertThat(tags.findByUserIdOrderByNameAsc(owner.getId())).hasSize(1);
	}

	@Test
	void givesTheFirstSevenTagsSevenDifferentColours() throws Exception {
		List<String> colours = new ArrayList<>();
		for (int i = 0; i < TagPalette.COLOURS.size(); i++) {
			String body = mockMvc.perform(post("/api/tags").with(as(owner))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":\"tag-" + i + "\"}"))
					.andExpect(status().isCreated())
					.andReturn().getResponse().getContentAsString();
			colours.add(JsonPath.read(body, "$.color"));
		}

		assertThat(colours).doesNotHaveDuplicates().containsExactlyElementsOf(TagPalette.COLOURS);

		// FR-5.4 cycles rather than running out.
		String eighth = mockMvc.perform(post("/api/tags").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"eighth\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		assertThat((String) JsonPath.read(eighth, "$.color")).isEqualTo(TagPalette.COLOURS.get(0));
	}

	@Test
	void reportsUsageCountsAndFiltersByFragment() throws Exception {
		Tag react = tags.save(TestFixtures.tag(owner, "react"));
		tags.save(TestFixtures.tag(owner, "postgres"));

		Project project = projects.save(TestFixtures.project(owner, "atlas"));
		mockMvc.perform(patch("/api/projects/" + project.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"tagIds\":[\"" + react.getId() + "\"]}"))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/tags").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				// Alphabetical, so postgres leads.
				.andExpect(jsonPath("$[0].name").value("postgres"))
				.andExpect(jsonPath("$[0].usageCount").value(0))
				.andExpect(jsonPath("$[1].name").value("react"))
				.andExpect(jsonPath("$[1].usageCount").value(1));

		mockMvc.perform(get("/api/tags").param("q", "REACT").with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].name").value("react"));
	}

	@Test
	void rejectsAColourThatIsNotAHexTriplet() throws Exception {
		mockMvc.perform(post("/api/tags").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"urgent\",\"color\":\"red\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.color").isArray());
	}

	@Test
	void anEmptyPatchChangesNothingAndARenameTakesEffect() throws Exception {
		Tag react = TestFixtures.tag(owner, "react");
		react.setColor("#2251B4");
		tags.save(react);

		mockMvc.perform(patch("/api/tags/" + react.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("react"))
				.andExpect(jsonPath("$.color").value("#2251B4"));

		mockMvc.perform(patch("/api/tags/" + react.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Preact\",\"color\":\"#16643B\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("preact"))
				.andExpect(jsonPath("$.color").value("#16643B"));
	}

	@Test
	void rejectsAnExplicitNullOnEitherColumn() throws Exception {
		Tag react = tags.save(TestFixtures.tag(owner, "react"));

		mockMvc.perform(patch("/api/tags/" + react.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":null}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.name").isArray());

		mockMvc.perform(patch("/api/tags/" + react.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"color\":null}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.color").isArray());
	}

	@Test
	void refusesARenameOntoAnExistingName() throws Exception {
		Tag react = tags.save(TestFixtures.tag(owner, "react"));
		tags.save(TestFixtures.tag(owner, "vue"));

		mockMvc.perform(patch("/api/tags/" + react.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"vue\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TAG_NAME_TAKEN"));
	}

	@Test
	void deletingATagLeavesTheProjectsThatCarriedIt() throws Exception {
		Tag react = tags.save(TestFixtures.tag(owner, "react"));
		Project project = projects.save(TestFixtures.project(owner, "atlas"));
		mockMvc.perform(patch("/api/projects/" + project.getId()).with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"tagIds\":[\"" + react.getId() + "\"]}"))
				.andExpect(status().isOk());

		mockMvc.perform(delete("/api/tags/" + react.getId()).with(as(owner)))
				.andExpect(status().isNoContent());

		// FR-5.9: the join row cascades, the project does not.
		mockMvc.perform(get("/api/projects/" + project.getId()).with(as(owner)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tags.length()").value(0));
	}

	@Test
	void anotherUsersTagIsIndistinguishableFromAMissingOne() throws Exception {
		Tag mine = tags.save(TestFixtures.tag(owner, "react"));
		User stranger = users.save(TestFixtures.user("stranger@example.com"));

		mockMvc.perform(get("/api/tags/" + mine.getId()).with(as(stranger)))
				.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/tags/" + mine.getId()).with(as(stranger)))
				.andExpect(status().isNotFound());

		// Two accounts may each own a tag called react.
		mockMvc.perform(post("/api/tags").with(as(stranger))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"react\"}"))
				.andExpect(status().isCreated());
	}
}
