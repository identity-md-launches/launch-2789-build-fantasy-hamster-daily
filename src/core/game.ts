import { CATALOG, eventById, type Event, type EventId } from "./catalog";
import { addDays, dayStart, WATCH_MS } from "./dates";

export interface Bucket {
  start: number;
  end: number;
  work: number;
  rounds: number;
  blocks: number;
  /** Older saved buckets have no flag and are complete. Partial evidence never ages into final evidence. */
  complete?: boolean;
  observedAt?: number;
}
export type Days = Record<string, (Bucket | null)[]>;
export type Outcome = "hit" | "miss" | "pending" | "unavailable";
export interface Price {
  points: number | null;
  hitRate: number | null;
  hits: number;
  sample: number;
}
export type Prices = Partial<Record<EventId, Price>>;
export interface Roster {
  day: string;
  picks: EventId[];
  captain: EventId;
  name: string;
}
export interface Draft extends Roster {
  savedAt: number;
  prices: Prices;
}
export interface Scored {
  day: string;
  score: number;
  outcomes: Outcome[];
  roster: Draft;
}

export function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (const char of seed)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => {
    let t = (hash += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function dailyCards(day: string): Event[] {
  const random = seededRandom(`fantasy-hamster:v1:${day}`);
  const shuffled: Event[] = [...CATALOG];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 12);
}
export const pricePoints = (hitRate: number): number =>
  Math.min(100, Math.max(10, Math.round(10 / Math.max(hitRate, 0.1))));
export const bucketsFor = (days: Days, day: string): (Bucket | null)[] =>
  days[day] ?? [null, null, null, null];
export const isComplete = (days: Days, day: string): boolean =>
  bucketsFor(days, day).every((b) => b !== null && b.complete !== false);
export const total = (
  buckets: (Bucket | null)[],
  key: "work" | "rounds" | "blocks" = "work",
): number => buckets.reduce((sum, b) => sum + (b?.[key] ?? 0), 0);

/** Partial counts prove monotonic hits, but only a finished watch can prove inactivity. */
export function evaluate(event: Event, day: string, days: Days): Outcome {
  const buckets = bucketsFor(days, day);
  const complete = isComplete(days, day);
  const work = total(buckets);
  const active = buckets.map((b) =>
    b?.rounds ? true : b && b.complete !== false ? false : null,
  );
  const count = active.filter(Boolean).length;
  const possible = count + active.filter((b) => b === null).length;
  const finish = (hit: boolean): Outcome =>
    complete ? (hit ? "hit" : "miss") : "pending";
  switch (event.kind) {
    case "work":
    case "rounds":
    case "blocks":
      return total(buckets, event.kind) >= event.threshold
        ? "hit"
        : finish(false);
    case "watch":
      return active[event.watch] === null
        ? "pending"
        : active[event.watch]
          ? "hit"
          : "miss";
    case "consecutive": {
      if (active.some((a, i) => i > 0 && a === true && active[i - 1] === true))
        return "hit";
      if (
        !active.some((a, i) => i > 0 && a !== false && active[i - 1] !== false)
      )
        return "miss";
      return finish(false);
    }
    case "triple":
      return count >= 3 ? "hit" : possible < 3 ? "miss" : finish(false);
    case "all":
      return active.includes(false) ? "miss" : count === 4 ? "hit" : "pending";
    case "one":
      return count > 1 || possible < 1 ? "miss" : finish(count === 1);
    case "monster":
      return buckets.some((b) => b && b.work >= 7000) ? "hit" : finish(false);
    case "even":
      return possible < 2
        ? "miss"
        : finish(
            count >= 2 && buckets.every((b) => (b?.work ?? 0) <= work / 2),
          );
    case "slow":
      return work > 6000 ? "miss" : finish(work >= 1 && work <= 6000);
    case "sleep": {
      const runs = [active.slice(0, 3), active.slice(1, 4)];
      if (runs.some((run) => run.every((a) => a === false))) return "hit";
      return runs.every((run) => run.includes(true)) ? "miss" : finish(false);
    }
    case "off":
      return work > 0 ? "miss" : finish(true);
    case "yesterday":
    case "record": {
      const count = event.kind === "yesterday" ? 1 : 6;
      const prior = Array.from({ length: count }, (_, i) =>
        addDays(day, -i - 1),
      );
      // A known prior day can disprove a final record even if some other history is absent.
      if (
        complete &&
        prior.some(
          (p) => isComplete(days, p) && work <= total(bucketsFor(days, p)),
        )
      )
        return "miss";
      if (prior.some((p) => !isComplete(days, p)))
        return complete ? "unavailable" : "pending";
      return prior.every((p) => work > total(bucketsFor(days, p)))
        ? "hit"
        : finish(false);
    }
  }
}

/** A game drafted on D uses days D-7..D-1; D is still in progress. */
export function pricesFor(gameDay: string, days: Days): Prices {
  const draftDay = addDays(gameDay, -1);
  return Object.fromEntries(
    CATALOG.map((event) => {
      let sample = 0,
        hits = 0;
      for (let i = 1; i <= 7; i++) {
        const day = addDays(draftDay, -i);
        if (!isComplete(days, day)) continue;
        // Require the same evidence for a sampled hit and miss. Otherwise a
        // partial record history admits only disproved records and biases odds.
        const priorCount =
          event.kind === "record" ? 6 : event.kind === "yesterday" ? 1 : 0;
        if (
          Array.from({ length: priorCount }, (_, j) => addDays(day, -j - 1))
            .some((prior) => !isComplete(days, prior))
        ) continue;
        const outcome = evaluate(event, day, days);
        if (outcome !== "hit" && outcome !== "miss") continue;
        sample++;
        if (outcome === "hit") hits++;
      }
      const hitRate = sample ? hits / sample : null;
      return [
        event.id,
        {
          sample,
          hits,
          hitRate,
          points: hitRate === null ? null : pricePoints(hitRate),
        },
      ];
    }),
  );
}
export function rosterOutcomes(roster: Roster, days: Days): Outcome[] {
  return roster.picks.map((id) => evaluate(eventById(id)!, roster.day, days));
}
export function rosterScore(
  roster: Roster,
  days: Days,
  prices: Prices,
): number {
  return roster.picks.reduce(
    (score, id) =>
      score +
      (evaluate(eventById(id)!, roster.day, days) === "hit"
        ? (prices[id]?.points ?? 0) * (roster.captain === id ? 2 : 1)
        : 0),
    0,
  );
}
export function canDraft(gameDay: string, now: number): boolean {
  return now >= dayStart(addDays(gameDay, -1)) && now < dayStart(gameDay);
}
export function validateRoster(value: unknown): value is Roster {
  if (!value || typeof value !== "object") return false;
  const r = value as Roster;
  return (
    typeof r.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.day) &&
    Number.isFinite(dayStart(r.day)) &&
    new Date(dayStart(r.day)).toISOString().slice(0, 10) === r.day &&
    Array.isArray(r.picks) &&
    r.picks.length === 5 &&
    new Set(r.picks).size === 5 &&
    r.picks.every((id) => dailyCards(r.day).some((e) => e.id === id)) &&
    r.picks.includes(r.captain) &&
    typeof r.name === "string" &&
    [...r.name].length <= 16 &&
    r.name.trim().length > 0
  );
}
export function watchIndex(bucket: Bucket, day: string): number {
  return Math.floor((bucket.start - dayStart(day)) / WATCH_MS);
}
