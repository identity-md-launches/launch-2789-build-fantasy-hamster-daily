import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, eventById, type EventId } from "./catalog";
import {
  addDays,
  countdown,
  dayKey,
  dayNumber,
  dayStart,
  DAY_MS,
  validDay,
  WATCH_MS,
} from "./dates";
import {
  canDraft,
  dailyCards,
  evaluate,
  isComplete,
  pricePoints,
  pricesFor,
  rosterScore,
  rosterOutcomes,
  seededRandom,
  validateRoster,
  type Days,
  type Draft,
  type Roster,
} from "./game";
import {
  mergeDays,
  numeric,
  parseSettlements,
  parseStatus,
  retryDelay,
  wheelState,
} from "./data";
import { decodeRival, encodeRival, resultText } from "./share";
import { emptyState, readState, STORAGE_KEY, writeState } from "./storage";

const DAY = "2026-10-30";
function fixture(
  work: (number | null)[],
  rounds: number[] = work.map((w) => (w ? 4 : 0)),
  blocks: number[] = [0, 0, 0, 0],
  day = DAY,
): Days {
  return {
    [day]: work.map((w, i) =>
      w === null
        ? null
        : {
            start: dayStart(day) + WATCH_MS * i,
            end: dayStart(day) + WATCH_MS * (i + 1),
            work: w,
            rounds: rounds[i],
            blocks: blocks[i],
          },
    ),
  };
}
const outcome = (id: EventId, days: Days) =>
  evaluate(eventById(id)!, DAY, days);

