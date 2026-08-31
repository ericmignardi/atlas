package com.ericmignardi.atlas.common.error;

import org.springframework.http.HttpStatus;

/**
 * 404. Also the answer for a row that exists but belongs to somebody else
 * (PRD 6.1) — a 403 would confirm the id is real, which is a disclosure the
 * repository layer's user-scoped lookups are designed to avoid making.
 */
public class NotFoundException extends ApiException {

	private static final long serialVersionUID = 1L;

	public NotFoundException(String message) {
		super(HttpStatus.NOT_FOUND, message);
	}

	public static NotFoundException of(String what, Object id) {
		return new NotFoundException(what + " " + id + " was not found");
	}
}
