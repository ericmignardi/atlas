package com.ericmignardi.atlas.project.dto;

import java.util.UUID;

/**
 * One {@code (project, count)} pair from a grouped aggregate (NFR-1.2).
 * {@code Long} rather than {@code long} because that is what {@code COUNT}
 * produces, and a constructor expression matches on the exact type.
 */
public record ProjectCountRow(UUID projectId, Long count) {
}
