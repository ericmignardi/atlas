package com.ericmignardi.atlas.auth.dto;

import java.util.Locale;

/**
 * FR-1.1. One rule, applied at the edge by every DTO that carries an email, so
 * "the same account" means the same thing on registration and on sign-in. The
 * {@code lower(email)} unique index is the backstop if a future code path
 * forgets.
 */
final class Emails {

	private Emails() {
	}

	static String normalise(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}
}
