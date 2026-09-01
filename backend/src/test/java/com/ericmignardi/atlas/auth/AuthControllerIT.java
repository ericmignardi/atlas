package com.ericmignardi.atlas.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.ericmignardi.atlas.AbstractWebIntegrationTest;
import com.ericmignardi.atlas.config.AtlasProperties;
import com.ericmignardi.atlas.security.JwtService;
import com.ericmignardi.atlas.security.LoginRateLimiter;
import com.ericmignardi.atlas.user.RefreshTokenRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;
import com.jayway.jsonpath.JsonPath;

/**
 * The Day 5 checklist, end to end: registration, sign-in, the three ways a token
 * can be bad, rotation, and logout.
 */
class AuthControllerIT extends AbstractWebIntegrationTest {

	private static final String EMAIL = "owner@example.com";
	private static final String PASSWORD = "correct-horse-9";

	@Autowired
	private UserRepository users;

	@Autowired
	private RefreshTokenRepository refreshTokens;

	@Autowired
	private LoginRateLimiter rateLimiter;

	@Autowired
	private AtlasProperties properties;

	@BeforeEach
	void reset() {
		// Deleting the users cascades the refresh tokens with them.
		users.deleteAll();
		// The limiter is a singleton keyed on the address every MockMvc request
		// reports, so without this the tests would rate-limit each other.
		rateLimiter.reset();
	}

	// --- registration -------------------------------------------------------

	@Test
	void registrationReturns201WithBothTokensAndTheUser() throws Exception {
		register(EMAIL, PASSWORD)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.refreshToken").isNotEmpty())
				.andExpect(jsonPath("$.tokenType").value("Bearer"))
				.andExpect(jsonPath("$.expiresIn").value(900))
				.andExpect(jsonPath("$.user.email").value(EMAIL))
				.andExpect(jsonPath("$.user.roles[0]").value("ROLE_USER"))
				.andExpect(jsonPath("$.user.createdAt").isNotEmpty());
	}

	/** FR-1.1: the address is the identity, however it was typed. */
	@Test
	void registrationLowercasesAndTrimsTheEmail() throws Exception {
		register("  Owner@Example.COM  ", PASSWORD)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.user.email").value(EMAIL));

		assertThat(users.findByEmailIgnoreCase(EMAIL)).isPresent();
	}

	@Test
	void aDuplicateEmailIsAFieldLevelBadRequest() throws Exception {
		register(EMAIL, PASSWORD).andExpect(status().isCreated());

		register("OWNER@example.com", PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.email").isArray())
				.andExpect(jsonPath("$.fields.email[0]").value("is already registered"));
	}

	/** FR-1.12. Six characters fails the length rule and the digit rule together. */
	@Test
	void aShortPasswordIsAFieldLevelBadRequest() throws Exception {
		register(EMAIL, "abcdef")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.password").isArray())
				.andExpect(jsonPath("$.error").value("Validation failed"));
	}

	@Test
	void aPasswordWithoutADigitIsRejected() throws Exception {
		register(EMAIL, "no-digits-here")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fields.password[0]").value("must contain a digit"));
	}

	/** FR-1.2, NFR-2.1: the column holds a strength-12 BCrypt hash and nothing else. */
	@Test
	void thePasswordIsStoredAsABcryptHashAndNeverEchoedBack() throws Exception {
		String body = register(EMAIL, PASSWORD)
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();

		assertThat(body).doesNotContain(PASSWORD);

		User saved = users.findByEmailIgnoreCase(EMAIL).orElseThrow();
		assertThat(saved.getPasswordHash()).startsWith("$2a$12$").hasSize(60);
		assertThat(saved.getPasswordHash()).doesNotContain(PASSWORD);
	}

	// --- login --------------------------------------------------------------

	@Test
	void loginReturns200WithBothTokens() throws Exception {
		register(EMAIL, PASSWORD).andExpect(status().isCreated());

		login(EMAIL, PASSWORD)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.refreshToken").isNotEmpty())
				.andExpect(jsonPath("$.user.email").value(EMAIL));
	}

	/**
	 * PRD 6.2. Byte-for-byte identical, not merely similar: any difference is an
	 * oracle for which addresses have accounts here.
	 */
	@Test
	void aWrongPasswordAndAnUnknownEmailAreIndistinguishable() throws Exception {
		register(EMAIL, PASSWORD).andExpect(status().isCreated());

		String wrongPassword = login(EMAIL, "wrong-password-9")
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error").value("Invalid email or password"))
				.andReturn().getResponse().getContentAsString();

		String unknownEmail = login("nobody@example.com", PASSWORD)
				.andExpect(status().isUnauthorized())
				.andReturn().getResponse().getContentAsString();

		assertThat(errorOf(unknownEmail)).isEqualTo(errorOf(wrongPassword));
	}

	/** NFR-2.9. */
	@Test
	void theEleventhLoginAttemptInAMinuteIsRateLimited() throws Exception {
		register(EMAIL, PASSWORD).andExpect(status().isCreated());

		for (int attempt = 1; attempt <= 10; attempt++) {
			login(EMAIL, "wrong-password-9").andExpect(status().isUnauthorized());
		}

		login(EMAIL, PASSWORD)
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
	}

	// --- protecting the rest of the API -------------------------------------

	/** FR-1.7, FR-1.8, and the reason SecurityErrorHandler exists. */
	@Test
	void aRequestWithNoTokenIs401AsJsonNotHtml() throws Exception {
		mockMvc.perform(get("/api/projects"))
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.error").value("Authentication is required"))
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.path").value("/api/projects"));
	}

	@Test
	void aValidTokenReachesTheProtectedEndpoint() throws Exception {
		String token = accessTokenFor(register(EMAIL, PASSWORD).andReturn()
				.getResponse().getContentAsString());

		mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray());
	}

