package com.ericmignardi.atlas.environment;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.common.error.NotFoundException;
import com.ericmignardi.atlas.common.error.ValidationException;
import com.ericmignardi.atlas.environment.EnvironmentPairingService.Pairing;
import com.ericmignardi.atlas.environment.dto.CreateEnvironmentRequest;
import com.ericmignardi.atlas.environment.dto.EnvironmentFilter;
import com.ericmignardi.atlas.environment.dto.EnvironmentGroup;
import com.ericmignardi.atlas.environment.dto.EnvironmentResponse;
import com.ericmignardi.atlas.environment.dto.EnvironmentRow;
import com.ericmignardi.atlas.environment.dto.EnvironmentSummary;
import com.ericmignardi.atlas.environment.dto.GroupedEnvironments;
import com.ericmignardi.atlas.environment.dto.PairResponse;
import com.ericmignardi.atlas.environment.dto.UpdateEnvironmentRequest;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;

import lombok.RequiredArgsConstructor;

/** FR-3.1 – FR-3.15. The invariants themselves live in {@link EnvironmentPairingService}. */
@Service
@RequiredArgsConstructor
public class EnvironmentService {

	private final EnvironmentRepository environments;
	private final ProjectRepository projects;
	private final EnvironmentPairingService pairing;

	@Transactional(readOnly = true)
	public List<EnvironmentResponse> list(UUID userId, UUID projectId, EnvironmentFilter filter) {
		requireProject(userId, projectId);

		return environments.findForProject(projectId, userId, filter.type(), filter.platform()).stream()
				.sorted(displayOrder())
				.map(environment -> EnvironmentResponse.from(environment, environment.getPairedWith()))
				.toList();
	}

	@Transactional(readOnly = true)
	public EnvironmentResponse get(UUID userId, UUID id) {
		return respond(require(userId, id));
	}

	/**
	 * FR-3.5, FR-3.6, FR-3.15. One query feeds all of it: the partner is
	 * fetch-joined, and the "who points at me" direction is rebuilt in memory
	 * from the same list rather than asked for again.
	 */
	@Transactional(readOnly = true)
	public GroupedEnvironments grouped(UUID userId, UUID projectId) {
		requireProject(userId, projectId);

		List<Environment> all = environments.findForProject(projectId, userId, null, null);
		Map<UUID, Environment> claimants = new HashMap<>();
		for (Environment environment : all) {
			if (environment.getPairedWith() != null) {
				claimants.putIfAbsent(environment.getPairedWith().getId(), environment);
			}
		}

		List<EnvironmentGroup> groups = new ArrayList<>();
		for (EnvironmentType type : EnvironmentType.values()) {
			groups.add(group(type, all, claimants));
		}
		return new GroupedEnvironments(groups);
	}

	@Transactional
	public EnvironmentResponse create(UUID userId, CreateEnvironmentRequest request) {
		Project project = requireProject(userId, request.projectId());

		Environment environment = new Environment();
		environment.setName(request.name().trim());
		environment.setPlatform(request.platform());
		environment.setType(request.type());
		environment.setBranch(blankToNull(request.branch()));
		environment.setUrl(blankToNull(request.url()));
		environment.setNotes(blankToNull(request.notes()));
		project.addEnvironment(environment);

		Environment saved = environments.save(environment);
		touch(project);
		return respond(saved);
	}

	@Transactional
	public EnvironmentResponse update(UUID userId, UUID id, UpdateEnvironmentRequest request) {
		Environment environment = require(userId, id);

		request.getName().ifPresent(name -> environment.setName(name.trim()));
		request.getPlatform().ifPresent(environment::setPlatform);
		request.getBranch().ifPresent(branch -> environment.setBranch(blankToNull(branch)));
		request.getUrl().ifPresent(url -> environment.setUrl(blankToNull(url)));
		request.getNotes().ifPresent(notes -> environment.setNotes(blankToNull(notes)));

		// FR-3.12: the pair's precondition was "same type", so it goes with it.
		request.getType().ifPresent(type -> {
			if (type != environment.getType()) {
				pairing.releasePartner(environment);
			}
			environment.setType(type);
		});

		Environment saved = environments.save(environment);
		touch(environment.getProject());
		return respond(saved);
	}

