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
 * The one test that does not extend {@code AbstractIntegrationTest}: it needs the
 * {@code dev} profile, which is a different context-cache key anyway. Spring Boot
 * does not invoke {@code CommandLineRunner} beans in a test context, so the run
 * is explicit here.
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
		// Five pairs, ten rows: pairing writes both columns (FR-3.7), so the
		// seed looks exactly like data the pairing service produced.
		assertThat(jdbcTemplate.queryForObject(
				"SELECT count(*) FROM environments WHERE paired_with_id IS NOT NULL", Integer.class))
				.isEqualTo(10);

		seeder.run();

		assertThat(userRepository.count()).isEqualTo(1);
		assertThat(projectRepository.count()).isEqualTo(5);
		assertThat(environmentRepository.count()).isEqualTo(18);
		assertThat(taskRepository.count()).isEqualTo(25);
		assertThat(tagRepository.count()).isEqualTo(8);
	}
}
