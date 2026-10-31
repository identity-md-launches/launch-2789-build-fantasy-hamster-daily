# Fantasy Hamster

A daily fantasy game for Squeekchain. Draft five predictions about Squeektoshi’s next UTC day, choose a Captain, and let the real wheel settle the score. A single static React + TypeScript page, with no account, wallet, token, payments, game server, external fonts, analytics, or simulated wheel data.

## How to play

1. Pick exactly five of tomorrow’s twelve cards before 00:00 UTC.
2. Crown one Captain: its hit earns double points. Save your team on this device.
3. Follow the real wheel, then reveal your result after the game day ends.

## Install, develop, preview, rebuild

Use Node.js 22.12 or newer and npm. All dependency versions are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

Build and preview the static export:

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
```

Serve the **contents of `dist/`**, which is included in this delivery. No build step or server-side rewrite is needed on the hosting service. Vite’s base is `./`; scripts, styles, favicon and social image use relative URLs. The application uses hash navigation (`#draft`, `#live`, `#results`, `#rivals`) and works below an arbitrary gateway path such as `/ipfs/<cid>/`. Use HTTP(S), rather than opening ES modules with `file://`.

`vite.config.ts` optionally accepts `FH_DEPENDENCIES`, an absolute path to an externally installed dependency directory. This was used to keep dependency trees outside the managed repository during construction. Normal `npm ci` needs no setting.

## Checks

```sh
npm run typecheck
npm test
npx playwright install --with-deps chromium webkit
npm run build
npm run validate
```

`npm test` runs 38 unit tests, including all 23 events, deterministic daily packs, exact pricing, UTC boundaries, complete versus in-progress buckets, record history, scoring, links, storage exceptions and long-lived scored-day preservation.

`npm run validate` serves the actual export at a nested `/ipfs/fantasy-hamster/` path in a bounded foreground process. It exercises drafting, Captain choice, validation messages, save/reload, keyboard help and focus return, sharing fallback, rival head-to-head and ranking, result flips, live outcomes, six responsive widths, automated accessibility, expired results, API failure, storage failure, polling/backoff, UTC rollover and the transparent OBS overlay. It uses synthetic API responses **only inside the tests**; production has no demo data or test mode. Browser binaries/platform libraries are development requirements. An unavailable engine is reported explicitly.

Actual worker results: production build and strict typecheck passed; **38/38 unit tests passed**. The pinned taste@1 design probe passed **16/16 checks** after contrast and first-screen fixes. Full browser results, precise coverage, evidence and remaining limits are in [artifacts/validation.md](artifacts/validation.md). The implemented design system is in [DESIGN.md](DESIGN.md).

The disposable `test/scratch/` directory is not required for installation, building or validation. The browser script creates it as needed. It is excluded from the submission.

## Timing, pricing and evidence

- A game day is one UTC calendar day. A roster is editable only during the preceding UTC day. The save handler rechecks the wall clock at submission, not just when the page opens. Packs use FNV-1a seed hashing, Mulberry32 and Fisher–Yates over the versioned catalog, keyed by the game’s UTC date. Everyone receives the same twelve IDs.
- Game #1 is **2026-01-01**. This is a display epoch for this fan game, not a claim about Squeekchain’s launch date.
- Pricing uses `clamp(round(10 / max(hitRate, 0.1)), 10, 100)`. For a game on G, drafting happens on D = G−1 and the history window is D−7 through D−1. D is unfinished and is excluded. Saving freezes the current quoted values; editing and saving again can update them before lock.
- The rolling API window includes future watches and often contains fewer than seven complete UTC days. Known outcomes within the requested seven-day pricing interval form the denominator; the card displays both the percentage and `hits/sample days`. Missing days are not invented or treated as misses. With no evaluable history, a card is unpriced and cannot be drafted. Complete cached days can increase the sample over time. This is a disclosed cold-start policy required by the limited public window.
- “Personal Record” needs six preceding days. A final failure can sometimes be proved from one known prior day; a hit requires all six. If a result truly cannot be evaluated, it stays unavailable rather than receiving a guessed outcome.
- The parser accepts numeric strings and rejects invalid/unsafe numbers. A bucket enters scoring only when `endAt <= min(clientNow, response.generatedAt)`. In-progress and future buckets are absent, **not zero**. Letting the clock advance does not turn an old snapshot’s future zero into evidence.
- Events with monotonic thresholds can hit early from completed watches. Events can die when a hit becomes impossible. Exact-count, bounded-work and distribution events wait for the watches they need. Watches are active when `activeRoundCount > 0`; consecutive runs do not wrap around midnight.
- Status polls every 20 seconds; settlements every 5 minutes. Both stop scheduling requests while the document is hidden and refresh on return. Requests time out after 12 seconds. HTTP 429 honors an exposed `Retry-After` in seconds or HTTP-date form. If CORS hides the header or it is invalid, the fallback is at least one minute (five minutes for settlements). Manual retry cannot bypass backoff.
- IDLE displays a sleeping hamster; ACTIVE rotates its wheel from `rpmMilli`, with a visual duration clamped to 0.3–8 seconds. COUNTER_FAULT, stale measurements, unknown freshness and lost status show the confused state. Motion can be paused and respects reduced-motion preferences.

