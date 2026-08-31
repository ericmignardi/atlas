package com.ericmignardi.atlas.environment.dto;

import java.util.List;

/** FR-3.5. Three groups, always in the order Production, Preview, Development. */
public record GroupedEnvironments(List<EnvironmentGroup> groups) {
}
