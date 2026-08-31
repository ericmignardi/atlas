package com.ericmignardi.atlas.common.error;

import org.springframework.http.HttpStatus;

/**
 * 409 — the request was well formed and the caller is allowed to make it, but
 * honouring it would break a business invariant: a fifth pinned project
 * (FR-2.8), a tag renamed onto a name already in use.
 *
 * <p>The {@code code} is the part a client can branch on. Messages get
 * rewritten; codes are the contract.
 */
public class ConflictException extends ApiException {

	private static final long serialVersionUID = 1L;

	public ConflictException(String code, String message) {
		super(HttpStatus.CONFLICT, message, code);
	}
}