	/**
	 * FR-3.13. Released before the row goes rather than left to ON DELETE SET
	 * NULL: the constraint cleans the column, but the partner is a managed entity
	 * in this transaction and would go on referencing a deleted row.
	 */
	@Transactional
	public void delete(UUID userId, UUID id) {
		Environment environment = require(userId, id);
		Project project = environment.getProject();

		pairing.releasePartner(environment);
		environments.flush();

		project.removeEnvironment(environment);
		environments.delete(environment);
		touch(project);
	}

	@Transactional
	public PairResponse pair(UUID userId, UUID id, UUID targetId) {
		Pairing paired = pairing.pair(userId, id, targetId);
		touch(paired.environment().getProject());
		return respond(paired);
	}

	@Transactional
	public PairResponse unpair(UUID userId, UUID id) {
		Pairing released = pairing.unpair(userId, id);
		touch(released.environment().getProject());
		return respond(released);
	}

	private EnvironmentGroup group(EnvironmentType type, List<Environment> all,
			Map<UUID, Environment> claimants) {

		List<Environment> members = all.stream()
				.filter(environment -> environment.getType() == type)
				.sorted(Comparator.comparing(Environment::getName, String.CASE_INSENSITIVE_ORDER))
				.toList();

		Set<UUID> taken = new HashSet<>();
		List<EnvironmentRow> rows = new ArrayList<>();

		// FR-3.15: applications claim their partners first, so a row always reads
		// app ── database and never the other way round.
		for (Environment application : members) {
			if (application.getPlatform().isDatabase() || !taken.add(application.getId())) {
				continue;
			}
			Environment partner = partnerWithin(application, claimants);
			if (partner != null && partner.getType() == type && taken.add(partner.getId())) {
				rows.add(new EnvironmentRow(EnvironmentSummary.from(application),
						EnvironmentSummary.from(partner)));
			}
			else {
				// The dashed empty slot is an explicit null database.
				rows.add(new EnvironmentRow(EnvironmentSummary.from(application), null));
			}
		}

		List<EnvironmentSummary> orphans = members.stream()
				.filter(environment -> environment.getPlatform().isDatabase())
				.filter(environment -> !taken.contains(environment.getId()))
				.map(EnvironmentSummary::from)
				.toList();

		return new EnvironmentGroup(type, rows, orphans);
	}

	private static Environment partnerWithin(Environment environment, Map<UUID, Environment> claimants) {
		return environment.getPairedWith() != null
				? environment.getPairedWith()
				: claimants.get(environment.getId());
	}

	/** FR-3.5: type in declaration order, then name. */
	private static Comparator<Environment> displayOrder() {
		return Comparator.comparing(Environment::getType)
				.thenComparing(Environment::getName, String.CASE_INSENSITIVE_ORDER);
	}

	private Environment require(UUID userId, UUID id) {
		return environments.findByIdAndUserId(id, userId)
				.orElseThrow(() -> NotFoundException.of("Environment", id));
	}

	private Project requireProject(UUID userId, UUID projectId) {
		return projects.findByIdAndUserId(projectId, userId)
				.orElseThrow(() -> ValidationException.of("projectId", "does not exist"));
	}

	/**
	 * FR-3.14. Assigning the timestamp is what marks the project dirty — a
	 * collection change does not — and the auditing listener then overwrites it
	 * at flush. Without the assignment Hibernate issues no UPDATE at all.
	 */
	private void touch(Project project) {
		project.setUpdatedAt(Instant.now());
		projects.save(project);
	}

	private EnvironmentResponse respond(Environment environment) {
		return EnvironmentResponse.from(environment, pairing.partnerOf(environment));
	}

	/**
	 * Each side reports its own current partner. After a pair those are the same
	 * thing; after an unpair they are not.
	 */
	private static PairResponse respond(Pairing pairing) {
		Environment environment = pairing.environment();
		Environment partner = pairing.partner();

		return new PairResponse(
				EnvironmentResponse.from(environment, environment.getPairedWith()),
				partner == null ? null : EnvironmentResponse.from(partner, partner.getPairedWith()));
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
