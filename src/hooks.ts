import { useEffect, useRef, useState } from "react";
import {
  parseSettlements,
  parseStatus,
  retryDelay,
  type Settlements,
  type WheelStatus,
} from "./core/data";

interface Feed<T> {
  data: T | null;
  error: string | null;
  lastGood: number | null;
  retryAt: number | null;
  loading: boolean;
}
export function useFeed<T>(
  path: string,
  interval: number,
  parse: (raw: unknown, now: number) => T,
) {
  const [state, setState] = useState<Feed<T>>({
    data: null,
    error: null,
    lastGood: null,
    retryAt: null,
    loading: true,
  });
  const force = useRef<() => void>(() => {});
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined,
      controller: AbortController | undefined;
    let disposed = false,
      inFlight = false,
      nextDue = 0,
      retryAfter = 0;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && !document.hidden)
        timer = setTimeout(
          fetchData,
          Math.min(Math.max(nextDue - Date.now(), 0), 2_147_483_647),
        );
    };
    const fetchData = async () => {
      if (disposed || document.hidden || inFlight) return;
      if (Date.now() < nextDue) {
        schedule();
        return;
      }
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12_000);
      try {
        const response = await fetch(`https://api.squeekchain.com/v1/${path}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 429) {
          const delay = retryDelay(
            response.headers.get("Retry-After"),
            Date.now(),
            Math.max(interval, 60_000),
          );
          nextDue = Date.now() + delay;
          retryAfter = nextDue;
          setState((s) => ({
            ...s,
            loading: false,
            error: "Rate limited",
            retryAt: nextDue,
          }));
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = parse(await response.json(), Date.now());
        if (!disposed)
          setState({
            data,
            error: null,
            lastGood: Date.now(),
            retryAt: null,
            loading: false,
          });
        nextDue = Date.now() + interval;
        retryAfter = 0;
      } catch {
        if (!disposed)
          setState((s) => ({ ...s, error: "Signal lost", loading: false }));
        nextDue = Date.now() + interval;
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        schedule();
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) {
        nextDue = Math.max(Date.now(), retryAfter);
        schedule();
      }
    };
    force.current = () => {
      nextDue = Math.max(Date.now(), retryAfter);
      schedule();
    };
    document.addEventListener("visibilitychange", visibility);
    void fetchData();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [path, interval, parse]);
  return { ...state, retry: () => force.current() };
}
export const parseStatusFeed = (raw: unknown): WheelStatus => parseStatus(raw);
export const parseSettlementsFeed = (raw: unknown, now: number): Settlements =>
  parseSettlements(raw, now);
export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}
