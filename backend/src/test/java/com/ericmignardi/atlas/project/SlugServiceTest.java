package com.ericmignardi.atlas.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ericmignardi.atlas.TestFixtures;
import com.ericmignardi.atlas.user.User;

/** FR-2.3 – FR-2.5. Pure logic, so pure unit tests: no context, no database. */
@ExtendWith(MockitoExtension.class)
class SlugServiceTest {

	private static final UUID USER_ID = UUID.randomUUID();

	@Mock
	private ProjectRepository projects;

	@InjectMocks
	private SlugService slugs;

	@Test
	void lowercasesAndHyphenatesAName() {
		assertThat(slugs.slugify("Harbourfront Dental")).isEqualTo("harbourfront-dental");
	}

	@Test
	void collapsesRunsOfPunctuationIntoOneHyphen() {
		assertThat(slugs.slugify("Sonder  --  Coffee & Co.")).isEqualTo("sonder-coffee-co");
	}

	@Test
	void trimsLeadingAndTrailingHyphens() {
		assertThat(slugs.slugify("  ...Fieldnote!  ")).isEqualTo("fieldnote");
	}

	@Test
	void keepsAccentedLettersAsTheirBaseLetter() {
		// The naive version deletes the accented character outright and turns
		// this into "caf-montral", which nobody notices until a client is called
		// something other than English.
		assertThat(slugs.slugify("Café Montréal")).isEqualTo("cafe-montreal");
	}

	@Test
	void fallsBackWhenANameHasNothingSluggable() {
		assertThat(slugs.slugify("!!! ???")).isEqualTo(SlugService.FALLBACK);
		assertThat(slugs.slugify("")).isEqualTo(SlugService.FALLBACK);
		assertThat(slugs.slugify(null)).isEqualTo(SlugService.FALLBACK);
	}

	@Test
	void usesTheBaseSlugWhenNothingHasClaimedIt() {
		when(projects.findByUserIdAndSlugStartingWith(USER_ID, "atlas")).thenReturn(List.of());

		assertThat(slugs.uniqueSlug("Atlas", USER_ID, null)).isEqualTo("atlas");
	}

	@Test
	void appendsTheFirstFreeSuffixOnCollision() {
		when(projects.findByUserIdAndSlugStartingWith(USER_ID, "atlas"))
				.thenReturn(List.of(project("atlas"), project("atlas-2")));

		assertThat(slugs.uniqueSlug("Atlas", USER_ID, null)).isEqualTo("atlas-3");
	}

	@Test
	void ignoresSlugsThatMerelyShareThePrefix() {
		when(projects.findByUserIdAndSlugStartingWith(USER_ID, "atlas"))
				.thenReturn(List.of(project("atlas-mobile")));

		assertThat(slugs.uniqueSlug("Atlas", USER_ID, null)).isEqualTo("atlas");
	}

	@Test
	void letsAProjectKeepItsOwnSlugWhenRenamed() {
		Project self = project("atlas");
		when(projects.findByUserIdAndSlugStartingWith(USER_ID, "atlas")).thenReturn(List.of(self));

		// Renaming "Atlas" to "Atlas" must not produce atlas-2 — the only row in
		// the way is the project doing the renaming.
		assertThat(slugs.uniqueSlug("Atlas", USER_ID, self.getId())).isEqualTo("atlas");
	}

	@Test
	void resolvesUniquenessInASingleQuery() {
		when(projects.findByUserIdAndSlugStartingWith(USER_ID, "atlas"))
				.thenReturn(List.of(project("atlas"), project("atlas-2"), project("atlas-3")));

		slugs.uniqueSlug("Atlas", USER_ID, null);

		// NFR-1.2: the suffix search happens in memory. A loop of existence
		// checks would be one round trip per attempt.
		verify(projects).findByUserIdAndSlugStartingWith(USER_ID, "atlas");
		verify(projects, never()).findBySlugAndUserId(anyString(), any());
	}

	private static Project project(String slug) {
		User owner = TestFixtures.user();
		Project project = TestFixtures.project(owner, slug);
		project.setId(UUID.randomUUID());
		return project;
	}
}
