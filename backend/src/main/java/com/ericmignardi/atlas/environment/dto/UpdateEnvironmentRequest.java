package com.ericmignardi.atlas.environment.dto;

import org.openapitools.jackson.nullable.JsonNullable;

import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * A class, not a record, because every field has to default to
 * {@code undefined()} — a record component cannot carry a default, and a null
 * {@code JsonNullable} would reintroduce the ambiguity one level up.
 *
 * <p>{@code projectId} and {@code pairedWithId} are absent: both would have to
 * release the pairing, and that is a different operation with a different name.
 */
@Getter
@Setter
public class UpdateEnvironmentRequest {

	@NotBlank(message = "must not be blank")
	@Size(max = 120, message = "must be at most 120 characters")
	private JsonNullable<String> name = JsonNullable.undefined();

	@NotNull(message = "must not be null")
	private JsonNullable<Platform> platform = JsonNullable.undefined();

	/** FR-3.12: changing this releases the pairing on both sides. */
	@NotNull(message = "must not be null")
	private JsonNullable<EnvironmentType> type = JsonNullable.undefined();

	@Size(max = 200, message = "must be at most 200 characters")
	private JsonNullable<String> branch = JsonNullable.undefined();

	@Size(max = 600, message = "must be at most 600 characters")
	private JsonNullable<String> url = JsonNullable.undefined();

	@Size(max = 4000, message = "must be at most 4000 characters")
	private JsonNullable<String> notes = JsonNullable.undefined();
}
