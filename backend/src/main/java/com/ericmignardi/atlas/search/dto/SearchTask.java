package com.ericmignardi.atlas.search.dto;

import java.util.UUID;

import com.ericmignardi.atlas.project.dto.ProjectSummary;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskStatus;

/** FR-4.5 again: a null project is the Unassigned bucket, not a missing record. */
public record SearchTask(UUID id, String title, TaskStatus status, ProjectSummary project) {

	public static SearchTask from(Task task) {
		return new SearchTask(
				task.getId(),
				task.getTitle(),
				task.getStatus(),
				ProjectSummary.from(task.getProject()));
	}
}
