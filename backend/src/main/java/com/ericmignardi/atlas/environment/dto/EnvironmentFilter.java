package com.ericmignardi.atlas.environment.dto;

import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;

public record EnvironmentFilter(EnvironmentType type, Platform platform) {
}
