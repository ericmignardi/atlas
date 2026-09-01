package com.ericmignardi.atlas.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * No format constraints beyond "present". Validating the password shape on login
 * would let an attacker distinguish "not a real password" from "not the right
 * password", and the rules change over time anyway: an account created under the
 * old policy still has to be able to sign in.
 */
public record LoginRequest(

		@NotBlank(message = "must not be blank")
		String email,

		@NotBlank(message = "must not be blank")
		String password) {

	public LoginRequest {
		email = Emails.normalise(email);
	}
}
