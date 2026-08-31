package com.ericmignardi.atlas.project.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.openapitools.jackson.nullable.JsonNullable;

import com.ericmignardi.atlas.project.ProjectStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * PRD 6.9, the single highest-risk shape in the build. Every field is a
 * {@link JsonNullable} so the service can tell three intentions apart:
 *
 * <ul>
 *   <li>key absent — leave the field alone</li>
 *   <li>key present with a value — set it</li>
 *   <li>key present and null — clear it</li>
 * </ul>
 *
 * <p>A plain {@code String client} collapses the first and third into the same
 * Java null, and the field is then wiped on every partial update. The failure is
 * silent: no exception, no log line, just a column that is empty the next time
 * anyone looks.
 *
 * <p>A class, not a record, because each field has to default to
 * {@code undefined()} — a record component cannot carry a default, and a null
 * {@code JsonNullable} would reintroduce the ambiguity one level up.
 *
 * <p>{@code name} and {@code status} are NOT NULL in the schema, so their
 * constraints reject an explicit null with a 400 rather than letting Hibernate
 * throw one statement later. The value extractor bundled with
 * jackson-databind-nullable is {@code @UnwrapByDefault}, so the annotations sit
 * on the property and see the value inside: an absent field is never handed to a
 * validator, a present-but-null one is.
 */
@Getter
@Setter
public class UpdateProjectRequest {

	@NotBlank(message = "must not be blank")
	@Size(max = 120, message = "must be at most 120 characters")
	private JsonNullable<String> name = JsonNullable.undefined();

	@Size(max = 120, message = "must be at most 120 characters")
	private JsonNullable<String> client = JsonNullable.undefined();

	@Size(max = 4000, message = "must be at most 4000 characters")
	private JsonNullable<String> description = JsonNullable.undefined();

	@NotNull(message = "must not be null")
	private JsonNullable<ProjectStatus> status = JsonNullable.undefined();

	@Size(max = 500, message = "must be at most 500 characters")
	@Pattern(regexp = ProjectUrls.PATTERN, message = ProjectUrls.MESSAGE)
	private JsonNullable<String> repoUrl = JsonNullable.undefined();

	@Size(max = 500, message = "must be at most 500 characters")
	@Pattern(regexp = ProjectUrls.PATTERN, message = ProjectUrls.MESSAGE)
	private JsonNullable<String> liveUrl = JsonNullable.undefined();

	@Size(max = 80, message = "must be at most 80 characters")
	private JsonNullable<String> engagement = JsonNullable.undefined();

	/**
	 * {@code tech_stack} is NOT NULL with an empty-array default, so an explicit
	 * null here means "empty it", handled in the service rather than rejected.
	 * The per-entry rule is enforced there too, alongside the de-duplication that
	 * has to happen before a count means anything.
	 */
	@Size(max = 24, message = "must contain at most 24 items")
	private JsonNullable<List<String>> techStack = JsonNullable.undefined();

	private JsonNullable<LocalDate> startedAt = JsonNullable.undefined();

	/** FR-5.7: sending a list replaces the set; omitting it changes nothing. */
	private JsonNullable<List<UUID>> tagIds = JsonNullable.undefined();
}
