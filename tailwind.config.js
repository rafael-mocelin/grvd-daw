/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        punch: "0 8px 0 0 #0a0a0f",
        glow: "0 0 24px 4px rgba(255, 77, 109, 0.35)",
      },
    },
  },
  plugins: [],
};
