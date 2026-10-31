import { dayKey, WATCH_MS } from "./dates";
import type { Bucket, Days } from "./game";

const object = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error("Invalid response");
  return x as Record<string, unknown>;
};
export function numeric(value: unknown): number {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value))
  )
    throw new Error("Invalid numeric data");
  const result = Number(value);
  if (
    !Number.isFinite(result) ||
    result < 0 ||
    result > Number.MAX_SAFE_INTEGER
  )
    throw new Error("Invalid numeric data");
  return result;
}
export interface Settlements {
  days: Days;
  windowStart: number;
  observedAt: number;
}
export function parseSettlements(input: unknown, now: number): Settlements {
  const data = object(input),
    window = object(data.window);
  if (numeric(window.bucketSeconds) !== 21600 || !Array.isArray(data.buckets))
    throw new Error("Unsupported buckets");
  const observedAt = Date.parse(String(data.generatedAt));
  const windowStart = Date.parse(String(window.startAt));
  if (!Number.isFinite(observedAt) || !Number.isFinite(windowStart))
    throw new Error("Missing data time");
  const through = Math.min(now, observedAt);
  const days: Days = {};
  for (const item of data.buckets) {
    const b = object(item);
    const start = Date.parse(String(b.startAt)),
      end = Date.parse(String(b.endAt));
    if (
      !Number.isFinite(start) ||
      end - start !== WATCH_MS ||
      start % WATCH_MS !== 0
    )
      throw new Error("Invalid bucket boundary");
    // A snapshot's future zero stays unknown even if wall time passes its end later.
    if (end > through) continue;
    const bucket: Bucket = {
      start,
      end,
      work: numeric(b.workAdded),
      rounds: numeric(b.activeRoundCount),
      blocks: numeric(b.completedBlockCount),
    };
    const key = dayKey(start),
      index = new Date(start).getUTCHours() / 6;
    days[key] ??= [null, null, null, null];
    days[key][index] = bucket;
  }
  return { days, windowStart, observedAt };
}
export interface WheelStatus {
  freshness: string;
  coreStatus: "ACTIVE" | "IDLE" | "COUNTER_FAULT";
  rpmMilli: number;
  cumulativeWork: number;
  observedAt: number;
  staleAfterSeconds: number;
  height: number;
}
export function parseStatus(input: unknown): WheelStatus {
  const data = object(input),
    measurement = object(data.measurement),
    anchor = object(object(data.builder).anchor);
  if (
    !["ACTIVE", "IDLE", "COUNTER_FAULT"].includes(
      String(measurement.coreStatus),
    )
  )
    throw new Error("Unknown wheel state");
  const observedAt = Date.parse(String(measurement.observedAt));
  if (!Number.isFinite(observedAt)) throw new Error("Missing measurement time");
  return {
    freshness: String(measurement.freshness),
    coreStatus: measurement.coreStatus as WheelStatus["coreStatus"],
    rpmMilli: numeric(measurement.rpmMilli),
    cumulativeWork: numeric(measurement.cumulativeWorkUnits),
    observedAt,
    staleAfterSeconds: numeric(measurement.staleAfterSeconds),
    height: numeric(anchor.blockHeight),
  };
}
export function wheelState(
  status: WheelStatus | null,
  now: number,
  lost: boolean,
): "running" | "sleeping" | "confused" {
  if (
    !status ||
    lost ||
    status.coreStatus === "COUNTER_FAULT" ||
    !["online", "fresh"].includes(status.freshness.toLowerCase()) ||
    now - status.observedAt > status.staleAfterSeconds * 1000
  )
    return "confused";
  return status.coreStatus === "ACTIVE" ? "running" : "sleeping";
}
export function retryDelay(
  header: string | null,
  now: number,
  fallback = 60_000,
): number {
  if (!header) return fallback;
  if (/^\d+(\.\d+)?$/.test(header.trim()))
    return Math.max(1000, Number(header) * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(1000, date - now) : fallback;
}
export function mergeDays(old: Days, fresh: Days): Days {
  const result: Days = { ...old };
  for (const [day, buckets] of Object.entries(fresh)) {
    result[day] = buckets.map((bucket, i) => bucket ?? old[day]?.[i] ?? null);
  }
  return result;
}
