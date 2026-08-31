package com.ericmignardi.atlas.environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openapitools.jackson.nullable.JsonNullable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.common.error.ConflictException;
import com.ericmignardi.atlas.environment.dto.CreateEnvironmentRequest;
import com.ericmignardi.atlas.environment.dto.UpdateEnvironmentRequest;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

/**
 * NFR-3.3: one test per pairing invariant. Every assertion goes to the raw
 * {@code paired_with_id} column rather than to an entity accessor — the bug
 * these invariants prevent is a one-sided reference, and an entity graph already
 * corrected in memory would hide one.
 */
class EnvironmentPairingServiceIT extends AbstractIntegrationTest {

	@Autowired
	private EnvironmentPairingService pairing;

	@Autowired
	private EnvironmentService environmentService;

	@Autowired
	private EnvironmentRepository environments;

	@Autowired
	private ProjectRepository projects;

	@Autowired
	private UserRepository users;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private User owner;
	private Project project;

	@BeforeEach
	void reset() {
		users.deleteAll();
		owner = users.save(TestFixtures.user("owner@example.com"));
		project = projects.save(TestFixtures.project(owner, "atlas"));
	}

	@Test
	void pair_sameProjectSameType_succeeds() {
		Environment app = save("Production", EnvironmentType.PRODUCTION, Platform.VERCEL);
		Environment database = save("Neon — main", EnvironmentType.PRODUCTION, Platform.NEON);

		pairing.pair(owner.getId(), app.getId(), database.getId());

		// FR-3.7 is symmetry, so both columns are asserted: one of them being
		// right is the failure mode, not the success case.
		assertThat(pairedWithId(app)).isEqualTo(database.getId());
		assertThat(pairedWithId(database)).isEqualTo(app.getId());
	}

	@Test
	void pair_differentType_returns409() {
		Environment production = save("Production", EnvironmentType.PRODUCTION, Platform.VERCEL);
		Environment preview = save("Preview", EnvironmentType.PREVIEW, Platform.NEON);

		assertThatThrownBy(() -> pairing.pair(owner.getId(), production.getId(), preview.getId()))
				.isInstanceOf(ConflictException.class)
				.extracting(failure -> ((ConflictException) failure).getCode())
				.isEqualTo("PAIR_DIFFERENT_TYPE");

		assertThat(pairedWithId(production)).isNull();
		assertThat(pairedWithId(preview)).isNull();
	}

	@Test
	void pair_differentProject_returns409() {
		Project other = projects.save(TestFixtures.project(owner, "sonder"));
		Environment mine = save("Production", EnvironmentType.PRODUCTION, Platform.VERCEL);
		Environment theirs = environments.save(TestFixtures.environment(
				other, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));

		assertThatThrownBy(() -> pairing.pair(owner.getId(), mine.getId(), theirs.getId()))
				.isInstanceOf(ConflictException.class)
				.extracting(failure -> ((ConflictException) failure).getCode())
				.isEqualTo("PAIR_DIFFERENT_PROJECT");
	}

	@Test
	void pair_self_returns409() {
		Environment app = save("Production", EnvironmentType.PRODUCTION, Platform.VERCEL);

		// FR-3.10 is checked first: an environment trivially shares its own
		// project and type, so both later guards would let it past.
		assertThatThrownBy(() -> pairing.pair(owner.getId(), app.getId(), app.getId()))
				.isInstanceOf(ConflictException.class)
				.extracting(failure -> ((ConflictException) failure).getCode())
				.isEqualTo("PAIR_SELF");

		assertThat(pairedWithId(app)).isNull();
	}

	@Test
	void pair_whenAlreadyPaired_releasesPreviousPartner() {
		Environment app = save("Production", EnvironmentType.PRODUCTION, Platform.VERCEL);
		Environment first = save("Neon — old", EnvironmentType.PRODUCTION, Platform.NEON);
		Environment second = save("Neon — new", EnvironmentType.PRODUCTION, Platform.NEON);

		pairing.pair(owner.getId(), app.getId(), first.getId());
		pairing.pair(owner.getId(), app.getId(), second.getId());

		assertThat(pairedWithId(app)).isEqualTo(second.getId());
		assertThat(pairedWithId(second)).isEqualTo(app.getId());

		// FR-3.11: the displaced partner is genuinely free, not merely no longer
		// pointed at. A row still holding a stale id would pass the first two
		// assertions and block the next pairing with a UNIQUE violation.
		assertThat(pairedWithId(first)).isNull();
		assertThat(countPointingAt(first)).isZero();
	}

	@Test
	void changeType_breaksPairOnBothSides() {
		Environment app = save("Production", EnvironmentType.PRODUCTION, Platform.VERCEL);
		Environment database = save("Neon — main", EnvironmentType.PRODUCTION, Platform.NEON);
		pairing.pair(owner.getId(), app.getId(), database.getId());

		UpdateEnvironmentRequest request = new UpdateEnvironmentRequest();
		request.setType(JsonNullable.of(EnvironmentType.PREVIEW));
		environmentService.update(owner.getId(), app.getId(), request);

		// FR-3.12. The pair's precondition was "same type"; the moment that stops
		// holding the pair has to go, or the data says something untrue.
		assertThat(pairedWithId(app)).isNull();
		assertThat(pairedWithId(database)).isNull();
	}

	@Test
	void delete_releasesPartner() {
		Environment app = save("Production", EnvironmentType.PRODUCTION, Platform.VERCEL);
		Environment database = save("Neon — main", EnvironmentType.PRODUCTION, Platform.NEON);
		pairing.pair(owner.getId(), app.getId(), database.getId());

		environmentService.delete(owner.getId(), app.getId());

		// FR-3.13: ON DELETE SET NULL would clean the column either way — what
		// this asserts is that the service did it first.
		assertThat(environments.findById(database.getId())).isPresent();
		assertThat(pairedWithId(database)).isNull();
		assertThat(environments.count()).isEqualTo(1);
	}

	@Test
	void anyWrite_touchesProjectUpdatedAt() {
		// FR-3.14, for all three verbs. A collection change does not make its
		// owner dirty, so the touch has to be explicit.
		var created = environmentService.create(owner.getId(), new CreateEnvironmentRequest(
				project.getId(), "Production", Platform.VERCEL, EnvironmentType.PRODUCTION,
				"main", "https://atlas.example.com", null));
		var afterCreate = updatedAt();
		assertThat(afterCreate).isAfter(project.getUpdatedAt());

		UpdateEnvironmentRequest rename = new UpdateEnvironmentRequest();
		rename.setName(JsonNullable.of("Production (Vercel)"));
		environmentService.update(owner.getId(), created.id(), rename);
		var afterUpdate = updatedAt();
		assertThat(afterUpdate).isAfter(afterCreate);

		environmentService.delete(owner.getId(), created.id());
		assertThat(updatedAt()).isAfter(afterUpdate);
	}

	private Environment save(String name, EnvironmentType type, Platform platform) {
		return environments.save(TestFixtures.environment(project, name, type, platform));
	}

	private UUID pairedWithId(Environment environment) {
		return jdbcTemplate.queryForObject(
				"SELECT paired_with_id FROM environments WHERE id = ?", UUID.class, environment.getId());
	}

	private int countPointingAt(Environment environment) {
		return jdbcTemplate.queryForObject(
				"SELECT count(*) FROM environments WHERE paired_with_id = ?", Integer.class,
				environment.getId());
	}

	private java.time.Instant updatedAt() {
		return projects.findById(project.getId()).orElseThrow().getUpdatedAt();
	}
}
