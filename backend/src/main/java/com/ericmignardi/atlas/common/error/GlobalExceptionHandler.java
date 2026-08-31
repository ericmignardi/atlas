package com.ericmignardi.atlas.common.error;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import tools.jackson.core.JacksonException;

/**
 * Every failure leaves the application through here, in the shape of PRD 6.1.
 * One advice, one body, no per-controller try/catch — which is the only way the
 * error handling on the other side can be written once.
 *
 * <p>Resolution is by <em>most specific</em> exception type, not by declaration
 * order, so the catch-all {@code Exception} handler at the bottom only sees what
 * nothing above it claimed. That is also why it has to reason about
 * {@link org.springframework.web.ErrorResponse}: the framework's own exceptions
 * — unknown path, wrong method, missing parameter — already carry the right
 * status, and letting the catch-all turn those into 500s is a regression you
 * notice only in production logs.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	private static final String VALIDATION_FAILED = "Validation failed";

	/** NotFound, Conflict, and everything else raised on purpose. */
	@ExceptionHandler(ApiException.class)
	public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest request) {
		if (ex instanceof ValidationException validation) {
			return ResponseEntity.badRequest()
					.body(ErrorResponse.validation(ex.getMessage(), validation.getFields(), request));
		}
		return ResponseEntity.status(ex.getStatus())
				.body(ErrorResponse.of(ex.getStatus(), ex.getMessage(), ex.getCode(), request));
	}

	/** A {@code @Valid @RequestBody} failed. This is the handler FR-8.4 rests on. */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> handleBodyValidation(MethodArgumentNotValidException ex,
			HttpServletRequest request) {

		Map<String, List<String>> fields = new LinkedHashMap<>();
		for (FieldError error : ex.getBindingResult().getFieldErrors()) {
			add(fields, error.getField(), error.getDefaultMessage());
		}
		for (ObjectError error : ex.getBindingResult().getGlobalErrors()) {
			add(fields, error.getObjectName(), error.getDefaultMessage());
		}
		return ResponseEntity.badRequest().body(ErrorResponse.validation(VALIDATION_FAILED, fields, request));
	}

	/** {@code @Validated} on a path variable or request parameter, Spring 6 style. */
	@ExceptionHandler(HandlerMethodValidationException.class)
	public ResponseEntity<ErrorResponse> handleParameterValidation(HandlerMethodValidationException ex,
			HttpServletRequest request) {

		Map<String, List<String>> fields = new LinkedHashMap<>();
		for (ParameterValidationResult result : ex.getParameterValidationResults()) {
			String name = result.getMethodParameter().getParameterName();
			result.getResolvableErrors().forEach(error -> add(fields, name, error.getDefaultMessage()));
		}
		return ResponseEntity.badRequest().body(ErrorResponse.validation(VALIDATION_FAILED, fields, request));
	}

	/** The same shape again, for violations raised outside the MVC binding path. */
	@ExceptionHandler(ConstraintViolationException.class)
	public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex,
			HttpServletRequest request) {

		Map<String, List<String>> fields = new LinkedHashMap<>();
		for (ConstraintViolation<?> violation : ex.getConstraintViolations()) {
			add(fields, lastNode(violation.getPropertyPath().toString()), violation.getMessage());
		}
		return ResponseEntity.badRequest().body(ErrorResponse.validation(VALIDATION_FAILED, fields, request));
	}

	/**
	 * Unparseable or mistyped JSON: {@code "status": "NOPE"}, a malformed date, a
	 * trailing comma. Jackson records which property it choked on, so most of
	 * these recover into the same field-level shape instead of a bare 400.
	 */
	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex,
			HttpServletRequest request) {

		Map<String, List<String>> fields = new LinkedHashMap<>();
		if (ex.getCause() instanceof JacksonException cause) {
			cause.getPath().stream()
					.map(JacksonException.Reference::getPropertyName)
					.filter(name -> name != null && !name.isBlank())
					.reduce((first, second) -> first + "." + second)
					.ifPresent(field -> add(fields, field, "is not a valid value"));
		}
		if (fields.isEmpty()) {
			return ResponseEntity.badRequest()
					.body(ErrorResponse.of(HttpStatus.BAD_REQUEST, "Malformed request body", request));
		}
		return ResponseEntity.badRequest().body(ErrorResponse.validation(VALIDATION_FAILED, fields, request));
	}

	/** A path variable or query parameter that will not convert — a non-UUID id. */
	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
			HttpServletRequest request) {

		Map<String, List<String>> fields = new LinkedHashMap<>();
		add(fields, ex.getName(), "is not a valid value");
		return ResponseEntity.badRequest().body(ErrorResponse.validation(VALIDATION_FAILED, fields, request));
	}

	@ExceptionHandler(AuthenticationException.class)
	public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex,
			HttpServletRequest request) {

		return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
				.body(ErrorResponse.of(HttpStatus.UNAUTHORIZED, "Authentication is required", request));
	}

	@ExceptionHandler(AccessDeniedException.class)
	public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex,
			HttpServletRequest request) {

		return ResponseEntity.status(HttpStatus.FORBIDDEN)
				.body(ErrorResponse.of(HttpStatus.FORBIDDEN, "You do not have access to that", request));
	}

	/**
	 * A constraint the service did not catch first. The real message names the
	 * index and quotes the row, so it is logged and not returned (NFR-2.7): the
	 * caller learns that something conflicted, not what the schema looks like.
	 */
	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex,
			HttpServletRequest request) {

		log.warn("Data integrity violation on {}", request.getRequestURI(), ex);
		return ResponseEntity.status(HttpStatus.CONFLICT)
				.body(ErrorResponse.of(HttpStatus.CONFLICT,
						"That change conflicts with data that already exists", "DATA_INTEGRITY", request));
	}

	/**
	 * The backstop. A correlation id goes into both the log line and the response
	 * so a report of "it broke" can be matched to a stack trace without the stack
	 * trace ever crossing the wire.
	 */
	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
		HttpStatus delegated = delegatedStatus(ex);
		if (delegated != null) {
			return ResponseEntity.status(delegated)
					.body(ErrorResponse.of(delegated, reason(ex, delegated), request));
		}

		String correlationId = UUID.randomUUID().toString().substring(0, 8);
		log.error("Unhandled exception on {} [ref {}]", request.getRequestURI(), correlationId, ex);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
				.body(ErrorResponse.of(HttpStatus.INTERNAL_SERVER_ERROR,
						"Something went wrong. Reference " + correlationId, request));
	}

	/**
	 * Spring MVC exceptions already carry the status they deserve. 5xx is
	 * deliberately excluded — those still take the correlation-id path.
	 */
	private static HttpStatus delegatedStatus(Exception ex) {
		if (!(ex instanceof org.springframework.web.ErrorResponse errorResponse)) {
			return null;
		}
		HttpStatus status = HttpStatus.resolve(errorResponse.getStatusCode().value());
		return status != null && !status.is5xxServerError() ? status : null;
	}

	private static String reason(Exception ex, HttpStatus status) {
		if (ex instanceof ErrorResponseException responseException) {
			String detail = responseException.getBody().getDetail();
			if (detail != null && !detail.isBlank()) {
				return detail;
			}
		}
		return status.getReasonPhrase();
	}

	/**
	 * Keys the map on the JSON field name (FR-8.4) so an error can be looked up
	 * by the name of the input that produced it. Container-element constraints —
	 * the {@code JsonNullable<@Size String>} on every PATCH DTO — come out of
	 * Hibernate Validator as {@code name[].<jsonnullable>}, which would match no
	 * input at all, so everything from the first bracket is dropped.
	 */
	private static void add(Map<String, List<String>> fields, String rawField, String message) {
		fields.computeIfAbsent(normalize(rawField), key -> new ArrayList<>())
				.add(message == null ? "is not valid" : message);
	}

	private static String normalize(String rawField) {
		if (rawField == null || rawField.isBlank()) {
			return "request";
		}
		int cut = rawField.length();
		for (char marker : new char[] { '[', '<' }) {
			int index = rawField.indexOf(marker);
			if (index > 0 && index < cut) {
				cut = index;
			}
		}
		String field = rawField.substring(0, cut);
		while (field.endsWith(".")) {
			field = field.substring(0, field.length() - 1);
		}
		return field.isBlank() ? "request" : field;
	}

	/** {@code create.request.name} is reported to the caller as {@code name}. */
	private static String lastNode(String propertyPath) {
		int lastDot = propertyPath.lastIndexOf('.');
		return lastDot < 0 ? propertyPath : propertyPath.substring(lastDot + 1);
	}
}
