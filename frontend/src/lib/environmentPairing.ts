import type { EnvironmentResponse } from "@/types/api";

/**
 * FR-3.7 – FR-3.10 as a predicate, so the pair dialog can offer only what the
 * server would accept.
 *
 * The invariants are enforced on the server, which answers a breach with a 409
 * and a reason code. Filtering the candidate list makes the rules *legible* —
 * you can see what pairs with what instead of discovering it by being told no —
 * and it is a convenience, never a boundary. The server still checks.
 */
export function eligiblePartners(
  source: EnvironmentResponse,
  candidates: readonly EnvironmentResponse[],
): EnvironmentResponse[] {
  return candidates.filter(
    (candidate) =>
      // FR-3.10, and it has to be first: an environment trivially shares its
      // own project and its own type, so every other test would let it past.
      candidate.id !== source.id &&
      candidate.projectId === source.projectId &&
      candidate.type === source.type &&
      /**
       * A fourth condition the three server invariants do not have, and a
       * deliberate one. FR-3.15 draws a row as `app ── database`; pairing two
       * applications produces a pair that has no shape on screen. The server
       * would allow it, and the UI does not offer it — so `/grouped` never has
       * to render a row it cannot draw.
       */
      candidate.isDatabase !== source.isDatabase,
  );
}
