package com.ericmignardi.atlas.search.dto;

import java.util.UUID;

import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectStatus;

/**
 * A palette row, not a project. The slug is what the palette navigates on and
 * the client is the disambiguator between two projects called "Website" — every
 * other column would be weight on a list that has to render in one frame.
 */
public record SearchProject(UUID id, String name, String slug, String client, ProjectStatus status) {

	public static SearchProject from(Project project) {
		return new SearchProject(
				project.getId(),
				project.getName(),
				project.getSlug(),
				project.getClient(),
				project.getStatus());
	}
}
