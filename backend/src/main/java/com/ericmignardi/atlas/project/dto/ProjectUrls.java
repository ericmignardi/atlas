package com.ericmignardi.atlas.project.dto;

final class ProjectUrls {

	/**
	 * The empty alternative matters: a form clearing a URL input sends {@code ""},
	 * not a missing key, and rejecting it would make "remove the repo link"
	 * impossible. Not the rule for an environment URL, which is free text.
	 */
	static final String PATTERN = "^$|^https?://\\S+$";

	static final String MESSAGE = "must be an http or https URL";

	private ProjectUrls() {
	}
}