## Local results and rivals

`localStorage['fantasy-hamster:v1']` contains versioned drafts, confirmed bucket evidence, scored days, revealed days, a display name and rivals. Every storage access is guarded. A storage failure is visible; the current visit remains usable. Complete daily evidence and each fully scored team are archived, so a result survives the public API’s rolling window. Older ordinary evidence is pruned after a year; evidence for saved drafts/scores and scored result objects is retained. A never-saved day that has left the API shows **“Result expired.”**

The scoring streak counts consecutive completed days with more than zero points, ending yesterday. Personal best includes all scored days retained on this browser. Clearing browser data removes the collection; there is no account or cross-device synchronization.

Rival links encode a version, UTC game day, five catalog IDs, Captain and up to 16 Unicode code points of display name as validated UTF-8/base64url in the hash. Names render as text, never HTML. Opening a link shows both rosters and **Add rival**. At most 20 rivals per day are stored and ranked locally. Rivals are never presented as a global leaderboard or authenticated entries. Links are editable and prove no draft time; the interface says so. Your saved prices stay fixed; rivals are priced from public/cached history available to the viewer. Missing history is explicitly unpriced, so scores from browsers with different history samples may differ.

Results offer a five-square Wordle-style text block, a clipboard button with selectable-text fallback, and an X intent link. Nothing is posted automatically.

## OBS overlay

Open `?overlay=1` in a 1920×1080 OBS browser source. It renders only a transparent lower third: the hamster, five cards and live outcomes. There are no controls. It uses today’s locally saved team, falling back to a saved tomorrow team labelled as such.

The main page’s **Stream overlay** link includes the available roster in its hash. Copy that complete URL into OBS to carry the five picks across OBS’s separate browser storage. A portable URL has the form `?overlay=1#rival=<encoded-roster>`; generate it through the game rather than writing the payload by hand. Imported prices/outcomes are derived from available public data. An empty source explains that no team exists; it does not invent a roster. An expired imported day is labelled expired.

## Source map

| Location | Purpose |
| --- | --- |
| `src/core/catalog.ts` | All 23 event names, rules and stable IDs |
| `src/core/game.ts`, `dates.ts` | Pure events, PRNG, prices, UTC locks and scoring |
| `src/core/data.ts` | Public response validation, completed evidence, freshness, retry parsing |
| `src/core/storage.ts`, `share.ts` | Guarded persistence and validated portable links |
| `src/core/game.test.ts` | Unit tests independent of React/network |
| `src/hooks.ts` | Visibility-aware polling and clock |
| `src/components/` | Original SVG hamster, card art, icons and event cards |
| `src/App.tsx`, `styles.css` | Draft, live, reveal, rivals, help and overlay views |
| `public/` | Local favicon, PNG social image and its editable SVG source |
| `test/browser.mjs` | Production-export interaction/accessibility checks |
| `artifacts/` | Actual validation, screenshots, budget and design-guide attribution |

Design guidance was adapted from Jakub Krehel’s Better Interface (MIT) and Paul Bakaus’s Impeccable documentation method (Apache-2.0). Source/commit attribution and their licenses are retained in `artifacts/design-guidance-notice.md` and `artifacts/design-guidance-LICENSE.txt`. All hamster and card illustrations are original local SVG code.
