package com.ericmignardi.atlas;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.ericmignardi.atlas.security.UserPrincipal;
import com.ericmignardi.atlas.user.User;

import tools.jackson.databind.ObjectMapper;

/**
 * {@link #as(User)} is why these tests can be honest about ownership: it puts a
 * real {@link UserPrincipal} in the security context, which is the same thing
 * {@link com.ericmignardi.atlas.security.JwtAuthenticationFilter} does after
 * verifying a token. Tests that care about the token itself — a tampered one, an
 * expired one, none at all — send a real {@code Authorization} header instead;
 * see {@code AuthControllerIT}.
 */
@AutoConfigureMockMvc
public abstract class AbstractWebIntegrationTest extends AbstractIntegrationTest {

	@Autowired
	protected MockMvc mockMvc;

	@Autowired
	protected ObjectMapper objectMapper;

	protected static RequestPostProcessor as(User user) {
		UserPrincipal principal = UserPrincipal.of(user);
		return authentication(
				new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
	}

	protected String json(Object value) {
		return objectMapper.writeValueAsString(value);
	}
}
