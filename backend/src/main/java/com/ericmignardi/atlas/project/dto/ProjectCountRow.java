package com.ericmignardi.atlas.project.dto;

import java.util.UUID;

/**
 * One {@code (project, count)} pair from a grouped aggregate. The constructor
 * expression target for the three list-view count queries: without them, a list
 * of twenty projects costs sixty extra round trips to fill in the same numbers
 * (NFR-1.2).
 *
 * <p>{@code Long} rather than {@code long} because that is what {@code COUNT}
 * produces, and a constructor expression matches on the exact type.
 */
public record ProjectCountRow(UUID projectId, Long count) {
}
