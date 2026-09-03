package com.ericmignardi.atlas.search.dto;

import java.util.UUID;

import com.ericmignardi.atlas.environment.Environment;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;
import com.ericmignardi.atlas.project.dto.ProjectSummary;

/**
 * The project is not decoration: an environment is only reachable through its
 * project's map, so the slug is how the palette navigates to this row at all.
 */
public record SearchEnvironment(
		UUID id,
		String name,
		EnvironmentType type,
		Platform platform,
		String branch,
		ProjectSummary project) {

	public static SearchEnvironment from(Environment environment) {
		return new SearchEnvironment(
				environment.getId(),
				environment.getName(),
				environment.getType(),
				environment.getPlatform(),
				environment.getBranch(),
				ProjectSummary.from(environment.getProject()));
	}
}
