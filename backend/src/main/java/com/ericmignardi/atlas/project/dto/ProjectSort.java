package com.ericmignardi.atlas.project.dto;

import java.util.Comparator;
import java.util.Locale;

import com.ericmignardi.atlas.project.Project;

/**
 * FR-2.13. Comparators rather than fragments of SQL: building an ORDER BY from
 * a request parameter hands a caller control of the query.
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

	/** FR-2.8: pinned projects lead every order, so the list agrees with the dashboard. */
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
