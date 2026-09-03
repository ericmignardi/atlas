package com.ericmignardi.atlas.dashboard;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.dashboard.dto.DashboardResponse;
import com.ericmignardi.atlas.dashboard.dto.DashboardStats;
import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.project.ProjectService;
import com.ericmignardi.atlas.project.ProjectStatus;
import com.ericmignardi.atlas.tag.TagRepository;
import com.ericmignardi.atlas.task.TaskRepository;
import com.ericmignardi.atlas.task.TaskService;

import lombok.RequiredArgsConstructor;

/**
 * FR-6.1 – FR-6.5.
 *
 * <p>Assembly, not computation. Every number here is a counting query and both
 * lists come from the services that already own their rules — the pinned cards
 * from {@link ProjectService} so they carry the same counts the projects list
 * shows, and the three buckets from {@link TaskService} so FR-4.10's timezone
 * boundary is written down exactly once. A dashboard with its own copy of
 * "what counts as overdue" is a dashboard that disagrees with the tasks page.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

	private final ProjectRepository projects;
	private final EnvironmentRepository environments;
	private final TaskRepository tasks;
	private final TagRepository tags;
	private final ProjectService projectService;
	private final TaskService taskService;

	/**
	 * One transaction, so the tiles and the lists describe the same instant. Read
	 * across two transactions, a task could be completed between the count and
	 * the list and the screen would show four open tasks above three rows.
	 */
	@Transactional(readOnly = true)
	public DashboardResponse load(UUID userId) {
		Instant now = Instant.now();

		long totalProjects = projects.countByUserId(userId);
		long totalTasks = tasks.countByUserId(userId);
		long tagCount = tags.countByUserId(userId);

		DashboardStats stats = new DashboardStats(
				totalProjects,
				projects.countByUserIdAndStatus(userId, ProjectStatus.ACTIVE),
				tasks.countOpenForUser(userId),
				tasks.countOverdueForUser(userId, now),
				environments.countForUser(userId),
				environments.countDistinctPlatformsForUser(userId),
				tagCount);

		// FR-6.4. Environments are not consulted: one cannot exist without a
		// project, so `totalProjects == 0` has already ruled them out.
		boolean newAccount = totalProjects == 0 && totalTasks == 0 && tagCount == 0;

		return new DashboardResponse(
				stats,
				projectService.pinned(userId),
				taskService.needsAttention(userId),
				newAccount);
	}
}
