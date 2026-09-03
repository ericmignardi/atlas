package com.ericmignardi.atlas.search;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ericmignardi.atlas.search.dto.SearchResponse;
import com.ericmignardi.atlas.security.CurrentUser;
import com.ericmignardi.atlas.security.UserPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@Tag(name = "Search", description = "What the command palette asks")
public class SearchController {

	private final SearchService searchService;

	/**
	 * {@code q} is optional rather than required: the palette clears the box on
	 * Escape and a 400 for "no query yet" would be an error state on a screen
	 * that is simply idle.
	 */
	@GetMapping
	@Operation(summary = "Projects, environments, and tasks matching q, five of each")
	public SearchResponse search(@CurrentUser UserPrincipal user,
			@RequestParam(required = false) String q) {

		return searchService.search(user.id(), q);
	}
}
