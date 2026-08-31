package com.ericmignardi.atlas.project;

/**
 * FR-2.6. Declared in display order. Persisted as a string, never an ordinal —
 * inserting a value into the middle of this list must not silently reinterpret
 * every existing row.
 */
public enum ProjectStatus {
	IDEA,
	ACTIVE,
	PAUSED,
	SHIPPED,
	ARCHIVED
}
