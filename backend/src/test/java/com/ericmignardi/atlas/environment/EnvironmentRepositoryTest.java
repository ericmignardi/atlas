package com.ericmignardi.atlas.environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ericmignardi.atlas.AbstractIntegrationTest;
import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

class EnvironmentRepositoryTest extends AbstractIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private EnvironmentRepository environmentRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private User owner;
	private Project project;

	@BeforeEach
	void reset() {
		userRepository.deleteAll();
		owner = userRepository.save(TestFixtures.user());
		project = projectRepository.save(TestFixtures.project(owner, "atlas"));
	}

	@Test
	void savesAndReloadsAnEnvironment() {
		Environment saved = environmentRepository.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));

		Environment reloaded = environmentRepository.findById(saved.getId()).orElseThrow();

		assertThat(reloaded.getName()).isEqualTo("Neon — main");
		assertThat(reloaded.getPlatform()).isEqualTo(Platform.NEON);
		assertThat(reloaded.getType()).isEqualTo(EnvironmentType.PRODUCTION);
		assertThat(reloaded.getPairedWith()).isNull();
	}

	@Test
	void storesEnumsAsStringsNotOrdinals() {
		environmentRepository.save(TestFixtures.environment(
				project, "Preview", EnvironmentType.PREVIEW, Platform.VERCEL));

		// Read the raw column. If this ever came back "1" instead of "PREVIEW",
		// inserting a value into the middle of the enum would silently
		// reinterpret every existing row (PRD 5.8).
		assertThat(jdbcTemplate.queryForObject(
				"SELECT type FROM environments WHERE name = 'Preview'", String.class))
				.isEqualTo("PREVIEW");
		assertThat(jdbcTemplate.queryForObject(
				"SELECT platform FROM environments WHERE name = 'Preview'", String.class))
				.isEqualTo("VERCEL");
	}

	@Test
	void pairsTwoEnvironmentsThroughASingleOwningColumn() {
		Environment app = environmentRepository.save(
				TestFixtures.environment(project, "Production", EnvironmentType.PRODUCTION));
		Environment database = environmentRepository.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));

		app.setPairedWith(database);
		environmentRepository.saveAndFlush(app);

		// The inverse side reads back without ever having been written to: one
		// column, two views. Looked up from the database's id, the owner of the
		// pair is the application environment.
		assertThat(environmentRepository.findByPairedWithId(database.getId()))
				.get()
				.extracting(Environment::getId)
				.isEqualTo(app.getId());
	}

	@Test
	void rejectsTwoEnvironmentsClaimingTheSamePartner() {
		Environment database = environmentRepository.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));
		Environment first = environmentRepository.save(
				TestFixtures.environment(project, "Production", EnvironmentType.PRODUCTION));
		Environment second = environmentRepository.save(
				TestFixtures.environment(project, "Production copy", EnvironmentType.PRODUCTION));

		first.setPairedWith(database);
		environmentRepository.saveAndFlush(first);
		second.setPairedWith(database);

		// This is the safety net under FR-3.7: even with a bug in the pairing
		// service, the UNIQUE constraint on paired_with_id makes a shared
		// partner impossible. It is also why pairing must release before it
		// assigns (FR-3.11) rather than assigning and cleaning up after.
		assertThatThrownBy(() -> environmentRepository.saveAndFlush(second))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void releasesThePartnerWhenAPairedEnvironmentIsDeleted() {
		Environment app = environmentRepository.save(
				TestFixtures.environment(project, "Production", EnvironmentType.PRODUCTION));
		Environment database = environmentRepository.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));
		app.setPairedWith(database);
		environmentRepository.saveAndFlush(app);

		// ON DELETE SET NULL, not CASCADE: losing the database environment must
		// unpair the application environment, not delete it too (FR-3.13).
		jdbcTemplate.update("DELETE FROM environments WHERE id = ?", database.getId());

		assertThat(environmentRepository.findById(app.getId()))
				.get()
				.extracting(Environment::getPairedWith)
				.isNull();
	}

	@Test
	void deletingAProjectDeletesItsEnvironmentsAtTheDatabaseLevel() {
		environmentRepository.save(
				TestFixtures.environment(project, "Production", EnvironmentType.PRODUCTION));
		environmentRepository.save(TestFixtures.environment(
				project, "Neon — main", EnvironmentType.PRODUCTION, Platform.NEON));

		// Deliberately native, bypassing the JPA cascade: this asserts the FK in
		// V5 says ON DELETE CASCADE, not that the entity mapping happens to.
		jdbcTemplate.update("DELETE FROM projects WHERE id = ?", project.getId());

		assertThat(environmentRepository.count()).isZero();
	}

	@Test
	void scopesLookupsToTheOwnerThroughTheProject() {
		Environment environment = environmentRepository.save(
				TestFixtures.environment(project, "Production", EnvironmentType.PRODUCTION));
		User stranger = userRepository.save(TestFixtures.user());

		assertThat(environmentRepository.findByIdAndUserId(environment.getId(), owner.getId())).isPresent();
		assertThat(environmentRepository.findByIdAndUserId(environment.getId(), stranger.getId())).isEmpty();
	}
}
