import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addDays,
  countdown,
  dayKey,
  dayNumber,
  dayStart,
  displayDay,
  WATCHES,
} from "./core/dates";
import { CATALOG, eventById, type EventId } from "./core/catalog";
import {
  bucketsFor,
  canDraft,
  dailyCards,
  isComplete,
  pricesFor,
  rosterOutcomes,
  rosterScore,
  total,
  type Days,
  type Draft,
  type Price,
  type Prices,
  type Roster,
  type Scored,
} from "./core/game";
import { mergeDays, wheelState } from "./core/data";
import {
  emptyState,
  mergeState,
  persistState,
  readState,
  STORAGE_KEY,
  type LocalState,
} from "./core/storage";
import { decodeRival, encodeRival, resultText } from "./core/share";
import {
  parseSettlementsFeed,
  parseStatusFeed,
  useClock,
  useFeed,
} from "./hooks";
import { CardArt, Hamster, HamsterMark, Icon } from "./components/Art";
import { EventCard } from "./components/EventCard";

type View = "draft" | "live" | "results" | "rivals";
const getView = (): View =>
  location.hash.startsWith("#rival=")
    ? "rivals"
    : ["live", "results", "rivals"].includes(location.hash.slice(1))
      ? (location.hash.slice(1) as View)
      : "draft";
const number = (n: number): string => n.toLocaleString("en-US");
const utcTime = (n: number): string =>
  new Date(n).toISOString().slice(11, 19) + " UTC";

