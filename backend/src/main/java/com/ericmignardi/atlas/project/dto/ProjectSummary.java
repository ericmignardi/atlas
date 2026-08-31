package com.ericmignardi.atlas.project.dto;

import java.util.UUID;

import com.ericmignardi.atlas.project.Project;

public record ProjectSummary(UUID id, String name, String slug) {

	public static ProjectSummary from(Project project) {
		if (project == null) {
			return null;
		}
		return new ProjectSummary(project.getId(), project.getName(), project.getSlug());
	}
}
