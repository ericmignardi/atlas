package com.ericmignardi.atlas.project;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.common.error.ConflictException;
import com.ericmignardi.atlas.common.error.NotFoundException;
import com.ericmignardi.atlas.common.error.ValidationException;
import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.project.dto.CreateProjectRequest;
import com.ericmignardi.atlas.project.dto.ProjectCountRow;
import com.ericmignardi.atlas.project.dto.ProjectCounts;
import com.ericmignardi.atlas.project.dto.ProjectFilter;
import com.ericmignardi.atlas.project.dto.ProjectResponse;
import com.ericmignardi.atlas.project.dto.UpdateProjectRequest;
import com.ericmignardi.atlas.tag.ProjectTag;
import com.ericmignardi.atlas.tag.Tag;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.task.TaskStatus;
import com.ericmignardi.atlas.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * FR-2.1 – FR-2.14. Responses are built here, inside the transaction, which is
 * what lets the lazy tag association be read with {@code open-in-view} off.
 */
@Service
@RequiredArgsConstructor
public class ProjectService {

	/** FR-2.8. */
	static final int MAX_PINNED = 4;

	private static final int MAX_YEARS_PAST = 50;
	private static final int MAX_YEARS_FUTURE = 1;

	private static final int MAX_TECH_ENTRY_LENGTH = 40;

	private final ProjectRepository projects;
	private final TagRepository tags;
	private final UserRepository users;
	private final EnvironmentRepository environments;
	private final TaskRepository tasks;
	private final SlugService slugs;

	@Transactional(readOnly = true)
	public List<ProjectResponse> list(UUID userId, ProjectFilter filter) {
		String query = filter.normalisedQuery();

		List<Project> found = projects.search(
				userId,
				filter.archivedVisible(),
				filter.status(),
				filter.normalisedTag(),
				query == null ? null : "%" + query.toLowerCase(Locale.ROOT) + "%");

		CountLookup counts = countsForUser(userId);
		return found.stream()
				.sorted(filter.order().comparator())
				.map(project -> ProjectResponse.from(project, counts.of(project.getId())))
				.toList();
	}

	@Transactional(readOnly = true)
	public ProjectResponse get(UUID userId, UUID id) {
		return respond(require(userId, id));
	}

	/** FR-2.10. The slug is the URL the frontend routes on, so it is a first-class lookup. */
	@Transactional(readOnly = true)
	public ProjectResponse getBySlug(UUID userId, String slug) {
		Project project = projects.findBySlugAndUserId(slug, userId)
				.orElseThrow(() -> new NotFoundException("Project " + slug + " was not found"));
		return respond(project);
	}

	@Transactional
	public ProjectResponse create(UUID userId, CreateProjectRequest request) {
		Project project = new Project();
		project.setUser(users.getReferenceById(userId));
		project.setName(request.name().trim());
		project.setSlug(slugs.uniqueSlug(request.name(), userId, null));
		project.setClient(blankToNull(request.client()));
		project.setDescription(blankToNull(request.description()));
		project.setStatus(request.status() == null ? ProjectStatus.IDEA : request.status());
		project.setRepoUrl(blankToNull(request.repoUrl()));
		project.setLiveUrl(blankToNull(request.liveUrl()));
		project.setEngagement(blankToNull(request.engagement()));
		project.setTechStack(normaliseTechStack(request.techStack()));
		project.setStartedAt(checkStartedAt(request.startedAt()));

		applyTags(project, userId, request.tagIds());

		return respond(projects.save(project));
	}

	/**
	 * Each field is applied only when the key was present, so {@code {}} is a
	 * no-op and {@code {"client": null}} clears exactly one column. Reading this
	 * method is how you check that: every line is an {@code ifPresent}, and there
	 * is no {@code else}.
	 */
	@Transactional
	public ProjectResponse update(UUID userId, UUID id, UpdateProjectRequest request) {
		Project project = require(userId, id);

		// FR-2.5: a rename regenerates the slug, excluding this project so it
		// does not collide with its own old slug.
		request.getName().ifPresent(name -> {
			project.setName(name.trim());
			project.setSlug(slugs.uniqueSlug(name, userId, project.getId()));
		});
		request.getClient().ifPresent(client -> project.setClient(blankToNull(client)));
		request.getDescription().ifPresent(value -> project.setDescription(blankToNull(value)));
		request.getStatus().ifPresent(project::setStatus);
		request.getRepoUrl().ifPresent(url -> project.setRepoUrl(blankToNull(url)));
		request.getLiveUrl().ifPresent(url -> project.setLiveUrl(blankToNull(url)));
		request.getEngagement().ifPresent(value -> project.setEngagement(blankToNull(value)));
		// NOT NULL with an empty-array default, so an explicit null empties it
		// rather than failing.
		request.getTechStack().ifPresent(stack -> project.setTechStack(normaliseTechStack(stack)));
		request.getStartedAt().ifPresent(date -> project.setStartedAt(checkStartedAt(date)));
		// FR-5.7: a list replaces the set, an absent key leaves it alone.
		request.getTagIds().ifPresent(tagIds -> applyTags(project, userId, tagIds));

		return respond(projects.save(project));
	}

