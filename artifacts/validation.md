# Revision validation

This is a targeted revision of the accepted Fantasy Hamster implementation. It preserves the original visual system, catalog, shuffle, links, asset pipeline and primary game loop. The nine finding verdicts are in [../.imd-responses.json](../.imd-responses.json): eight fixed, one disputed because the supplied public sources lack historical pricing evidence. These are worker observations, not independent certification.

## Reproduction and corrections

The original committed export was copied to a disposable directory and served unchanged. The supplied expired rival hash reproduced **401px scroll width** at **390, 360 and 320px**, in Chromium and WebKit. In both engines, saving in tab B then refreshing tab A's visibility removed the draft. Settlements-only failures left OBS's healthy caption unchanged; healthy counter faults were labelled “Signal lost.” Core reproductions used the real public settlements snapshot generated **2026-10-31T19:09:01.268Z**.

| Finding / severity | Source and cause | Correction and recheck |
| --- | --- | --- |
| Long rival name / high | `src/styles.css:1111`, `:1121`, `:1831`: intrinsic widths escaped invitation, comparison and ranking columns | Shrinkable grids and text, bounded invitation, full-name wrapping, wrapping headings with intact scores. Both engines: expired and priced 16-character names fit; no overflow at 320/360/390/760/1440px. |
| Stale tabs erase saved state / high | `src/App.tsx:1273`, `src/core/storage.ts:138`: whole stale state replaced storage | Merge on every write, sync storage/visibility events, serialize with Web Locks where available; newer drafts, scores, rivals and reveals survive. Both engines: A+B+OBS, visibility refetch, close/reload, plus local-edit protection. Pure tests also check stale same-day writes and explicit rescoring. |
| Silent OBS settlements failure / medium | `src/App.tsx:1049`: overlay lacked feed metadata | Both feed errors/lastGood times are passed through. Both engines: five-minute clock advance produces a results-specific UTC last-received time; last-known outcomes stay visible. |
| Discarded partial evidence / medium | `src/core/data.ts:50`, `src/core/game.ts:71`: every unfinished bucket was dropped | Positive in-progress values are lower bounds, with explicit completion and observation metadata. Modified real snapshot: 18:00 watch now hits Night Shift and daily work becomes **14114**, rather than 5114. Tests prevent premature rest/exact/distribution results and completion by elapsed time. Both engines light live Overtime/Clocked In/Triple Shift before watch end. |
| Biased Personal Record odds / medium | `src/core/game.ts:160`: provable misses entered a sample whose potential hits lacked prior history | Pricing requires the same complete prior evidence for hits and misses. Real cold-start snapshot changes from a misleading **0/3, 100 points** to **no sample, unpriced**. Sufficient-history fixture is **2/5, 40%, 25 points**. |
| Historical rival prices / medium, disputed | `src/App.tsx:881`, `src/core/game.ts:152`: original price window has left the feed | Reproduced for 2026-10-27: known Warm-Up miss, no priced cards. Kept explicit Unpriced and known outcomes. Exact recovery needs Squeekchain/requester-supplied historical data/quotes or an agreed link/pricing change; the specified hash and rolling feed cannot recover them. |
| Unreadable storage destroyed / low | `src/core/storage.ts:183`: failed read was followed by an empty overwrite | Refuse writes over unreadable/newer blobs; visible visit-only notice states preservation. Both engines and unit tests preserve malformed JSON and a version-2 score blob byte for byte after loading/editing. |
| Healthy measurement rejected by missing anchor / low | `src/core/data.ts:79`: unused builder height was mandatory | Removed that unrelated dependency while retaining measurement validation. Both engines show sleeping IDLE with null anchor; unit tests also cover an absent builder. This response variant was tested, not observed on the public service. |
| OBS counter-fault label / low | `src/App.tsx:1085`: confused hamster conflated feed failures and faults | Separate Counter fault, Wheel measurement stale and transport-error captions. Both engines cover both/individual/first-load failures and exact last-good or never-received labels. |

A rendered recheck found two applicable follow-up defects during repair: the invitation still needed a maximum width at 320px, and the longest first-load error caption put OBS 4.5px above its lower third. Both were corrected in the same components. The error-state wheel now uses 140px of height instead of 160px, retaining every caption and all five cards.

## Commands and actual results

The normal project commands remain documented in the README. For this run dependencies were installed **outside the repository** from its unchanged lockfile. `PATH` pointed to that installation; Vite used its existing optional `FH_DEPENDENCIES` setting. Typecheck additionally received `--typeRoots` pointing to the external `@types` directory. No runtime dependency, registry mirror or archive was added.

