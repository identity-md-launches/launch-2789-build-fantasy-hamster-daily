import type { Roster, Scored } from "./game";
import { validateRoster } from "./game";
import { dayNumber } from "./dates";
export function encodeRival(roster: Roster): string {
  const value = JSON.stringify({
    v: 1,
    d: roster.day,
    p: roster.picks,
    c: roster.captain,
    n: roster.name,
  });
  const binary = Array.from(new TextEncoder().encode(value), (byte) =>
    String.fromCharCode(byte),
  ).join("");
  return `#rival=${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
export function decodeRival(hash: string): Roster | null {
  if (!hash.startsWith("#rival=") || hash.length > 1800) return null;
  try {
    const encoded = hash.slice(7).replace(/-/g, "+").replace(/_/g, "/");
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
      ),
    );
    const roster = {
      day: value.d,
      picks: value.p,
      captain: value.c,
      name: value.n,
    };
    return value.v === 1 && validateRoster(roster) ? roster : null;
  } catch {
    return null;
  }
}
export const resultText = (scored: Scored): string =>
  `Fantasy Hamster #${dayNumber(scored.day)}\n${scored.score} points · ${scored.day}\n${scored.outcomes.map((o) => (o === "hit" ? "🟧" : "⬜")).join("")}\nSmall paws. Big predictions.`;
