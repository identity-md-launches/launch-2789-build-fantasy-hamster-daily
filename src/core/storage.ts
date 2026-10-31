import {
  isComplete,
  canDraft,
  validateRoster,
  type Days,
  type Draft,
  type Roster,
  type Scored,
} from "./game";
import { dayKey, dayStart, validDay, WATCH_MS } from "./dates";
import { numeric } from "./data";

export const STORAGE_KEY = "fantasy-hamster:v1";
export interface LocalState {
  version: 1;
  drafts: Record<string, Draft>;
  days: Days;
  scores: Record<string, Scored>;
  rivals: Record<string, Roster[]>;
  revealed: string[];
  name: string;
}
export const emptyState = (): LocalState => ({
  version: 1,
  drafts: {},
  days: {},
  scores: {},
  rivals: {},
  revealed: [],
  name: "",
});
export function validDraft(draft: unknown): draft is Draft {
  if (!validateRoster(draft)) return false;
  const d = draft as Draft;
  return (
    Number.isFinite(d.savedAt) &&
    canDraft(d.day, d.savedAt) &&
    d.prices !== null &&
    typeof d.prices === "object" &&
    d.picks.every((id) => {
      const price = d.prices[id];
      return (
        price &&
        typeof price.points === "number" &&
        price.points >= 10 &&
        price.points <= 100 &&
        Number.isInteger(price.points) &&
        typeof price.hitRate === "number" &&
        price.hitRate >= 0 &&
        price.hitRate <= 1 &&
        price.sample > 0 &&
        price.sample <= 7
      );
    })
  );
}
export function readState(storage: Pick<Storage, "getItem">): {
  state: LocalState;
  failed: boolean;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: emptyState(), failed: false };
    const value = JSON.parse(raw);
    if (value.version !== 1) throw new Error("Unknown storage version");
    const state = emptyState();
    for (const [day, draft] of Object.entries(value.drafts ?? {}))
      if (validDraft(draft) && draft.day === day) state.drafts[day] = draft;
    for (const [day, buckets] of Object.entries(value.days ?? {})) {
      if (!validDay(day) || !Array.isArray(buckets) || buckets.length !== 4)
        continue;
      state.days[day] = buckets.map((b, i) => {
        if (
          !b ||
          b.start !== dayStart(day) + i * WATCH_MS ||
          b.end !== b.start + WATCH_MS ||
          b.end > Date.now()
        )
          return null;
        try {
          return {
            start: b.start,
            end: b.end,
            work: numeric(b.work),
            rounds: numeric(b.rounds),
            blocks: numeric(b.blocks),
          };
        } catch {
          return null;
        }
      });
    }
    for (const [day, score] of Object.entries(value.scores ?? {})) {
      const s = score as Scored;
      if (
        s &&
        validDraft(s.roster) &&
        s.day === day &&
        s.roster.day === day &&
        Number.isFinite(s.score) &&
        s.score >= 0 &&
        s.score <= 600 &&
        Array.isArray(s.outcomes) &&
        s.outcomes.length === 5 &&
        s.outcomes.every((o) => o === "hit" || o === "miss")
      )
        state.scores[day] = s;
    }
    for (const [day, rosters] of Object.entries(value.rivals ?? {}))
      if (validDay(day) && Array.isArray(rosters))
        state.rivals[day] = rosters
          .filter(validateRoster)
          .filter((r) => r.day === day)
          .slice(0, 20);
    state.revealed = Array.isArray(value.revealed)
      ? value.revealed.filter(
          (d: unknown) => typeof d === "string" && validDay(d),
        )
      : [];
    state.name =
      typeof value.name === "string"
        ? [...value.name].slice(0, 16).join("")
        : "";
    return { state, failed: false };
  } catch {
    return { state: emptyState(), failed: true };
  }
}
export function writeState(
  storage: Pick<Storage, "setItem">,
  state: LocalState,
): boolean {
  try {
    // Daily evidence is compact; retain a year, plus every day required by a saved roster.
    const keepAfter = dayStart(dayKey()) - 366 * 86_400_000;
    const days = Object.fromEntries(
      Object.entries(state.days).filter(
        ([day]) =>
          dayStart(day) >= keepAfter ||
          state.drafts[day] ||
          state.scores[day] ||
          !isComplete(state.days, day),
      ),
    );
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, days }));
    return true;
  } catch {
    return false;
  }
}
