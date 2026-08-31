package com.ericmignardi.atlas.project.dto;

import java.util.Locale;

import com.ericmignardi.atlas.project.ProjectStatus;

/**
 * FR-2.7, FR-2.12, FR-2.13. {@code tag} is the tag name, not its id: the UI
 * filters from a chip the user can read, and names are unique per account.
 *
 * <p>{@code includeArchived} is boxed, not primitive — an absent query parameter
 * binds as null, and constructor binding has nowhere to put a null in a
 * {@code boolean}.
 */
public record ProjectFilter(
		ProjectStatus status,
		String tag,
		String q,
		Boolean includeArchived,
		String sort) {

	/** FR-2.7: asking for archived by status is itself a request to include them. */
	public boolean archivedVisible() {
		return Boolean.TRUE.equals(includeArchived) || status == ProjectStatus.ARCHIVED;
	}

	public ProjectSort order() {
		return ProjectSort.from(sort);
	}

	public String normalisedQuery() {
		return q == null || q.isBlank() ? null : q.trim();
	}

	public String normalisedTag() {
		return tag == null || tag.isBlank() ? null : tag.trim().toLowerCase(Locale.ROOT);
	}
}
