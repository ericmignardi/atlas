package com.ericmignardi.atlas.common.error;

import org.springframework.http.HttpStatus;

/** 409. The {@code code} is the contract a client branches on; messages are not. */
public class ConflictException extends ApiException {

	private static final long serialVersionUID = 1L;

	public ConflictException(String code, String message) {
		super(HttpStatus.CONFLICT, message, code);
	}
}
