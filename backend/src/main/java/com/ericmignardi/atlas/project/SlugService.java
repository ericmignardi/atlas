package com.ericmignardi.atlas.project;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

/** FR-2.3 – FR-2.5. */
@Service
@RequiredArgsConstructor
public class SlugService {

	/** What a name of nothing but punctuation collapses to. */
	static final String FALLBACK = "project";

	private final ProjectRepository projects;

	/**
	 * NFD decomposition splits an accented character into the letter and a
	 * combining mark, so stripping the marks leaves the letter behind: Café
	 * becomes cafe rather than caf. Deleting everything outside a-z0-9 instead
	 * drops the accented letter entirely.
	 */
	public String slugify(String input) {
		if (input == null) {
			return FALLBACK;
		}
		String slug = Normalizer.normalize(input, Normalizer.Form.NFD)
				.replaceAll("\\p{M}", "")
				.toLowerCase(Locale.ROOT)
				.replaceAll("[^a-z0-9]+", "-")
				.replaceAll("(^-|-$)", "");
		return slug.isEmpty() ? FALLBACK : slug;
	}

	/**
	 * FR-2.4. One prefix scan rather than a loop of existence checks: every slug
	 * that could collide shares the base as a prefix, so the suffix search
	 * happens in memory.
	 *
	 * @param excludeId the project being renamed, so it does not collide with
	 *                  itself; null on create
	 */
	public String uniqueSlug(String name, UUID userId, UUID excludeId) {
		String base = slugify(name);

		Set<String> taken = projects.findByUserIdAndSlugStartingWith(userId, base).stream()
				.filter(project -> !Objects.equals(project.getId(), excludeId))
				.map(Project::getSlug)
				.collect(Collectors.toSet());

		if (!taken.contains(base)) {
			return base;
		}
		for (int suffix = 2;; suffix++) {
			String candidate = base + "-" + suffix;
			if (!taken.contains(candidate)) {
				return candidate;
			}
		}
	}
}
