package com.ericmignardi.atlas.dashboard.dto;

import java.util.List;

import com.ericmignardi.atlas.project.dto.ProjectResponse;
import com.ericmignardi.atlas.task.dto.NeedsAttention;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The whole landing screen in one payload (FR-6.1 – FR-6.5). Four requests would
 * be four loading states arriving at four different moments, and a dashboard
 * that assembles itself in front of you is a dashboard that looks broken.
 */
public record DashboardResponse(
		DashboardStats stats,

		/** FR-6.2. At most four; the client draws a dashed card in each unused slot. */
		List<ProjectResponse> pinnedProjects,

		/** FR-6.3, reusing FR-4.10's buckets rather than re-deriving them here. */
		NeedsAttention needsAttention,

		/**
		 * FR-6.4. Decided on the server because it is a fact about the account, not
		 * about this screen: nothing has ever been created. A client inferring it
		 * from three empty arrays would also show the empty state to somebody whose
		 * projects are all archived, which is a different situation entirely.
		 */
		@JsonProperty("isNewAccount") boolean newAccount) {
}
