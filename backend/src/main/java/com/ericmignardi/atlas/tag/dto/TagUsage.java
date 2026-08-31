package com.ericmignardi.atlas.tag.dto;

import java.util.UUID;

/**
 * One row of the grouped count behind FR-5.6. A constructor expression target,
 * so the aggregate arrives typed instead of as an Object[] the caller has to
 * index into and cast.
 */
public record TagUsage(UUID tagId, Long count) {
}
