package com.ericmignardi.atlas.config;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.environment.Environment;
import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.project.ProjectStatus;
import com.ericmignardi.atlas.tag.ProjectTag;
import com.ericmignardi.atlas.tag.Tag;
import com.ericmignardi.atlas.tag.TagPalette;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskPriority;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.task.TaskStatus;
import com.ericmignardi.atlas.user.User;
import com.ericmignardi.atlas.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Idempotent: it returns early if the demo account already exists, so a DevTools
 * reload does not stack up five more projects every time.
 */
@Component
@Profile("dev")
@RequiredArgsConstructor
public class DevDataSeeder implements CommandLineRunner {

	private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

	private static final String DEMO_EMAIL = "eric@ericmignardi.com";
	private static final String DEMO_PASSWORD = "atlas-dev-password";

	private final UserRepository userRepository;
	private final ProjectRepository projectRepository;
	private final EnvironmentRepository environmentRepository;
	private final TaskRepository taskRepository;
	private final TagRepository tagRepository;
	private final PasswordEncoder passwordEncoder;

	@Override
	@Transactional
	public void run(String... args) {
		if (userRepository.existsByEmailIgnoreCase(DEMO_EMAIL)) {
			log.debug("Development seed skipped: {} already exists", DEMO_EMAIL);
			return;
		}

		User user = new User();
		user.setEmail(DEMO_EMAIL);
		user.setPasswordHash(passwordEncoder.encode(DEMO_PASSWORD));
		user.setDisplayName("Eric Mignardi");
		userRepository.save(user);

		Map<String, Tag> tags = seedTags(user);
		List<Project> projects = seedProjects(user, tags);
		seedEnvironments(projects);
		seedTasks(user, projects);

		log.info("Development seed created: {} / {} — {} projects, {} environments, {} tasks, {} tags",
				DEMO_EMAIL, DEMO_PASSWORD, projects.size(), environmentRepository.count(),
				taskRepository.count(), tags.size());
	}

	private Map<String, Tag> seedTags(User user) {
		List<String> names = List.of(
				"client-work", "personal", "spring", "react", "postgres", "vercel", "urgent", "maintenance");

		Map<String, Tag> byName = new LinkedHashMap<>();
		int index = 0;
		for (String name : names) {
			Tag tag = new Tag();
			tag.setUser(user);
			tag.setName(name);
			// FR-5.4: the colour follows the tag count, so a fresh set cycles.
			tag.setColor(TagPalette.nextColour(index++));
			byName.put(name, tagRepository.save(tag));
		}
		return byName;
	}

	private List<Project> seedProjects(User user, Map<String, Tag> tags) {
		List<Project> projects = new ArrayList<>();

		projects.add(project(user, tags, "Atlas", "atlas", null, ProjectStatus.ACTIVE, true,
				"Personal developer portal. Projects, environments, and tasks in one place — "
						+ "the thing that replaces the spreadsheet, the pinned tabs, and the notes app.",
				"https://github.com/ericmignardi/atlas", "https://atlas.ericmignardi.com",
				"Personal", LocalDate.now().minusDays(1),
				List.of("Java 21", "Spring Boot", "PostgreSQL", "React", "TypeScript", "Tailwind CSS"),
				List.of("personal", "spring", "react", "postgres")));

		projects.add(project(user, tags, "Northwind Dental", "northwind-dental", "Northwind Dental Group",
				ProjectStatus.SHIPPED, true,
				"Marketing site and online booking funnel. Handed over in June; still on a small "
						+ "maintenance retainer for content changes.",
				"https://github.com/ericmignardi/northwind-dental", "https://northwinddental.ca",
				"Fixed bid", LocalDate.now().minusMonths(7),
				List.of("Next.js", "TypeScript", "Sanity", "Vercel"),
				List.of("client-work", "vercel", "maintenance")));

		projects.add(project(user, tags, "Sonder Coffee Roasters", "sonder-coffee", "Sonder Coffee Co.",
				ProjectStatus.ACTIVE, false,
				"Subscription storefront. Phase two is the roast-schedule calendar and the "
						+ "wholesale price tier.",
				"https://github.com/ericmignardi/sonder-storefront", "https://shop.sondercoffee.ca",
				"Retainer", LocalDate.now().minusMonths(3),
				List.of("Next.js", "TypeScript", "Stripe", "Tailwind CSS", "Vercel"),
				List.of("client-work", "react", "vercel")));

		projects.add(project(user, tags, "Meridian Invoicing", "meridian-invoicing", "Meridian Contracting",
				ProjectStatus.PAUSED, false,
				"Internal invoicing and job-costing tool. Paused at the client's request until "
						+ "their fiscal year closes in October.",
				"https://github.com/ericmignardi/meridian-invoicing", null,
				"Time and materials", LocalDate.now().minusMonths(5),
				List.of("Java 21", "Spring Boot", "PostgreSQL", "React"),
				List.of("client-work", "spring", "postgres")));

		projects.add(project(user, tags, "Fieldnote", "fieldnote", null,
				ProjectStatus.IDEA, false,
				"Offline-first notes for site visits. Local SQLite, sync when there is signal. "
						+ "No code yet — this is a shape, not a project.",
				null, null, "Personal", null,
				List.of("SvelteKit", "SQLite"),
				List.of("personal")));

		return projects;
	}

