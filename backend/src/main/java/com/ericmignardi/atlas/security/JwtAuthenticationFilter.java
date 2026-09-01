package com.ericmignardi.atlas.security;

import java.io.IOException;
import java.util.UUID;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Reads the bearer token and, if it verifies, populates the security context.
 *
 * <p>It never rejects a request. An absent, malformed, or expired token simply
 * leaves the context empty and the chain continues; the authorization rules then
 * produce the 401 through {@link SecurityErrorHandler}. Throwing here would put
 * the decision in two places and give a different response body depending on
 * which one fired first.
 *
 * <p>{@code OncePerRequestFilter} rather than a plain {@code Filter} because a
 * forward or an ERROR dispatch would otherwise run the parse again for the same
 * request.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String HEADER = "Authorization";
	private static final String PREFIX = "Bearer ";

	private final JwtService jwtService;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain chain) throws ServletException, IOException {

		String token = bearerToken(request);
		if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
			jwtService.parse(token).ifPresent(claims -> authenticate(claims, request));
		}
		chain.doFilter(request, response);
	}

	private void authenticate(Claims claims, HttpServletRequest request) {
		UUID id;
		try {
			id = UUID.fromString(claims.getSubject());
		} catch (IllegalArgumentException | NullPointerException e) {
			// Signed by us but without a usable subject: treat it as no token
			// rather than as a server error.
			return;
		}

		// No database read. The token is the assertion, which is the whole point
		// of a stateless API; the cost is that a token stays good for the rest of
		// its 15 minutes even if the account is deleted, which is why the TTL is
		// short and the refresh token is the revocable half.
		UserPrincipal principal = UserPrincipal.fromToken(id, jwtService.email(claims),
				jwtService.roles(claims));

		UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
				principal, null, principal.getAuthorities());
		authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
		SecurityContextHolder.getContext().setAuthentication(authentication);
	}

	private static String bearerToken(HttpServletRequest request) {
		String header = request.getHeader(HEADER);
		if (header == null || !header.startsWith(PREFIX)) {
			return null;
		}
		String token = header.substring(PREFIX.length()).trim();
		return token.isEmpty() ? null : token;
	}
}