test("UTC dates ignore local zones and cross month, year, leap day, and DST boundaries", () => {
  assert.equal(dayKey(Date.parse("2026-10-31T23:59:59.999Z")), "2026-10-31");
  assert.equal(dayKey(Date.parse("2026-11-01T00:00:00.000Z")), "2026-11-01");
  assert.equal(dayKey(Date.parse("2026-10-31T23:00:00-04:00")), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(dayStart("2026-10-26") - dayStart("2026-10-25"), DAY_MS);
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(validDay("not-a-date"), false);
  assert.equal(dayNumber("2026-01-01"), 1);
  assert.equal(
    countdown(dayStart("2026-11-01"), dayStart("2026-10-31") + 1234),
    "23:59:58",
  );
  assert.equal(countdown(0, 100), "00:00:00");
});

test("drafting is open only on the preceding UTC day and closes at the exact midnight boundary", () => {
  const start = dayStart(DAY);
  assert.equal(canDraft(DAY, start - DAY_MS - 1), false);
  assert.equal(canDraft(DAY, start - DAY_MS), true);
  assert.equal(canDraft(DAY, start - 1), true);
  assert.equal(canDraft(DAY, start), false);
  assert.equal(canDraft(DAY, start + 1), false);
});

test("seeded PRNG and daily shuffle are deterministic, diverse, bounded, and never duplicate cards", () => {
  const a = seededRandom(DAY),
    b = seededRandom(DAY),
    c = seededRandom(addDays(DAY, 1));
  const aa = Array.from({ length: 100 }, a),
    bb = Array.from({ length: 100 }, b);
  assert.deepEqual(aa, bb);
  assert.ok(aa.every((n) => n >= 0 && n < 1));
  assert.notEqual(aa[0], c());
  for (let i = 0; i < 40; i++) {
    const cards = dailyCards(addDays(DAY, i));
    assert.equal(cards.length, 12);
    assert.equal(new Set(cards.map((c) => c.id)).size, 12);
    assert.deepEqual(cards, dailyCards(addDays(DAY, i)));
  }
  assert.notDeepEqual(dailyCards(DAY), dailyCards(addDays(DAY, 1)));
});

test("pricing follows the exact rounded and clamped inverse hit rate formula", () => {
  for (const [rate, expected] of [
    [0, 100],
    [0.01, 100],
    [0.1, 100],
    [0.14, 71],
    [0.2, 50],
    [0.5, 20],
    [6 / 7, 12],
    [1, 10],
    [2, 10],
  ])
    assert.equal(pricePoints(rate), expected);
});

const thresholds: [EventId, number, "work" | "rounds" | "blocks"][] = [
  ["warm-up", 5000, "work"],
  ["five-figures", 10000, "work"],
  ["big-legs", 14000, "work"],
  ["20k-legend", 20000, "work"],
  ["clocked-in", 12, "rounds"],
  ["overtime", 30, "rounds"],
  ["block-party", 1000, "blocks"],
  ["block-bonanza", 1300, "blocks"],
];
for (const [id, threshold, key] of thresholds)
  test(`${id}: inclusive threshold, early hit, pending unknowns, and final miss`, () => {
    const make = (n: number, final: boolean) =>
      fixture(
        [key === "work" ? n : 1, ...(final ? [0, 0, 0] : [null, null, null])],
        [key === "rounds" ? n : 1, 0, 0, 0],
        [key === "blocks" ? n : 0, 0, 0, 0],
      );
    assert.equal(outcome(id, make(threshold, true)), "hit");
    assert.equal(outcome(id, make(threshold, false)), "hit");
    assert.equal(outcome(id, make(threshold - 1, false)), "pending");
    assert.equal(outcome(id, make(threshold - 1, true)), "miss");
  });
for (const [index, id] of (
  ["dawn-patrol", "breakfast-run", "afternoon-jog", "night-shift"] as const
).entries())
  test(`${id}: resolves only its required watch`, () => {
    const w: (number | null)[] = [null, null, null, null];
    assert.equal(outcome(id, fixture(w)), "pending");
    w[index] = 0;
    assert.equal(outcome(id, fixture(w)), "miss");
    w[index] = 1;
    assert.equal(outcome(id, fixture(w)), "hit");
  });
test("Back to Back: only adjacent same-day watches count; impossibility resolves early", () => {
  assert.equal(outcome("back-to-back", fixture([1, 1, null, null])), "hit");
  assert.equal(outcome("back-to-back", fixture([1, 0, 1, 0])), "miss");
  assert.equal(outcome("back-to-back", fixture([1, 0, 0, null])), "miss");
  assert.equal(outcome("back-to-back", fixture([1, 0, 1, null])), "pending");
});
test("Triple Shift: early hits and mathematically impossible misses", () => {
  assert.equal(outcome("triple-shift", fixture([1, 1, 1, null])), "hit");
  assert.equal(outcome("triple-shift", fixture([0, 0, null, null])), "miss");
  assert.equal(outcome("triple-shift", fixture([1, 0, 1, null])), "pending");
});
test("Around the Clock: any completed inactive watch kills it", () => {
  assert.equal(outcome("around-clock", fixture([1, 1, 1, 1])), "hit");
  assert.equal(outcome("around-clock", fixture([1, 1, 1, null])), "pending");
  assert.equal(outcome("around-clock", fixture([0, null, null, null])), "miss");
});
test("One Big Run: requires a complete day for a hit, two active watches kill it early", () => {
  assert.equal(outcome("one-big-run", fixture([0, 0, 1, 0])), "hit");
  assert.equal(outcome("one-big-run", fixture([0, 0, 0, 0])), "miss");
  assert.equal(outcome("one-big-run", fixture([1, 0, 0, null])), "pending");
  assert.equal(outcome("one-big-run", fixture([1, 1, null, null])), "miss");
});
test("Monster Session: inclusive 7,000 in one watch, not a daily aggregate", () => {
  assert.equal(
    outcome("monster-session", fixture([7000, null, null, null])),
    "hit",
  );
  assert.equal(outcome("monster-session", fixture([6999, 6999, 0, 0])), "miss");
  assert.equal(
    outcome("monster-session", fixture([6999, null, null, null])),
    "pending",
  );
});
test("Even Split: 50% equality qualifies and future work can rebalance a currently lopsided day", () => {
  assert.equal(outcome("even-split", fixture([3000, 3000, 0, 0])), "hit");
  assert.equal(outcome("even-split", fixture([3001, 2999, 0, 0])), "miss");
  assert.equal(
    outcome("even-split", fixture([8000, 0, null, null])),
    "pending",
  );
  assert.equal(outcome("even-split", fixture([0, 0, 0, 1])), "miss");
  assert.equal(outcome("even-split", fixture([0, 0, 0, 0])), "miss");
});
test("Slow Burn: inclusive 1..6,000, zero misses, over 6,000 kills early", () => {
  for (const work of [1, 6000])
    assert.equal(outcome("slow-burn", fixture([work, 0, 0, 0])), "hit");
  for (const work of [0, 6001])
    assert.equal(outcome("slow-burn", fixture([work, 0, 0, 0])), "miss");
  assert.equal(outcome("slow-burn", fixture([6000, 0, 0, null])), "pending");
  assert.equal(outcome("slow-burn", fixture([6001, null, null, null])), "miss");
});
test("Beauty Sleep: three adjacent inactive watches, not just three total", () => {
  assert.equal(outcome("beauty-sleep", fixture([0, 0, 0, null])), "hit");
  assert.equal(outcome("beauty-sleep", fixture([1, 0, 0, 0])), "hit");
  assert.equal(outcome("beauty-sleep", fixture([0, 0, 1, 0])), "miss");
  assert.equal(outcome("beauty-sleep", fixture([0, 1, 1, null])), "miss");
  assert.equal(outcome("beauty-sleep", fixture([0, 0, null, null])), "pending");
});
test("Day Off: future zeroes cannot earn a rest day", () => {
  assert.equal(outcome("day-off", fixture([0, 0, 0, 0])), "hit");
  assert.equal(outcome("day-off", fixture([0, 0, 0, null])), "pending");
  assert.equal(outcome("day-off", fixture([1, null, null, null])), "miss");
});
test("Beat Yesterday: strictly greater, early hit after crossing, unknown prior day stays unavailable", () => {
  const prior = fixture([500, 0, 0, 0], undefined, undefined, addDays(DAY, -1));
  assert.equal(
    outcome("beat-yesterday", {
      ...prior,
      ...fixture([501, null, null, null]),
    }),
    "hit",
  );
  assert.equal(
    outcome("beat-yesterday", { ...prior, ...fixture([500, 0, 0, 0]) }),
    "miss",
  );
  assert.equal(
    outcome("beat-yesterday", fixture([501, 0, 0, 0])),
    "unavailable",
  );
  assert.equal(
    outcome("beat-yesterday", fixture([501, null, null, null])),
    "pending",
  );
});
test("Personal Record: must strictly beat all six prior complete days", () => {
  let history: Days = {};
  for (let i = 1; i <= 6; i++)
    history = {
      ...history,
      ...fixture([i * 100, 0, 0, 0], undefined, undefined, addDays(DAY, -i)),
    };
  assert.equal(
    outcome("personal-record", {
      ...history,
      ...fixture([601, null, null, null]),
    }),
    "hit",
  );
  assert.equal(
    outcome("personal-record", { ...history, ...fixture([600, 0, 0, 0]) }),
    "miss",
  );
  delete history[addDays(DAY, -6)];
  assert.equal(
    outcome("personal-record", { ...history, ...fixture([601, 0, 0, 0]) }),
    "unavailable",
  );
  assert.equal(
    outcome("personal-record", { ...history, ...fixture([99, 0, 0, 0]) }),
    "miss",
  );
});
test("every event is pending for a completely unknown day; the catalog has 23 unique entries", () => {
  assert.equal(CATALOG.length, 23);
  assert.equal(new Set(CATALOG.map((e) => e.id)).size, 23);
  for (const event of CATALOG)
    assert.equal(evaluate(event, DAY, {}), "pending", event.name);
});

test("prices use only the seven days before drafting, exclude missing/incomplete evidence, and report sample sizes", () => {
  const game = addDays(DAY, 1);
  let history: Days = {};
  for (let i = 1; i <= 7; i++)
    history = {
      ...history,
      ...fixture(
        [i <= 3 ? 5000 : 0, 0, 0, 0],
        undefined,
        undefined,
        addDays(DAY, -i),
      ),
    };
  history = {
    ...history,
    ...fixture([99999, 0, 0, 0], undefined, undefined, DAY),
    ...fixture([99999, 0, 0, 0], undefined, undefined, addDays(DAY, -8)),
  };
  assert.deepEqual(pricesFor(game, history)["warm-up"], {
    hits: 3,
    sample: 7,
    hitRate: 3 / 7,
    points: 23,
  });
  delete history[addDays(DAY, -1)];
  history[addDays(DAY, -2)][3] = null;
  assert.deepEqual(pricesFor(game, history)["warm-up"], {
    hits: 1,
    sample: 5,
    hitRate: 0.2,
    points: 50,
  });
  assert.equal(pricesFor(game, {})["warm-up"]?.points, null);
  assert.equal(pricesFor(game, {})["personal-record"]?.sample, 0);
});

function rawBucket(start: number, work = "0") {
  return {
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + WATCH_MS).toISOString(),
    workAdded: work,
    activeRoundCount: work === "0" ? "0" : "1",
    completedBlockCount: "0",
  };
}
function rawSettlement(now: number, buckets: unknown[]) {
  return {
    generatedAt: new Date(now).toISOString(),
    window: {
      startAt: new Date(dayStart(DAY)).toISOString(),
      bucketSeconds: 21600,
    },
    buckets,
  };
}
test("in-progress and future buckets never become real zeroes, including when re-reading an old snapshot after midnight", () => {
  const start = dayStart(DAY),
    observed = start + WATCH_MS * 3 + 10;
  const raw = rawSettlement(
    observed,
    Array.from({ length: 6 }, (_, i) => rawBucket(start + WATCH_MS * i)),
  );
  const parsed = parseSettlements(raw, observed);
  assert.equal(parsed.days[DAY].filter(Boolean).length, 3);
  assert.equal(parsed.days[DAY][3], null);
  assert.equal(parsed.days[addDays(DAY, 1)], undefined);
  assert.equal(outcome("day-off", parsed.days), "pending");
  assert.equal(outcome("beauty-sleep", parsed.days), "hit");
  assert.equal(parseSettlements(raw, start + DAY_MS * 2).days[DAY][3], null);
  assert.equal(
    parseSettlements(
      rawSettlement(start + WATCH_MS, [rawBucket(start)]),
      start + WATCH_MS - 1,
    ).days[DAY],
    undefined,
  );
  assert.ok(
    parseSettlements(
      rawSettlement(start + WATCH_MS, [rawBucket(start)]),
      start + WATCH_MS,
    ).days[DAY][0],
  );
});
test("API parsing accepts numeric strings, preserves observed data, and rejects malformed buckets/numbers", () => {
  assert.equal(numeric("12345"), 12345);
  for (const bad of ["", "-1", "NaN", "Infinity", null, true])
    assert.throws(() => numeric(bad));
  const start = dayStart(DAY);
  const parsed = parseSettlements(
    rawSettlement(start + DAY_MS, [rawBucket(start, "5000")]),
    start + DAY_MS,
  );
  assert.equal(parsed.days[DAY][0]?.work, 5000);
  assert.equal(outcome("warm-up", parsed.days), "hit");
  assert.throws(() =>
    parseSettlements(
      rawSettlement(start + DAY_MS, [rawBucket(start + 1)]),
      start + DAY_MS,
    ),
  );
  assert.throws(() => parseSettlements({ buckets: [] }, start));
});
test("merging completed evidence retains earlier days without filling holes with invented zeroes", () => {
  const old = fixture([1, null, null, null]);
  const merged = mergeDays(old, fixture([null, 2, null, null]));
  assert.equal(merged[DAY][0]?.work, 1);
  assert.equal(merged[DAY][1]?.work, 2);
  assert.equal(merged[DAY][2], null);
  assert.equal(isComplete(merged, DAY), false);
});
test("wheel state is scaled from real status; faults, freshness, timestamp expiry, and network loss become confused", () => {
  const now = dayStart(DAY);
  const raw = {
    measurement: {
      coreStatus: "ACTIVE",
      freshness: "online",
      rpmMilli: "42000",
      cumulativeWorkUnits: "1000",
      observedAt: new Date(now).toISOString(),
      staleAfterSeconds: "120",
    },
    builder: { anchor: { blockHeight: "99" } },
  };
  const s = parseStatus(raw);
  assert.equal(s.rpmMilli, 42000);
  assert.equal(wheelState(s, now, false), "running");
  assert.equal(
    wheelState({ ...s, coreStatus: "IDLE" }, now, false),
    "sleeping",
  );
  assert.equal(
    wheelState({ ...s, coreStatus: "COUNTER_FAULT" }, now, false),
    "confused",
  );
  assert.equal(
    wheelState({ ...s, freshness: "stale" }, now, false),
    "confused",
  );
  assert.equal(wheelState(s, now + 120001, false), "confused");
  assert.equal(wheelState(s, now, true), "confused");
  assert.equal(wheelState(null, now, false), "confused");
});
test("Retry-After supports delta seconds and HTTP dates without retrying early", () => {
  const now = dayStart(DAY);
  assert.equal(retryDelay("120", now), 120000);
  assert.equal(retryDelay(new Date(now + 300000).toUTCString(), now), 300000);
  assert.equal(retryDelay(null, now), 60000);
  assert.equal(retryDelay("not valid", now), 60000);
  assert.equal(retryDelay("0", now), 1000);
});
function roster(): Roster {
  const picks = dailyCards(DAY)
    .slice(0, 5)
    .map((e) => e.id);
  return { day: DAY, picks, captain: picks[0], name: "A tiny rival" };
}
test("rival links round-trip day, picks, captain and Unicode name and reject tampering", () => {
  const r = { ...roster(), name: "Léa & <friend>" };
  assert.deepEqual(decodeRival(encodeRival(r)), r);
  assert.equal(
    validateRoster({ ...r, picks: [r.picks[0], ...r.picks.slice(0, 4)] }),
    false,
  );
  assert.equal(validateRoster({ ...r, name: "x".repeat(17) }), false);
  assert.equal(validateRoster({ ...r, day: "2026-02-30" }), false);
  assert.equal(decodeRival("#rival=broken"), null);
  assert.equal(decodeRival("#draft"), null);
  assert.equal(
    decodeRival(encodeRival({ ...r, captain: "not-a-card" as EventId })),
    null,
  );
  assert.equal(decodeRival("#rival=" + "x".repeat(2000)), null);
});
test("scoring doubles only the Captain and result text contains the game number, score, and five outcomes", () => {
  const r = roster(),
    days = fixture(
      [30000, 30000, 30000, 30000],
      [50, 50, 50, 50],
      [2000, 2000, 2000, 2000],
    );
  const prices = Object.fromEntries(
    r.picks.map((id) => [id, { points: 10, hitRate: 1, hits: 7, sample: 7 }]),
  );
  const outcomes = r.picks.map((id) => evaluate(eventById(id)!, DAY, days));
  const expected = outcomes.reduce(
    (sum, o, i) => sum + (o === "hit" ? (i === 0 ? 20 : 10) : 0),
    0,
  );
  assert.equal(rosterScore(r, days, prices), expected);
  const draft: Draft = { ...r, savedAt: dayStart(DAY) - 1, prices };
  const text = resultText({
    day: DAY,
    score: expected,
    outcomes,
    roster: draft,
  });
  assert.ok(text.includes(`Fantasy Hamster #${dayNumber(DAY)}`));
  assert.ok(text.includes(`${expected} points`));
  assert.equal([...text.split("\n")[2]].length, 5);
});
test("local storage survives exceptions, validates data, and preserves complete evidence", () => {
  const state = emptyState();
  assert.equal(
    writeState(
      {
        setItem: () => {
          throw new Error("quota");
        },
      },
      state,
    ),
    false,
  );
  assert.equal(
    readState({
      getItem: () => {
        throw new Error("blocked");
      },
    }).failed,
    true,
  );
  assert.equal(readState({ getItem: () => "{broken" }).failed, true);
  assert.equal(readState({ getItem: () => null }).failed, false);
  let stored = "";
  state.days = fixture([0, 0, 0, 0]);
  assert.equal(
    writeState(
      {
        setItem: (key, value) => {
          assert.equal(key, STORAGE_KEY);
          stored = value;
        },
      },
      state,
    ),
    true,
  );
  const read = readState({ getItem: () => stored });
  assert.equal(read.failed, false);
  assert.ok(isComplete(read.state.days, DAY));
});

