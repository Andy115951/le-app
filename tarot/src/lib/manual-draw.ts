import type { ManualDrawState, Reading } from "@/lib/types";

export type DrawAction =
  | { action: "cut"; revision: number; cutIndex: number }
  | { action: "select"; revision: number; selected: number[] }
  | { action: "confirm"; revision: number };

/** Business conflicts use P0001 so PostgREST does not retry them as serialization failures. */
export function isManualDrawConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  return value.code === "40001" || (
    value.code === "P0001" &&
    (value.message === "draw_conflict" || value.message === "request_conflict")
  );
}

export function parseDrawAction(input: unknown): DrawAction | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const revision = value.revision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) return null;
  if (value.action === "confirm")
    return { action: "confirm", revision: revision as number };
  if (
    value.action === "cut" &&
    Number.isInteger(value.cutIndex) &&
    (value.cutIndex as number) > 0 &&
    (value.cutIndex as number) < 78
  )
    return {
      action: "cut",
      revision: revision as number,
      cutIndex: value.cutIndex as number,
    };
  if (
    value.action === "select" &&
    Array.isArray(value.selected) &&
    value.selected.length <= 10 &&
    new Set(value.selected).size === value.selected.length &&
    value.selected.every((i) => Number.isInteger(i) && i >= 0 && i < 78)
  )
    return {
      action: "select",
      revision: revision as number,
      selected: value.selected,
    };
  return null;
}

/** Explicit allowlist: NEVER return selected identities or orientations before confirmation. */
export function publicDrawState(input: unknown): ManualDrawState | null {
  if (!input || typeof input !== "object") return null;
  const state = input as Record<string, unknown>;
  if (
    state.version !== 1 ||
    !Array.isArray(state.positions) ||
    !Array.isArray(state.selected) ||
    !Number.isInteger(state.revision)
  )
    return null;
  return {
    cardCount: 78,
    revision: state.revision as number,
    cutIndex: typeof state.cutIndex === "number" ? state.cutIndex : null,
    selected: state.selected as number[],
    positions: state.positions.map((p) => ({
      position: String(p.position),
      positionLabel: String(p.positionLabel),
    })),
  };
}

export function isReadingDrawn(
  reading: Pick<Reading, "status" | "spreadResult">,
) {
  return reading.status !== "drawing" && reading.spreadResult.cards.length > 0;
}
