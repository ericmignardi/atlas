package com.ericmignardi.atlas.project.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.ericmignardi.atlas.project.ProjectStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code slug} is absent because it is derived from the name (FR-2.3), and
 * letting a client set it would make FR-2.4 unenforceable. {@code isPinned} is
 * absent because the cap of FR-2.8 lives behind its own endpoint, and a second
 * way in would be a second place to forget the check.
 */
public record CreateProjectRequest(

		@NotBlank(message = "must not be blank")
		@Size(max = 120, message = "must be at most 120 characters")
		String name,

		@Size(max = 120, message = "must be at most 120 characters")
		String client,

		@Size(max = 4000, message = "must be at most 4000 characters")
		String description,

		/** FR-2.6: null takes the default of IDEA. */
		ProjectStatus status,

		@Size(max = 500, message = "must be at most 500 characters")
		@Pattern(regexp = ProjectUrls.PATTERN, message = ProjectUrls.MESSAGE)
		String repoUrl,

		@Size(max = 500, message = "must be at most 500 characters")
		@Pattern(regexp = ProjectUrls.PATTERN, message = ProjectUrls.MESSAGE)
		String liveUrl,

		@Size(max = 80, message = "must be at most 80 characters")
		String engagement,

		@Size(max = 24, message = "must contain at most 24 items")
		List<String> techStack,

		LocalDate startedAt,

		List<UUID> tagIds) {
}
