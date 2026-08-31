package com.ericmignardi.atlas.tag.dto;

import org.openapitools.jackson.nullable.JsonNullable;

import com.ericmignardi.atlas.tag.TagPalette;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * FR-5.8. Every field is a {@link JsonNullable} for the reason PRD 6.9 spends a
 * page on: an absent key and an explicit null are the same Java null in a plain
 * DTO, so "leave the colour alone" and "clear the colour" become
 * indistinguishable and one of them silently wins on every request.
 *
 * <p>A class rather than a record, because the fields have to default to
 * {@code undefined()} — a record component cannot, and a null JsonNullable
 * would put the same ambiguity back one level up.
 *
 * <p>Both columns are NOT NULL, so both constraints reject an explicit null.
 * The value extractor shipped with jackson-databind-nullable is
 * {@code @UnwrapByDefault}, which is why the annotations sit on the property and
 * validate the value inside: an undefined field is never handed to a validator
 * at all, and a present-but-null one is.
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
