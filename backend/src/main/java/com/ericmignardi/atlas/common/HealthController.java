package com.ericmignardi.atlas.common;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Liveness probe for the walking skeleton: the cheapest possible end-to-end
 * check that the container is up and routing works, with no database or
 * authentication in the path. Kept past Day 1 because it is what the Vite dev
 * proxy and the Azure ingress smoke test both call.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

	@GetMapping("/ping")
	public Map<String, String> ping() {
		return Map.of("status", "ok");
	}
}
