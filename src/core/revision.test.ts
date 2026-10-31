import { test } from "node:test";
import assert from "node:assert/strict";
import { eventById, type EventId } from "./catalog";
import { addDays, dayStart, WATCH_MS } from "./dates";
import {
  dailyCards,
  evaluate,
  isComplete,
  pricesFor,
  rosterOutcomes,
  rosterScore,
  total,
  type Bucket,
  type Days,
  type Draft,
} from "./game";
import { mergeDays, parseSettlements, parseStatus, wheelState } from "./data";
import {
  emptyState,
  mergeState,
  persistState,
  readState,
  STORAGE_KEY,
  writeState,
} from "./storage";

const DAY = "2026-10-31";
const start = dayStart(DAY);
const now = start + 19 * 3600_000;
const event = (id: EventId, days: Days, day = DAY) =>
  evaluate(eventById(id)!, day, days);
function bucket(day: string, i: number, work = 1000): Bucket {
  return {
    start: dayStart(day) + i * WATCH_MS,
    end: dayStart(day) + (i + 1) * WATCH_MS,
    work,
    rounds: work ? 4 : 0,
    blocks: work / 10,
  };
}
function completeDay(day: string, work = 4000): Days {
  return {
    [day]: Array.from({ length: 4 }, (_, i) => bucket(day, i, work / 4)),
  };
}
function payload(work = 9000, rounds = 9, blocks = 800) {
  const buckets = Array.from({ length: 8 }, (_, i) => ({
    startAt: new Date(start + i * WATCH_MS).toISOString(),
    endAt: new Date(start + (i + 1) * WATCH_MS).toISOString(),
    workAdded: String(i === 3 ? work : 0),
    activeRoundCount: String(i === 3 ? rounds : 0),
    completedBlockCount: String(i === 3 ? blocks : 0),
  }));
  return {
    generatedAt: new Date(now).toISOString(),
    window: { startAt: new Date(start).toISOString(), bucketSeconds: "21600" },
    buckets,
  };
}
function memory(raw: string | null = null) {
  let value = raw,
    writes = 0;
  return {
    getItem: (key: string) => {
      assert.equal(key, STORAGE_KEY);
      return value;
    },
    setItem: (key: string, next: string) => {
      assert.equal(key, STORAGE_KEY);
      writes++;
      value = next;
    },
    get raw() {
      return value;
    },
    get writes() {
      return writes;
    },
  };
}
function draft(day: string, savedAt = dayStart(day) - 10_000): Draft {
  let history: Days = {};
  for (let i = 2; i <= 14; i++)
    history = { ...history, ...completeDay(addDays(day, -i)) };
  const picks = dailyCards(day)
    .slice(0, 5)
    .map((e) => e.id);
  return {
    day,
    savedAt,
    picks,
    captain: picks[0],
    name: "Rival",
    prices: pricesFor(day, history),
  };
}

test("positive in-progress evidence resolves watch/threshold hits and bounded misses before the watch ends", () => {
  const days = parseSettlements(payload(), now).days;
  assert.equal(days[DAY][3]?.work, 9000);
  assert.equal(days[DAY][3]?.complete, false);
  assert.equal(isComplete(days, DAY), false);
  assert.equal(total(days[DAY]), 9000);
  for (const id of ["night-shift", "warm-up", "monster-session"] as const)
    assert.equal(event(id, days), "hit", id);
  for (const id of ["day-off", "slow-burn"] as const)
    assert.equal(event(id, days), "miss", id);
  assert.equal(event("five-figures", days), "pending");
  assert.equal(event("one-big-run", days), "pending");
  assert.equal(
    event("block-party", parseSettlements(payload(9000, 30, 1000), now).days),
    "hit",
  );
  assert.equal(
    event("overtime", parseSettlements(payload(9000, 30, 1000), now).days),
    "hit",
  );
});

test("partial zeroes cannot prove rest, a final exact count or a balanced split", () => {
  const zero = parseSettlements(payload(0, 0, 0), now).days;
  assert.equal(zero[DAY][3], null);
  assert.equal(event("night-shift", zero), "pending");
  assert.equal(event("day-off", zero), "pending");
  const days = completeDay(DAY);
  days[DAY][3] = { ...bucket(DAY, 3, 1000), complete: false, observedAt: now };
  assert.equal(event("around-clock", days), "hit");
  assert.equal(event("even-split", days), "pending");
  days[DAY][3] = { ...bucket(DAY, 3, 0), complete: false, observedAt: now };
  days[DAY][2] = bucket(DAY, 2, 0);
  days[DAY][1] = bucket(DAY, 1, 0);
  assert.equal(event("beauty-sleep", days), "pending");
  assert.equal(event("one-big-run", days), "pending");
});

test("partial evidence does not become final when replayed or saved past the watch boundary", () => {
  const raw = payload();
  raw.buckets[4].workAdded = "99999"; // Impossible future evidence is ignored.
  const days = parseSettlements(raw, now + 2 * WATCH_MS).days;
  assert.equal(days[addDays(DAY, 1)], undefined);
  assert.equal(isComplete(days, DAY), false);
  const state = emptyState();
  state.days = days;
  const storage = memory();
  assert.equal(writeState(storage, state), true);
  const restored = readState(storage).state.days;
  assert.equal(restored[DAY][3]?.complete, false);
  assert.equal(event("one-big-run", restored), "pending");
  assert.equal(pricesFor(addDays(DAY, 2), restored)["warm-up"]?.sample, 0);
});

