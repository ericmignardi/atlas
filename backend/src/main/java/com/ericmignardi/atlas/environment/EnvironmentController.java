package com.ericmignardi.atlas.environment;

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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ericmignardi.atlas.environment.dto.CreateEnvironmentRequest;
import com.ericmignardi.atlas.environment.dto.EnvironmentFilter;
import com.ericmignardi.atlas.environment.dto.EnvironmentResponse;
import com.ericmignardi.atlas.environment.dto.GroupedEnvironments;
import com.ericmignardi.atlas.environment.dto.PairRequest;
import com.ericmignardi.atlas.environment.dto.PairResponse;
import com.ericmignardi.atlas.environment.dto.UpdateEnvironmentRequest;
import com.ericmignardi.atlas.security.CurrentUser;
import com.ericmignardi.atlas.security.UserPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/environments")
@RequiredArgsConstructor
@Tag(name = "Environments", description = "Deployment targets, and the pairs they form")
public class EnvironmentController {

	private final EnvironmentService environmentService;

	@GetMapping
	@Operation(summary = "List a project's environments, optionally filtered by type or platform")
	public List<EnvironmentResponse> list(@CurrentUser UserPrincipal user,
			@RequestParam UUID projectId, @ModelAttribute EnvironmentFilter filter) {

		return environmentService.list(user.id(), projectId, filter);
	}

	@GetMapping("/grouped")
	@Operation(summary = "The Environments tab: three type groups of paired rows, in display order")
	public GroupedEnvironments grouped(@CurrentUser UserPrincipal user, @RequestParam UUID projectId) {
		return environmentService.grouped(user.id(), projectId);
	}

	@PostMapping
	@Operation(summary = "Create an environment under a project")
	public ResponseEntity<EnvironmentResponse> create(@CurrentUser UserPrincipal user,
			@Valid @RequestBody CreateEnvironmentRequest request) {

		EnvironmentResponse created = environmentService.create(user.id(), request);
		return ResponseEntity
				.created(URI.create("/api/environments/" + created.id()))
				.body(created);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get one environment")
	public EnvironmentResponse get(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		return environmentService.get(user.id(), id);
	}

	@PatchMapping("/{id}")
	@Operation(summary = "Partially update an environment; a type change breaks the pairing")
	public EnvironmentResponse update(@CurrentUser UserPrincipal user, @PathVariable UUID id,
			@Valid @RequestBody UpdateEnvironmentRequest request) {

		return environmentService.update(user.id(), id, request);
	}

	@DeleteMapping("/{id}")
	@Operation(summary = "Delete an environment; its partner survives, unpaired")
	public ResponseEntity<Void> delete(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		environmentService.delete(user.id(), id);
		return ResponseEntity.noContent().build();
	}

	@PutMapping("/{id}/pair")
	@Operation(summary = "Pair two environments; 409 with a reason code on an invariant breach")
	public PairResponse pair(@CurrentUser UserPrincipal user, @PathVariable UUID id,
			@Valid @RequestBody PairRequest request) {

		return environmentService.pair(user.id(), id, request.targetId());
	}

	@DeleteMapping("/{id}/pair")
	@Operation(summary = "Release a pairing; both sides are cleared")
	public PairResponse unpair(@CurrentUser UserPrincipal user, @PathVariable UUID id) {
		return environmentService.unpair(user.id(), id);
	}
}
