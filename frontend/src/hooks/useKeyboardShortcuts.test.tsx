import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

/**
 * FR-7.7 is the part that goes wrong. Registering a global shortcut is trivial;
 * *not* firing it while someone is typing a backslash into a description field
 * is the requirement, and nothing about the happy path tells you it is broken.
 */
const Harness = ({
  onToggleSidebar,
  onEscape,
}: {
  onToggleSidebar: () => void;
  onEscape?: () => void;
}) => {
  useKeyboardShortcuts([
    { key: "\\", meta: true, handler: onToggleSidebar },
    { key: "Escape", allowInInput: true, handler: onEscape ?? (() => {}) },
  ]);

  return (
    <div>
      <input aria-label="Title" />
      <button type="button">Elsewhere</button>
    </div>
  );
};

describe("useKeyboardShortcuts", () => {
  it("fires a meta shortcut from outside a text input", async () => {
    const onToggleSidebar = vi.fn();
    const user = userEvent.setup();

    render(<Harness onToggleSidebar={onToggleSidebar} />);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    await user.keyboard("{Control>}\\{/Control}");

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("does not fire while a text input has focus", async () => {
    const onToggleSidebar = vi.fn();
    const user = userEvent.setup();

    render(<Harness onToggleSidebar={onToggleSidebar} />);
    await user.click(screen.getByLabelText("Title"));
    await user.keyboard("{Control>}\\{/Control}");

    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it("still fires Escape from inside a text input", async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();

    render(<Harness onToggleSidebar={vi.fn()} onEscape={onEscape} />);
    await user.click(screen.getByLabelText("Title"));
    await user.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
