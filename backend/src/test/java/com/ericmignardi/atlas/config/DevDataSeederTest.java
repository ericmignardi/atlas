package com.ericmignardi.atlas.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.ericmignardi.atlas.TestcontainersConfiguration;
import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.user.UserRepository;

/**
 * The seeder is the only bean in the application that writes on startup, which
 * makes it the only one that can quietly corrupt a developer's database. It runs
 * on every boot, and DevTools reboots on every recompile, so "idempotent" is not
 * a nicety — without it a morning's work leaves fifty projects behind.
 *
 * <p>This is the one test that does not extend {@code AbstractIntegrationTest}:
 * it needs the {@code dev} profile, and a different profile is a different
 * context-cache key anyway. Spring Boot does not invoke {@code CommandLineRunner}
 * beans in a test context, so the run is explicit here.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("dev")
class DevDataSeederTest {

	@Autowired
	private DevDataSeeder seeder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private EnvironmentRepository environmentRepository;

	@Autowired
	private TaskRepository taskRepository;

	@Autowired
	private TagRepository tagRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void reset() {
		userRepository.deleteAll();
	}

	@Test
	void seedsARealisticDatasetAndDoesNotDuplicateItOnASecondRun() {
		seeder.run();

		assertThat(userRepository.count()).isEqualTo(1);
		assertThat(projectRepository.count()).isEqualTo(5);
		assertThat(environmentRepository.count()).isEqualTo(18);
		assertThat(taskRepository.count()).isEqualTo(25);
		assertThat(tagRepository.count()).isEqualTo(8);
		assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM project_tags", Integer.class))
				.isEqualTo(14);
		assertThat(jdbcTemplate.queryForObject(
				"SELECT count(*) FROM environments WHERE paired_with_id IS NOT NULL", Integer.class))
				.isEqualTo(5);

		seeder.run();

		assertThat(userRepository.count()).isEqualTo(1);
		assertThat(projectRepository.count()).isEqualTo(5);
		assertThat(environmentRepository.count()).isEqualTo(18);
		assertThat(taskRepository.count()).isEqualTo(25);
		assertThat(tagRepository.count()).isEqualTo(8);
	}
}
