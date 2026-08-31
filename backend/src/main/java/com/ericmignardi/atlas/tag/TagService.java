package com.ericmignardi.atlas.tag;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.common.error.ConflictException;
import com.ericmignardi.atlas.common.error.NotFoundException;
import com.ericmignardi.atlas.tag.dto.CreateTagRequest;
import com.ericmignardi.atlas.tag.dto.TagResponse;
import com.ericmignardi.atlas.tag.dto.TagUsage;
import com.ericmignardi.atlas.tag.dto.UpdateTagRequest;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Tags: create-or-return, the palette cycle, rename, delete (FR-5.1 – FR-5.9).
 *
 * <p>The entity never leaves this class. Controllers get records; the mapping
 * happens on the way out, inside the transaction, so a lazy association can
 * still be read without {@code open-in-view} propping the session open past the
 * end of the request.
 */
@Service
@RequiredArgsConstructor
public class TagService {

	private final TagRepository tags;
	private final UserRepository users;

	/** The outcome of a create-or-return, because the two differ only in status code. */
	public record TagCreation(TagResponse tag, boolean created) {
	}

	@Transactional(readOnly = true)
	public List<TagResponse> list(UUID userId, String query) {
		List<Tag> found = query == null || query.isBlank()
				? tags.findByUserIdOrderByNameAsc(userId)
				: tags.findByUserIdAndNameContainingIgnoreCaseOrderByNameAsc(userId, query.trim());

		Map<UUID, Long> usage = usageByTagId(userId);
		return found.stream()
				.map(tag -> TagResponse.from(tag, usage.getOrDefault(tag.getId(), 0L)))
				.toList();
	}

	@Transactional(readOnly = true)
	public TagResponse get(UUID userId, UUID id) {
		Tag tag = require(userId, id);
		return TagResponse.from(tag, usageByTagId(userId).getOrDefault(id, 0L));
	}

	/**
	 * FR-5.3: a name that already exists returns the existing tag rather than
	 * erroring, which is what lets the tag input on the frontend be a single
	 * "add" action instead of a search-then-create dance.
	 *
	 * <p><strong>Deliberately not {@code @Transactional}.</strong> Two callers
	 * racing on the same new name both miss the lookup, both insert, and one
	 * loses to the unique index. Recovering from that means re-reading the row
	 * the winner wrote — and that read has to happen in a transaction that is
	 * still usable. Inside one enclosing transaction it would not be: a failed
	 * flush marks it rollback-only and every subsequent statement fails too. Each
	 * repository call here is transactional on its own (Spring Data makes it so),
	 * so the failed insert rolls back by itself and the re-read runs clean.
	 */
	public TagCreation findOrCreate(UUID userId, CreateTagRequest request) {
		String name = normalise(request.name());

		Optional<Tag> existing = tags.findByUserIdAndName(userId, name);
		if (existing.isPresent()) {
			return new TagCreation(TagResponse.from(existing.get(), usageOf(existing.get())), false);
		}

		User owner = users.getReferenceById(userId);
		Tag tag = new Tag();
		tag.setUser(owner);
		tag.setName(name);
		tag.setColor(request.color() == null ? TagPalette.nextColour(tags.countByUserId(userId))
				: request.color());

		try {
			return new TagCreation(TagResponse.from(tags.saveAndFlush(tag), 0L), true);
		}
		catch (DataIntegrityViolationException race) {
			Tag winner = tags.findByUserIdAndName(userId, name).orElseThrow(() -> race);
			return new TagCreation(TagResponse.from(winner, usageOf(winner)), false);
		}
	}

	/** FR-5.8. Renaming onto a name already in use is a conflict, not a merge. */
	@Transactional
	public TagResponse update(UUID userId, UUID id, UpdateTagRequest request) {
		Tag tag = require(userId, id);

		request.getName().ifPresent(rawName -> {
			String name = normalise(rawName);
			if (!name.equals(tag.getName()) && tags.findByUserIdAndName(userId, name).isPresent()) {
				throw new ConflictException("TAG_NAME_TAKEN", "A tag called " + name + " already exists");
			}
			tag.setName(name);
		});
		request.getColor().ifPresent(tag::setColor);

		return TagResponse.from(tags.save(tag), usageOf(tag));
	}

	/** FR-5.9. The join rows go with it; the projects that carried it do not. */
	@Transactional
	public void delete(UUID userId, UUID id) {
		tags.delete(require(userId, id));
	}

	/** FR-5.2. One place normalises, so a lookup and an insert cannot disagree. */
	static String normalise(String rawName) {
		return rawName == null ? null : rawName.trim().toLowerCase(Locale.ROOT);
	}

	private Tag require(UUID userId, UUID id) {
		return tags.findByIdAndUserId(id, userId).orElseThrow(() -> NotFoundException.of("Tag", id));
	}

	private Map<UUID, Long> usageByTagId(UUID userId) {
		return tags.countUsageForUser(userId).stream()
				.collect(Collectors.toMap(TagUsage::tagId, TagUsage::count, (a, b) -> a, HashMap::new));
	}

	private long usageOf(Tag tag) {
		return tag.getId() == null ? 0L : tags.countUsageForTag(tag.getId());
	}
}
