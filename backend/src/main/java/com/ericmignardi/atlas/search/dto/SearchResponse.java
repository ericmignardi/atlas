package com.ericmignardi.atlas.search.dto;

import java.util.List;

/**
 * FR-7.2. Three lists, always present and always in this order, because the
 * palette renders its groups in a fixed order (Projects, Environments, Tasks)
 * and a group that appears and disappears makes the row under the cursor move.
 */
public record SearchResponse(
		List<SearchProject> projects,
		List<SearchEnvironment> environments,
		List<SearchTask> tasks) {

	public static SearchResponse empty() {
		return new SearchResponse(List.of(), List.of(), List.of());
	}
}
