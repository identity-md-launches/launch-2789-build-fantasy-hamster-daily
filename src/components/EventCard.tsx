import type { Event } from "../core/catalog";
import type { Outcome, Price } from "../core/game";
import { CardArt, Icon } from "./Art";

export function EventCard({
  event,
  price,
  selected = false,
  captain = false,
  onPick,
  onCaptain,
  full = false,
  outcome,
  compact = false,
}: {
  event: Event;
  price?: Price;
  selected?: boolean;
  captain?: boolean;
  onPick?: () => void;
  onCaptain?: () => void;
  full?: boolean;
  outcome?: Outcome;
  compact?: boolean;
}) {
  const unpriced = price?.points == null;
  return (
    <article
      className={`event-card ${selected ? "selected" : ""} ${captain ? "captain" : ""} ${outcome ?? ""} ${compact ? "compact" : ""}`}
    >
      <div className="card-top">
        <span>{event.category}</span>
        <strong className="card-points">
          {unpriced ? "?" : price.points}
          <span> pts{captain ? " ×2" : ""}</span>
        </strong>
      </div>
      <div className="card-picture">
        <CardArt id={event.id} />
        {captain && (
          <span className="captain-stamp">
            <Icon name="crown" />
            Captain
          </span>
        )}
      </div>
      <h3>{event.name}</h3>
      {!compact && <p className="card-description">{event.description}</p>}
      {!compact && (
        <p className="hit-rate">
          {price?.hitRate == null
            ? "History unavailable"
            : `${Math.round(price.hitRate * 100)}% hit rate · ${price.hits}/${price.sample} days`}
        </p>
      )}
      {onPick && (
        <div className="card-actions">
          <button
            type="button"
            className={`pick-button ${selected ? "is-picked" : ""}`}
            aria-pressed={selected}
            aria-label={`${selected ? "Remove" : "Pick"} ${event.name}`}
            disabled={!selected && (full || unpriced)}
            onClick={onPick}
          >
            {selected ? (
              <>
                <Icon name="check" size={16} /> Picked
              </>
            ) : (
              <>
                <span aria-hidden="true">+</span> Pick card
              </>
            )}
          </button>
          {selected && (
            <button
              type="button"
              className={`captain-button ${captain ? "is-captain" : ""}`}
              onClick={onCaptain}
              aria-pressed={captain}
              aria-label={`Make ${event.name} Captain`}
            >
              <Icon name="crown" size={18} />
            </button>
          )}
        </div>
      )}
      {outcome && (
        <div className={`outcome outcome-${outcome}`}>
          <Icon
            name={
              outcome === "hit"
                ? "check"
                : outcome === "miss"
                  ? "close"
                  : "wheel"
            }
            size={16}
          />
          {outcome === "hit"
            ? "Hit"
            : outcome === "miss"
              ? "Dead"
              : outcome === "unavailable"
                ? "History unavailable"
                : "In play"}
        </div>
      )}
    </article>
  );
}
