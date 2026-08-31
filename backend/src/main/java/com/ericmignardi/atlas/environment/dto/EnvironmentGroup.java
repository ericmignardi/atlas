package com.ericmignardi.atlas.environment.dto;

import java.util.List;

import com.ericmignardi.atlas.environment.EnvironmentType;

/** FR-3.5. Present even when empty, so the three cards do not come and go. */
public record EnvironmentGroup(
		EnvironmentType type,
		List<EnvironmentRow> rows,
		List<EnvironmentSummary> orphanDatabases) {
}