	private Project project(User user, Map<String, Tag> tags, String name, String slug, String client,
			ProjectStatus status, boolean pinned, String description, String repoUrl, String liveUrl,
			String engagement, LocalDate startedAt, List<String> techStack, List<String> tagNames) {

		Project project = new Project();
		project.setUser(user);
		project.setName(name);
		project.setSlug(slug);
		project.setClient(client);
		project.setStatus(status);
		project.setPinned(pinned);
		project.setDescription(description);
		project.setRepoUrl(repoUrl);
		project.setLiveUrl(liveUrl);
		project.setEngagement(engagement);
		project.setStartedAt(startedAt);
		project.setTechStack(new ArrayList<>(techStack));
		for (String tagName : tagNames) {
			project.getTags().add(new ProjectTag(project, tags.get(tagName)));
		}
		return projectRepository.save(project);
	}

	private void seedEnvironments(List<Project> projects) {
		Project atlas = projects.get(0);
		Project northwind = projects.get(1);
		Project sonder = projects.get(2);
		Project meridian = projects.get(3);

		Environment atlasProd = env(atlas, "Production", Platform.VERCEL, EnvironmentType.PRODUCTION,
				"main", "https://atlas.ericmignardi.com",
				"Azure Static Web Apps in front of Container Apps.");
		Environment atlasProdDb = env(atlas, "Neon — main", Platform.NEON, EnvironmentType.PRODUCTION,
				"main",
				"postgresql://atlas_owner:npg_R7xQ2mVt@ep-shy-frost-a8k3n1qz.us-east-2.aws.neon.tech/atlas?sslmode=require",
				"Autoscaling off. Point-in-time restore kept at 7 days.");
		Environment atlasPreview = env(atlas, "Preview", Platform.VERCEL, EnvironmentType.PREVIEW,
				"develop", "https://atlas-git-develop-ericmignardi.vercel.app", null);
		Environment atlasPreviewDb = env(atlas, "Neon — develop", Platform.NEON, EnvironmentType.PREVIEW,
				"develop",
				"postgresql://atlas_owner:npg_R7xQ2mVt@ep-late-cell-a8v2p0dc.us-east-2.aws.neon.tech/atlas?sslmode=require",
				"Branched off main. Reset it whenever the schema drifts.");
		env(atlas, "Local", Platform.LOCAL, EnvironmentType.DEVELOPMENT,
				"feature/persistence", "jdbc:postgresql://localhost:5433/atlas",
				"docker compose up -d. Port 5433, not 5432.");

		pair(atlasProd, atlasProdDb);
		pair(atlasPreview, atlasPreviewDb);

		Environment nwProd = env(northwind, "Production", Platform.VERCEL, EnvironmentType.PRODUCTION,
				"main", "https://northwinddental.ca", "DNS at Cloudflare, apex + www.");
		Environment nwProdDb = env(northwind, "Sanity — production", Platform.OTHER,
				EnvironmentType.PRODUCTION, null, "https://northwind.sanity.studio",
				"Dataset: production. Client has two editor seats.");
		env(northwind, "Staging", Platform.VERCEL, EnvironmentType.PREVIEW,
				"staging", "https://northwind-git-staging-ericmignardi.vercel.app",
				"Where content changes get approved before they go live.");
		env(northwind, "Local", Platform.LOCAL, EnvironmentType.DEVELOPMENT,
				"main", "http://localhost:3000", null);

		pair(nwProd, nwProdDb);

		Environment sonderProd = env(sonder, "Production", Platform.VERCEL, EnvironmentType.PRODUCTION,
				"main", "https://shop.sondercoffee.ca",
				"Stripe live keys. Do not point this at a test branch.");
		Environment sonderProdDb = env(sonder, "Neon — main", Platform.NEON, EnvironmentType.PRODUCTION,
				"main",
				"postgresql://sonder_owner:npg_4tLp9wKe@ep-wispy-dawn-a5m7r2ub.us-east-2.aws.neon.tech/sonder?sslmode=require",
				null);
		Environment sonderPreview = env(sonder, "Preview — wholesale", Platform.VERCEL,
				EnvironmentType.PREVIEW, "feature/wholesale-tier",
				"https://sonder-git-feature-wholesale-tier-ericmignardi.vercel.app",
				"Wholesale pricing behind a flag. Share this one with the client, not staging.");
		Environment sonderPreviewDb = env(sonder, "Neon — wholesale", Platform.NEON,
				EnvironmentType.PREVIEW, "feature/wholesale-tier",
				"postgresql://sonder_owner:npg_4tLp9wKe@ep-damp-glade-a5j4t8we.us-east-2.aws.neon.tech/sonder?sslmode=require",
				null);
		env(sonder, "Preview — roast calendar", Platform.VERCEL, EnvironmentType.PREVIEW,
				"feature/roast-calendar",
				"https://sonder-git-feature-roast-calendar-ericmignardi.vercel.app",
				"Unpaired on purpose: it reads the wholesale branch's data.");
		env(sonder, "Local", Platform.LOCAL, EnvironmentType.DEVELOPMENT,
				"feature/wholesale-tier", "http://localhost:3000", null);

		pair(sonderProd, sonderProdDb);
		pair(sonderPreview, sonderPreviewDb);

		env(meridian, "Staging", Platform.VERCEL, EnvironmentType.PREVIEW,
				"main", "https://meridian-invoicing.vercel.app",
				"Sleeping. Redeploy before the October restart.");
		env(meridian, "Neon — staging", Platform.NEON, EnvironmentType.PREVIEW, "main",
				"postgresql://meridian_owner:npg_8sQd3zXf@ep-old-river-a5c9k4tn.us-east-2.aws.neon.tech/meridian?sslmode=require",
				"Suspended by Neon after 5 days idle. First query wakes it.");
		env(meridian, "Local", Platform.LOCAL, EnvironmentType.DEVELOPMENT,
				"main", "jdbc:postgresql://localhost:5432/meridian", null);

	}

