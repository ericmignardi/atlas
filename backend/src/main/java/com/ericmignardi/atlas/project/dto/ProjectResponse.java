package com.ericmignardi.atlas.project.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectStatus;
import com.ericmignardi.atlas.tag.ProjectTag;
import com.ericmignardi.atlas.tag.dto.TagSummary;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * PRD 6.3. Built only inside the service, while the entity is still attached, so
 * the lazy tag association can be walked without {@code open-in-view}.
 *
 * <p>The mapping is a static factory and nothing else — no library, no
 * annotation processor. Twenty lines, and the compiler enforces exactly what a
 * mapping tool sells as an unmapped-property check: add a component and every
 * call site fails to build until it supplies one.
 */
public record ProjectResponse(
		UUID id,
		String name,
		String slug,
		String client,
		String description,
		ProjectStatus status,
		String repoUrl,
		String liveUrl,
		String engagement,
		List<String> techStack,

		/*
		 * Named isPinned in the contract, and pinned on the entity. Jackson would
		 * otherwise be free to publish this as "pinned" — the explicit name is
		 * what keeps the JSON stable no matter what the record component is
		 * called.
		 */
		@JsonProperty("isPinned") boolean pinned,

		LocalDate startedAt,
		List<TagSummary> tags,
		long environmentCount,
		long openTaskCount,
		long overdueTaskCount,
		Instant createdAt,
		Instant updatedAt) {

	public static ProjectResponse from(Project project, ProjectCounts counts) {
		return new ProjectResponse(
				project.getId(),
				project.getName(),
				project.getSlug(),
				project.getClient(),
				project.getDescription(),
				project.getStatus(),
				project.getRepoUrl(),
				project.getLiveUrl(),
				project.getEngagement(),
				List.copyOf(project.getTechStack()),
				project.isPinned(),
				project.getStartedAt(),
				tagsOf(project),
				counts.environments(),
				counts.openTasks(),
				counts.overdueTasks(),
				project.getCreatedAt(),
				project.getUpdatedAt());
	}

	/** Alphabetical, so a chip row does not reshuffle between two identical reads. */
	private static List<TagSummary> tagsOf(Project project) {
		return project.getTags().stream()
				.map(ProjectTag::getTag)
				.map(TagSummary::from)
				.sorted(Comparator.comparing(TagSummary::name))
				.toList();
	}
}
