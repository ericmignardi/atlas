package com.ericmignardi.atlas.common.error;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The one body every failure produces (PRD 6.1). Built only by
 * {@link GlobalExceptionHandler} — nothing else should be constructing error
 * payloads, because the moment two places do, they drift.
 *
 * <p>{@code fields} is populated on 400 and null everywhere else; {@code code}
 * carries a machine-readable reason on the conflicts that have one (PRD 6.4's
 * {@code PAIR_DIFFERENT_TYPE} and friends). {@code NON_NULL} keeps both out of
 * the JSON entirely rather than emitting {@code "fields": null}, so the shape
 * the frontend checks is "is the key there", not "is the value null".
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
		Instant timestamp,
		int status,
		String error,
		String path,
		String code,
		Map<String, List<String>> fields) {

	public static ErrorResponse of(HttpStatus status, String message, HttpServletRequest request) {
		return new ErrorResponse(Instant.now(), status.value(), message, path(request), null, null);
	}

	public static ErrorResponse of(HttpStatus status, String message, String code,
			HttpServletRequest request) {
		return new ErrorResponse(Instant.now(), status.value(), message, path(request), code, null);
	}

	public static ErrorResponse validation(String message, Map<String, List<String>> fields,
			HttpServletRequest request) {
		return new ErrorResponse(Instant.now(), HttpStatus.BAD_REQUEST.value(), message, path(request),
				null, fields);
	}

	private static String path(HttpServletRequest request) {
		return request == null ? null : request.getRequestURI();
	}
}
