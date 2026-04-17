import type { Mood } from "../data/types";

interface Props {
  mood: Mood;
  size?: number;
  talk?: string;
  compact?: boolean;
}

/**
 * Pure CSS/SVG face — no image assets. The face is the "soul" of the DAW.
 * It animates bob/wiggle/pulse depending on mood.
 */
export function TamagotchiFace({ mood, size = 120, talk, compact }: Props) {
  const animClass =
    mood === "hyped"
      ? "pulsebeat"
      : mood === "happy"
        ? "bob"
        : mood === "sleepy" || mood === "asleep"
          ? ""
          : mood === "lonely" || mood === "sad"
            ? "wiggle"
            : "bob";

  const bgColor =
    mood === "hyped"
      ? "#ff4d6d"
      : mood === "happy"
        ? "#ffcf40"
        : mood === "chill"
          ? "#7cffcb"
          : mood === "sleepy" || mood === "asleep"
            ? "#4a4a60"
            : mood === "lonely"
              ? "#8a8a9c"
              : "#5a5a70";

  const eyes = () => {
    if (mood === "asleep" || mood === "sleepy") {
      return (
        <>
          <line x1="-14" y1="-2" x2="-6" y2="-2" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" />
          <line x1="6" y1="-2" x2="14" y2="-2" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    }
    if (mood === "hyped") {
      return (
        <>
          <g transform="translate(-10,-4)">
            <polygon points="-4,-4 4,-4 0,6" fill="#0a0a0f" />
          </g>
          <g transform="translate(10,-4)">
            <polygon points="-4,-4 4,-4 0,6" fill="#0a0a0f" />
          </g>
        </>
      );
    }
    if (mood === "sad" || mood === "lonely") {
      return (
        <>
          <circle cx="-10" cy="-2" r="3" fill="#0a0a0f" />
          <circle cx="10" cy="-2" r="3" fill="#0a0a0f" />
          {/* tear */}
          <circle cx="-10" cy="8" r="2" fill="#9bd9ff" />
        </>
      );
    }
    return (
      <>
        <circle cx="-10" cy="-2" r="3.5" fill="#0a0a0f" />
        <circle cx="10" cy="-2" r="3.5" fill="#0a0a0f" />
      </>
    );
  };

  const mouth = () => {
    if (mood === "hyped") {
      return <path d="M -12 10 Q 0 22 12 10 L 12 14 Q 0 28 -12 14 Z" fill="#0a0a0f" />;
    }
    if (mood === "happy") {
      return <path d="M -10 10 Q 0 20 10 10" stroke="#0a0a0f" strokeWidth="3" fill="none" strokeLinecap="round" />;
    }
    if (mood === "sad" || mood === "lonely") {
      return <path d="M -10 16 Q 0 8 10 16" stroke="#0a0a0f" strokeWidth="3" fill="none" strokeLinecap="round" />;
    }
    if (mood === "sleepy" || mood === "asleep") {
      return <ellipse cx="0" cy="14" rx="5" ry="2" fill="#0a0a0f" />;
    }
    return <line x1="-8" y1="12" x2="8" y2="12" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" />;
  };

  return (
    <div className={`relative inline-flex flex-col items-center ${compact ? "" : "gap-2"}`}>
      <div className={`relative ${animClass}`} style={{ width: size, height: size }}>
        {/* body */}
        <svg viewBox="-60 -60 120 120" width={size} height={size}>
          <defs>
            <radialGradient id="shine" cx="0.35" cy="0.3" r="0.6">
              <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <rect x="-55" y="-55" width="110" height="110" rx="30" ry="30" fill={bgColor} />
          <rect x="-55" y="-55" width="110" height="110" rx="30" ry="30" fill="url(#shine)" />
          {/* screen inset */}
          <rect x="-40" y="-36" width="80" height="60" rx="10" ry="10" fill="#0a0a0f" />
          <rect x="-40" y="-36" width="80" height="60" rx="10" ry="10" fill="rgba(255,255,255,0.04)" className="scan" />
          <g transform="translate(0, -6)">{eyes()}</g>
          <g transform="translate(0, -6)">{mouth()}</g>
          {/* sleep Z */}
          {(mood === "asleep" || mood === "sleepy") && (
            <text x="20" y="-30" fill="#9bd9ff" fontSize="20" fontWeight="bold">
              z
            </text>
          )}
        </svg>
      </div>
      {talk && !compact && (
        <div className="mt-1 max-w-[240px] text-center text-xs font-mono text-white/80 bg-raised border border-line rounded-xl px-3 py-1.5">
          {talk}
        </div>
      )}
    </div>
  );
}
