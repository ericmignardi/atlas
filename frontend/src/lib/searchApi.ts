import { api } from "@/lib/apiClient";
import type { SearchResponse } from "@/types/api";

/**
 * PRD §6.7 / FR-7.2. Five projects, five environments, five tasks.
 *
 * Unlike the projects and tasks lists, this one is **not** filtered in the
 * browser: the palette searches across three resources at once, including
 * archived-adjacent rows the lists never fetch, and holding all of it client-
 * side to answer one keystroke is the wrong trade. The 120 ms debounce
 * (FR-7.5) is what keeps that cheap.
 */
export const search = (q: string): Promise<SearchResponse> =>
  api.get<SearchResponse>("/search", { q });
