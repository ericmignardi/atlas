package com.ericmignardi.atlas.tag;

import java.util.List;

/**
 * The seven recipes of PRD 9.5, in cycle order: blue, green, amber, violet,
 * teal, red, neutral. The column stores the <em>text</em> hex of a recipe and
 * the interface maps it back to the background and border, so a palette tweak
 * is a stylesheet change and never a data migration.
 *
 * <p>A new tag takes {@code palette[tagCount % 7]} (FR-5.4), which is what stops
 * a freshly created set from coming out entirely blue.
 */
public final class TagPalette {

	public static final List<String> COLOURS = List.of(
			"#2251B4", // blue
			"#16643B", // green
			"#8A5A08", // amber
			"#5B2BB0", // violet
			"#0F6157", // teal
			"#9B2C22", // red
			"#454D5F"); // neutral

	/** The pattern the API validates a client-supplied colour against (PRD 7.5). */
	public static final String HEX_PATTERN = "^#[0-9a-fA-F]{6}$";

	private TagPalette() {
	}

	public static String nextColour(long existingTagCount) {
		return COLOURS.get((int) Math.floorMod(existingTagCount, COLOURS.size()));
	}
}
