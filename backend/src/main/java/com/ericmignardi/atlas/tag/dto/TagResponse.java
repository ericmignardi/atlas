package com.ericmignardi.atlas.tag.dto;

import java.time.Instant;
import java.util.UUID;

import com.ericmignardi.atlas.tag.Tag;

/** FR-5.6 supplies the usage count. */
public record TagResponse(UUID id, String name, String color, long usageCount, Instant createdAt) {

	public static TagResponse from(Tag tag, long usageCount) {
		return new TagResponse(tag.getId(), tag.getName(), tag.getColor(), usageCount, tag.getCreatedAt());
	}
}
