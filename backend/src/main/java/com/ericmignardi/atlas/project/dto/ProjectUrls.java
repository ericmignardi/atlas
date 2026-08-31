package com.ericmignardi.atlas.project.dto;

/**
 * The URL rule of PRD 7.2, in one place so the create and update DTOs cannot
 * drift apart.
 *
 * <p>The empty alternative matters: a form that clears a URL input sends
 * {@code ""}, not a missing key, and a pattern that rejected it would make
 * "remove the repo link" impossible. The service turns blank into null on the
 * way to the entity, so nothing empty is ever stored.
 *
 * <p>Note this is <em>not</em> the rule for an environment URL — PRD 7.3 leaves
 * that free text, because a Neon connection string is not an HTTP URL.
 */
final class ProjectUrls {

	static final String PATTERN = "^$|^https?://\\S+$";

	static final String MESSAGE = "must be an http or https URL";

	private ProjectUrls() {
	}
}
