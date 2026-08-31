package com.ericmignardi.atlas.environment;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

public enum Platform {
	VERCEL,
	NEON,
	LOCAL,
	OTHER;

	/** FR-3.6. Everything not in here is an application environment. */
	public static final Set<Platform> DATABASE_PLATFORMS = Collections.unmodifiableSet(EnumSet.of(NEON));

	public boolean isDatabase() {
		return DATABASE_PLATFORMS.contains(this);
	}
}
