package com.ericmignardi.atlas.common.error;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * The base of every failure the application raises deliberately, as opposed to
 * the ones the framework throws at us. Carrying the status on the exception is
 * what lets {@link GlobalExceptionHandler} have one handler for the whole
 * family instead of one per subclass.
 *
 * <p>No stack trace is filled in: these are control flow for expected outcomes
 * — a 404 for a missing project is not an incident — and capturing a trace for
 * each one costs more than everything else the request does. The genuinely
 * unexpected failures reach the {@code Exception} handler, which logs the trace
 * in full.
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