	private Environment env(Project project, String name, Platform platform, EnvironmentType type,
			String branch, String url, String notes) {

		Environment environment = new Environment();
		environment.setName(name);
		environment.setPlatform(platform);
		environment.setType(type);
		environment.setBranch(branch);
		environment.setUrl(url);
		environment.setNotes(notes);
		project.addEnvironment(environment);
		return environmentRepository.save(environment);
	}

	/** FR-3.7: both sides, exactly as EnvironmentPairingService writes them. */
	private void pair(Environment app, Environment database) {
		app.setPairedWith(database);
		database.setPairedWith(app);
		environmentRepository.save(app);
		environmentRepository.save(database);
	}

	private record TaskSeed(String title, Project project, TaskStatus status, TaskPriority priority,
			Long dueInDays, String description) {
	}

	private void seedTasks(User user, List<Project> projects) {
		Project atlas = projects.get(0);
		Project northwind = projects.get(1);
		Project sonder = projects.get(2);
		Project meridian = projects.get(3);
		Project fieldnote = projects.get(4);

		Instant now = Instant.now();

		List<TaskSeed> seeds = Arrays.asList(
				new TaskSeed("Send Northwind the June maintenance invoice", northwind, TaskStatus.TODO,
						TaskPriority.URGENT, -6L, "Three content changes and the booking-form fix."),
				new TaskSeed("Rotate the Sonder Stripe restricted key", sonder, TaskStatus.TODO,
						TaskPriority.HIGH, -3L, "The one in the Vercel preview env is six months old."),
				new TaskSeed("Reply to Meridian about the October restart", meridian, TaskStatus.BLOCKED,
						TaskPriority.MEDIUM, -1L, "Waiting on their fiscal-year close date."),
				new TaskSeed("Renew the northwinddental.ca certificate", northwind, TaskStatus.TODO,
						TaskPriority.HIGH, -2L, null),

				new TaskSeed("Write the Flyway migrations for Atlas", atlas, TaskStatus.IN_PROGRESS,
						TaskPriority.HIGH, 0L, "Seven files, one per concern. Never edit an applied one."),
				new TaskSeed("Map the Environment self-relation", atlas, TaskStatus.IN_PROGRESS,
						TaskPriority.HIGH, 0L, "One column, two sides. Only pairedWith owns it."),
				new TaskSeed("Projects and Tags API", atlas, TaskStatus.TODO, TaskPriority.HIGH, 1L,
						"Establishes the controller/service/DTO shape everything else copies."),
				new TaskSeed("Environments and Tasks API", atlas, TaskStatus.TODO, TaskPriority.HIGH, 2L,
						"The pairing invariants live in the service, not the controller."),
				new TaskSeed("Wholesale price tier — schema", sonder, TaskStatus.IN_PROGRESS,
						TaskPriority.MEDIUM, 2L, "Tiered pricing per customer group, not per product."),
				new TaskSeed("Spring Security and JWT", atlas, TaskStatus.TODO, TaskPriority.URGENT, 4L,
						"Access token 15 minutes, refresh 7 days, rotation on use."),
				new TaskSeed("Roast calendar — first pass", sonder, TaskStatus.TODO, TaskPriority.MEDIUM,
						5L, "Client wants to publish the week's roasts every Sunday."),
				new TaskSeed("Book the Q4 hosting review", null, TaskStatus.TODO, TaskPriority.LOW, 6L,
						"Vercel and Neon spend across all four client projects."),

				new TaskSeed("Frontend foundation — shell, router, auth store", atlas, TaskStatus.TODO,
						TaskPriority.HIGH, 7L, null),
				new TaskSeed("Dashboard and command palette", atlas, TaskStatus.TODO,
						TaskPriority.MEDIUM, 10L, "Cmd-K over projects, environments, and tasks."),
				new TaskSeed("Deploy Atlas to Azure", atlas, TaskStatus.TODO, TaskPriority.URGENT, 11L,
						"Container Apps plus Static Web Apps. Account first."),
				new TaskSeed("Sonder — wholesale UAT with the client", sonder, TaskStatus.TODO,
						TaskPriority.MEDIUM, 14L, null),
				new TaskSeed("Prototype Fieldnote sync conflict handling", fieldnote, TaskStatus.TODO,
						TaskPriority.LOW, 21L, "Last-write-wins is not good enough for site notes."),

				new TaskSeed("Read up on Postgres partial indexes", null, TaskStatus.TODO,
						TaskPriority.LOW, null, null),
				new TaskSeed("Consolidate the two Neon accounts", null, TaskStatus.BLOCKED,
						TaskPriority.LOW, null, "Blocked: support ticket open since last week."),
				new TaskSeed("Decide whether Fieldnote is worth starting", fieldnote, TaskStatus.TODO,
						TaskPriority.LOW, null, null),

				// Done, within the seven-day window of FR-4.12.
				new TaskSeed("Scaffold the Spring Boot and Vite applications", atlas, TaskStatus.DONE,
						TaskPriority.HIGH, -1L, null),
				new TaskSeed("Write both Dockerfiles and prove the images run", atlas, TaskStatus.DONE,
						TaskPriority.MEDIUM, -1L, null),
				new TaskSeed("Northwind — swap the booking widget", northwind, TaskStatus.DONE,
						TaskPriority.MEDIUM, -4L, null),
				new TaskSeed("Sonder — fix the cart total rounding", sonder, TaskStatus.DONE,
						TaskPriority.URGENT, -5L, "Half-up on the line, not on the total."),

				new TaskSeed("Write the PRD and the ten-day plan", atlas, TaskStatus.DONE,
						TaskPriority.HIGH, -12L, null));

		Map<TaskStatus, Integer> nextOrder = new LinkedHashMap<>();
		for (TaskSeed seed : seeds) {
			Task task = new Task();
			task.setUser(user);
			task.setProject(seed.project());
			task.setTitle(seed.title());
			task.setDescription(seed.description());
			task.setStatus(seed.status());
			task.setPriority(seed.priority());
			if (seed.dueInDays() != null) {
				task.setDueDate(now.plus(seed.dueInDays(), ChronoUnit.DAYS));
			}
			// FR-4.6: completed_at is server-controlled and only exists on DONE.
			if (seed.status() == TaskStatus.DONE) {
				long completedDaysAgo = seed.dueInDays() == null ? 1L : Math.abs(seed.dueInDays());
				task.setCompletedAt(now.minus(completedDaysAgo, ChronoUnit.DAYS));
			}
			task.setSortOrder(nextOrder.merge(seed.status(), 1, Integer::sum));
			taskRepository.save(task);
		}
	}
}
