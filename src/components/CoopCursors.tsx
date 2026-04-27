/**
 * CoopCursors — Phase 4.3 overlay that renders other seats' cursors.
 *
 * Mounted at AppCore level so it's visible across every stage while the
 * user is in an active coop session. Gracefully renders nothing when
 * there's no session or no peers — zero cost when not in use.
 *
 * Design notes:
 *   - Fixed position, very high z-index, pointer-events:none so cursors
 *     never block clicks or tap targets.
 *   - Each seat is drawn as a triangle pointer + a tiny flag with the
 *     seat color. Dead simple for now; visual design is Phase 6 work.
 *   - Payloads with cursor=null mean the peer is online but not hovering
 *     inside the window (they mouse-left). We skip rendering those.
 */

import { useStore } from "../store/useStore";
import { useCoopPresence, type CoopPresencePayload } from "../lib/coop-presence";

export function CoopCursors() {
  const activeCoopSessionId = useStore((s) => s.activeCoopSessionId);
  const userId              = useStore((s) => s.userId);

  const peers = useCoopPresence(activeCoopSessionId, userId);
  const entries = Object.values(peers);

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((peer) => (
        peer.cursor ? <PeerCursor key={peer.userId} peer={peer} /> : null
      ))}
    </>
  );
}

function PeerCursor({ peer }: { peer: CoopPresencePayload }) {
  if (!peer.cursor) return null;
  const x = peer.cursor.xRel * window.innerWidth;
  const y = peer.cursor.yRel * window.innerHeight;

  return (
    <div
      style={{
        position:      "fixed",
        left:          0,
        top:           0,
        transform:     `translate(${x}px, ${y}px)`,
        pointerEvents: "none",
        zIndex:        9800,
        // Slight ease on transform so the cursor feels alive even between
        // our 50ms broadcast ticks. Snappy enough to still feel responsive.
        transition:    "transform 60ms linear",
      }}
    >
      {/* Triangle pointer */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
      >
        <path
          d="M2 2 L2 18 L7 13 L11 20 L14 19 L10 12 L17 12 Z"
          fill={peer.color}
          stroke="rgba(0,0,0,0.6)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      {/* Tag with seat color — tiny, trails the pointer */}
      <div
        style={{
          position:     "absolute",
          left:         14,
          top:          16,
          padding:      "2px 6px",
          borderRadius: 4,
          background:   peer.color,
          color:        "rgba(0,0,0,0.85)",
          fontFamily:   "monospace",
          fontSize:     9,
          fontWeight:   800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace:   "nowrap",
          boxShadow:    "0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        seat
      </div>
    </div>
  );
}
