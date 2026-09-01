package com.ericmignardi.atlas.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import com.ericmignardi.atlas.common.error.ApiException;

class LoginRateLimiterTest {

	private final LoginRateLimiter limiter = new LoginRateLimiter();

	@BeforeEach
	void reset() {
		limiter.reset();
	}

	private static MockHttpServletRequest from(String address) {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr(address);
		return request;
	}

	/** NFR-2.9, and the "eleventh attempt" line in the Day 5 checklist. */
	@Test
	void allowsTenAttemptsAndRejectsTheEleventh() {
		MockHttpServletRequest request = from("203.0.113.7");
		for (int attempt = 1; attempt <= 10; attempt++) {
			int number = attempt;
			assertThatCode(() -> limiter.check(request))
					.as("attempt %d", number)
					.doesNotThrowAnyException();
		}

		assertThatThrownBy(() -> limiter.check(request))
				.isInstanceOf(ApiException.class)
				.hasMessageContaining("Too many sign-in attempts")
				.extracting(exception -> ((ApiException) exception).getStatus())
				.isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
	}

	/** One noisy address must not lock everyone else out. */
	@Test
	void countsEachAddressSeparately() {
		MockHttpServletRequest noisy = from("203.0.113.7");
		for (int attempt = 0; attempt < 11; attempt++) {
			try {
				limiter.check(noisy);
			} catch (ApiException expected) {
				assertThat(expected.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
			}
		}

		assertThatCode(() -> limiter.check(from("198.51.100.4"))).doesNotThrowAnyException();
	}

	/**
	 * Behind the Container Apps ingress every request has the proxy as its remote
	 * address, so without this the limiter would count the whole internet as one
	 * client and the first ten users of the minute would lock out the rest.
	 */
	@Test
	void prefersTheFirstHopOfXForwardedForOverTheProxyAddress() {
		for (int attempt = 0; attempt < 10; attempt++) {
			MockHttpServletRequest request = from("10.0.0.1");
			request.addHeader("X-Forwarded-For", "203.0.113.7, 10.0.0.1");
			limiter.check(request);
		}

		MockHttpServletRequest sameProxyDifferentClient = from("10.0.0.1");
		sameProxyDifferentClient.addHeader("X-Forwarded-For", "198.51.100.4, 10.0.0.1");
		assertThatCode(() -> limiter.check(sameProxyDifferentClient)).doesNotThrowAnyException();
	}
}
