package com.ericmignardi.atlas.task.dto;

import java.time.Instant;
import java.util.Comparator;
import java.util.Locale;

import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.task.Task;

/**
 * FR-4.13. Comparators rather than fragments of SQL: building an ORDER BY from
 * a request parameter hands a caller control of the query.
 */
public enum TaskSort {

	STATUS(Comparator.comparing(Task::getStatus).thenComparingInt(Task::getSortOrder)),

	DUE(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))),

	/** The enum is declared low to high, so most urgent first is a reversal. */
	PRIORITY(Comparator.comparing(Task::getPriority).reversed()),

	/** FR-4.5: the unassigned bucket sorts last. */
	PROJECT(Comparator.comparing(TaskSort::projectName,
			Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))),

	TITLE(Comparator.comparing(Task::getTitle, String.CASE_INSENSITIVE_ORDER));

	private final Comparator<Task> comparator;

	TaskSort(Comparator<Task> comparator) {
		this.comparator = comparator;
	}

	/** Made total, so two reads of the same list do not reshuffle equal rows. */
	public Comparator<Task> comparator() {
		return comparator
				.thenComparing(Task::getTitle, String.CASE_INSENSITIVE_ORDER)
				.thenComparing((Task task) -> String.valueOf(task.getId()));
	}

	/** Unknown or absent falls back to the default rather than 400-ing. */
	public static TaskSort from(String raw) {
		if (raw == null || raw.isBlank()) {
			return STATUS;
		}
		String key = raw.trim().toUpperCase(Locale.ROOT).replace("_", "").replace("-", "");
		if ("DUEDATE".equals(key)) {
			key = "DUE";
		}
		try {
			return valueOf(key);
		}
		catch (IllegalArgumentException unknown) {
			return STATUS;
		}
	}

	private static String projectName(Task task) {
		Project project = task.getProject();
		return project == null ? null : project.getName();
	}
}
