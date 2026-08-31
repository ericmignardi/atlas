package com.ericmignardi.atlas;

import java.util.List;
import java.util.UUID;

import com.ericmignardi.atlas.environment.Environment;
import com.ericmignardi.atlas.environment.EnvironmentType;
import com.ericmignardi.atlas.environment.Platform;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.project.ProjectStatus;
import com.ericmignardi.atlas.tag.Tag;
import com.ericmignardi.atlas.task.Task;
import com.ericmignardi.atlas.task.TaskStatus;
import com.ericmignardi.atlas.user.User;

/**
 * Unsaved, valid-by-construction entities. Every factory takes only what the
 * test actually cares about and fills the rest with something plausible, so a
 * test reads as the one thing it is asserting rather than as twelve setter
 * calls with one interesting line buried in them.
 */
public final class TestFixtures {

	private TestFixtures() {
	}

	public static User user() {
		return user("user-" + UUID.randomUUID() + "@example.com");
	}

	public static User user(String email) {
		User user = new User();
		user.setEmail(email);
		// Not a real hash; nothing in these tests authenticates.
		user.setPasswordHash("$2a$12$0123456789012345678901234567890123456789012345678901");
		user.setDisplayName("Test User");
		return user;
	}

	public static Project project(User owner, String slug) {
		Project project = new Project();
		project.setUser(owner);
		project.setName(slug);
		project.setSlug(slug);
		project.setStatus(ProjectStatus.ACTIVE);
		project.setTechStack(List.of("Java 21", "Spring Boot"));
		return project;
	}

	public static Environment environment(Project project, String name, EnvironmentType type) {
		return environment(project, name, type, Platform.VERCEL);
	}

	public static Environment environment(Project project, String name, EnvironmentType type,
			Platform platform) {
		Environment environment = new Environment();
		environment.setName(name);
		environment.setType(type);
		environment.setPlatform(platform);
		environment.setBranch("main");
		project.addEnvironment(environment);
		return environment;
	}

	public static Task task(User owner, Project project, String title, TaskStatus status, int sortOrder) {
		Task task = new Task();
		task.setUser(owner);
		task.setProject(project);
		task.setTitle(title);
		task.setStatus(status);
		task.setSortOrder(sortOrder);
		return task;
	}

	public static Tag tag(User owner, String name) {
		Tag tag = new Tag();
		tag.setUser(owner);
		tag.setName(name);
		return tag;
	}
}
