package com.ericmignardi.atlas.project.dto;

/**
 * The three derived numbers on a project card. Grouped into one record so
 * {@link ProjectResponse#from} takes two arguments instead of four bare longs
 * in an order nothing but a comment enforces.
 */
public record ProjectCounts(long environments, long openTasks, long overdueTasks) {

	public static final ProjectCounts NONE = new ProjectCounts(0, 0, 0);
}
