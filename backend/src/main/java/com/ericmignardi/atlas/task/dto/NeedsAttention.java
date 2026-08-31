package com.ericmignardi.atlas.task.dto;

import java.util.List;

/** FR-4.10. The three buckets are disjoint and exhaustive over the window. */
public record NeedsAttention(
		List<TaskResponse> overdue,
		List<TaskResponse> dueToday,
		List<TaskResponse> dueSoon) {
}
