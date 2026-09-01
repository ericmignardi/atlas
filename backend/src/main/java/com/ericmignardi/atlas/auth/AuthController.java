package com.ericmignardi.atlas.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ericmignardi.atlas.auth.dto.AuthResponse;
import com.ericmignardi.atlas.auth.dto.LoginRequest;
import com.ericmignardi.atlas.auth.dto.RefreshTokenRequest;
import com.ericmignardi.atlas.auth.dto.RegisterRequest;
import com.ericmignardi.atlas.auth.dto.UserResponse;
import com.ericmignardi.atlas.security.CurrentUser;
import com.ericmignardi.atlas.security.LoginRateLimiter;
import com.ericmignardi.atlas.security.UserPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * PRD §6.2. {@code register}, {@code login}, and {@code refresh} are the three
 * unauthenticated endpoints in the application; {@code logout} and {@code me}
 * need a bearer token like everything else.
 *
 * <p>Rate limiting lives here rather than in the service because it is a
 * property of the HTTP request — it needs the caller's address, which the
 * service has no business knowing about.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Registration, sign-in, token refresh, and sign-out")
public class AuthController {

	private final AuthService authService;
	private final LoginRateLimiter rateLimiter;

	@PostMapping("/register")
	@Operation(summary = "Create an account and sign in")
	public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
	}

	@PostMapping("/login")
	@Operation(summary = "Exchange email and password for an access and a refresh token")
	public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
		rateLimiter.check(http);
		return authService.login(request);
	}

	@PostMapping("/refresh")
	@Operation(summary = "Exchange a refresh token for a new pair; the old one is revoked")
	public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
		return authService.refresh(request.refreshToken());
	}

	@PostMapping("/logout")
	@Operation(summary = "Revoke a refresh token")
	@SecurityRequirement(name = "bearerAuth")
	public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
		authService.logout(request.refreshToken());
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/me")
	@Operation(summary = "The signed-in account")
	@SecurityRequirement(name = "bearerAuth")
	public UserResponse me(@CurrentUser UserPrincipal user) {
		return authService.me(user);
	}
}
