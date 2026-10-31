# Fantasy Hamster design system

## Overview

Fantasy Hamster is a small daily game built around warm paper trading cards and a real hamster’s wheel. The visual idea is a collectible card pack on a cream tabletop: dark outlines, orange ink, chunky headlines and small original illustrations. The game board follows the short introduction immediately. At 390×844, the product, sleeping hamster, UTC lock timer and first two **Pick card** buttons are visible together.

The source of truth is `src/styles.css`, then the actual components in `src/components/` and `src/App.tsx`. CSS is organized into `reset`, `base`, `components` and `responsive` layers. The design is intentionally light only.

## Colors

All UI colors are semantic custom properties in `src/styles.css`:

| Token | Value | Implemented role |
| --- | --- | --- |
| `--paper` | `#f6f2e6` | Page, wheel, illustration field |
| `--paper-light` | `#fffdf6` | Cards, inputs and neutral buttons |
| `--paper-deep` | `#e9e0ca` | Team slip, resting/dead surfaces, quiet panels |
| `--paper-line` | `#cfc4ac` | Separators, card dots, wheel spokes |
| `--ink` | `#292b24` | Main text, outlines, selected filter |
| `--muted` | `#5d5d50` | Supporting text, captions, empty slots |
| `--accent` | `#f5783b` | Primary action, active navigation, Captain, illustration details |
| `--accent-light` | `#ffeadc` | Selected card and rival invitation |
| `--hit` | `#365841` | Confirmed hit text and indicators |
| `--hit-bg` | `#e4eddf` | Confirmed hit surface and saved notice |
| `--focus` | `#164f76` | Keyboard focus outline |

There is one bold brand accent. Green has the separate role of a confirmed positive state. A miss/dead card uses neutral paper and a visible cross with text; an unsettled card says “In play.” Color never carries the outcome alone.

Measured solid pairs: ink/paper **12.80:1**, muted/deep paper **5.08:1**, muted/light paper **6.56:1**, ink/orange **5.21:1**, hit text/hit surface **6.65:1**. The focus color has **3.16:1** contrast against orange and **7.77:1** against paper. These ratios were computed from the implemented sRGB values and checked alongside the rendered contrast probe; they are not claims about the translucent dialog backdrop.

The pixel hamster uses a small self-contained fur/cheek palette in `Art.tsx`: tan `#dba36a`, pale belly `#fff7e5`, and rose cheek/ear details. These are illustration colors, not additional UI accents.

## Typography

No font files or font network requests exist. `--font-body` is `Arial, Helvetica, sans-serif`. `--font-display` is `"Arial Black", "Arial Rounded MT Bold", Arial, sans-serif`; native availability determines the chosen face. Do not assume Arial Black is installed. Display fallback remains a heavy sans serif.

| Token | Size at default root | Role |
| --- | ---: | --- |
| `--text-small` | 13px / 0.8125rem | Card rules, data labels, metadata and compact controls |
| `--text-body` | 16px / 1rem | Prose, text inputs, changing values |
| `--text-card` | 20px / 1.25rem | Card headings, mobile section title |
| `--text-section` | 28px / 1.75rem | Section headings, counters, summary labels |
| `--text-title` | 44px / 2.75rem | Mobile headline, large numeric summaries |
| `--text-display` | 64px / 4rem | Wide headline |

Weights are 400, 700 and 900. Body line height is 1.5; headings generally use 1.1 and card titles 1.15. The phone headline uses 1.02. Display tracking is −0.055em; section tracking is −0.035em. Small text uses natural tracking. Numbers use tabular numerals where they change. Headings balance their lines and allow long words to wrap, including under enlarged text. Supporting prose uses `text-wrap: pretty`, with descriptive paragraphs capped near 56–75ch.

The orange headline underline is text decoration, not a separate image. Keep the headline as the largest and heaviest text. Input text remains 16px to avoid iOS form zoom.

## Layout

The shared `.site-header`, `.page-shell` and `.site-footer` align to a maximum 1280px content width. Outer margins are 48px at wide sizes, 32px below 1120px, 20px below 760px and 16px below 580px. Small gaps are 4/6/8px, control and card spacing uses 12/14/16/18/20px, and groups use 24/28/32px or larger section spacing. These are existing CSS values, not a separate invented spacing-token system.

| Width | Implemented behavior |
| --- | --- |
| Above 1120px | Two-part introduction; three market columns; 310px sticky team slip; five live cards |
| Up to 1120px | 44px headline; two market columns; 280px team slip; three live columns |
| Up to 760px | Team slip enters normal flow after the market; three market columns; a review-team action appears after five picks |
| Up to 580px | Compact introduction and hamster row; two market/live columns; four-column navigation; 20px section heading; 16px outer margins; help becomes a labelled icon button |
| Below 359px | Card metadata stacks, card titles use 16px, market gaps narrow and display tracking tightens |

The draft’s first screen is kept compact without clipping or hiding game information. Navigation uses `auto-fit` with a 4.25rem minimum, retaining four columns at normal supported sizes and allowing fewer columns when text is enlarged. Card metadata can wrap. A mobile **Five picked. Review your team** button scrolls to and focuses the team heading. The rest of the controls stay in document flow; there is no fixed mobile bar obscuring cards.

