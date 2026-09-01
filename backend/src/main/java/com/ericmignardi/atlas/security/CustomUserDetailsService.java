package com.ericmignardi.atlas.security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * The only place a password hash is read. Throwing
 * {@link UsernameNotFoundException} rather than returning null is what
 * {@code DaoAuthenticationProvider} expects, and with its default
 * {@code hideUserNotFoundExceptions} it converts that into the same
 * {@code BadCredentialsException} a wrong password produces — which is exactly
 * the "identical message either way" rule the login endpoint needs.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

	private final UserRepository users;

	@Override
	@Transactional(readOnly = true)
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		return users.findByEmailIgnoreCase(email)
				.map(UserPrincipal::of)
				.orElseThrow(() -> new UsernameNotFoundException("No account for that email"));
	}
}
