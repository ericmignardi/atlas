package com.ericmignardi.atlas.tag.dto;

import org.openapitools.jackson.nullable.JsonNullable;

import com.ericmignardi.atlas.tag.TagPalette;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * FR-5.8. A class rather than a record, because the fields have to default to
 * {@code undefined()}. Both columns are NOT NULL, so both constraints reject an
 * explicit null.
 */
@Getter
@Setter
public class UpdateTagRequest {

	@NotBlank(message = "must not be blank")
	@Size(max = 50, message = "must be at most 50 characters")
	private JsonNullable<String> name = JsonNullable.undefined();

	@NotBlank(message = "must not be blank")
	@Pattern(regexp = TagPalette.HEX_PATTERN, message = "must be a hex colour such as #2251B4")
	private JsonNullable<String> color = JsonNullable.undefined();
}
