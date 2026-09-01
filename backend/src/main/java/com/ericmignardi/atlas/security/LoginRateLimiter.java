package com.ericmignardi.atlas.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.ericmignardi.atlas.common.error.ApiException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * NFR-2.9: ten login attempts per IP per minute.
 *
 * <p>A fixed window in a {@link ConcurrentHashMap}, not a token bucket and not a
 * sliding window. The failure it exists to stop is an unattended credential
 * script, and a fixed window stops that; the burst a window boundary allows —
 * twenty attempts across two adjacent seconds — is not the difference between
 * safe and breached.
 *
 * <p><strong>Single instance only.</strong> The state is in this JVM's heap, so
 * two replicas would each allow ten. Atlas deploys as one Container Apps
 * revision scaled to one, which makes this honest rather than theatrical; a
 * multi-instance deployment would move the counter to Redis and keep the same
 * interface.
 */
@Component
public class LoginRateLimiter {

	private static final int MAX_ATTEMPTS = 10;
	private static final Duration WINDOW = Duration.ofMinutes(1);

	private final Map<String, Window> windows = new ConcurrentHashMap<>();

	/**
	 * Counts one attempt and throws 429 once the window is full. Called before
	 * the password is checked, so a wrong password and a right one cost the
	 * attacker the same.
	 */
	public void check(HttpServletRequest request) {
		String client = clientAddress(request);
		Instant now = Instant.now();

		Window window = windows.compute(client,
				(key, existing) -> existing == null || existing.isExpired(now) ? new Window(now) : existing);

		if (window.count.incrementAndGet() > MAX_ATTEMPTS) {
			throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
					"Too many sign-in attempts. Try again in a minute.", "RATE_LIMITED");
		}

		// Bounded cleanup: without it the map grows one entry per distinct
		// address forever. Cheap because it only runs when the map is large.
		if (windows.size() > 10_000) {
			windows.values().removeIf(entry -> entry.isExpired(now));
		}
	}

	/** Test seam. Also what a deployment restart does, which is the honest reset. */
	public void reset() {
		windows.clear();
	}

	/**
	 * Behind Azure Container Apps ingress every request arrives from the proxy,
	 * so {@code getRemoteAddr()} alone would rate-limit the whole internet as one
	 * client. The first hop in {@code X-Forwarded-For} is the caller. That header
	 * is client-controlled and therefore spoofable — which only matters if the
	 * proxy fails to overwrite it, and the ingress does.
	 */
	private static String clientAddress(HttpServletRequest request) {
		String forwarded = request.getHeader("X-Forwarded-For");
		if (forwarded != null && !forwarded.isBlank()) {
			return forwarded.split(",")[0].trim();
		}
		String remote = request.getRemoteAddr();
		return remote == null ? "unknown" : remote;
	}

	private static final class Window {

		private final Instant startedAt;
		private final AtomicInteger count = new AtomicInteger();

		private Window(Instant startedAt) {
			this.startedAt = startedAt;
		}

		private boolean isExpired(Instant now) {
			return startedAt.plus(WINDOW).isBefore(now);
		}
	}
}
