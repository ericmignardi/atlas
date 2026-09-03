import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TagInput } from "@/components/projects/TagInput";
import type { TagResponse, TagSummary } from "@/types/api";

/**
 * FR-5.10. Three behaviours that are only visible from the keyboard, and
 * therefore three that never get exercised by clicking around:
 *
 * - the "Create *name*" row appears only for a name that does not exist,
 * - it disappears the moment the typed name matches an existing tag, whatever
 *   the case (FR-5.2 lowercases before comparing),
 * - Backspace on an empty input removes the last chip, and only then.
 */

const tag = (name: string, usageCount = 0): TagResponse => ({
  id: `id-${name}`,
  name,
  color: "#2251B4",
  usageCount,
  createdAt: "2026-01-01T00:00:00Z",
});

const AVAILABLE = [tag("react", 4), tag("client-work", 2)];

const Harness = ({ initial = [] as TagSummary[] }) => {
  const [value, setValue] = useState<TagSummary[]>(initial);
  return <TagInput value={value} onChange={setValue} available={AVAILABLE} />;
};

describe("TagInput", () => {
  it("suggests existing tags as you type", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("rea");

    expect(screen.getByRole("option", { name: /react/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /client-work/ })).not.toBeInTheDocument();
  });

  it("offers to create a name that does not exist, and not one that does", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("postgres");
    expect(screen.getByRole("option", { name: /Create postgres/ })).toBeInTheDocument();

    await user.clear(screen.getByRole("combobox"));
    // Typed in a different case from the stored name. FR-5.2 normalises before
    // comparing, so this must resolve to the existing tag rather than offering a
    // second one that differs only in capitalisation.
    await user.keyboard("React");
    expect(screen.queryByRole("option", { name: /Create/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /react/ })).toBeInTheDocument();
  });

  it("commits the first suggestion on Enter without submitting anything else", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("rea{Enter}");

    expect(screen.getByRole("button", { name: "Remove tag react" })).toBeInTheDocument();
  });

  it("removes the last chip on Backspace only when the input is empty", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[tag("react"), tag("client-work")]} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("abc");

    // Mid-word: Backspace is deleting a character, not a chip.
    await user.keyboard("{Backspace}");
    expect(screen.getByRole("button", { name: "Remove tag client-work" })).toBeInTheDocument();

    await user.keyboard("{Backspace}{Backspace}{Backspace}");
    expect(
      screen.queryByRole("button", { name: "Remove tag client-work" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove tag react" })).toBeInTheDocument();
  });
});
