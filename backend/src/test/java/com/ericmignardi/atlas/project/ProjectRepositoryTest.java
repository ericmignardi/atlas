package com.ericmignardi.atlas.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

class ProjectRepositoryTest extends AbstractIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	private User owner;
	private User other;

	@BeforeEach
	void reset() {
		userRepository.deleteAll();
		owner = userRepository.save(TestFixtures.user("owner@example.com"));
		other = userRepository.save(TestFixtures.user("other@example.com"));
	}

	@Test
	void savesAndReloadsAProject() {
		Project saved = projectRepository.save(TestFixtures.project(owner, "atlas"));

		Project reloaded = projectRepository.findById(saved.getId()).orElseThrow();

		assertThat(reloaded.getSlug()).isEqualTo("atlas");
		assertThat(reloaded.getStatus()).isEqualTo(ProjectStatus.ACTIVE);
		assertThat(reloaded.isPinned()).isFalse();
		assertThat(reloaded.getCreatedAt()).isNotNull();
	}

	@Test
	void roundTripsTechStackThroughAPostgresTextArray() {
		Project project = TestFixtures.project(owner, "atlas");
		project.setTechStack(List.of("Java 21", "Spring Boot", "PostgreSQL", "React"));
		Project saved = projectRepository.save(project);

		Project reloaded = projectRepository.findById(saved.getId()).orElseThrow();

		// Order matters — a text[] is a list, not a set — and so does the space
		// inside "Java 21", which is what a comma-joined string would lose.
		assertThat(reloaded.getTechStack())
				.containsExactly("Java 21", "Spring Boot", "PostgreSQL", "React");
	}

	@Test
	void storesAnEmptyTechStackRatherThanNull() {
		Project project = TestFixtures.project(owner, "empty-stack");
		project.setTechStack(List.of());

		Project reloaded = projectRepository.findById(projectRepository.save(project).getId()).orElseThrow();

		assertThat(reloaded.getTechStack()).isEmpty();
	}

	@Test
	void rejectsADuplicateSlugForTheSameUser() {
		projectRepository.save(TestFixtures.project(owner, "atlas"));

		assertThatThrownBy(() -> projectRepository.saveAndFlush(TestFixtures.project(owner, "atlas")))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void allowsTheSameSlugForTwoDifferentUsers() {
		projectRepository.save(TestFixtures.project(owner, "atlas"));

		// The unique index is (user_id, slug), not (slug): two people may both
		// own a project called atlas.
		assertThat(projectRepository.saveAndFlush(TestFixtures.project(other, "atlas")).getId()).isNotNull();
	}

	@Test
	void scopesEveryLookupToTheOwner() {
		Project project = projectRepository.save(TestFixtures.project(owner, "atlas"));

		assertThat(projectRepository.findByIdAndUserId(project.getId(), owner.getId())).isPresent();
		// FR-1.9 at the lowest layer: another user's id yields nothing, so a
		// service that forgets to check ownership still cannot leak the row.
		assertThat(projectRepository.findByIdAndUserId(project.getId(), other.getId())).isEmpty();
		assertThat(projectRepository.findBySlugAndUserId("atlas", other.getId())).isEmpty();
	}

	@Test
	void findsSlugsSharingAPrefixForDeduplication() {
		projectRepository.save(TestFixtures.project(owner, "atlas"));
		projectRepository.save(TestFixtures.project(owner, "atlas-2"));
		projectRepository.save(TestFixtures.project(owner, "sonder"));

		assertThat(projectRepository.findByUserIdAndSlugStartingWith(owner.getId(), "atlas"))
				.extracting(Project::getSlug)
				.containsExactlyInAnyOrder("atlas", "atlas-2");
	}

	@Test
	void countsOnlyThisUsersPinnedProjects() {
		Project pinned = TestFixtures.project(owner, "pinned");
		pinned.setPinned(true);
		projectRepository.save(pinned);
		projectRepository.save(TestFixtures.project(owner, "unpinned"));
		Project otherPinned = TestFixtures.project(other, "theirs");
		otherPinned.setPinned(true);
		projectRepository.save(otherPinned);

		assertThat(projectRepository.countByUserIdAndPinnedTrue(owner.getId())).isEqualTo(1);
	}

	@Test
	void excludesArchivedProjectsUnlessAsked() {
		projectRepository.save(TestFixtures.project(owner, "active"));
		Project archived = TestFixtures.project(owner, "archived");
		archived.setStatus(ProjectStatus.ARCHIVED);
		projectRepository.save(archived);

		assertThat(projectRepository.findAllForUser(owner.getId(), false))
				.extracting(Project::getSlug).containsExactly("active");
		assertThat(projectRepository.findAllForUser(owner.getId(), true))
				.extracting(Project::getSlug).containsExactlyInAnyOrder("active", "archived");
	}
}