| Command | Result |
| --- | --- |
| `npm ci` (external disposable prefix, project manifest/lockfile) | Passed |
| `npm run typecheck -- --typeRoots <external-deps>/@types` | Passed, strict TypeScript, no emit |
| `npm test` | **49/49 passed**, original 38 plus 11 regression tests |
| `npm run build` | Passed; current production HTML, CSS and JS in `dist/`; 38 modules |
| `npm run validate` | **22/22 check groups passed** on the actual export under `/ipfs/fantasy-hamster/`, Chromium and WebKit |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **16/16 passed** on the final export |
| `git diff --check` | Passed |

The initial stock WebKit binary lacked Linux libraries. Browser checks were completed with matching Playwright core and an available WebKit runtime plus temporary library/software-rendering setup outside the repository. An intermediate cross-tab test froze its own animation-frame polling clock; that test was corrected to let cross-tab clocks run, while interval/backoff tests still advance mocked time. Neither workaround changes production code. One interrupted intermediate run was followed by complete passing runs.

Machine-readable final results: [browser-checks.json](browser-checks.json), [taste.json](taste.json). Test API fixtures exist only in the test programs; production never simulates wheel data. The public API was fetched to reproduce the reported data-dependent cases; controlled responses establish error and boundary behavior without waiting on actual wheel events or a real five-minute interval.

## Better Interface review: six domains

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native buttons/labels/dialog preserved; keyboard help open/Escape/focus return, draft/Captain/save interactions, visible focus screenshot, reduced motion, semantic names, axe scans with zero violations in tested main/rival flows and six draft widths. Outcomes retain text and icons. | No physical device, screen-reader session, native browser zoom or exhaustive forced-colors check. Automated scans are not full accessibility certification. |
| Layout — Checked | Actual production export at nested base path; draft widths 320/390/580/760/960/1440; long-name rivals 320/360/390/760/1440 in both engines; OBS 1920×1080 including all error captions. At 390×844 the title, hamster, countdown and Pick card controls appear together. | Browser emulation, not every device. No RTL/localized layout was added to this English-only game. |
| Writing — Checked | Plain feed-specific failure text with actual times; visit-only preservation notice; partial-watch labels; no invented pricing claim. Local ranking and unverified link timing remain disclosed. | Complete historical rival scores cannot be promised from the supplied rolling source. |
| Typography — Checked | Existing six-size system preserved. Full 16-character names wrap without truncation; headings may wrap and scores stay together. 200% root text reflows at 390px in the draft. | Root text enlargement is not native browser zoom; native system-font availability varies. |
| Colors — Checked | Existing semantic palette reused; final probe passed solid-pair contrast checks. Recomputed ink/paper **12.80:1**, muted/deep paper **5.08:1**, muted/light paper **6.56:1**, ink/accent **5.21:1**, hit/hit background **6.65:1**, focus/paper **7.77:1**, focus/accent **3.16:1**. Error caption is ink on opaque cream, including in transparent OBS. | No claim about contrast over arbitrary external OBS video or the translucent dialog backdrop. No dark theme is requested. |
| UI — Checked | Original flat paper/outlines/illustrations/motion retained. Card reveal and live outcomes, empty/error/success states, mobile team review, pause/reduced motion and no-control OBS were exercised. Dialog focus return was also viewed with the browser tool against the real public API. | Motion was not replayed at 10% speed in a native Animations panel. Clipboard fallback tested; X intent validated without posting. |

The final screenshots were inspected, including the first phone screen and repaired rival/OBS states:

- [Phone draft, 390×844](screenshots/draft-390.png)
- [Desktop draft, 1440px](screenshots/draft-1440.png)
- [WebKit long-name rival, 390×844](screenshots/rival-390.png)
- [OBS lost signal, 1920×1080](screenshots/overlay-lost.png)
- [Visible focus after dialog Escape, public API, 1280×720](screenshots/help-focus.png)

Other than the public-API focus capture, these screenshots use the explicitly controlled test responses. Their teams/outcomes are test evidence, not a production demo mode. No viewport contents are fabricated.

**Complete for the bounded revision scope.** The historical-pricing finding remains disputed with the missing source/format decision identified above. Physical Safari/iPhone behavior, screen readers, native zoom, long-term storage durability and all future API response variants remain unperformed or inherently unprovable in this run. The static export and all runtime assets remain included; no publishing action was performed.
