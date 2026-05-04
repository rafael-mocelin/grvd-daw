/**
 * Chibi — minimal port of the parameterized character rig from the
 * jam-stage branch. Just enough to render distinct silhouettes for the
 * 4 starter den characters.
 *
 * Variants:
 *   - hair:    "curls" | "braids" | "slick" | "cap"
 *   - expression: "grin" | "smirk" | "cool"
 *
 * Pure HTML/CSS, no Tone, no audio reactivity in v1 — just identity.
 */

import type { DenCharacter } from "../../data/denCharacters";

interface ChibiProps {
  character: DenCharacter;
  size?:     number;       // overall box size in px (default 110)
}

export function Chibi({ character, size = 110 }: ChibiProps) {
  const scale = size / 110;
  return (
    <div style={{ position: "relative", width: size, height: size * 1.55 }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "0 0", width: 110, height: 170 }}>
        {/* legs / shoes */}
        <div style={{
          position: "absolute", bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: 60, display: "flex", justifyContent: "space-between",
        }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ width: 24, height: 22 }}>
              <div style={{
                width: "100%", height: 10, background: "#1a1a22",
                border: "2px solid #0a0f1c", borderRadius: "4px 4px 0 0",
              }} />
              <div style={{
                width: "108%", height: 14, marginLeft: -1,
                background: "linear-gradient(180deg, #fff, #d0d0d8)",
                border: "2px solid #0a0f1c",
                borderRadius: i === 0 ? "4px 8px 6px 6px" : "8px 4px 6px 6px",
              }} />
            </div>
          ))}
        </div>

        {/* hoodie body */}
        <div style={{
          position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)",
          width: 76, height: 64,
          background: `linear-gradient(180deg, ${character.jacket} 0%, ${darken(character.jacket, 0.18)} 100%)`,
          border: "2px solid #0a0f1c",
          borderRadius: "16px 16px 10px 10px",
        }}>
          {/* hood collar */}
          <div style={{
            position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)",
            width: 50, height: 10,
            background: character.jacket,
            border: "2px solid #0a0f1c",
            borderRadius: "10px 10px 4px 4px",
          }} />
        </div>

        {/* head */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 92, height: 92,
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 35% 30%, ${lighten(character.skin, 0.15)}, ${character.skin} 60%, ${darken(character.skin, 0.18)})`,
            border: "2px solid #0a0f1c",
            borderRadius: headRadius(character.hair),
          }} />

          <Hair style={character.hair} color={character.hairColor} />

          {/* eyes */}
          <div style={{
            position: "absolute", top: 42, left: 22, width: 10, height: 12,
            background: "#0a0f1c", borderRadius: "50%",
          }} />
          <div style={{
            position: "absolute", top: 42, right: 22, width: 10, height: 12,
            background: "#0a0f1c", borderRadius: "50%",
          }} />

          <Mouth expression={character.expression} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function headRadius(hair: DenCharacter["hair"]): string {
  if (hair === "slick") return "32% 32% 22% 22% / 35% 35% 25% 25%";
  if (hair === "cap")   return "44% 44% 38% 38% / 50% 50% 42% 42%";
  if (hair === "braids") return "50% 50% 45% 45% / 55% 55% 50% 50%";
  return "50% 50% 46% 46% / 52% 52% 44% 44%";
}

function Hair({ style, color }: { style: DenCharacter["hair"]; color: string }) {
  if (style === "curls") {
    return (
      <>
        {[
          { x: 12, y: 2, s: 18 }, { x: 30, y: -2, s: 20 }, { x: 50, y: -2, s: 20 },
          { x: 68, y: 2, s: 18 }, { x: 22, y: 10, s: 14 }, { x: 60, y: 10, s: 14 },
        ].map((t, i) => (
          <div key={i} style={{
            position: "absolute", left: t.x, top: t.y, width: t.s, height: t.s,
            borderRadius: "50%", background: color, border: "2px solid #0a0f1c",
          }} />
        ))}
      </>
    );
  }
  if (style === "braids") {
    return (
      <>
        <div style={{
          position: "absolute", top: -2, left: 12, right: 12, height: 18,
          background: color, border: "2px solid #0a0f1c",
          borderRadius: "44% 44% 30% 30% / 80% 80% 30% 30%",
        }} />
        {[2, 76].map((x) => (
          <div key={x} style={{ position: "absolute", left: x, top: 14, width: 14, height: 50 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                position: "absolute", left: 0, top: i * 14,
                width: 14, height: 18,
                borderRadius: "50%", background: color, border: "2px solid #0a0f1c",
              }} />
            ))}
            <div style={{
              position: "absolute", left: 3, top: 46,
              width: 8, height: 6, borderRadius: 2,
              background: "linear-gradient(180deg, #f3c44a, #a07a0c)",
              border: "1.5px solid #0a0f1c",
            }} />
          </div>
        ))}
      </>
    );
  }
  if (style === "slick") {
    return (
      <div style={{
        position: "absolute", top: -3, left: 6, right: 6, height: 22,
        background: `linear-gradient(180deg, ${color}, #0a0a14)`,
        border: "2px solid #0a0f1c",
        borderRadius: "32% 32% 14% 14% / 60% 60% 18% 18%",
      }}>
        <div style={{
          position: "absolute", top: 3, left: 6, right: 6, height: 2,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
        }} />
      </div>
    );
  }
  // cap
  return (
    <>
      <div style={{
        position: "absolute", top: -2, left: 10, right: 10, height: 22,
        background: color, border: "2px solid #0a0f1c",
        borderRadius: "40% 40% 20% 20% / 80% 80% 20% 20%",
      }} />
      <div style={{
        position: "absolute", top: 16, left: -2, width: 18, height: 6,
        background: color, border: "2px solid #0a0f1c",
        borderRadius: "0 50% 50% 0 / 0 100% 100% 0",
      }} />
    </>
  );
}

function Mouth({ expression }: { expression: DenCharacter["expression"] }) {
  const base: React.CSSProperties = {
    position: "absolute", top: 64, left: "50%",
    transform: "translateX(-50%)",
    background: "#3a1818", border: "1.5px solid #0a0f1c",
  };
  if (expression === "grin") {
    return (
      <div style={{ ...base, width: 14, height: 8, borderRadius: "0 0 14px 14px" }}>
        <div style={{
          position: "absolute", top: 1, left: 2, width: 7, height: 2,
          background: "#fff", borderRadius: 1,
        }} />
      </div>
    );
  }
  if (expression === "smirk") {
    return <div style={{ ...base, width: 12, height: 6, marginLeft: 3, borderRadius: "20% 50% 80% 50%" }} />;
  }
  return <div style={{ ...base, width: 12, height: 3, borderRadius: 2 }} />;
}

/* -------------------------------------------------------------------------- */
/* tiny color helpers (avoid extra imports)                                    */
/* -------------------------------------------------------------------------- */

function darken(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return rgbToHex(
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount))),
  );
}
function lighten(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return rgbToHex(
    Math.min(255, Math.round(r + (255 - r) * amount)),
    Math.min(255, Math.round(g + (255 - g) * amount)),
    Math.min(255, Math.round(b + (255 - b) * amount)),
  );
}
function parseHex(h: string): { r: number; g: number; b: number } {
  const s = h.replace("#", "");
  const v = s.length === 3
    ? s.split("").map((c) => c + c).join("")
    : s;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}