	/**
	 * FR-2.11. Environments cascade from the mapping; tasks do not, because they
	 * are not mapped here at all — the foreign key is ON DELETE SET NULL.
	 */
	@Transactional
	public void delete(UUID userId, UUID id) {
		projects.delete(require(userId, id));
	}

	/** FR-2.8. Idempotent: pinning what is already pinned is not a conflict. */
	@Transactional
	public ProjectResponse pin(UUID userId, UUID id) {
		Project project = require(userId, id);
		if (!project.isPinned()) {
			if (projects.countByUserIdAndPinnedTrue(userId) >= MAX_PINNED) {
				throw new ConflictException("PIN_LIMIT_REACHED",
						"At most " + MAX_PINNED + " projects can be pinned. Unpin one first.");
			}
			project.setPinned(true);
		}
		return respond(projects.save(project));
	}

	@Transactional
	public ProjectResponse unpin(UUID userId, UUID id) {
		Project project = require(userId, id);
		project.setPinned(false);
		return respond(projects.save(project));
	}

	private Project require(UUID userId, UUID id) {
		return projects.findByIdAndUserId(id, userId)
				.orElseThrow(() -> NotFoundException.of("Project", id));
	}

	/**
	 * FR-5.7 as a diff rather than a clear-and-rebuild. Clearing the collection
	 * and adding the same rows back leaves Hibernate free to order the inserts
	 * before the deletes inside one flush, and the composite primary key then
	 * rejects a row that is not actually changing.
	 */
	private void applyTags(Project project, UUID userId, List<UUID> tagIds) {
		Set<UUID> wanted = tagIds == null ? Set.of() : new LinkedHashSet<>(tagIds);

		List<Tag> resolved = wanted.isEmpty() ? List.of()
				: tags.findByIdInAndUserId(new ArrayList<>(wanted), userId);
		if (resolved.size() != wanted.size()) {
			// A tag belonging to somebody else is reported as unknown, not as
			// forbidden — confirming it exists would be the disclosure.
			throw ValidationException.of("tagIds", "contains a tag that does not exist");
		}

		Set<UUID> current = project.getTags().stream()
				.map(link -> link.getTag().getId())
				.collect(Collectors.toCollection(HashSet::new));

		project.getTags().removeIf(link -> !wanted.contains(link.getTag().getId()));
		resolved.stream()
				.filter(tag -> !current.contains(tag.getId()))
				.forEach(tag -> project.getTags().add(new ProjectTag(project, tag)));
	}

	/** Duplicates removed, order preserved, blanks dropped. */
	private List<String> normaliseTechStack(List<String> raw) {
		if (raw == null) {
			return new ArrayList<>();
		}
		Set<String> seen = new LinkedHashSet<>();
		for (String entry : raw) {
			if (entry == null || entry.isBlank()) {
				continue;
			}
			String trimmed = entry.trim();
			if (trimmed.length() > MAX_TECH_ENTRY_LENGTH) {
				throw ValidationException.of("techStack",
						"entries must be at most " + MAX_TECH_ENTRY_LENGTH + " characters");
			}
			seen.add(trimmed);
		}
		return new ArrayList<>(seen);
	}

	/**
	 * A typo in a year is the realistic failure — 2206 instead of 2026 — and it is
	 * invisible on a card but poisons every date sort. Bean Validation has no
	 * annotation for "within this window", so it is a check.
	 */
	private LocalDate checkStartedAt(LocalDate startedAt) {
		if (startedAt == null) {
			return null;
		}
		LocalDate today = LocalDate.now();
		if (startedAt.isBefore(today.minusYears(MAX_YEARS_PAST))
				|| startedAt.isAfter(today.plusYears(MAX_YEARS_FUTURE))) {
			throw ValidationException.of("startedAt",
					"must be within " + MAX_YEARS_PAST + " years past and " + MAX_YEARS_FUTURE
							+ " year future");
		}
		return startedAt;
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	private ProjectResponse respond(Project project) {
		UUID id = project.getId();
		return ProjectResponse.from(project, new ProjectCounts(
				environments.countByProjectId(id),
				tasks.countByProjectIdAndStatusNot(id, TaskStatus.DONE),
				tasks.countByProjectIdAndStatusNotAndDueDateBefore(id, TaskStatus.DONE, Instant.now())));
	}

	private CountLookup countsForUser(UUID userId) {
		return new CountLookup(
				index(environments.countByProjectForUser(userId)),
				index(tasks.countOpenByProjectForUser(userId)),
				index(tasks.countOverdueByProjectForUser(userId, Instant.now())));
	}

	private static Map<UUID, Long> index(List<ProjectCountRow> rows) {
		return rows.stream()
				.collect(Collectors.toMap(ProjectCountRow::projectId, ProjectCountRow::count,
						(a, b) -> a, HashMap::new));
	}

	/**
	 * Three grouped queries for a whole list instead of three per project
	 * (NFR-1.2). A project with nothing to count is absent from every map, which
	 * is why each lookup defaults to zero.
	 */
	private record CountLookup(Map<UUID, Long> environments, Map<UUID, Long> open,
			Map<UUID, Long> overdue) {

		ProjectCounts of(UUID projectId) {
			return new ProjectCounts(
					environments.getOrDefault(projectId, 0L),
					open.getOrDefault(projectId, 0L),
					overdue.getOrDefault(projectId, 0L));
		}
	}
}