test("scored days survive archival pruning and API expiry; drafts saved outside their UTC draft day are rejected", () => {
  const state = emptyState();
  const oldDay = addDays(dayKey(), -400);
  for (let i = 0; i < 20; i++)
    state.days = {
      ...state.days,
      ...fixture([6000, 0, 0, 0], undefined, undefined, addDays(oldDay, -i)),
    };
  const picks = dailyCards(oldDay)
    .slice(0, 5)
    .map((e) => e.id);
  const draft: Draft = {
    day: oldDay,
    picks,
    captain: picks[0],
    name: "Old team",
    savedAt: dayStart(oldDay) - 1,
    prices: pricesFor(oldDay, state.days),
  };
  state.drafts[oldDay] = draft;
  state.scores[oldDay] = {
    day: oldDay,
    roster: draft,
    score: rosterScore(draft, state.days, draft.prices),
    outcomes: rosterOutcomes(draft, state.days),
  };
  let stored = "";
  assert.equal(
    writeState(
      {
        setItem: (_key, value) => {
          stored = value;
        },
      },
      state,
    ),
    true,
  );
  const read = readState({ getItem: () => stored });
  assert.deepEqual(read.state.scores[oldDay], state.scores[oldDay]);
  assert.equal(isComplete(read.state.days, oldDay), true);
  assert.equal(read.state.days[addDays(oldDay, -1)], undefined);
  const late = {
    ...state,
    drafts: { [oldDay]: { ...draft, savedAt: dayStart(oldDay) } },
  };
  assert.equal(
    readState({ getItem: () => JSON.stringify(late) }).state.drafts[oldDay],
    undefined,
  );
  const tooEarly = {
    ...state,
    drafts: { [oldDay]: { ...draft, savedAt: dayStart(oldDay) - 2 * DAY_MS } },
  };
  assert.equal(
    readState({ getItem: () => JSON.stringify(tooEarly) }).state.drafts[oldDay],
    undefined,
  );
});
