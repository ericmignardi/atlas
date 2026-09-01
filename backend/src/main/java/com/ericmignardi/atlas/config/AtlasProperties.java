package com.ericmignardi.atlas.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed configuration bound once at startup, in place of {@code @Value} strings
 * scattered across the classes that need them. A record gets constructor
 * binding for free, which is what makes every field final and the object safe
 * to share between beans.
 *
 * <p>{@code atlas.jwt.secret} deliberately has no default in
 * {@code application.yml}. With {@code JWT_SECRET} unset the property binds to
 * the unresolved placeholder text itself, which is 13 characters —
 * {@link com.ericmignardi.atlas.security.JwtService} then refuses it for being
 * under 256 bits and the context never finishes starting (NFR-2.2). Either way,
 * a misconfigured deployment dies at startup with a message naming the variable,
 * rather than signing tokens with something guessable.
 */
@ConfigurationProperties(prefix = "atlas")
public record AtlasProperties(Jwt jwt, Cors cors) {

	/** FR-1.4 access TTL 15 minutes, FR-1.5 refresh TTL 7 days. */
	public record Jwt(String secret, Duration accessTokenTtl, Duration refreshTokenTtl) {
	}

	/** NFR-2.4: exactly one origin. There is no list and no wildcard. */
	public record Cors(String allowedOrigin) {
	}
}
