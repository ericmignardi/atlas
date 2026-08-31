package com.ericmignardi.atlas.tag.dto;

import com.ericmignardi.atlas.tag.TagPalette;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * The name is trimmed and lowercased by the service, not here — a DTO that
 * rewrites its own input makes the validation messages describe a value the
 * caller never sent.
 */
public record CreateTagRequest(

		@NotBlank(message = "must not be blank")
		@Size(max = 50, message = "must be at most 50 characters")
		String name,

		/** FR-5.4: omitted, the tag takes the next colour in the palette cycle. */
		@Pattern(regexp = TagPalette.HEX_PATTERN, message = "must be a hex colour such as #2251B4")
		String color) {
}
