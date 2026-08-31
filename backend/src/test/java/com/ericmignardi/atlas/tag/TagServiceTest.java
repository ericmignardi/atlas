package com.ericmignardi.atlas.tag;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openapitools.jackson.nullable.JsonNullable;
import org.springframework.dao.DataIntegrityViolationException;

import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.common.error.ConflictException;
import com.ericmignardi.atlas.tag.TagService.TagCreation;
import com.ericmignardi.atlas.tag.dto.CreateTagRequest;
import com.ericmignardi.atlas.tag.dto.UpdateTagRequest;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

/** FR-5.1 – FR-5.9. */
@ExtendWith(MockitoExtension.class)
class TagServiceTest {

	private static final UUID USER_ID = UUID.randomUUID();

	@Mock
	private TagRepository tags;

	@Mock
	private UserRepository users;

	@InjectMocks
	private TagService service;

	private User owner;

	@BeforeEach
	void setUp() {
		owner = TestFixtures.user("owner@example.com");
		owner.setId(USER_ID);
		lenient().when(users.getReferenceById(USER_ID)).thenReturn(owner);
		lenient().when(tags.saveAndFlush(any(Tag.class))).thenAnswer(call -> {
			Tag saved = call.getArgument(0);
			saved.setId(UUID.randomUUID());
			return saved;
		});
	}

	@Test
	void lowercasesAndTrimsANewTagName() {
		when(tags.findByUserIdAndName(USER_ID, "react")).thenReturn(Optional.empty());
		when(tags.countByUserId(USER_ID)).thenReturn(0L);

		TagCreation result = service.findOrCreate(USER_ID, new CreateTagRequest("  React  ", null));

		assertThat(result.created()).isTrue();
		assertThat(result.tag().name()).isEqualTo("react");
	}

	@Test
	void returnsTheExistingTagRatherThanCreatingASecond() {
		Tag existing = tag("react");
		when(tags.findByUserIdAndName(USER_ID, "react")).thenReturn(Optional.of(existing));
		when(tags.countUsageForTag(existing.getId())).thenReturn(3L);

		TagCreation result = service.findOrCreate(USER_ID, new CreateTagRequest("React", null));

		// FR-5.3, and the reason the endpoint answers 200 rather than 201: the
		// caller can send the same name repeatedly and always get the same id.
		assertThat(result.created()).isFalse();
		assertThat(result.tag().id()).isEqualTo(existing.getId());
		assertThat(result.tag().usageCount()).isEqualTo(3);
		verify(tags, never()).saveAndFlush(any());
	}

	@Test
	void takesTheNextColourInTheCycleFromTheUsersTagCount() {
		when(tags.findByUserIdAndName(any(), any())).thenReturn(Optional.empty());
		when(tags.countByUserId(USER_ID)).thenReturn(2L);

		TagCreation result = service.findOrCreate(USER_ID, new CreateTagRequest("postgres", null));

		assertThat(result.tag().color()).isEqualTo(TagPalette.COLOURS.get(2));
	}

	@Test
	void wrapsAroundThePaletteAfterSevenTags() {
		when(tags.findByUserIdAndName(any(), any())).thenReturn(Optional.empty());
		when(tags.countByUserId(USER_ID)).thenReturn(7L);

		TagCreation result = service.findOrCreate(USER_ID, new CreateTagRequest("eighth", null));

		assertThat(result.tag().color()).isEqualTo(TagPalette.COLOURS.get(0));
	}

	@Test
	void honoursAnExplicitColour() {
		when(tags.findByUserIdAndName(any(), any())).thenReturn(Optional.empty());

		TagCreation result = service.findOrCreate(USER_ID, new CreateTagRequest("urgent", "#9B2C22"));

		assertThat(result.tag().color()).isEqualTo("#9B2C22");
		verify(tags, never()).countByUserId(any());
	}

	@Test
	void recoversFromLosingTheRaceToCreateTheSameName() {
		Tag winner = tag("react");
		when(tags.findByUserIdAndName(USER_ID, "react"))
				.thenReturn(Optional.empty())
				.thenReturn(Optional.of(winner));
		when(tags.countByUserId(USER_ID)).thenReturn(0L);
		when(tags.saveAndFlush(any(Tag.class)))
				.thenThrow(new DataIntegrityViolationException("ux_tags_user_name"));
		when(tags.countUsageForTag(winner.getId())).thenReturn(0L);

		TagCreation result = service.findOrCreate(USER_ID, new CreateTagRequest("react", null));

		// The insert lost to the unique index; the answer is the row the winner
		// wrote, not a 409 the caller can do nothing about.
		assertThat(result.created()).isFalse();
		assertThat(result.tag().id()).isEqualTo(winner.getId());
	}

	@Test
	void renamesATag() {
		Tag existing = tag("react");
		when(tags.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));
		when(tags.findByUserIdAndName(USER_ID, "preact")).thenReturn(Optional.empty());
		when(tags.save(existing)).thenReturn(existing);

		UpdateTagRequest request = new UpdateTagRequest();
		request.setName(JsonNullable.of("  Preact "));

		assertThat(service.update(USER_ID, existing.getId(), request).name()).isEqualTo("preact");
	}

	@Test
	void refusesToRenameOntoANameAlreadyInUse() {
		Tag existing = tag("react");
		when(tags.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));
		when(tags.findByUserIdAndName(USER_ID, "vue")).thenReturn(Optional.of(tag("vue")));

		UpdateTagRequest request = new UpdateTagRequest();
		request.setName(JsonNullable.of("vue"));

		assertThatThrownBy(() -> service.update(USER_ID, existing.getId(), request))
				.isInstanceOf(ConflictException.class);
	}

	@Test
	void anEmptyPatchChangesNothing() {
		Tag existing = tag("react");
		existing.setColor("#2251B4");
		when(tags.findByIdAndUserId(existing.getId(), USER_ID)).thenReturn(Optional.of(existing));
		when(tags.save(existing)).thenReturn(existing);

		var updated = service.update(USER_ID, existing.getId(), new UpdateTagRequest());

		assertThat(updated.name()).isEqualTo("react");
		assertThat(updated.color()).isEqualTo("#2251B4");
	}

	private Tag tag(String name) {
		Tag tag = new Tag();
		tag.setId(UUID.randomUUID());
		tag.setUser(owner);
		tag.setName(name);
		return tag;
	}
}
