package com.ericmignardi.atlas.tag.dto;

import java.util.UUID;

import com.ericmignardi.atlas.tag.Tag;

/**
 * A tag as it appears nested inside another resource (PRD 6.3). No usage count:
 * inside a project list, the count would be both meaningless and expensive.
 */
public record TagSummary(UUID id, String name, String color) {

	public static TagSummary from(Tag tag) {
		return new TagSummary(tag.getId(), tag.getName(), tag.getColor());
	}
}