function Notice({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>;
}

function ShareControl({
  text,
  label,
  filename,
}: {
  text: string;
  label: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  return (
    <div className="share-control">
      <button
        className="button secondary"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setManual(false);
          } catch {
            setManual(true);
          }
        }}
      >
        <Icon name={copied ? "check" : "copy"} />
        {copied ? "Copied" : label}
      </button>
      {filename && (
        <a
          className="text-link"
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on X <Icon name="arrow" size={16} />
        </a>
      )}
      {manual && (
        <label className="manual-copy">
          Copy this {filename ? "result" : "link"}
          <textarea
            readOnly
            rows={filename ? 5 : 3}
            value={text}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
      <span className="sr-only" role="status">
        {copied ? "Copied to clipboard." : ""}
      </span>
    </div>
  );
}

function DraftBuilder({
  day,
  days,
  saved,
  onSave,
  name,
  onName,
  now,
  onMessage,
}: {
  day: string;
  days: Days;
  saved?: Draft;
  onSave: (draft: Draft) => void;
  name: string;
  onName: (name: string) => void;
  now: number;
  onMessage: (message: string) => void;
}) {
  const [picks, setPicks] = useState<EventId[]>(saved?.picks ?? []);
  const [captain, setCaptain] = useState<EventId | null>(
    saved?.captain ?? null,
  );
  const [filter, setFilter] = useState("All cards");
  const [error, setError] = useState("");
  useEffect(() => {
    if (saved) {
      setPicks(saved.picks);
      setCaptain(saved.captain);
      setError("");
    }
  }, [saved?.savedAt, saved?.captain, saved?.picks.join(",")]);
  const cards = useMemo(() => dailyCards(day), [day]);
  const freshPrices = useMemo(() => pricesFor(day, days), [day, days]);
  const unchanged =
    saved &&
    saved.picks.join(",") === picks.join(",") &&
    saved.captain === captain;
  const prices = unchanged ? saved.prices : freshPrices;
  const available = cards.filter(
    (e) => freshPrices[e.id]?.points != null,
  ).length;
  const maxScore = picks.reduce(
    (sum, id) => sum + (prices[id]?.points ?? 0) * (captain === id ? 2 : 1),
    0,
  );
  const toggle = (id: EventId) => {
    setError("");
    if (picks.includes(id)) {
      setPicks(picks.filter((p) => p !== id));
      if (captain === id) setCaptain(null);
    } else if (picks.length < 5) setPicks([...picks, id]);
  };
  const submit = () => {
    const savedAt = Date.now();
    if (!canDraft(day, savedAt)) {
      setError("Drafts have closed for this day. Open tomorrow’s draft.");
      return;
    }
    if (picks.length !== 5) {
      setError(
        `Pick ${5 - picks.length} more ${picks.length === 4 ? "card" : "cards"} to complete your team.`,
      );
      return;
    }
    if (!captain || !picks.includes(captain)) {
      setError(
        "Choose a Captain with the crown button on one of your five cards.",
      );
      return;
    }
    if (picks.some((id) => prices[id]?.points == null)) {
      setError(
        "Some cards need more history. Choose cards with a point value.",
      );
      return;
    }
    onSave({
      day,
      picks,
      captain,
      name: name.trim() || "Hamster fan",
      savedAt,
      prices,
    });
    onMessage("Draft saved on this device. You can edit it until 00:00 UTC.");
    setError("");
  };
  const shown = cards.filter(
    (e) =>
      filter === "All cards" ||
      (filter === "My picks" && picks.includes(e.id)) ||
      (filter === "Long shots" && (freshPrices[e.id]?.points ?? 0) >= 50),
  );
  return (
    <section aria-labelledby="draft-heading" id="draft-board">
      <div className="section-heading">
        <div>
          <h2 id="draft-heading">Tomorrow’s draft</h2>
          <p>
            {displayDay(day)} · #{dayNumber(day)} · Pick 5 of 12
          </p>
        </div>
        <div className="lock-timer">
          <Icon name="wheel" size={18} />
          <span>
            Locks in <strong>{countdown(dayStart(day), now)}</strong>
          </span>
        </div>
      </div>
      <div className="draft-layout">
        <div className="card-market">
          <div className="market-toolbar">
            <div className="filters" aria-label="Filter draft cards">
              {["All cards", "My picks", "Long shots"].map((f) => (
                <button
                  type="button"
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="muted small">Rarer hits, bigger points.</span>
          </div>
          {picks.length === 5 && (
            <button
              className="button secondary mobile-review"
              type="button"
              onClick={() => {
                const heading = document.getElementById("team-heading");
                heading?.scrollIntoView({ block: "start" });
                heading?.focus({ preventScroll: true });
              }}
            >
              Five picked. Review your team <Icon name="arrow" />
            </button>
          )}
          <div className="event-grid">
            {shown.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                price={prices[event.id]}
                selected={picks.includes(event.id)}
                captain={captain === event.id}
                full={picks.length === 5}
                onPick={() => toggle(event.id)}
                onCaptain={() => {
                  setCaptain(event.id);
                  setError("");
                }}
              />
            ))}
          </div>
          {shown.length === 0 && (
            <Notice>
              {filter === "My picks"
                ? "Your team is waiting. Pick five cards from All cards."
                : "No long shots in this pack."}
              <button
                type="button"
                className="text-link"
                onClick={() => setFilter("All cards")}
              >
                Show all cards
              </button>
            </Notice>
          )}
          <p className="pricing-note">
            Hit rates use confirmed results from the seven days before today.
            Each card shows its available sample. Missing history is excluded,
            never counted as a miss. Points freeze when you save.
          </p>
        </div>
        <aside className="team-slip" aria-labelledby="team-heading">
          <div className="slip-heading">
            <h3 id="team-heading" tabIndex={-1}>
              Your starting five
            </h3>
            <span className="pick-count">{picks.length}/5</span>
          </div>
          <p className="small muted">
            Pick your cards. Crown one Captain for double points.
          </p>
          <ol className="roster-slots">
            {Array.from({ length: 5 }, (_, i) => {
              const id = picks[i],
                event = id ? eventById(id)! : null;
              return (
                <li key={id ?? i} className={id ? "filled-slot" : "empty-slot"}>
                  <span className="slot-number">{i + 1}</span>
                  {event ? (
                    <>
                      <span className="slot-name">
                        {event.name}
                        {captain === id && (
                          <span className="small captain-label">
                            Captain ×2
                          </span>
                        )}
                      </span>
                      <strong>
                        {(prices[id]?.points ?? 0) * (captain === id ? 2 : 1)}
                      </strong>
                      <button
                        className="slot-crown"
                        type="button"
                        onClick={() => setCaptain(id)}
                        aria-label={`Captain ${event.name}`}
                        aria-pressed={captain === id}
                      >
                        <Icon name="crown" size={18} />
                      </button>
                    </>
                  ) : (
                    <span>Open spot</span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="potential">
            <span>Possible points</span>
            <strong>{maxScore}</strong>
          </div>
          <button
            className="button primary save-draft"
            type="button"
            onClick={submit}
          >
            {unchanged ? (
              <>
                <Icon name="check" />
                Draft saved
              </>
            ) : (
              <>
                Save tomorrow’s team <Icon name="arrow" />
              </>
            )}
          </button>
          <p className="form-message" role="status">
            {error ||
              (unchanged
                ? "Saved here. Edit any time before lock."
                : `${picks.length}/5 picked${captain ? " · Captain chosen" : " · Choose a Captain"}`)}
          </p>
          <label className="name-field" htmlFor="display-name">
            Your display name <span className="small muted">(optional)</span>
            <input
              id="display-name"
              name="display-name"
              autoComplete="nickname"
              value={name}
              maxLength={32}
              onChange={(e) =>
                onName([...e.target.value].slice(0, 16).join(""))
              }
              placeholder="Hamster fan"
            />
          </label>
          {unchanged && (
            <div className="rival-share">
              <ShareControl
                key={saved.savedAt}
                text={
                  new URL(
                    encodeRival({ ...saved, name: name.trim() || saved.name }),
                    location.href,
                  ).href
                }
                label="Copy rival link"
              />
              <p className="small muted">
                Send a friend your roster. Rival links carry no proof of when a
                team was drafted.
              </p>
            </div>
          )}
          {available < 5 && (
            <Notice>
              {available === 0
                ? "Waiting for confirmed wheel history. You can browse today’s pack."
                : "More confirmed history is needed to price five cards."}
            </Notice>
          )}
          <div className="slip-foot">
            <Icon name="sun" size={18} /> Real hamster. Real results.
          </div>
        </aside>
      </div>
    </section>
  );
}

function Watches({ day, days }: { day: string; days: Days }) {
  return (
    <div className="watches" aria-label={`Watches for ${day}`}>
      {bucketsFor(days, day).map((b, i) => (
        <div
          key={i}
          className={`watch ${b?.rounds ? "active-watch" : b && b.complete !== false ? "rest-watch" : "unknown-watch"}`}
        >
          <span className="watch-symbol">
            <Icon name={b?.rounds ? "wheel" : "sun"} size={18} />
          </span>
          <strong>{WATCHES[i]}</strong>
          <span className="small">
            {String(i * 6).padStart(2, "0")}–
            {String((i + 1) * 6).padStart(2, "0")} UTC
          </span>
          <span className="small">
            {b?.complete === false
              ? `${number(b.work)} work · In progress`
              : b ? b.rounds > 0 ? `${number(b.work)} work` : "Rested" : "Not settled"}
          </span>
        </div>
      ))}
    </div>
  );
}

function LiveView({
  today,
  days,
  draft,
  onDraft,
  lost,
}: {
  today: string;
  days: Days;
  draft?: Draft;
  onDraft: () => void;
  lost: boolean;
}) {
  const buckets = bucketsFor(days, today);
  return (
    <section aria-labelledby="live-heading">
      <div className="section-heading">
        <div>
          <h2 id="live-heading">Today on the wheel</h2>
          <p>
            {displayDay(today)} · Game #{dayNumber(today)} · Drafts closed at
            00:00 UTC
          </p>
        </div>
        <span className="status-tag">
          {lost ? "Signal lost" : "Watching the wheel"}
        </span>
      </div>
      <div className="daily-stats">
        <div>
          <span>Confirmed work</span>
          <strong>
            {buckets.some(Boolean) ? number(total(buckets)) : "—"}
          </strong>
        </div>
        <div>
          <span>Active rounds</span>
          <strong>
            {buckets.some(Boolean) ? number(total(buckets, "rounds")) : "—"}
          </strong>
        </div>
        <div>
          <span>Completed blocks</span>
          <strong>
            {buckets.some(Boolean) ? number(total(buckets, "blocks")) : "—"}
          </strong>
        </div>
      </div>
      <Watches day={today} days={days} />
      <p className="muted small">
        Work in progress can confirm a hit. Only finished watches can confirm
        rest; an unsettled zero is unknown.
      </p>
      {draft ? (
        <>
          <div className="section-heading compact-heading">
            <h3>Your team is in play</h3>
            <strong>
              {rosterScore(draft, days, draft.prices)} points confirmed
            </strong>
          </div>
          <div className="live-roster">
            {draft.picks.map((id) => (
              <EventCard
                key={id}
                event={eventById(id)!}
                price={draft.prices[id]}
                captain={draft.captain === id}
                outcome={rosterOutcomes(draft, days)[draft.picks.indexOf(id)]}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <HamsterMark />
          <h3>No team for today</h3>
          <p>
            Today’s draft is closed. Start with tomorrow’s pack and come back to
            watch your picks play out.
          </p>
          <button className="button primary" onClick={onDraft}>
            Draft tomorrow <Icon name="arrow" />
          </button>
        </div>
      )}
    </section>
  );
}

function ResultReveal({
  result,
  revealed,
  onRevealed,
  best,
  streak,
}: {
  result: Scored;
  revealed: boolean;
  onRevealed: () => void;
  best: number;
  streak: number;
}) {
  const [count, setCount] = useState(revealed ? 5 : 0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || count >= 5) return;
    const timer = setTimeout(
      () => setCount((c) => c + 1),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 650,
    );
    return () => clearTimeout(timer);
  }, [playing, count]);
  useEffect(() => {
    if (count === 5 && !revealed) onRevealed();
  }, [count, revealed, onRevealed]);
  return (
    <div className="result-reveal">
      <div className="reveal-intro">
        <h3>
          {count === 5
            ? "The wheel has spoken."
            : "Five picks. One real hamster."}
        </h3>
        <p>
          {count === 5
            ? "A little luck. A lot of tiny legs."
            : "Your results are ready. Let’s turn them over."}
        </p>
        {count < 5 && (
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              onClick={() => setPlaying(true)}
              disabled={playing}
            >
              {playing ? "Turning your cards…" : "Reveal my result"}
              <Icon name="arrow" />
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => setCount(5)}
            >
              Reveal all
            </button>
          </div>
        )}
      </div>
      <div className="reveal-grid">
        {result.roster.picks.map((id, i) => (
          <div key={id} className={`flip-card ${i < count ? "flipped" : ""}`}>
            <div className="flip-inner">
              <div className="flip-back" aria-hidden={i < count}>
                <HamsterMark />
                <span>
                  Fantasy
                  <br />
                  Hamster
                </span>
                <span className="small">#{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="flip-front" aria-hidden={i >= count}>
                <CardArt id={id} />
                <strong>{eventById(id)!.name}</strong>
                <span>
                  {result.roster.captain === id ? "Captain ×2" : "Team pick"}
                </span>
                <span className="result-hit">
                  <Icon
                    name={result.outcomes[i] === "hit" ? "check" : "close"}
                  />
                  {result.outcomes[i] === "hit"
                    ? `Hit · +${(result.roster.prices[id]?.points ?? 0) * (result.roster.captain === id ? 2 : 1)}`
                    : "Miss · 0"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {count === 5 && (
        <div className="revealed-summary">
          <div className="result-stats">
            <div>
              <span>Final score</span>
              <strong>
                {result.score}
                <span> pts</span>
              </strong>
            </div>
            <div>
              <span>Personal best</span>
              <strong>
                {best}
                <span> pts</span>
              </strong>
            </div>
            <div>
              <span>Scoring streak</span>
              <strong>
                {streak}
                <span> {streak === 1 ? "day" : "days"}</span>
              </strong>
            </div>
          </div>
          <ShareControl
            text={resultText(result)}
            label="Copy result"
            filename="result"
          />
          <p className="small muted">
            Your scores and streak live on this browser. A streak counts
            consecutive days with more than zero points.
          </p>
        </div>
      )}
      <span className="sr-only" role="status">
        {count === 5
          ? `Final score ${result.score} points. Personal best ${best}. Scoring streak ${streak} days.`
          : `${count} of 5 cards revealed.`}
      </span>
    </div>
  );
}

function ResultsView({
  today,
  local,
  days,
  windowStart,
  onDraft,
  onRevealed,
}: {
  today: string;
  local: LocalState;
  days: Days;
  windowStart?: number;
  onDraft: () => void;
  onRevealed: (day: string) => void;
}) {
  const yesterday = addDays(today, -1);
  const [selected, setSelected] = useState(yesterday);
  const choices = [
    ...new Set([
      yesterday,
      ...Object.keys(local.drafts).filter((day) => day < today),
    ]),
  ]
    .sort()
    .reverse();
  const draft = local.drafts[selected],
    score = local.scores[selected];
  const expired =
    draft &&
    !score &&
    !isComplete(days, selected) &&
    windowStart !== undefined &&
    dayStart(addDays(selected, 1)) <= windowStart;
  const scores = Object.values(local.scores);
  const best = Math.max(0, ...scores.map((s) => s.score));
  let streak = 0;
  for (
    let day = yesterday;
    local.scores[day]?.score > 0;
    day = addDays(day, -1)
  )
    streak++;
  return (
    <section aria-labelledby="results-heading">
      <div className="section-heading">
        <div>
          <h2 id="results-heading">The daily reveal</h2>
          <p>Saved results stay here, even after the API moves on.</p>
        </div>
        <label className="select-label">
          Game day
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {choices.map((day) => (
              <option key={day} value={day}>
                {displayDay(day)} · #{dayNumber(day)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {score ? (
        <ResultReveal
          key={selected}
          result={score}
          revealed={local.revealed.includes(selected)}
          onRevealed={() => onRevealed(selected)}
          best={best}
          streak={streak}
        />
      ) : (
        <div className="empty-state">
          <HamsterMark />
          <h3>
            {expired
              ? "Result expired"
              : draft
                ? "Waiting for the full picture"
                : "Your first reveal is ahead"}
          </h3>
          <p>
            {expired
              ? "This day has left the API’s seven-day window and was never saved on this browser."
              : draft
                ? isComplete(days, selected)
                  ? "A selected event needs prior-day history that is not available. The game cannot invent a result."
                  : "The final watches have not been confirmed yet. Results appear once all the required data is available."
                : "Save tomorrow’s team today. After that game day ends, come back for your five-card reveal."}
          </p>
          <button className="button primary" type="button" onClick={onDraft}>
            Draft tomorrow <Icon name="arrow" />
          </button>
        </div>
      )}
      <details className="history-details">
        <summary>
          Past results on this browser <span>{scores.length}</span>
        </summary>
        {scores.length ? (
          <ul className="history-list">
            {scores
              .sort((a, b) => b.day.localeCompare(a.day))
              .map((s) => (
                <li key={s.day}>
                  <button type="button" onClick={() => setSelected(s.day)}>
                    <span>
                      {displayDay(s.day)} · #{dayNumber(s.day)}
                    </span>
                    <strong>
                      {s.score} points <Icon name="arrow" size={16} />
                    </strong>
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="muted">
            No scored days yet. Your first saved team starts the collection.
          </p>
        )}
      </details>
    </section>
  );
}

function RosterComparison({
  roster,
  days,
  prices,
  own = false,
  expired = false,
}: {
  roster: Roster;
  days: Days;
  prices: Prices;
  own?: boolean;
  expired?: boolean;
}) {
  const outcomes = rosterOutcomes(roster, days);
  const missingPrice = roster.picks.some((id) => prices[id]?.points == null);
  return (
    <div className="comparison-roster">
      <div className="comparison-heading">
        <h3>{own ? "You" : <bdi>{roster.name}</bdi>}</h3>
        <strong>
          {expired
            ? "Result expired"
            : missingPrice
              ? "Unpriced"
              : `${rosterScore(roster, days, prices)} pts`}
        </strong>
      </div>
      <ol>
        {roster.picks.map((id, i) => (
          <li key={id}>
            <CardArt id={id} />
            <span>
              {eventById(id)!.name}
              {roster.captain === id && <small>Captain ×2</small>}
            </span>
            <span className={`comparison-outcome ${outcomes[i]}`}>
              {expired ? (
                "Expired"
              ) : outcomes[i] === "hit" ? (
                <>
                  <Icon name="check" size={16} /> Hit
                </>
              ) : outcomes[i] === "miss" ? (
                <>
                  <Icon name="close" size={16} /> Miss
                </>
              ) : outcomes[i] === "unavailable" ? (
                "Unknown"
              ) : (
                "In play"
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RivalsView({
  today,
  incoming,
  invalid,
  local,
  days,
  windowStart,
  onAdd,
  onDraft,
}: {
  today: string;
  incoming: Roster | null;
  invalid: boolean;
  local: LocalState;
  days: Days;
  windowStart?: number;
  onAdd: (r: Roster) => void;
  onDraft: () => void;
}) {
  const [day, setDay] = useState(incoming?.day ?? today);
  useEffect(() => {
    if (incoming) setDay(incoming.day);
  }, [incoming]);
  const own = local.drafts[day];
  const publicPrices = useMemo(() => pricesFor(day, days), [day, days]);
  const rivals = local.rivals[day] ?? [];
  const known =
    incoming && rivals.some((r) => encodeRival(r) === encodeRival(incoming));
  const expired =
    !isComplete(days, day) &&
    windowStart !== undefined &&
    dayStart(addDays(day, 1)) <= windowStart;
  const ranked = [
    ...(own ? [{ roster: own as Roster, prices: own.prices, own: true }] : []),
    ...rivals.map((roster) => ({ roster, prices: publicPrices, own: false })),
  ]
    .map((entry) => ({
      ...entry,
      score:
        entry.roster.picks.some((id) => entry.prices[id]?.points == null) ||
        expired
          ? null
          : rosterScore(entry.roster, days, entry.prices),
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const choices = [
    ...new Set([
      today,
      addDays(today, 1),
      day,
      ...Object.keys(local.rivals),
      ...Object.keys(local.drafts),
    ]),
  ]
    .sort()
    .reverse();
  return (
    <section aria-labelledby="rivals-heading">
      <div className="section-heading">
        <div>
          <h2 id="rivals-heading">Tiny paws. Friendly rivalry.</h2>
          <p>Shared rosters, scored with public wheel data.</p>
        </div>
        <label className="select-label">
          Game day
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {choices.map((d) => (
              <option key={d} value={d}>
                {displayDay(d)} · #{dayNumber(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {invalid && (
        <Notice>
          This rival link is invalid. Ask your friend to copy a new link from
          their saved draft.
        </Notice>
      )}
      {incoming && incoming.day === day && (
        <>
          <div className="rival-invite">
            <div>
              <h3>
                <bdi>{incoming.name}</bdi> brought a team.
              </h3>
              <p className="small">
                {displayDay(incoming.day)} · Shared roster. Draft timing is
                unverified.
              </p>
            </div>
            <button
              className="button primary"
              type="button"
              disabled={!!known || rivals.length >= 20}
              onClick={() => onAdd(incoming)}
            >
              {known ? (
                <>
                  <Icon name="check" />
                  Rival added
                </>
              ) : (
                "Add rival"
              )}
            </button>
          </div>
          <div className="head-to-head">
            {own ? (
              <RosterComparison
                roster={own}
                prices={own.prices}
                days={days}
                own
                expired={expired}
              />
            ) : (
              <div className="comparison-empty">
                <h3>You have no team for this day</h3>
                <p>
                  {day > today
                    ? "Save your five picks to join the matchup."
                    : "Drafts for this day have closed. You can still follow your rival’s cards."}
                </p>
                <button className="button secondary" onClick={onDraft}>
                  Draft tomorrow
                </button>
              </div>
            )}
            <RosterComparison
              roster={incoming}
              prices={publicPrices}
              days={days}
              expired={expired}
            />
          </div>
        </>
      )}
      <div className="local-ranking">
        <h3>The local leaderboard</h3>
        <p className="small muted">
          Only rivals you add on this browser appear here. Your saved prices
          stay fixed; rivals use the history available here. Live scores are
          provisional.
        </p>
        {ranked.length ? (
          <ol className="ranking-list">
            {ranked.map((entry, i) => (
              <li key={`${entry.roster.name}-${entry.roster.picks.join(",")}`}>
                <span className="rank-number">
                  {entry.score === null ? "·" : i + 1}
                </span>
                <span>
                  <bdi>{entry.own ? "You" : entry.roster.name}</bdi>
                  <small>
                    {entry.own
                      ? "Saved before lock"
                      : "Shared roster · timing unverified"}
                  </small>
                </span>
                <strong>
                  {entry.score === null
                    ? expired
                      ? "Expired"
                      : "Unpriced"
                    : `${entry.score} pts`}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <div className="inline-empty">
            <Icon name="link" size={28} />
            <p>
              Save a draft, copy your rival link, and send it to a friend. Open
              their link to add their team here.
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={onDraft}
            >
              Build your team <Icon name="arrow" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Overlay({
  days,
  local,
  now,
  state,
  rpm,
  incoming,
  windowStart,
  statusFeed,
  resultsFeed,
}: {
  days: Days;
  local: LocalState;
  now: number;
  state: "running" | "sleeping" | "confused";
  rpm: number;
  incoming: Roster | null;
  windowStart?: number;
  statusFeed: { error: string | null; lastGood: number | null; loading: boolean; data: { coreStatus: string } | null };
  resultsFeed: { error: string | null; lastGood: number | null };
}) {
  const today = dayKey(now);
  const draft =
    incoming ?? local.drafts[today] ?? local.drafts[addDays(today, 1)];
  const prices = draft
    ? "prices" in draft
      ? (draft.prices as Prices)
      : pricesFor(draft.day, days)
    : {};
  const expired =
    !!draft &&
    !isComplete(days, draft.day) &&
    windowStart !== undefined &&
    dayStart(addDays(draft.day, 1)) <= windowStart;
  const lost = !!(statusFeed.error || resultsFeed.error);
  const received = (time: number | null) => time ? utcTime(time) : "never on this visit";
  const caption = lost
    ? `Signal lost · ${[
        resultsFeed.error ? `results last received ${received(resultsFeed.lastGood)}` : "",
        statusFeed.error ? `status last received ${received(statusFeed.lastGood)}` : "",
      ].filter(Boolean).join(" · ")}`
    : statusFeed.data?.coreStatus === "COUNTER_FAULT"
      ? "Counter fault"
      : state === "confused"
        ? statusFeed.loading ? "Connecting to wheel" : "Wheel measurement stale"
        : expired ? "Result expired"
          : draft && draft.day > today ? "Tomorrow’s team"
            : state === "running" ? "On the wheel" : "Resting up";
  useEffect(() => {
    document.documentElement.classList.add("overlay-mode");
    return () => document.documentElement.classList.remove("overlay-mode");
  }, []);
  return (
    <main className="obs-overlay" aria-label="Fantasy Hamster stream overlay">
      <div className={`overlay-hamster ${lost ? "signal-lost" : ""}`}>
        <Hamster state={state} rpmMilli={rpm} />
        <strong>Fantasy Hamster</strong>
        <span className="small">
          Game #{dayNumber(draft?.day ?? today)} ·{" "}
          {caption}
        </span>
        {resultsFeed.error && <span className="small">Card outcomes are last-known.</span>}
      </div>
      <div className="overlay-cards">
        {draft ? (
          draft.picks.map((id) => (
            <EventCard
              key={id}
              event={eventById(id)!}
              price={prices[id]}
              captain={draft.captain === id}
              outcome={
                expired
                  ? "unavailable"
                  : rosterOutcomes(draft, days)[draft.picks.indexOf(id)]
              }
              compact
            />
          ))
        ) : (
          <p className="overlay-empty">
            No saved team for today. Draft tomorrow’s five in the main game.
          </p>
        )}
      </div>
    </main>
  );
}

function HelpDialog({
  dialogRef,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="help-dialog"
      aria-labelledby="help-title"
    >
      <div className="dialog-heading">
        <h2 id="help-title">A very small fantasy league.</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Close how to play"
          onClick={() => dialogRef.current?.close()}
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        Squeektoshi is a real hamster. His wheel powers Squeekchain’s proof of
        work. You predict his next day.
      </p>
      <ol className="how-to-list">
        <li>
          <strong>Draft five.</strong> Choose five of tomorrow’s twelve event
          cards before 00:00 UTC.
        </li>
        <li>
          <strong>Crown one.</strong> Your Captain earns double points when its
          event hits.
        </li>
        <li>
          <strong>Meet the hamster.</strong> Real wheel data settles the cards.
          Come back for your reveal.
        </li>
      </ol>
      <h3>Every watch counts</h3>
      <p>
        A UTC day has four six-hour watches. A watch is active when it has at
        least one active round. Live cards resolve only from finished watches,
        or when a result is already certain.
      </p>
      <h3>Small sample, honest odds</h3>
      <p>
        Points = clamp(round(10 / max(hit rate, 0.1)), 10, 100). History uses
        the last seven complete days before the draft day. We show the number of
        known results, skip missing days, and leave a card unpriced if none are
        known. Your saved prices stay fixed.
      </p>
      <p className="muted small">
        Everything is saved locally. Clearing browser data clears your teams,
        results and rivals. Rival links can be edited and do not prove when a
        team was chosen.
      </p>
      <button
        type="button"
        className="button primary"
        onClick={() => dialogRef.current?.close()}
      >
        Got it. Let’s draft. <Icon name="arrow" />
      </button>
    </dialog>
  );
}

export default function App() {
  const [loaded] = useState(() => {
    try {
      return readState(localStorage);
    } catch {
      return { state: emptyState(), failed: true };
    }
  });
  const [local, setLocal] = useState<LocalState>(loaded.state);
  const persisted = useRef(loaded.state);
  const [storageFailed, setStorageFailed] = useState(loaded.failed);
  const [view, setView] = useState<View>(getView);
  const [hash, setHash] = useState(location.hash);
  const [message, setMessage] = useState("");
  const [paused, setPaused] = useState(false);
  const helpRef = useRef<HTMLDialogElement>(null);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const now = useClock(),
    today = dayKey(now),
    tomorrow = addDays(today, 1);
  const status = useFeed("status", 20_000, parseStatusFeed);
  const settlements = useFeed(
    "settlements?range=7d",
    300_000,
    parseSettlementsFeed,
  );
  const days = useMemo(
    () => mergeDays(local.days, settlements.data?.days ?? {}),
    [local.days, settlements.data],
  );
  const hamsterState = wheelState(status.data, now, !!status.error);
  const overlay = new URLSearchParams(location.search).get("overlay") === "1";
  const incoming = useMemo(() => decodeRival(hash), [hash]);
  useEffect(() => {
    const change = () => {
      setView(getView());
      setHash(location.hash);
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const fresh = settlements.data;
    if (!fresh) return;
    setLocal((previous) => {
      const nextDays = mergeDays(previous.days, fresh.days);
      const scores = { ...previous.scores };
      for (const draft of Object.values(previous.drafts)) {
        if (!isComplete(nextDays, draft.day)) continue;
        const outcomes = rosterOutcomes(draft, nextDays);
        if (outcomes.some((o) => o !== "hit" && o !== "miss")) continue;
        scores[draft.day] = {
          day: draft.day,
          roster: draft,
          score: rosterScore(draft, nextDays, draft.prices),
          outcomes,
        };
      }
      return { ...previous, days: nextDays, scores };
    });
  }, [settlements.data]);
  useEffect(() => {
    let cancelled = false;
    const save = () => {
      if (cancelled) return;
      try {
        const result = persistState(localStorage, local, persisted.current);
        setStorageFailed(result.failed);
        if (result.failed) return;
        persisted.current = result.state;
        setLocal((current) => {
          const merged = mergeState(local, current, result.state);
          return JSON.stringify(merged) === JSON.stringify(current) ? current : merged;
        });
      } catch {
        setStorageFailed(true);
      }
    };
    // Serialize simultaneous saves on browsers supporting Web Locks. The
    // fallback still re-reads and merges the latest state before every write.
    if (navigator.locks) void navigator.locks.request(STORAGE_KEY, save).catch(() => setStorageFailed(true));
    else save();
    return () => { cancelled = true; };
  }, [local]);
  useEffect(() => {
    const sync = () => {
      try {
        const result = readState(localStorage);
        if (result.failed) { setStorageFailed(true); return; }
        setLocal((current) => {
          const merged = mergeState(persisted.current, current, result.state);
          return JSON.stringify(merged) === JSON.stringify(current) ? current : merged;
        });
      } catch { setStorageFailed(true); }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync();
    };
    const visible = () => { if (!document.hidden) sync(); };
    addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visible);
    return () => {
      removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    const dialog = helpRef.current;
    const restore = () => helpTrigger.current?.focus();
    dialog?.addEventListener("close", restore);
    return () => dialog?.removeEventListener("close", restore);
  }, []);
  const navigate = (next: View) => {
    location.hash = next;
    setView(next);
  };
  const onDraft = () => {
    navigate("draft");
    setTimeout(
      () =>
        document
          .getElementById("draft-heading")
          ?.scrollIntoView({ block: "start", behavior: "instant" }),
      0,
    );
  };
  const saveDraft = (draft: Draft) =>
    setLocal((s) => ({ ...s, drafts: { ...s.drafts, [draft.day]: draft } }));
  const onReveal = (day: string) =>
    setLocal((s) =>
      s.revealed.includes(day) ? s : { ...s, revealed: [...s.revealed, day] },
    );
  const addRival = (r: Roster) =>
    setLocal((s) => {
      const previous = s.rivals[r.day] ?? [];
      if (
        previous.length >= 20 ||
        previous.some((p) => encodeRival(p) === encodeRival(r))
      )
        return s;
      setMessage(`${r.name} added to this day’s local rivals.`);
      return { ...s, rivals: { ...s.rivals, [r.day]: [...previous, r] } };
    });
  if (overlay)
    return (
      <Overlay
        days={days}
        local={local}
        now={now}
        state={hamsterState}
        rpm={status.data?.rpmMilli ?? 0}
        incoming={incoming}
        windowStart={settlements.data?.windowStart}
        statusFeed={status}
        resultsFeed={settlements}
      />
    );
  const lastSeen = status.data?.observedAt;
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to game
      </a>
      <header className="site-header">
        <a className="brand" href="#draft" aria-label="Fantasy Hamster home">
          <HamsterMark />
          <span>
            Fantasy Hamster
            <span className="brand-subtitle">The Squeekchain daily game</span>
          </span>
        </a>
        <div className="header-actions">
          <span className="local-note">
            <span className="tiny-dot" /> Just for the fun of it
          </span>
          <button
            ref={helpTrigger}
            className="help-button"
            type="button"
            aria-label="How to play"
            onClick={() => helpRef.current?.showModal()}
          >
            <Icon name="help" />
            <span>How to play</span>
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="page-shell">
        <section className="intro" aria-labelledby="hero-title">
          <div className="intro-copy">
            <h1 id="hero-title">
              Small paws.
              <br />
              <span>Big predictions.</span>
            </h1>
            <p>Pick tomorrow’s five. A real hamster decides the score.</p>
            <a
              href="#draft"
              className="intro-link"
              onClick={() => {
                if (view === "draft")
                  document
                    .getElementById("draft-heading")
                    ?.scrollIntoView({ behavior: "instant" });
              }}
            >
              Draft tomorrow <Icon name="arrow" />
            </a>
          </div>
          <div className="hamster-home">
            <div className="hamster-illustration">
              <Hamster
                state={hamsterState}
                rpmMilli={status.data?.rpmMilli ?? 0}
                paused={paused}
              />
              <button
                type="button"
                className="motion-toggle"
                aria-label={
                  paused ? "Play hamster animation" : "Pause hamster animation"
                }
                aria-pressed={paused}
                onClick={() => setPaused((p) => !p)}
              >
                <Icon name={paused ? "play" : "pause"} size={16} />
              </button>
            </div>
            <div className="hamster-caption">
              <span className={`status-dot ${hamsterState}`} />
              <div>
                <strong>
                  {hamsterState === "sleeping"
                    ? "Squeektoshi is off the clock."
                    : hamsterState === "running"
                      ? "Squeektoshi is on a roll."
                      : status.loading
                        ? "Finding Squeektoshi…"
                        : "Waiting for Squeektoshi’s signal."}
                </strong>
                <span>
                  {hamsterState === "sleeping"
                    ? "Dreaming of a personal best."
                    : hamsterState === "running"
                      ? `${number((status.data?.rpmMilli ?? 0) / 1000)} RPM. Tiny legs, serious business.`
                      : lastSeen
                        ? `Last observed ${utcTime(lastSeen)}`
                        : "Connecting to the real wheel."}
                </span>
              </div>
            </div>
          </div>
          <div className="intro-stamp" aria-hidden="true">
            <Icon name="crown" size={28} />
            <span>
              One hamster.
              <br />
              Endless potential.
            </span>
          </div>
        </section>
        <nav className="game-nav" aria-label="Game views">
          {(
            [
              ["draft", "Tomorrow", "Draft"],
              ["live", "Today", "Live"],
              ["results", "Yesterday", "Results"],
              ["rivals", "Rivals", "Local"],
            ] as const
          ).map(([key, title, sub]) => (
            <a
              key={key}
              href={`#${key}`}
              aria-current={view === key ? "page" : undefined}
              onClick={() => setView(key)}
            >
              <span>{title}</span>
              <span className="nav-sub">
                {sub}
                {key === "draft" && local.drafts[tomorrow] && (
                  <Icon name="check" size={14} />
                )}
                {key === "live" && <span className="nav-live-dot" />}
              </span>
            </a>
          ))}
        </nav>
        {(status.error || settlements.error) && (
          <div className="signal-notice" role="status">
            <div>
              <strong>
                Signal lost
                {status.error === "Rate limited" ||
                settlements.error === "Rate limited"
                  ? " · API rate limit"
                  : ""}
              </strong>
              <p>
                {settlements.error
                  ? `Wheel results last received ${settlements.lastGood ? utcTime(settlements.lastGood) : "never on this visit"}. `
                  : ""}
                {status.error
                  ? `Status last received ${status.lastGood ? utcTime(status.lastGood) : "never on this visit"}. `
                  : ""}
                {Math.max(status.retryAt ?? 0, settlements.retryAt ?? 0) > now
                  ? `Retrying after ${utcTime(Math.max(status.retryAt ?? 0, settlements.retryAt ?? 0))}.`
                  : "Showing only last-known data."}
              </p>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                if (status.error) status.retry();
                if (settlements.error) settlements.retry();
              }}
              disabled={
                Math.max(status.retryAt ?? 0, settlements.retryAt ?? 0) > now
              }
            >
              Retry signal
            </button>
          </div>
        )}
        {storageFailed && (
          <Notice>
            Browser storage is unavailable or a saved file could not be read.
            Existing unreadable data is preserved. Teams may be kept only for
            this visit. Allow site storage before relying on tomorrow’s result.
          </Notice>
        )}
        <div className="announcement" role="status">
          {message}
        </div>
        {view === "draft" && (
          <DraftBuilder
            key={tomorrow}
            day={tomorrow}
            days={days}
            saved={local.drafts[tomorrow]}
            onSave={saveDraft}
            name={local.name}
            onName={(name) => setLocal((s) => ({ ...s, name }))}
            now={now}
            onMessage={setMessage}
          />
        )}
        {view === "live" && (
          <LiveView
            today={today}
            days={days}
            draft={local.drafts[today]}
            onDraft={onDraft}
            lost={!!settlements.error}
          />
        )}
        {view === "results" && (
          <ResultsView
            today={today}
            days={days}
            local={local}
            windowStart={settlements.data?.windowStart}
            onDraft={onDraft}
            onRevealed={onReveal}
          />
        )}
        {view === "rivals" && (
          <RivalsView
            today={today}
            incoming={incoming}
            invalid={hash.startsWith("#rival=") && !incoming}
            local={local}
            days={days}
            windowStart={settlements.data?.windowStart}
            onAdd={addRival}
            onDraft={onDraft}
          />
        )}
        <section className="how-it-works" aria-labelledby="how-heading">
          <h2 id="how-heading">A little daily ritual.</h2>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Draft five.</h3>
                <p>Pick five of tomorrow’s twelve cards before 00:00 UTC.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Crown one.</h3>
                <p>Make one your Captain. A hit earns double points.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Trust the tiny legs.</h3>
                <p>The real wheel scores your team. Return for the reveal.</p>
              </div>
            </li>
          </ol>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          <HamsterMark />
          <strong>See you at the wheel.</strong>
        </div>
        <p>
          Fan-made game for Squeekchain. No real money. Data from
          api.squeekchain.com
        </p>
        <div className="footer-meta">
          <span>All times UTC · Saved on this device</span>
          <a
            href={`?overlay=1${local.drafts[today] || local.drafts[tomorrow] ? encodeRival(local.drafts[today] ?? local.drafts[tomorrow]) : ""}`}
            className="text-link"
          >
            Stream overlay <Icon name="arrow" size={16} />
          </a>
        </div>
      </footer>
      <HelpDialog dialogRef={helpRef} />
    </>
  );
}
