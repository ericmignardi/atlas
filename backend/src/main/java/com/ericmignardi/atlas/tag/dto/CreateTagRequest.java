package com.ericmignardi.atlas.tag.dto;

import com.ericmignardi.atlas.tag.TagPalette;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * PRD 7.5. The name is trimmed and lowercased by the service, not here — a DTO
 * that rewrites its own input makes the validation messages describe a value the
 * caller never sent.
 *
 * <p>{@code color} is optional; omitted, the tag takes the next colour in the
 * palette cycle (FR-5.4).
 */
public record CreateTagRequest(

		@NotBlank(message = "must not be blank")
		@Size(max = 50, message = "must be at most 50 characters")
		String name,

		@Pattern(regexp = TagPalette.HEX_PATTERN, message = "must be a hex colour such as #2251B4")
		String color) {
}
