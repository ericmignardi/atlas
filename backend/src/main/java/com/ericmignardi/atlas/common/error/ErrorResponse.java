package com.ericmignardi.atlas.common.error;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The one body every failure produces. {@code NON_NULL} keeps {@code fields} and
 * {@code code} out of the JSON entirely rather than emitting nulls, so the shape
 * the frontend checks is "is the key there".
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