test("merging never downgrades completed evidence and selects the newer partial snapshot", () => {
  const partial = parseSettlements(payload(), now).days;
  const final = completeDay(DAY, 12000);
  final[DAY].forEach((b) => {
    if (b) b.observedAt = start + 4 * WATCH_MS;
  });
  assert.equal(isComplete(mergeDays(final, partial), DAY), true);
  assert.equal(total(mergeDays(partial, final)[DAY]), 12000);
  const newer = structuredClone(partial);
  newer[DAY][3] = { ...newer[DAY][3]!, observedAt: now + 1000, work: 9500 };
  assert.equal(mergeDays(newer, partial)[DAY][3]?.work, 9500);
});

test("record prices require all six priors for both hits and misses, preventing a miss-only denominator", () => {
  let days: Days = {};
  for (const [i, work] of [6997, 4899, 14787, 12531, 14190].entries())
    days = { ...days, ...completeDay(`2026-10-${26 + i}`, work) };
  assert.equal(event("personal-record", days, "2026-10-27"), "miss");
  assert.equal(event("personal-record", days, "2026-10-28"), "unavailable");
  assert.deepEqual(pricesFor("2026-11-01", days)["personal-record"], {
    sample: 0,
    hits: 0,
    hitRate: null,
    points: null,
  });
  for (let i = 20; i <= 25; i++)
    days = { ...days, ...completeDay(`2026-10-${i}`, 1000) };
  assert.deepEqual(pricesFor("2026-11-01", days)["personal-record"], {
    sample: 5,
    hits: 2,
    hitRate: 0.4,
    points: 25,
  });
});

test("a stale tab merges saved drafts, scores, rivals, names and reveals before writing", () => {
  const a = emptyState(),
    b = emptyState();
  const team = draft("2026-10-30");
  b.drafts[team.day] = team;
  b.days = completeDay(team.day);
  b.scores[team.day] = {
    day: team.day,
    roster: team,
    score: rosterScore(team, b.days, team.prices),
    outcomes: rosterOutcomes(team, b.days),
  };
  b.rivals[team.day] = [{ ...team, name: "Other rival" }];
  b.revealed = [team.day];
  b.name = "New name";
  const storage = memory();
  assert.equal(writeState(storage, b), true);
  a.days = completeDay(DAY);
  const result = persistState(storage, a, emptyState());
  assert.equal(result.failed, false);
  assert.deepEqual(result.state.drafts, b.drafts);
  assert.deepEqual(result.state.scores, b.scores);
  assert.deepEqual(result.state.rivals, b.rivals);
  assert.equal(result.state.name, "New name");
  assert.deepEqual(result.state.revealed, b.revealed);
  assert.ok(result.state.days[DAY]);
  assert.ok(result.state.days[team.day]);
  assert.deepEqual(readState(storage).state.drafts, b.drafts);
});

test("a stale same-day edit cannot replace a newer draft and distinct rivals are unioned", () => {
  const base = emptyState();
  const day = "2026-11-01";
  const a = emptyState(),
    b = emptyState();
  a.drafts[day] = draft(day, dayStart(day) - 20_000);
  b.drafts[day] = { ...draft(day, dayStart(day) - 10_000), name: "Latest" };
  a.rivals[day] = [{ ...a.drafts[day], name: "A" }];
  b.rivals[day] = [{ ...b.drafts[day], name: "B" }];
  const merged = mergeState(base, a, b);
  assert.equal(merged.drafts[day].name, "Latest");
  assert.deepEqual(merged.rivals[day].map((r) => r.name).sort(), ["A", "B"]);
  const storage = memory();
  writeState(storage, b);
  writeState(storage, a);
  assert.equal(readState(storage).state.drafts[day].name, "Latest");
});

for (const raw of [
  "{broken",
  JSON.stringify({
    version: 2,
    scores: { "2026-10-20": { score: 500 } },
    drafts: {},
  }),
]) {
  test(`unreadable storage is preserved byte for byte: ${raw.slice(0, 25)}`, () => {
    const storage = memory(raw);
    const loaded = readState(storage);
    assert.equal(loaded.failed, true);
    assert.equal(writeState(storage, loaded.state), false);
    assert.equal(
      persistState(storage, { ...emptyState(), name: "New visit" }).failed,
      true,
    );
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
  });
}

test("an absent builder anchor does not reject healthy wheel measurement", () => {
  const raw = {
    measurement: {
      freshness: "online",
      coreStatus: "IDLE",
      observedAt: new Date(now).toISOString(),
      rpmMilli: "0",
      cumulativeWorkUnits: "500",
      staleAfterSeconds: "120",
    },
    builder: { status: "unavailable", anchor: null },
  };
  assert.equal(wheelState(parseStatus(raw), now, false), "sleeping");
  assert.equal(
    wheelState(parseStatus({ measurement: raw.measurement }), now, false),
    "sleeping",
  );
  assert.throws(() =>
    parseStatus({
      ...raw,
      measurement: { ...raw.measurement, coreStatus: "OTHER" },
    }),
  );
});

test("an explicitly rescored day can update while an unchanged old tab cannot roll it back", () => {
  const day = "2026-10-30",
    team = draft(day);
  const base = emptyState();
  base.drafts[day] = team;
  base.scores[day] = {
    day,
    roster: team,
    score: 10,
    outcomes: ["hit", "miss", "miss", "miss", "miss"],
  };
  const changed = structuredClone(base);
  changed.scores[day].score = 20;
  assert.equal(mergeState(base, changed, base).scores[day].score, 20);
  assert.equal(mergeState(base, base, changed).scores[day].score, 20);
});
