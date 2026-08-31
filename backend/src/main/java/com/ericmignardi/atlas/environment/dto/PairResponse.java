package com.ericmignardi.atlas.environment.dto;

/**
 * Both sides of a pairing operation. {@code partner} is null after an unpair of
 * something that was not paired to begin with, which is a no-op and not an error.
 */
public record PairResponse(EnvironmentResponse environment, EnvironmentResponse partner) {
}
