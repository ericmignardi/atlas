package com.ericmignardi.atlas.common.error;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 400 for rules Bean Validation cannot express. It carries the same
 * {@code fields} map an annotation failure produces, so the frontend attaches
 * the message to the input either way (FR-8.4).
 */
@Getter
public class ValidationException extends ApiException {

	private static final long serialVersionUID = 1L;

	private final transient Map<String, List<String>> fields;

	public ValidationException(Map<String, List<String>> fields) {
		super(HttpStatus.BAD_REQUEST, "Validation failed");
		this.fields = Map.copyOf(fields);
	}

	public static ValidationException of(String field, String message) {
		Map<String, List<String>> fields = new LinkedHashMap<>();
		fields.put(field, List.of(message));
		return new ValidationException(fields);
	}
}
