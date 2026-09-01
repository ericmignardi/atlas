package com.ericmignardi.atlas.security;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.ericmignardi.atlas.common.error.ErrorResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import tools.jackson.databind.ObjectMapper;

/**
 * Failures inside the filter chain never reach {@code @RestControllerAdvice} —
 * there is no handler method for the advice to wrap. Without this, Spring falls
 * back to the servlet container's HTML error page and the frontend's error
 * handling breaks on the first expired token.
 *
 * <p>Both interfaces on one class so the 401 and the 403 cannot drift apart:
 * they are the same {@link ErrorResponse} shape every other failure produces.
 *
 * <p>FR-1.8: no credentials is 401, valid credentials without the required role
 * is 403. Note that this is *not* the FR-1.9 case — another user's record is a
 * 404 decided in the service layer, because a 403 would confirm the row exists.
 */
@Component
@RequiredArgsConstructor
public class SecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

	private final ObjectMapper objectMapper;

	@Override
	public void commence(HttpServletRequest request, HttpServletResponse response,
			AuthenticationException authException) throws IOException {

		write(request, response, HttpStatus.UNAUTHORIZED, "Authentication is required");
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response,
			AccessDeniedException accessDeniedException) throws IOException {

		write(request, response, HttpStatus.FORBIDDEN, "You do not have access to that");
	}

	/**
	 * The exception's own message is deliberately discarded (NFR-2.7): it names
	 * filters and expression strings the caller has no business seeing.
	 */
	private void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status,
			String message) throws IOException {

		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setCharacterEncoding("UTF-8");
		objectMapper.writeValue(response.getOutputStream(), ErrorResponse.of(status, message, request));
	}
}
