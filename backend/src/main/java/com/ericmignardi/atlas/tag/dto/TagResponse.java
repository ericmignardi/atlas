package com.ericmignardi.atlas.tag.dto;

import java.time.Instant;
import java.util.UUID;

import com.ericmignardi.atlas.tag.Tag;

/**
 * A tag on its own (PRD 6.6), carrying the usage count FR-5.6 asks for.
 *
 * <p>The static factory is the whole mapping layer. Adding a component here
 * breaks every call site until it is supplied, which is the same guarantee a
 * mapping library sells as an "unmapped target property" check — except the
 * compiler does it, with no annotation processor and no generated source to
 * read when it goes wrong.
 */
public record TagResponse(UUID id, String name, String color, long usageCount, Instant createdAt) {

	public static TagResponse from(Tag tag, long usageCount) {
		return new TagResponse(tag.getId(), tag.getName(), tag.getColor(), usageCount, tag.getCreatedAt());
	}
}
