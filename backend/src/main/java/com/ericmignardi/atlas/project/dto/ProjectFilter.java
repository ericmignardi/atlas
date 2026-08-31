package com.ericmignardi.atlas.project.dto;

import java.util.Locale;

import com.ericmignardi.atlas.project.ProjectStatus;

/**
 * The query string of {@code GET /api/projects} (FR-2.7, FR-2.12, FR-2.13),
 * bound as one object so the controller signature stays a single parameter and
 * the filter can grow without every caller changing.
 *
 * @param status          exact status, or null for all of them
 * @param tag             tag <em>name</em>, not id — the UI filters from a chip
 *                        the user can read, and names are unique per account
 * @param q               case-insensitive substring over name, client, and
 *                        description
 * @param includeArchived archived projects are excluded unless this is set, or
 *                        unless {@code status=ARCHIVED} asks for them by name.
 *                        Boxed, not primitive: an absent query parameter binds
 *                        as null, and constructor binding has nowhere to put a
 *                        null in a {@code boolean} — the whole request fails
 *                        with a 400 about a parameter nobody sent
 * @param sort            one of updated, created, name, status
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

	/** Null and blank are the same thing to a filter, and only one of them is easy to test for. */
	public String normalisedQuery() {
		return q == null || q.isBlank() ? null : q.trim();
	}

	public String normalisedTag() {
		return tag == null || tag.isBlank() ? null : tag.trim().toLowerCase(Locale.ROOT);
	}
}