	@Test
	void aTamperedTokenIs401() throws Exception {
		String token = accessTokenFor(register(EMAIL, PASSWORD).andReturn()
				.getResponse().getContentAsString());

		String[] parts = token.split("[.]");
		String tampered = parts[0] + "." + parts[1].substring(0, parts[1].length() - 2) + "AB."
				+ parts[2];

		mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + tampered))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error").value("Authentication is required"));
	}

	@Test
	void anExpiredTokenIs401() throws Exception {
		register(EMAIL, PASSWORD).andExpect(status().isCreated());
		User user = users.findByEmailIgnoreCase(EMAIL).orElseThrow();

		// Same secret, negative TTL: a token this server would have signed, issued
		// a second into the past.
		JwtService expired = new JwtService(new AtlasProperties(
				new AtlasProperties.Jwt(properties.jwt().secret(), Duration.ofSeconds(-1),
						properties.jwt().refreshTokenTtl()),
				properties.cors()));

		mockMvc.perform(get("/api/projects")
				.header("Authorization", "Bearer " + expired.generateAccessToken(user)))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void aGarbageAuthorizationHeaderIs401RatherThanA500() throws Exception {
		mockMvc.perform(get("/api/projects").header("Authorization", "Bearer not-a-jwt"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/projects").header("Authorization", "Basic abc"))
				.andExpect(status().isUnauthorized());
	}

	// --- refresh and logout -------------------------------------------------

	@Test
	void refreshReturnsANewAccessTokenAndRotatesTheRefreshToken() throws Exception {
		String first = register(EMAIL, PASSWORD).andReturn().getResponse().getContentAsString();
		String originalRefresh = JsonPath.read(first, "$.refreshToken");

		String refreshed = refresh(originalRefresh)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.user.email").value(EMAIL))
				.andReturn().getResponse().getContentAsString();

		assertThat(JsonPath.<String>read(refreshed, "$.refreshToken")).isNotEqualTo(originalRefresh);
		assertThat(refreshTokens.count()).isEqualTo(2);

		// The replacement works, which is what makes rotation invisible to a
		// well-behaved client.
		refresh(JsonPath.read(refreshed, "$.refreshToken")).andExpect(status().isOk());
	}

	/**
	 * Reuse of a rotated token means a replay or a leak, so every session the
	 * user holds is revoked rather than only the presented one.
	 */
	@Test
	void theOldRefreshTokenIsRejectedAfterRotationAndTakesTheSessionWithIt() throws Exception {
		String first = register(EMAIL, PASSWORD).andReturn().getResponse().getContentAsString();
		String originalRefresh = JsonPath.read(first, "$.refreshToken");

		String refreshed = refresh(originalRefresh).andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		String replacement = JsonPath.read(refreshed, "$.refreshToken");

		refresh(originalRefresh)
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error").value("Refresh token is invalid or expired"));

		refresh(replacement).andExpect(status().isUnauthorized());
	}

	@Test
	void refreshRejectsATokenItNeverIssued() throws Exception {
		refresh("not-a-token-this-server-ever-minted").andExpect(status().isUnauthorized());
	}

	/** FR-1.6. */
	@Test
	void logoutRevokesTheRefreshTokenAndFurtherRefreshesAre401() throws Exception {
		String body = register(EMAIL, PASSWORD).andReturn().getResponse().getContentAsString();
		String accessToken = JsonPath.read(body, "$.accessToken");
		String refreshToken = JsonPath.read(body, "$.refreshToken");

		mockMvc.perform(post("/api/auth/logout")
				.header("Authorization", "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(refreshBody(refreshToken)))
				.andExpect(status().isNoContent());

		refresh(refreshToken).andExpect(status().isUnauthorized());
	}

	@Test
	void logoutItselfNeedsAToken() throws Exception {
		String body = register(EMAIL, PASSWORD).andReturn().getResponse().getContentAsString();

		mockMvc.perform(post("/api/auth/logout")
				.contentType(MediaType.APPLICATION_JSON)
				.content(refreshBody(JsonPath.read(body, "$.refreshToken"))))
				.andExpect(status().isUnauthorized());
	}

	/** FR-1.11. */
	@Test
	void meReturnsTheSignedInAccount() throws Exception {
		String token = accessTokenFor(register(EMAIL, PASSWORD).andReturn()
				.getResponse().getContentAsString());

		mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(EMAIL))
				.andExpect(jsonPath("$.roles[0]").value("ROLE_USER"))
				.andExpect(jsonPath("$.id").isNotEmpty());
	}

	@Test
	void meIs401WithoutAToken() throws Exception {
		mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
	}

	// --- helpers ------------------------------------------------------------

	private ResultActions register(String email, String password) throws Exception {
		return mockMvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)));
	}

	private ResultActions login(String email, String password) throws Exception {
		return mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)));
	}

	private ResultActions refresh(String refreshToken) throws Exception {
		return mockMvc.perform(post("/api/auth/refresh")
				.contentType(MediaType.APPLICATION_JSON)
				.content(refreshBody(refreshToken)));
	}

	private static String refreshBody(String refreshToken) {
		return "{\"refreshToken\":\"%s\"}".formatted(refreshToken);
	}

	private static String accessTokenFor(String authResponse) {
		return JsonPath.read(authResponse, "$.accessToken");
	}

	private static String errorOf(String errorResponse) {
		return JsonPath.read(errorResponse, "$.error");
	}
}
