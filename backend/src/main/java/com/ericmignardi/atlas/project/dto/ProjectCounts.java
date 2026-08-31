package com.ericmignardi.atlas.project.dto;

public record ProjectCounts(long environments, long openTasks, long overdueTasks) {

	public static final ProjectCounts NONE = new ProjectCounts(0, 0, 0);
}