Rendered draft reflow was checked at 320, 390, 580, 760, 960 and 1440px. Rival comparisons with 16-character unbroken names were checked in Chromium and WebKit at 320, 360, 390, 760 and 1440px. The head-to-head grids use `minmax(0, 1fr)`; invitation/heading/ranking names have `min-width: 0` and `overflow-wrap: anywhere`, and invitation text is bounded to its column. A comparison heading wraps while its score stays together; no name is clipped or abbreviated. The OBS layout is specifically 1920×1080. A separate 200% root-text check supplements reflow; native browser zoom and physical-device inspection are distinct, unperformed checks.

## Elevation & Depth

The interface is flat. There are no box shadows or glowing surfaces. Structural borders and paper tones establish hierarchy. A native modal dialog uses a translucent `#292b2480` backdrop. The selected card adds a fine inset outline with a non-interactive pseudo-element. Decorative paper dots are a light radial pattern, not a neon gradient.

The team slip’s 6px top rule distinguishes it from collectible cards. Standard cards and primary buttons have 2px ink borders; the dialog and overlay use 3px outlines. Separators are 1px, often dashed on the team slip.

## Shapes

Event cards have 10px radii, reduced to 8px on phones. Card picture wells use 5px radii. Buttons and fields use 6px radii. Small captain controls use 4px; dialog and overlay groups use 12px. Round controls are limited to the animation pause and small status dots. Do not give every label a pill or enclose the logo in a panel.

## Components

| Component / pattern | Source | Reuse and behavior |
| --- | --- | --- |
| `Icon` | `src/components/Art.tsx` | One 2px rounded SVG icon set, `currentColor`, decorative to assistive technology; no emoji UI icons |
| `Hamster`, `HamsterMark` | `src/components/Art.tsx` | Pixel hamster and wheel; running/sleeping/confused states; `rpmMilli` determines wheel duration; `paused` suspends animation |
| `CardArt` | `src/components/Art.tsx` | One distinct original SVG for every event ID; shares cream, ink and orange |
| `EventCard` | `src/components/EventCard.tsx` | Event, price, selection, Captain and outcome; optional pick/Captain handlers; compact overlay variant |
| `.button` | `src/styles.css` | `primary` orange or `secondary` paper; minimum 48px height; loading/disabled states remain explicit |
| `DraftBuilder` | `src/App.tsx` | Twelve-card market, three filter buttons, five slots, Captain and save validation; unpriced cards cannot be picked |
| `Watches`, `LiveView` | `src/App.tsx` | Four UTC buckets, confirmed lower-bound totals, active/rested/unsettled and In progress labels, live roster |
| `ResultReveal` | `src/App.tsx` | Five staged CSS flips; reveal-all alternative; final score, best, streak and sharing after reveal |
| `ShareControl` | `src/App.tsx` | Clipboard action, copied status and selectable textarea fallback; X sharing is an explicit link |
| `RivalsView`, `RosterComparison` | `src/App.tsx` | Imported roster, two comparable lists, add-rival state, local ranking and unverified-timing disclosure |
| `HelpDialog` | `src/App.tsx` | Native modal focus containment, Escape support, close action and focus return to help trigger |
| `Overlay` | `src/App.tsx` | Transparent lower third, five cards and hamster; no controls; portable hash roster; feed-specific lost-signal times and last-known outcomes |

The OBS hamster scene is 160px tall in normal operation and 140px during feed errors, allowing both error timestamps and the last-known caption to fit within the 1920×1080 lower third. The panel retains the existing paper/ink tokens, 13px caption, 20px title, 3px outline and 12px radius. Counter faults and stale wheel measurements have separate captions.

Native buttons, links, labels, selects and dialog provide the keyboard model. Toggle buttons expose `aria-pressed`, navigation uses `aria-current`, and controls use visible text or explicit labels. Focus uses a 3px outline with 4px offset. Routine messages use stable polite status regions. Inputs, waiting states, storage errors and lost signal use plain explanatory copy.

Motion is opt-in under `prefers-reduced-motion: no-preference`. Press feedback is scale 0.96 over 150ms, with `cubic-bezier(.2,0,0,1)`. Card flips take 550ms; reveal sequencing advances every 650ms, or 80ms without animation under reduced motion. Wheel rotation is 0.3–8 seconds from real RPM. Sleeping symbols drift gently over four seconds. The main game provides a pause control. No animation runs under reduced motion; outcomes always include static text and an icon.

## Do’s and Don’ts

- Start additional game sections inside `.page-shell` with `.section-heading`, then reuse existing cards, buttons, fields and spacing.
- Use the orange fill for the current primary action or selected state. Use `--hit` only for confirmed positives, and always keep the written outcome.
- Keep scoring in the pure core modules and pass observed data into visual components. Loading and future watches must remain unknown.
- Preserve four UTC watches, relative assets, hash navigation, system fonts and local artwork. Add new event art through `CardArt` using the existing palette/stroke.
- Keep actionable errors next to their controls. Preserve native keyboard behavior, visible focus and reduced-motion support.
- Do not add decorative badges above headings, external fonts, full-width slogans, neon/glow effects, color-only outcomes or hidden critical text.

Validation details, corrected findings and limitations are recorded in `artifacts/validation.md`. The pinned design-guide attributions and licenses are in `artifacts/design-guidance-notice.md` and `artifacts/design-guidance-LICENSE.txt`.
