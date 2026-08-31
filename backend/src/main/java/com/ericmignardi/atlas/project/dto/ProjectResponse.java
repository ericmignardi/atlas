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

		/** Named isPinned in the contract, and pinned on the entity. */
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
