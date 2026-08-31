package com.ericmignardi.atlas;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.ericmignardi.atlas.security.UserPrincipal;
import com.ericmignardi.atlas.user.User;

import tools.jackson.databind.ObjectMapper;

/**
 * The base for the controller tests: the full context of
 * {@link AbstractIntegrationTest} plus MockMvc, which drives the real filter
 * chain, the real argument resolvers, and the real exception handler without
 * binding a port.
 *
 * <p>{@link #as(User)} is why these tests can be honest about ownership. The
 * Day 3 stub in {@code CurrentUserResolver} resolves an unauthenticated request
 * to the single account in the database, which is unusable for a test that needs
 * two; putting a real {@code UserPrincipal} in the security context takes the
 * same path the Day 5 JWT filter will, so these assertions do not have to be
 * rewritten when the stub goes.
 */
@AutoConfigureMockMvc
public abstract class AbstractWebIntegrationTest extends AbstractIntegrationTest {

	@Autowired
	protected MockMvc mockMvc;

	@Autowired
	protected ObjectMapper objectMapper;

	protected static RequestPostProcessor as(User user) {
		UserPrincipal principal = UserPrincipal.of(user);
		return authentication(new UsernamePasswordAuthenticationToken(principal, null,
				List.of(new SimpleGrantedAuthority("ROLE_USER"))));
	}

	protected String json(Object value) {
		return objectMapper.writeValueAsString(value);
	}
}
