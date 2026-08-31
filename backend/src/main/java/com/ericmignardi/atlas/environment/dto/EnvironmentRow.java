package com.ericmignardi.atlas.environment.dto;

/** FR-3.15. A null {@code database} is the dashed empty slot the UI renders. */
public record EnvironmentRow(EnvironmentSummary application, EnvironmentSummary database) {
}
