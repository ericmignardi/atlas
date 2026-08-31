package com.ericmignardi.atlas.tag;

import java.util.List;

/**
 * FR-5.4. The column stores the text hex of a recipe and the interface maps it
 * back to the background and border, so a palette tweak is a stylesheet change
 * and never a data migration.
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

	public static final String HEX_PATTERN = "^#[0-9a-fA-F]{6}$";

	private TagPalette() {
	}

	public static String nextColour(long existingTagCount) {
		return COLOURS.get((int) Math.floorMod(existingTagCount, COLOURS.size()));
	}
}
