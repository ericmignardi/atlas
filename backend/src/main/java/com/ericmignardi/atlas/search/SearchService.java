package com.ericmignardi.atlas.search;

import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.environment.EnvironmentRepository;
import com.ericmignardi.atlas.project.ProjectRepository;
import com.ericmignardi.atlas.search.dto.SearchEnvironment;
import com.ericmignardi.atlas.search.dto.SearchProject;
import com.ericmignardi.atlas.search.dto.SearchResponse;
import com.ericmignardi.atlas.search.dto.SearchTask;
import com.ericmignardi.atlas.task.TaskRepository;

import lombok.RequiredArgsConstructor;

/** FR-7.2. Three capped queries, run against one query string. */
@Service
@RequiredArgsConstructor
public class SearchService {

	/** PRD §6.7: each group is capped at five. The palette is a jump list, not a report. */
	private static final Limit PER_GROUP = Limit.of(5);

	private final ProjectRepository projects;
	private final EnvironmentRepository environments;
	private final TaskRepository tasks;

	/**
	 * An empty query returns empty groups rather than everything. The palette
	 * fires on every settled keystroke including the one that clears the box, and
	 * "match nothing" is the honest answer to "no query" — returning the first
	 * five of each table would show results the user did not ask for.
	 *
	 * <p>Case folding happens here and the wildcards are added here, so the three
	 * repositories all receive the same already-prepared pattern. {@code LIKE} on
	 * a lower-cased column is enough at this scale; full-text search is a Postgres
	 * feature this data volume does not earn.
	 */
	@Transactional(readOnly = true)
	public SearchResponse search(UUID userId, String query) {
		String trimmed = query == null ? "" : query.trim();
		if (trimmed.isEmpty()) {
			return SearchResponse.empty();
		}

		// The user's own % or _ would otherwise be wildcards, and a search for
		// "100%" would silently match everything after "100". Backslash is
		// Postgres's default LIKE escape character, so no ESCAPE clause is needed
		// in the JPQL — and Postgres is the only database Atlas runs on.
		String escaped = trimmed.toLowerCase(Locale.ROOT)
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
		String pattern = "%" + escaped + "%";

		return new SearchResponse(
				projects.searchByText(userId, pattern, PER_GROUP).stream()
						.map(SearchProject::from).toList(),
				environments.searchByText(userId, pattern, PER_GROUP).stream()
						.map(SearchEnvironment::from).toList(),
				tasks.searchByText(userId, pattern, PER_GROUP).stream()
						.map(SearchTask::from).toList());
	}
}
