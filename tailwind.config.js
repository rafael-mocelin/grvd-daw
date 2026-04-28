/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy palette — kept so existing screens don't shatter while we
        // migrate. The new "grvd" namespace below is the canonical one.
        ink: "#0a0a0f",
        panel: "#13131a",
        raised: "#1c1c26",
        line: "#2a2a38",
        accent: "#ff4d6d",
        accent2: "#ffd166",
        gold: "#ffcf40",
        mint: "#7cffcb",
        ice: "#9bd9ff",
        muted: "#6b6b7d",

        // ── GRVD UI v1 palette ──
        // Validated against the Nano Banana style sheet. Six semantic
        // names + a tinted scale. Pull from these going forward, not the
        // legacy names above.
        grvd: {
          base:    "#0a0814",  // page background — deepest
          panel:   "#15102a",  // raised panel surfaces
          line:    "#2a1f4d",  // subtle borders
          purple:  "#a78bfa",  // primary accent
          magenta: "#ff4d9c",  // hot accent / hero CTAs
          cyan:    "#22d3ee",  // discover / "now playing" / borrowed-state
          gold:    "#fbbf24",  // currency / level rings / XP
          lime:    "#4ade80",  // claim / success / "ready"
          orange:  "#fb923c",  // trending / 🔥 halo
        },
      },
      fontFamily: {
        // Display = chunky rounded sans for game-feel headings + button copy
        display: ['"Lilita One"', "system-ui", "sans-serif"],
        // Body = clean modern sans for descriptions + secondary text
        sans:    ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        // Mono = technical readouts only (BPM, timecodes, ids)
        mono:    ['"JetBrains Mono"', "monospace"],
      },
      backgroundImage: {
        // ── Card gradients (per-vibe) ──
        // Used by TemplatePicker cards + producer-tile accent borders.
        // Names mirror the tag/genre vocabulary so consumers can pull
        // bg-card-trap etc.
        "card-trap":     "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
        "card-drill":    "linear-gradient(135deg, #ff4d9c 0%, #d946ef 100%)",
        "card-boom-bap": "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
        "card-pop-rap":  "linear-gradient(135deg, #ff4d9c 0%, #fb923c 100%)",

        // ── Hero CTA gradient (the "primary" big button across the app) ──
        "btn-hero":      "linear-gradient(135deg, #a78bfa 0%, #ff4d9c 100%)",
        "btn-claim":     "linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)",
        "btn-ghost":     "linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(255,77,156,0.05) 100%)",

        // ── HUD piece gradients ──
        "energy-orb":    "linear-gradient(180deg, #a78bfa 0%, #ff4d9c 100%)",
        "xp-ribbon":     "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)",
        "level-ring":    "linear-gradient(135deg, #fbbf24 0%, #fb923c 100%)",

        // Subtle texture for the page base — soft radial purple glow.
        "page-glow":     "radial-gradient(ellipse at top, rgba(167,139,250,0.10) 0%, transparent 60%)",
      },
      boxShadow: {
        // Legacy
        punch: "0 8px 0 0 #0a0a0f",
        glow:  "0 0 24px 4px rgba(255, 77, 109, 0.35)",

        // ── GRVD UI v1 depth recipes ──
        // chunky:  drop shadow + inset top-highlight for the "candy button"
        //          look. Use on every interactive surface that should
        //          feel pressable.
        // chunky-press: same but compressed — apply during :active.
        chunky: [
          "0 6px 0 0 rgba(0,0,0,0.35)",          // chunky drop
          "0 12px 24px -4px rgba(0,0,0,0.45)",   // ambient
          "inset 0 2px 0 0 rgba(255,255,255,0.30)", // glossy top highlight
        ].join(", "),
        "chunky-press": [
          "0 2px 0 0 rgba(0,0,0,0.35)",
          "0 4px 8px -2px rgba(0,0,0,0.45)",
          "inset 0 1px 0 0 rgba(255,255,255,0.20)",
        ].join(", "),

        // Glow recipes for active / trending / claim states.
        "glow-purple":  "0 0 20px 4px rgba(167, 139, 250, 0.45)",
        "glow-magenta": "0 0 20px 4px rgba(255, 77, 156, 0.45)",
        "glow-cyan":    "0 0 20px 4px rgba(34, 211, 238, 0.45)",
        "glow-gold":    "0 0 20px 4px rgba(251, 191, 36, 0.55)",
        "glow-orange":  "0 0 20px 4px rgba(251, 146, 60, 0.55)",
        "glow-lime":    "0 0 20px 4px rgba(74, 222, 128, 0.45)",
      },
      keyframes: {
        // Idle bob for the avatar puck (pet still feels alive in the corner)
        "puck-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-2px)" },
        },
        // Press-bounce on chunky buttons — quick squash + spring back.
        "press-bounce": {
          "0%":   { transform: "scale(1)" },
          "40%":  { transform: "scale(0.92)" },
          "100%": { transform: "scale(1)" },
        },
        // Subtle shimmer that sweeps across orb-bars + ribbons.
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Pulse halo for trending / now-playing borders.
        "halo-pulse": {
          "0%, 100%": { boxShadow: "0 0 16px 2px rgba(251, 146, 60, 0.35)" },
          "50%":      { boxShadow: "0 0 28px 6px rgba(251, 146, 60, 0.65)" },
        },
        // Talk-bubble pop-in.
        "bubble-in": {
          "0%":   { transform: "scale(0.85) translateY(4px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)",      opacity: "1" },
        },
      },
      animation: {
        "puck-bob":     "puck-bob 2.4s ease-in-out infinite",
        "press-bounce": "press-bounce 180ms ease-out",
        shimmer:        "shimmer 2.4s linear infinite",
        "halo-pulse":   "halo-pulse 1.6s ease-in-out infinite",
        "bubble-in":    "bubble-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
