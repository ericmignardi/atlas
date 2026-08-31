package com.ericmignardi.atlas.tag;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ericmignardi.atlas.security.CurrentUser;
import com.ericmignardi.atlas.security.UserPrincipal;
import com.ericmignardi.atlas.tag.TagService.TagCreation;
import com.ericmignardi.atlas.tag.dto.CreateTagRequest;
import com.ericmignardi.atlas.tag.dto.TagResponse;
import com.ericmignardi.atlas.tag.dto.UpdateTagRequest;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** PRD 6.6. Bind, delegate, map the response. No business logic lives here. */
@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
@io.swagger.v3.oas.annotations.tags.Tag(name = "Tags", description = "Labels, shared across projects")
public class TagController {

	private final TagService tagService;

	@GetMapping
	@Operation(summary = "List tags, each with its usage count")
	public List<TagResponse> list(@CurrentUser UserPrincipal user,
			@RequestParam(required = false) String q) {

		return tagService.list(user.id(), q);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get one tag")
	public TagResponse get(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		return tagService.get(user.id(), id);
	}

	/**
	 * Create or return (FR-5.3). 201 when the tag is new, 200 when it already
	 * existed — the caller gets the same body either way and can tell which
	 * happened from the status, which is what makes this safe to call blindly.
	 */
	@PostMapping
	@Operation(summary = "Create a tag, or return the existing one with that name")
	public ResponseEntity<TagResponse> create(@CurrentUser UserPrincipal user,
			@Valid @RequestBody CreateTagRequest request) {

		TagCreation result = tagService.findOrCreate(user.id(), request);
		if (!result.created()) {
			return ResponseEntity.ok(result.tag());
		}
		return ResponseEntity.created(URI.create("/api/tags/" + result.tag().id())).body(result.tag());
	}

	@PatchMapping("/{id}")
	@Operation(summary = "Rename or recolour a tag")
	public TagResponse update(@CurrentUser UserPrincipal user, @PathVariable UUID id,
			@Valid @RequestBody UpdateTagRequest request) {

		return tagService.update(user.id(), id, request);
	}

	@DeleteMapping("/{id}")
	@Operation(summary = "Delete a tag; tagged projects survive")
	public ResponseEntity<Void> delete(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		tagService.delete(user.id(), id);
		return ResponseEntity.noContent().build();
	}
}
