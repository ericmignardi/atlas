package com.ericmignardi.atlas.project;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ericmignardi.atlas.project.dto.CreateProjectRequest;
import com.ericmignardi.atlas.project.dto.ProjectFilter;
import com.ericmignardi.atlas.project.dto.ProjectResponse;
import com.ericmignardi.atlas.project.dto.UpdateProjectRequest;
import com.ericmignardi.atlas.security.CurrentUser;
import com.ericmignardi.atlas.security.UserPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * PRD 6.3. Bind, delegate, map the response — and nothing else. Every rule this
 * endpoint enforces lives in {@link ProjectService}, so the same rule holds for
 * a future caller that is not HTTP, and so a controller test that passed would
 * not be evidence the rule works.
 */
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@Tag(name = "Projects", description = "The aggregate the rest of the portal hangs off")
public class ProjectController {

	private final ProjectService projectService;

	@GetMapping
	@Operation(summary = "List projects, filtered and sorted")
	public List<ProjectResponse> list(@CurrentUser UserPrincipal user,
			@ModelAttribute ProjectFilter filter) {

		return projectService.list(user.id(), filter);
	}

	@PostMapping
	@Operation(summary = "Create a project; the slug is derived from the name")
	public ResponseEntity<ProjectResponse> create(@CurrentUser UserPrincipal user,
			@Valid @RequestBody CreateProjectRequest request) {

		ProjectResponse created = projectService.create(user.id(), request);
		return ResponseEntity
				.created(URI.create("/api/projects/" + created.id()))
				.body(created);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get one project by id")
	public ProjectResponse get(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		return projectService.get(user.id(), id);
	}

	@GetMapping("/slug/{slug}")
	@Operation(summary = "Get one project by slug")
	public ProjectResponse getBySlug(@CurrentUser UserPrincipal user, @PathVariable String slug) {
		return projectService.getBySlug(user.id(), slug);
	}

	@PatchMapping("/{id}")
	@Operation(summary = "Partially update a project; an absent key changes nothing")
	public ProjectResponse update(@CurrentUser UserPrincipal user, @PathVariable UUID id,
			@Valid @RequestBody UpdateProjectRequest request) {

		return projectService.update(user.id(), id, request);
	}

	@DeleteMapping("/{id}")
	@Operation(summary = "Delete a project; environments go with it, tasks are detached")
	public ResponseEntity<Void> delete(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		projectService.delete(user.id(), id);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/{id}/pin")
	@Operation(summary = "Pin a project; 409 once four are pinned")
	public ProjectResponse pin(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		return projectService.pin(user.id(), id);
	}

	@DeleteMapping("/{id}/pin")
	@Operation(summary = "Unpin a project")
	public ProjectResponse unpin(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		return projectService.unpin(user.id(), id);
	}
}
