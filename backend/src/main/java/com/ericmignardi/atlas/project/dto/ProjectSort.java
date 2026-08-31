package com.ericmignardi.atlas.project.dto;

import java.util.Comparator;
import java.util.Locale;

import com.ericmignardi.atlas.project.Project;

/**
 * FR-2.13. The four orders the list offers, as comparators rather than as
 * fragments of SQL: the list query fetch-joins tags, so it already returns a
 * whole page of the user's projects in one round trip, and re-ordering that in
 * memory costs nothing a personal portal will ever notice. Building the ORDER BY
 * from a request parameter is also the classic way to hand a caller control of
 * the query — this way the parameter can only select from a closed set.
 */
public enum ProjectSort {

	UPDATED(Comparator.comparing(Project::getUpdatedAt).reversed()),
	CREATED(Comparator.comparing(Project::getCreatedAt).reversed()),
	NAME(Comparator.comparing(Project::getName, String.CASE_INSENSITIVE_ORDER)),
	STATUS(Comparator.comparing(Project::getStatus).thenComparing(Project::getName,
			String.CASE_INSENSITIVE_ORDER));

	private final Comparator<Project> comparator;

	ProjectSort(Comparator<Project> comparator) {
		this.comparator = comparator;
	}

	/**
	 * Pinned projects lead every order (FR-6.x pins them to the dashboard, and a
	 * list that disagreed with the dashboard would be its own bug), then the
	 * chosen key.
	 */
	public Comparator<Project> comparator() {
		return Comparator.comparing(Project::isPinned).reversed().thenComparing(comparator);
	}

	/** Unknown or absent falls back to the default rather than 400-ing. */
	public static ProjectSort from(String raw) {
		if (raw == null || raw.isBlank()) {
			return UPDATED;
		}
		try {
			return valueOf(raw.trim().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException unknown) {
			return UPDATED;
		}
	}
}
