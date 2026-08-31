package com.ericmignardi.atlas.common.error;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * No stack trace is filled in: these are control flow for expected outcomes, and
 * capturing a trace for each one costs more than everything else the request
 * does. Genuinely unexpected failures reach the {@code Exception} handler, which
 * logs the trace in full.
 */
@Getter
public class ApiException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	private final HttpStatus status;

	/** Machine-readable reason, or null when the message is the whole story. */
	private final String code;

	public ApiException(HttpStatus status, String message) {
		this(status, message, null);
	}

	public ApiException(HttpStatus status, String message, String code) {
		super(message, null, false, false);
		this.status = status;
		this.code = code;
	}
}
