package com.ericmignardi.atlas.tag.dto;

import java.util.UUID;

/** One row of the grouped count behind FR-5.6, typed rather than an Object[]. */
public record TagUsage(UUID tagId, Long count) {
}
