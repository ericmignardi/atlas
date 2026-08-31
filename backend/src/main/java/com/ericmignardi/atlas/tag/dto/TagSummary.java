package com.ericmignardi.atlas.tag.dto;

import java.util.UUID;

import com.ericmignardi.atlas.tag.Tag;

/** A tag nested inside another resource. No usage count: it would be expensive and meaningless there. */
public record TagSummary(UUID id, String name, String color) {

	public static TagSummary from(Tag tag) {
		return new TagSummary(tag.getId(), tag.getName(), tag.getColor());
	}
}
