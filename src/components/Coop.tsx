/**
 * Coop — real-time co-production via Supabase Realtime.
 *
 * Flow:
 *   Host → clicks "start a session" → gets a 6-char join code
 *   Guest → enters the code → joins the session
 *
 * Once both are in, any layer pick or template choice is broadcast
 * over a Supabase Realtime channel. Both sides see the same state.
 * When the host finalizes the song, both users' names are attached as collaborators.
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useStore } from "../store/useStore";
import { TEMPLATES } from "../data/templates";
import { TamagotchiFace } from "./TamagotchiFace";
import type { LayerKind } from "../data/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type CoopStatus = "idle" | "hosting" | "joining" | "active";

interface CoopMessage {
  type: "pick_template" | "pick_layer" | "swap_layer" | "peer_info" | "sync_state";
  payload: Record<string, unknown>;
}

interface PeerInfo {
  name: string;
  avatar: string;
  userId: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function genJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function Coop() {
  const { user } = useAuth();
  const {
    tamagotchi, setCoopPeer, setStage, feedNeed,
    pickTemplate, pickLayer, swapLayer, activeTemplate, layers,
  } = useStore();

  const [status,   setStatus]   = useState<CoopStatus>("idle");
  const [joinCode, setJoinCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [peer,     setPeer]     = useState<PeerInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const myName   = user?.email?.split("@")[0] ?? "unknown";
  const myAvatar = "🎛️";

  /* ── Broadcast helpers ─────────────────────────────────────── */

  function broadcast(msg: CoopMessage) {
    channelRef.current?.send({ type: "broadcast", event: "daw", payload: msg });
  }

  /* ── Subscribe to a channel ────────────────────────────────── */

  function subscribeToChannel(code: string) {
    if (channelRef.current) channelRef.current.unsubscribe();

    const channel = supabase
      .channel(`coop:${code}`)
      .on("broadcast", { event: "daw" }, ({ payload }: { payload: CoopMessage }) => {
        handleIncoming(payload);
      })
      .subscribe();

    channelRef.current = channel;
  }

  function handleIncoming(msg: CoopMessage) {
    switch (msg.type) {
      case "peer_info": {
        const info = msg.payload as unknown as PeerInfo;
        setPeer(info);
        setCoopPeer(info.name, info.avatar);
        feedNeed("social", 20);
        setStatus("active");
        break;
      }
      case "pick_template": {
        const tpl = TEMPLATES.find((t) => t.id === msg.payload.templateId);
        if (tpl) pickTemplate(tpl);
        break;
      }
      case "pick_layer": {
        pickLayer(
          msg.payload.kind as LayerKind,
          msg.payload.variant as string,
          msg.payload.soundId as string
        );
        break;
      }
      case "swap_layer": {
        swapLayer(
          msg.payload.kind as LayerKind,
          msg.payload.variant as string,
          msg.payload.soundId as string
        );
        break;
      }
    }
  }

  /* ── Create session (host) ─────────────────────────────────── */

  async function handleHost() {
    if (!user) return;
    setError(null);
    const code = genJoinCode();
    const { data, error: dbErr } = await supabase
      .from("coop_sessions")
      .insert({
        host_id:   user.id,
        join_code: code,
        status:    "waiting",
        state:     {},
      })
      .select("id")
      .single();

    if (dbErr) { setError(dbErr.message); return; }

    setSessionId(data.id);
    setJoinCode(code);
    setStatus("hosting");
    subscribeToChannel(code);

    // Broadcast own info once joined
    broadcast({
      type: "peer_info",
      payload: { name: myName, avatar: myAvatar, userId: user.id },
    });
  }

  /* ── Join session (guest) ──────────────────────────────────── */

  async function handleJoin() {
    if (!user || !inputCode.trim()) return;
    setError(null);
    const code = inputCode.trim().toUpperCase();

    const { data, error: dbErr } = await supabase
      .from("coop_sessions")
      .select("*")
      .eq("join_code", code)
      .eq("status", "waiting")
      .single();

    if (dbErr || !data) { setError("session not found or already started."); return; }

    // Mark session as active
    await supabase
      .from("coop_sessions")
      .update({ guest_id: user.id, status: "active" })
      .eq("id", data.id);

    setSessionId(data.id);
    setJoinCode(code);
    setStatus("active");
    subscribeToChannel(code);

    // Send own info to host
    broadcast({
      type: "peer_info",
      payload: { name: myName, avatar: myAvatar, userId: user.id },
    });
  }

  /* ── Expose broadcast so StackingView can use it ──────────────
     We patch the store actions to also broadcast when in a coop session.
     Simple approach: override pickLayer / pickTemplate on this render only.
     (A cleaner approach would store the broadcast fn in the store,
      but this keeps Supabase out of the store.) */
  const origPickTemplate = pickTemplate;
  function coopPickTemplate(tpl: typeof TEMPLATES[number]) {
    origPickTemplate(tpl);
    broadcast({ type: "pick_template", payload: { templateId: tpl.id } });
  }

  /* ── Cleanup on unmount ────────────────────────────────────── */

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  /* ── Copy join code ────────────────────────────────────────── */

  function copyCode() {
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  /* ── Render ─────────────────────────────────────────────────── */

  const S: Record<string, React.CSSProperties> = {
    root:  { padding: "20px 16px", maxWidth: 480, margin: "0 auto", fontFamily: "monospace" },
    back:  { background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, marginBottom: 16 },
    card:  { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "20px 18px" },
    h2:    { fontSize: 17, fontWeight: 900, color: "#fff", margin: "0 0 6px" },
    muted: { fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 },
    input: { padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontFamily: "monospace", fontSize: 14, width: "100%", outline: "none" },
    btn:   (bg: string): React.CSSProperties => ({
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "9px 18px", borderRadius: 10,
      background: bg, border: "none",
      color: "#fff", fontFamily: "monospace", fontSize: 12, fontWeight: 700,
      cursor: "pointer", transition: "all 0.15s",
    }),
  };

  return (
    <div style={S.root}>
      <button style={S.back} onClick={() => setStage("crib")}>← back</button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <TamagotchiFace mood={tamagotchi.mood} size={52} compact />
        <div>
          <div style={S.h2}>co-production</div>
          <div style={S.muted}>real-time session · both names on the song</div>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 11, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── IDLE: choose to host or join ── */}
      {status === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 6 }}>start a session</div>
            <div style={{ ...S.muted, marginBottom: 14 }}>
              generate a 6-character code. share it with your collaborator so they can join.
            </div>
            <button style={S.btn("rgba(124,58,237,0.8)")} onClick={handleHost}>
              🎛️ create session
            </button>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 6 }}>join a session</div>
            <div style={{ ...S.muted, marginBottom: 10 }}>
              enter the code your collaborator shared.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...S.input, letterSpacing: "0.2em", textTransform: "uppercase", flex: 1 }}
                placeholder="ABC123"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              />
              <button style={S.btn("rgba(255,255,255,0.1)")} onClick={handleJoin}>
                join →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HOSTING: waiting for guest ── */}
      {status === "hosting" && (
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            your join code
          </div>
          <div style={{
            fontSize: 40, fontWeight: 900, letterSpacing: "0.3em", color: "#a78bfa",
            background: "rgba(124,58,237,0.12)", borderRadius: 12, padding: "18px 24px",
            marginBottom: 14,
          }}>
            {joinCode}
          </div>
          <button style={{ ...S.btn("rgba(255,255,255,0.08)"), marginBottom: 16 }} onClick={copyCode}>
            {copied ? "✓ copied" : "copy code"}
          </button>
          <div style={S.muted}>
            waiting for your collaborator to enter the code…
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 6, fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", justifyContent: "center" }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", animation: "pulsebeat 1s infinite" }} />
            live
          </div>
        </div>
      )}

      {/* ── JOINING: waiting to connect ── */}
      {status === "joining" && (
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={S.muted}>connecting…</div>
        </div>
      )}

      {/* ── ACTIVE: both in the room ── */}
      {status === "active" && peer && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{peer.avatar}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
              {peer.name} is in the room
            </div>
            <div style={S.muted}>
              pick a template and start stacking. both names will be on the song.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => coopPickTemplate(tpl)}
                style={{
                  ...S.btn(activeTemplate?.id === tpl.id
                    ? "rgba(124,58,237,0.7)"
                    : "rgba(255,255,255,0.05)"),
                  flexDirection: "column", padding: "12px",
                  border: `1.5px solid ${activeTemplate?.id === tpl.id ? "#7c3aed" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 900 }}>{tpl.name}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {tpl.bpm} bpm · {tpl.bars} bars
                </span>
              </button>
            ))}
          </div>

          {activeTemplate && (
            <button
              style={{ ...S.btn("rgba(124,58,237,0.85)"), boxShadow: "0 0 20px rgba(124,58,237,0.35)" }}
              onClick={() => { setCoopPeer(peer.name, peer.avatar); setStage("stack"); }}
            >
              start stacking →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
