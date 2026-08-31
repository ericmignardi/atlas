package com.ericmignardi.atlas.tag;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

class TagRepositoryTest extends AbstractIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private TagRepository tagRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private User owner;

	@BeforeEach
	void reset() {
		userRepository.deleteAll();
		owner = userRepository.save(TestFixtures.user());
	}

	@Test
	void savesAndReloadsATagWithTheDefaultPaletteColour() {
		Tag saved = tagRepository.save(TestFixtures.tag(owner, "spring"));

		Tag reloaded = tagRepository.findById(saved.getId()).orElseThrow();

		assertThat(reloaded.getName()).isEqualTo("spring");
		// CHAR(7) is blank-padded to its full width by Postgres, so a colour
		// that came back as "#4545" would show up here as a length mismatch.
		assertThat(reloaded.getColor()).isEqualTo("#454D5F");
		assertThat(reloaded.getCreatedAt()).isNotNull();
	}

	@Test
	void rejectsADuplicateTagNameForTheSameUser() {
		tagRepository.save(TestFixtures.tag(owner, "spring"));

		assertThatThrownBy(() -> tagRepository.saveAndFlush(TestFixtures.tag(owner, "spring")))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void allowsTheSameTagNameForTwoDifferentUsers() {
		tagRepository.save(TestFixtures.tag(owner, "spring"));
		User stranger = userRepository.save(TestFixtures.user());

		assertThat(tagRepository.saveAndFlush(TestFixtures.tag(stranger, "spring")).getId()).isNotNull();
	}

	@Test
	void attachesManyDistinctTagsToOneProject() {
		Tag spring = tagRepository.save(TestFixtures.tag(owner, "spring"));
		Tag react = tagRepository.save(TestFixtures.tag(owner, "react"));
		Tag postgres = tagRepository.save(TestFixtures.tag(owner, "postgres"));
		Project project = TestFixtures.project(owner, "atlas");

		project.getTags().add(new ProjectTag(project, spring));
		project.getTags().add(new ProjectTag(project, react));
		project.getTags().add(new ProjectTag(project, postgres));
		projectRepository.saveAndFlush(project);

		// Three, not one. ProjectTag's equals compares the two association ids
		// rather than the @EmbeddedId, which @MapsId leaves empty until flush —
		// comparing the key instead makes every new join row equal to every
		// other and the Set silently keeps one.
		assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM project_tags", Integer.class))
				.isEqualTo(3);
	}

	@Test
	void loadsAProjectWithItsTagsInOneQuery() {
		Tag spring = tagRepository.save(TestFixtures.tag(owner, "spring"));
		Project project = TestFixtures.project(owner, "atlas");
		project.getTags().add(new ProjectTag(project, spring));
		projectRepository.saveAndFlush(project);

		Set<ProjectTag> tags = projectRepository.findAllForUser(owner.getId(), false)
				.getFirst()
				.getTags();

		// Outside a transaction, so reaching t.getTag().getName() only works
		// because findAllForUser JOIN FETCHes both levels (NFR-1.2).
		assertThat(tags).extracting(t -> t.getTag().getName()).containsExactly("spring");
	}

	@Test
	void deletingATagRemovesTheJoinRowsAndLeavesTheProject() {
		Tag spring = tagRepository.save(TestFixtures.tag(owner, "spring"));
		Project project = TestFixtures.project(owner, "atlas");
		project.getTags().add(new ProjectTag(project, spring));
		Project saved = projectRepository.saveAndFlush(project);

		// FR-5.9. Native again: the cascade under test is the one in V7.
		jdbcTemplate.update("DELETE FROM tags WHERE id = ?", spring.getId());

		assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM project_tags", Integer.class)).isZero();
		assertThat(projectRepository.findById(saved.getId())).isPresent();
	}

	@Test
	void deletingAProjectRemovesItsJoinRowsAndLeavesTheTag() {
		Tag spring = tagRepository.save(TestFixtures.tag(owner, "spring"));
		Project project = TestFixtures.project(owner, "atlas");
		project.getTags().add(new ProjectTag(project, spring));
		Project saved = projectRepository.saveAndFlush(project);

		jdbcTemplate.update("DELETE FROM projects WHERE id = ?", saved.getId());

		assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM project_tags", Integer.class)).isZero();
		assertThat(tagRepository.findById(spring.getId())).isPresent();
	}

	@Test
	void listsATagsOwnTagsAlphabeticallyAndScopedToTheOwner() {
		tagRepository.save(TestFixtures.tag(owner, "spring"));
		tagRepository.save(TestFixtures.tag(owner, "postgres"));
		User stranger = userRepository.save(TestFixtures.user());
		tagRepository.save(TestFixtures.tag(stranger, "aardvark"));

		assertThat(tagRepository.findByUserIdOrderByNameAsc(owner.getId()))
				.extracting(Tag::getName)
				.containsExactly("postgres", "spring");
	}
}
