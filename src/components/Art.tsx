import type { CSSProperties } from "react";
import type { EventId } from "../core/catalog";

export function Icon({
  name,
  size = 20,
}: {
  name:
    | "arrow"
    | "check"
    | "close"
    | "crown"
    | "copy"
    | "link"
    | "sun"
    | "wheel"
    | "help"
    | "pause"
    | "play";
  size?: number;
}) {
  const paths = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    crown: (
      <>
        <path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z" />
        <path d="M7 22h10" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    link: (
      <>
        <path
          d="m10 14 4-4m-6 5-2 2a4 4 0 0 1-5-5l4-4a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 5l-4 4a4 4 0 0 1-6 0"
          transform="translate(1 -1)"
        />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    wheel: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 3v7m0 4v7M3 12h7m4 0h7m-8-1 5-5m-7 7-5 5m5-7L6 6m7 7 5 5" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" />
      </>
    ),
    pause: (
      <>
        <path d="M9 5v14M15 5v14" />
      </>
    ),
    play: <path d="m7 4 13 8-13 8V4Z" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function PixelHamster({
  sleeping = false,
  confused = false,
}: {
  sleeping?: boolean;
  confused?: boolean;
}) {
  return (
    <g className="pixel-hamster" shapeRendering="crispEdges">
      <path
        d="M3 14h4V8h5V4h7v4h10V4h7v6h4v5h4v15h-5v5H11v-4H5v-8H3Z"
        fill="var(--ink)"
      />
      <path d="M8 14h4V9h8v4h9V9h7v7h4v12h-6v4H13v-5H8Z" fill="#dba36a" />
      <path d="M13 11h4v4h-4zm18 0h3v4h-3z" fill="#e9b5a3" />
      <path d="M13 25h4v-4h16v4h3v7H13Z" fill="#fff7e5" />
      {sleeping ? (
        <>
          <path d="M15 19h5v2h-5zm13 0h5v2h-5z" fill="var(--ink)" />
          <path d="M22 25h5v2h-5z" fill="var(--ink)" />
        </>
      ) : (
        <>
          <path
            d="M16 18h3v4h-3zm13 0h3v4h-3zM23 24h4v3h-4z"
            fill="var(--ink)"
          />
          <path d="M17 18h1v1h-1zm13 0h1v1h-1z" fill="#fff7e5" />
        </>
      )}
      <path d="M13 33h7v4h-7zm16 0h7v4h-7z" fill="var(--ink)" />
      <path d="M13 25h5v3h-5zm18 0h5v3h-5z" fill="#d88c77" />
      {confused && (
        <g fill="var(--ink)">
          <path d="M44 3h8v3h-8zm5 3h3v5h-3zm-4 5h5v3h-5zm0 6h4v4h-4z" />
        </g>
      )}
    </g>
  );
}
export function HamsterMark() {
  return (
    <svg
      className="hamster-mark"
      width="48"
      height="44"
      viewBox="0 0 48 42"
      aria-hidden="true"
    >
      <PixelHamster />
    </svg>
  );
}
export function Hamster({
  state,
  rpmMilli,
  paused = false,
}: {
  state: "running" | "sleeping" | "confused";
  rpmMilli: number;
  paused?: boolean;
}) {
  const duration = Math.max(
    0.3,
    Math.min(8, 60 / Math.max(rpmMilli / 1000, 1)),
  );
  return (
    <svg
      className={`hamster-scene ${state} ${paused ? "paused" : ""}`}
      viewBox="0 0 320 205"
      role="img"
      aria-label={
        state === "sleeping"
          ? "Squeektoshi curled up asleep on his wheel"
          : state === "running"
            ? "Squeektoshi running on his wheel"
            : "Squeektoshi waiting for a fresh wheel signal"
      }
      style={{ "--wheel-speed": `${duration}s` } as CSSProperties}
    >
      <path d="M29 181h266" stroke="var(--ink)" strokeWidth="3" />
      <path
        d="M117 181 139 137h44l27 44"
        fill="var(--paper-deep)"
        stroke="var(--ink)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle
        cx="161"
        cy="88"
        r="76"
        fill="var(--paper)"
        stroke="var(--ink)"
        strokeWidth="4"
      />
      <g
        className="wheel-spokes"
        style={{ transformOrigin: "161px 88px" }}
        stroke="var(--paper-line)"
        strokeWidth="3"
      >
        <path d="M161 16v144M89 88h144m-123-51 102 102m0-102L110 139" />
        <circle cx="161" cy="88" r="63" fill="none" strokeDasharray="3 9" />
      </g>
      <circle
        cx="161"
        cy="88"
        r="8"
        fill="var(--accent)"
        stroke="var(--ink)"
        strokeWidth="3"
      />
      <g
        className="hamster-body"
        transform={
          state === "sleeping"
            ? "translate(118 114) scale(1.6 1.1)"
            : "translate(121 106) scale(1.6)"
        }
      >
        <PixelHamster
          sleeping={state === "sleeping"}
          confused={state === "confused"}
        />
      </g>
      {state === "sleeping" && (
        <g
          className="sleep-symbols"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="3"
        >
          <path d="M225 48h12l-12 12h12m7-38h17l-17 17h17m-12 33h9l-9 9h9" />
        </g>
      )}
      <path
        d="M42 174v-15m-5 8h11m211 8v-12m-5 6h10"
        stroke="var(--ink)"
        strokeWidth="2"
      />
      <g fill="var(--accent)" stroke="var(--ink)" strokeWidth="2">
        <ellipse
          cx="65"
          cy="176"
          rx="6"
          ry="3"
          transform="rotate(-30 65 176)"
        />
        <ellipse
          cx="247"
          cy="178"
          rx="6"
          ry="3"
          transform="rotate(25 247 178)"
        />
      </g>
    </svg>
  );
}

/** Each catalog entry has an original, distinct little line illustration. */
export function CardArt({ id }: { id: EventId }) {
  const art: Record<EventId, React.ReactNode> = {
    "warm-up": (
      <>
        <path
          d="M28 65c-8-17 12-20 7-40 20 10 12 24 20 25 4-4 6-9 5-14 22 27 1 45-16 43-8 0-12-5-16-14Z"
          fill="var(--accent)"
        />
        <path d="M40 69c-5-7 5-11 6-19 12 13 7 23-1 23" fill="var(--paper)" />
        <path d="M17 21v10m-5-5h10m43-9v8m-4-4h8" />
      </>
    ),
    "five-figures": (
      <>
        <path d="M20 27h43v43H20z" fill="var(--paper-deep)" />
        <path d="M26 20h43v43H26z" fill="var(--paper)" />
        <path d="M36 31h20M36 39h20M36 47h12" />
        <circle cx="61" cy="68" r="13" fill="var(--accent)" />
        <path d="M61 60v16m-4-12h6m-6 8h8" />
      </>
    ),
    "big-legs": (
      <>
        <path
          d="m27 22 13 7-8 24 18 11-5 11-28-14 7-23zm26-1 13 5-5 25 12 14-7 9-23-22Z"
          fill="var(--accent)"
        />
        <path d="M14 75h28m8 4h23M24 16l4-7m12 8 8-5" />
      </>
    ),
    "20k-legend": (
      <>
        <path
          d="m45 12 10 20 22 3-16 16 4 23-20-11-20 11 4-23-16-16 22-3Z"
          fill="var(--accent)"
        />
        <path d="m32 43 9 9 17-20M9 12l5 8m61 0 5-8M7 62l9-3m60 0 9 3" />
      </>
    ),
    "clocked-in": (
      <>
        <rect x="19" y="27" width="50" height="48" rx="3" fill="var(--paper)" />
        <path d="M30 17h29v20H30z" fill="var(--accent)" />
        <path d="M36 14h17m-20 37 8 8 16-17M29 66h29" />
      </>
    ),
    overtime: (
      <>
        <circle cx="45" cy="45" r="29" fill="var(--paper)" />
        <path d="M45 23v24l14 9M39 9h12m-6 0v7" />
        <path d="m71 15 4-6m-1 18 8-3M19 70l-6 6" />
        <path d="M26 78h36" stroke="var(--accent)" strokeWidth="6" />
      </>
    ),
    "block-party": (
      <>
        <path d="m23 43 22-12 23 12v26L45 81 23 69Z" fill="var(--accent)" />
        <path d="m23 43 22 13 23-13M45 56v25M16 12l7 6m18-10v10m23-4-5 8m17 3-8 4" />
        <path d="m23 24 12-7-4 17Z" fill="var(--paper-deep)" />
      </>
    ),
    "block-bonanza": (
      <>
        <path
          d="m9 54 18-10 18 10v21L27 85 9 75Zm38 0 18-10 18 10v21L65 85 47 75ZM29 20 47 10l18 10v21L47 51 29 41Z"
          fill="var(--accent)"
        />
        <path d="m9 54 18 10 18-10m-18 10v20m20-30 18 10 18-10M65 64v20M29 20l18 10 18-10M47 30v21" />
      </>
    ),
    "dawn-patrol": (
      <>
        <path d="M14 59h64M23 49a23 23 0 0 1 46 0" />
        <path d="M26 50a20 20 0 0 1 40 0Z" fill="var(--accent)" />
        <path d="M46 12v9M14 29l8 5m47-1 8-6M22 69h49m-36 9h24" />
      </>
    ),
    "breakfast-run": (
      <>
        <path
          d="M19 36h44v26a18 18 0 0 1-18 16h-8a18 18 0 0 1-18-16Zm44 6h7a10 10 0 0 1 0 20h-7"
          fill="var(--paper)"
        />
        <path d="M15 80h56M31 24c-8-8 8-9 0-17m17 17c-8-8 8-9 0-17" />
        <path d="M26 44h29v12H26z" fill="var(--accent)" stroke="none" />
      </>
    ),
    "afternoon-jog": (
      <>
        <circle cx="46" cy="44" r="20" fill="var(--accent)" />
        <path d="M46 9v9m0 52v10M11 44h9m52 0h9M21 19l7 7m37 37 7 7M20 70l7-7m38-38 7-7" />
        <path d="M32 46h8m10 0h8m-19 9h14" />
      </>
    ),
    "night-shift": (
      <>
        <path
          d="M59 12c-28 9-30 44 1 55-31 13-57-23-36-46 9-10 23-13 35-9Z"
          fill="var(--accent)"
        />
        <path
          d="m69 33 3 7 8 1-6 5 2 8-7-4-6 4 1-8-5-5 7-1Zm-6 37v10m-5-5h10"
          fill="var(--paper-deep)"
        />
      </>
    ),
    "back-to-back": (
      <>
        <path
          d="m12 45 18-12 18 12-18 12Zm30 0 18-12 18 12-18 12Z"
          fill="var(--accent)"
        />
        <path d="M12 45v20l18 12 18-12V45m-18 12v20m12-32v20l18 12 18-12V45M60 57v20M25 17h37m-7-6 7 6-7 6" />
      </>
    ),
    "triple-shift": (
      <>
        <path
          d="M13 57h17v23H13Zm24-22h17v45H37Zm24-21h17v66H61Z"
          fill="var(--accent)"
        />
        <path d="m16 34 5-5 5 5m16-20 4-5 5 5M8 85h75" />
      </>
    ),
    "around-clock": (
      <>
        <circle cx="45" cy="45" r="30" fill="var(--accent)" />
        <circle cx="45" cy="45" r="21" fill="var(--paper)" />
        <path d="M45 30v17l11 7M45 9V3m0 84v-6M9 45H3m84 0h-6M19 19l-5-5m62 62-5-5M19 71l-5 5m62-62-5 5" />
      </>
    ),
    "one-big-run": (
      <>
        <path d="M15 66h13V39h16v27h13V22h17v44h6" />
        <path d="m49 19 15-10 15 10M16 77h63" />
        <path d="M57 27h17v39H57Z" fill="var(--accent)" />
        <circle cx="22" cy="28" r="6" fill="var(--paper-deep)" />
      </>
    ),
    "monster-session": (
      <>
        <path d="M20 70V31l13 10 13-25 14 25 13-10v39Z" fill="var(--accent)" />
        <path d="m28 52 9 4m20 0 8-4M36 67l5-5 5 5 5-5 5 5M15 77h64" />
        <path d="m10 24 6 5m61-17-4 9" />
      </>
    ),
    "even-split": (
      <>
        <path d="M45 15v61m-20 4h40M15 29h60M22 29 9 55h26Zm46 0L55 55h26Z" />
        <path
          d="M9 55a13 13 0 0 0 26 0Zm46 0a13 13 0 0 0 26 0Z"
          fill="var(--accent)"
        />
        <circle cx="45" cy="22" r="5" fill="var(--accent)" />
      </>
    ),
    "slow-burn": (
      <>
        <path d="M29 41h32v39H29Z" fill="var(--paper)" />
        <path d="M45 11c-17 16-12 25 0 25s17-9 0-25Z" fill="var(--accent)" />
        <path d="M45 36v9M21 81h48M35 50h8v8h-8M14 22l7 4m48 0 7-4" />
      </>
    ),
    "beauty-sleep": (
      <>
        <path d="M14 44h62v31H14z" fill="var(--paper-deep)" />
        <path d="M22 36h44v26H22z" fill="var(--paper)" />
        <path d="M14 75v8m62-8v8M29 26h10l-10 10h10M51 11h17L51 28h17" />
        <path d="M23 52c8-15 29-12 36 4H23Z" fill="var(--accent)" />
      </>
    ),
    "day-off": (
      <>
        <path
          d="M17 23h56M22 15v16m17-16v16m17-16v16m12-16v16M17 23v54h56V23"
          fill="var(--paper)"
        />
        <path d="M17 31h56v9H17Z" fill="var(--accent)" />
        <path d="m34 52 22 16m0-16L34 68" />
      </>
    ),
    "beat-yesterday": (
      <>
        <path
          d="M14 73V54h16v19m10 0V37h16v36m10 0V17h16v56"
          fill="var(--accent)"
        />
        <path d="M10 80h74M15 38l22-15 13 3L72 8m-12 0h12v12" />
      </>
    ),
    "personal-record": (
      <>
        <path
          d="M28 19h35v30a18 18 0 0 1-35 0Zm0 8H15v13c0 11 8 13 17 13m31-26h13v13c0 11-8 13-17 13M45 66v13M30 81h30"
          fill="var(--paper)"
        />
        <path
          d="m45 27 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z"
          fill="var(--accent)"
        />
        <path d="M13 13v8m-4-4h8m59 47v8m-4-4h8" />
      </>
    ),
  };
  return (
    <svg
      className="card-art"
      viewBox="0 0 92 92"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {art[id]}
    </svg>
  );
}
