package com.ericmignardi.atlas.common.error;

import org.springframework.http.HttpStatus;

/**
 * 404, and also the answer for a row that belongs to somebody else: a 403 would
 * confirm the id is real (NFR-2.7).
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
