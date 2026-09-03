package com.ericmignardi.atlas.dashboard;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ericmignardi.atlas.dashboard.dto.DashboardResponse;
import com.ericmignardi.atlas.security.CurrentUser;
import com.ericmignardi.atlas.security.UserPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "The landing screen, in one call")
public class DashboardController {

	private final DashboardService dashboardService;

	@GetMapping
	@Operation(summary = "Stats, pinned projects, and the needs-attention buckets")
	public DashboardResponse load(@CurrentUser UserPrincipal user) {
		return dashboardService.load(user.id());
	}
}
