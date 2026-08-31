package com.ericmignardi.atlas.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openapitools.jackson.nullable.JsonNullable;

import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.common.error.ConflictException;
import com.ericmignardi.atlas.common.error.NotFoundException;
import com.ericmignardi.atlas.common.error.ValidationException;
import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.project.dto.CreateProjectRequest;
import com.ericmignardi.atlas.project.dto.ProjectFilter;
import com.ericmignardi.atlas.project.dto.ProjectResponse;
import com.ericmignardi.atlas.project.dto.UpdateProjectRequest;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

/**
 * The rules, with the database mocked away. The point of testing them here
 * rather than only through MockMvc is that a failure names the rule that broke
 * instead of a status code that could have come from anywhere.
 */
@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

	private static final UUID USER_ID = UUID.randomUUID();

	@Mock
	private ProjectRepository projects;

	@Mock
	private TagRepository tags;

	@Mock
	private UserRepository users;

	@Mock
	private EnvironmentRepository environments;

	@Mock
	private TaskRepository tasks;

	@Mock
	private SlugService slugs;

	@InjectMocks
	private ProjectService service;

	private User owner;

	@BeforeEach
	void setUp() {
		owner = TestFixtures.user("owner@example.com");
		owner.setId(USER_ID);
		lenient().when(users.getReferenceById(USER_ID)).thenReturn(owner);
		lenient().when(projects.save(any(Project.class))).thenAnswer(call -> {
			Project saved = call.getArgument(0);
			if (saved.getId() == null) {
				saved.setId(UUID.randomUUID());
			}
			return saved;
		});
	}

	@Test
	void createsAProjectWithADerivedSlugAndTheDefaultStatus() {
		when(slugs.uniqueSlug("Harbourfront Dental", USER_ID, null)).thenReturn("harbourfront-dental");

		ProjectResponse created = service.create(USER_ID,
				request("Harbourfront Dental", null, null, null, null));

		assertThat(created.slug()).isEqualTo("harbourfront-dental");
		assertThat(created.status()).isEqualTo(ProjectStatus.IDEA);
		assertThat(created.pinned()).isFalse();
	}

	@Test
	void trimsBlankOptionalFieldsToNullRatherThanStoringEmptyStrings() {
		when(slugs.uniqueSlug(any(), any(), any())).thenReturn("atlas");

		ProjectResponse created = service.create(USER_ID,
				new CreateProjectRequest("Atlas", "   ", "", null, "", null, "  ", null, null, null));

		assertThat(created.client()).isNull();
		assertThat(created.description()).isNull();
		assertThat(created.repoUrl()).isNull();
		assertThat(created.engagement()).isNull();
	}

	@Test
	void removesDuplicateTechStackEntriesAndKeepsTheOrder() {
		when(slugs.uniqueSlug(any(), any(), any())).thenReturn("atlas");

		ProjectResponse created = service.create(USER_ID, request("Atlas", null, null,
				List.of("Java 21", "Spring Boot", "java 21", "Java 21", "  "), null));

		// "java 21" differs by case and is a different entry — the rule is exact
		// duplicates, because a tech chip is displayed as it was typed.
		assertThat(created.techStack()).containsExactly("Java 21", "Spring Boot", "java 21");
	}

	@Test
	void rejectsATechStackEntryLongerThanTheColumnAllows() {
		when(slugs.uniqueSlug(any(), any(), any())).thenReturn("atlas");

		ValidationException thrown = catchThrowableOfType(ValidationException.class,
				() -> service.create(USER_ID, request("Atlas", null, null, List.of("x".repeat(41)), null)));

		// FR-8.4: the message has to arrive keyed to the input that caused it.
		assertThat(thrown.getFields()).containsKey("techStack");
	}

	@Test
	void rejectsAStartDateOutsideTheSanityWindow() {
		when(slugs.uniqueSlug(any(), any(), any())).thenReturn("atlas");

		assertThatThrownBy(() -> service.create(USER_ID,
				request("Atlas", null, null, null, LocalDate.now().plusYears(3))))
				.isInstanceOf(ValidationException.class);
	}

	@Test
	void reportsAnUnknownTagAsAFieldErrorRatherThanAsForbidden() {
		when(slugs.uniqueSlug(any(), any(), any())).thenReturn("atlas");
		when(tags.findByIdInAndUserId(anyList(), eq(USER_ID))).thenReturn(List.of());

		assertThatThrownBy(() -> service.create(USER_ID, new CreateProjectRequest("Atlas", null, null,
				null, null, null, null, null, null, List.of(UUID.randomUUID()))))
				.isInstanceOf(ValidationException.class);
	}

	@Test
	void renamingRegeneratesTheSlugExcludingTheProjectItself() {
		Project existing = existing("atlas", "Atlas");
		when(projects.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));
		when(slugs.uniqueSlug("Atlas Portal", USER_ID, existing.getId())).thenReturn("atlas-portal");

		UpdateProjectRequest request = new UpdateProjectRequest();
		request.setName(JsonNullable.of("Atlas Portal"));

		ProjectResponse updated = service.update(USER_ID, existing.getId(), request);

		assertThat(updated.name()).isEqualTo("Atlas Portal");
		assertThat(updated.slug()).isEqualTo("atlas-portal");
	}

	@Test
	void anEmptyPatchChangesNothing() {
		Project existing = existing("atlas", "Atlas");
		existing.setClient("Harbourfront");
		existing.setStatus(ProjectStatus.ACTIVE);
		when(projects.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));

		ProjectResponse updated = service.update(USER_ID, existing.getId(), new UpdateProjectRequest());

		assertThat(updated.name()).isEqualTo("Atlas");
		assertThat(updated.slug()).isEqualTo("atlas");
		assertThat(updated.client()).isEqualTo("Harbourfront");
		assertThat(updated.status()).isEqualTo(ProjectStatus.ACTIVE);
		// The rename branch is what regenerates a slug. An untouched name must
		// not reach it at all.
		verify(slugs, never()).uniqueSlug(any(), any(), any());
	}

	@Test
	void anExplicitNullClearsOnlyThatField() {
		Project existing = existing("atlas", "Atlas");
		existing.setClient("Harbourfront");
		existing.setEngagement("Retainer");
		when(projects.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));

		UpdateProjectRequest request = new UpdateProjectRequest();
		request.setClient(JsonNullable.of(null));

		ProjectResponse updated = service.update(USER_ID, existing.getId(), request);

		assertThat(updated.client()).isNull();
		assertThat(updated.engagement()).isEqualTo("Retainer");
	}

	@Test
	void pinsUpToTheCapAndConflictsBeyondIt() {
		Project existing = existing("atlas", "Atlas");
		when(projects.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));
		when(projects.countByUserIdAndPinnedTrue(USER_ID)).thenReturn((long) ProjectService.MAX_PINNED);

		assertThatThrownBy(() -> service.pin(USER_ID, existing.getId()))
				.isInstanceOf(ConflictException.class)
				.hasMessageContaining("At most 4");
	}

	@Test
	void pinningAnAlreadyPinnedProjectIsNotAConflict() {
		Project existing = existing("atlas", "Atlas");
		existing.setPinned(true);
		when(projects.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));

		assertThat(service.pin(USER_ID, existing.getId()).pinned()).isTrue();
		// The cap is only consulted when the pin count would actually change.
		verify(projects, never()).countByUserIdAndPinnedTrue(any());
	}

	@Test
	void treatsAnotherUsersProjectAsMissing() {
		UUID id = UUID.randomUUID();
		when(projects.findByIdAndUserId(id, USER_ID)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.get(USER_ID, id)).isInstanceOf(NotFoundException.class);
	}

	@Test
	void listExcludesArchivedUnlessAskedAndPassesTheFilterDown() {
		when(projects.search(USER_ID, false, null, null, null)).thenReturn(List.of());

		service.list(USER_ID, new ProjectFilter(null, null, null, false, null));

		verify(projects).search(USER_ID, false, null, null, null);
	}

	@Test
	void askingForArchivedByStatusIsItselfARequestToIncludeThem() {
		when(projects.search(USER_ID, true, ProjectStatus.ARCHIVED, null, null)).thenReturn(List.of());

		service.list(USER_ID, new ProjectFilter(ProjectStatus.ARCHIVED, null, null, false, null));

		// Otherwise ?status=ARCHIVED would return nothing, which reads as a bug
		// in the filter rather than as the archived rule doing its job.
		verify(projects).search(USER_ID, true, ProjectStatus.ARCHIVED, null, null);
	}

	@Test
	void lowercasesAndWildcardsTheFreeTextQuery() {
		when(projects.search(eq(USER_ID), eq(false), eq(null), eq(null), eq("%harbour%")))
				.thenReturn(List.of());

		service.list(USER_ID, new ProjectFilter(null, null, "  Harbour ", false, null));

		verify(projects).search(USER_ID, false, null, null, "%harbour%");
	}

	@Test
	void sortsPinnedProjectsFirstThenByTheChosenKey() {
		Project pinned = existing("zeta", "Zeta");
		pinned.setPinned(true);
		Project alpha = existing("alpha", "Alpha");
		when(projects.search(USER_ID, false, null, null, null)).thenReturn(List.of(alpha, pinned));

		List<ProjectResponse> listed = service.list(USER_ID,
				new ProjectFilter(null, null, null, false, "name"));

		assertThat(listed).extracting(ProjectResponse::name).containsExactly("Zeta", "Alpha");
	}

	private Project existing(String slug, String name) {
		Project project = TestFixtures.project(owner, slug);
		project.setName(name);
		project.setId(UUID.randomUUID());
		project.setCreatedAt(java.time.Instant.now());
		project.setUpdatedAt(java.time.Instant.now());
		return project;
	}

	private static CreateProjectRequest request(String name, String client, String description,
			List<String> techStack, LocalDate startedAt) {

		return new CreateProjectRequest(name, client, description, null, null, null, null, techStack,
				startedAt, null);
	}

}
