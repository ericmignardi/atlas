import { Icon } from "@/components/ui/Icon";

/**
 * NFR-5 / PRD §8.5: the minimum supported viewport is 768 px, and below that
 * Atlas says so rather than degrading quietly.
 *
 * Stating it is the honest option. A dense two-pane tool with a board, a
 * grouped environment view, and a command palette does not become a phone app
 * by stacking; pretending otherwise ships something nobody can use and calls it
 * responsive. `md:hidden` is the whole implementation — there is no breakpoint
 * below `md` in the theme, so this is visible exactly when nothing else works.
 */
export const WidthNotice = () => (
  <div className="fixed inset-0 z-70 grid place-items-center bg-canvas p-6 md:hidden">
    <div className="flex max-w-[32ch] flex-col items-center gap-2 text-center">
      <Icon name="warning" size={22} className="text-amber-600" />
      <p className="text-lg text-ink">Atlas needs a wider window</p>
      <p className="text-sm text-ink-secondary">
        This is a desktop tool — the board and the environment view need at least 768 pixels. Widen
        the window, or open Atlas on a larger screen.
      </p>
    </div>
  </div>
);
