import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "@/components/ui/Modal";

/**
 * A regression test for a bug the project form found the hard way.
 *
 * `useFocusTrap` focuses a control when it runs. Its effect used to depend on
 * the `onEscape` callback, and every caller passes an inline arrow — so the
 * effect re-ran on *every render*, and re-running it moved focus. In a
 * confirmation dialog nothing renders between keystrokes and it never showed.
 * In a dialog holding a form, each character typed re-renders, the trap fires,
 * and the caret lands on the close button after the first letter.
 *
 * The symptom is "the form only accepts one character", which reads like an
 * input bug and is nowhere near the input.
 */

const FormInModal = ({ onClose = () => {} }: { onClose?: () => void }) => {
  const [value, setValue] = useState("");
  return (
    <Modal open onClose={onClose} title="A form">
      <input
        aria-label="Name"
        data-autofocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Modal>
  );
};

describe("Modal", () => {
  it("keeps focus in a field while its state changes on every keystroke", async () => {
    const user = userEvent.setup();
    render(<FormInModal />);

    const input = screen.getByLabelText("Name");
    await user.click(input);
    await user.keyboard("Northwind");

    expect(input).toHaveValue("Northwind");
    expect(input).toHaveFocus();
  });

  it("starts in the field marked data-autofocus, not on the close button", async () => {
    render(<FormInModal />);

    // Without the marker the first focusable in DOM order wins, and that is the
    // header's dismiss control — a dialog that opens on Cancel.
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FormInModal onClose={onClose} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
