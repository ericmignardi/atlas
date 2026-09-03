package com.ericmignardi.atlas.dashboard.dto;

/**
 * FR-6.1's four tiles, plus the two numbers that give them a second line.
 *
 * <p>{@code totalProjects} is not a tile of its own: the tile counts what is
 * <em>active</em> (FR-6.5's header counts the same thing), and the total is what
 * turns "3" into "3 of 11". It is also the cheapest way for the client to tell
 * an empty account from a quiet one without a second request.
 */
public record DashboardStats(
		long totalProjects,
		long activeProjects,
		long openTasks,
		long overdueTasks,
		long environments,
		long platforms,
		long tags) {
}
