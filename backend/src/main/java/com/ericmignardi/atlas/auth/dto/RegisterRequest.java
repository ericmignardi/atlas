package com.ericmignardi.atlas.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * FR-1.12 is expressed as annotations rather than as code in the service so the
 * failure comes back through the same {@code fields} map every other 400 uses.
 * The password rules are separate constraints on purpose: "at least 10
 * characters" and "must contain a digit" are different problems, and the form
 * should be able to say which one it is.
 */
public record RegisterRequest(

		@NotBlank(message = "must not be blank")
		@Email(message = "must be a valid email address")
		@Size(max = 320, message = "must be at most 320 characters")
		String email,

		@NotBlank(message = "must not be blank")
		@Size(min = 10, max = 100, message = "must be at least 10 characters")
		@Pattern(regexp = ".*[A-Za-z].*", message = "must contain a letter")
		@Pattern(regexp = ".*[0-9].*", message = "must contain a digit")
		@Schema(description = "At least 10 characters, with a letter and a digit")
		String password,

		@Size(max = 80, message = "must be at most 80 characters")
		String displayName) {

	/**
	 * FR-1.1: lowercased and trimmed, matching the {@code lower(email)} unique
	 * index. It happens here, in the canonical constructor Jackson calls, rather
	 * than in the service — because validation runs on the constructed object and
	 * {@code @Email} rejects the trailing space a form field so often carries.
	 * Normalising afterwards would mean the rule never got the chance to apply.
	 */
	public RegisterRequest {
		email = Emails.normalise(email);
		displayName = displayName == null || displayName.isBlank() ? null : displayName.trim();
	}
}
