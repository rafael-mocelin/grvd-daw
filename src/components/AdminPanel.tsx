/**
 * AdminPanel — debug/testing tools, visible only when user is promoted to
 * admin via Supabase app_metadata.
 *
 * Gives the admin a quick way to force mood states so the shell face can
 * be visually tested (otherwise you'd have to wait for tamagotchi needs
 * to decay to see sleepy/asleep).
 *
 * To become admin, run in Supabase SQL editor:
 *   UPDATE auth.users
 *   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
 *   WHERE email = 'you@example.com';
 * Then sign out and back in.
 */

import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useStore } from "../store/useStore";
import type { Mood } from "../data/types";

const MOODS: Mood[] = ["hyped", "happy", "chill", "sleepy", "asleep", "sad", "lonely"];

const MOOD_EMOJI: Record<Mood, string> = {
  hyped:  "[*]",
  happy:  "[:)]",
  chill:  "[-]",
  sleepy: "[z]",
  asleep: "[Z]",
  sad:    "[:(]",
  lonely: "[;_;]",
};

export function AdminPanel() {
  const { isAdmin, user } = useAuth();
  const { moodOverride, setMoodOverride } = useStore();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      {/* Floating launcher — always visible for admins, above the shell */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "close admin panel" : "open admin panel"}
        style={{
          position: "fixed",
          top: 14,
          right: 14,
          zIndex: 9000,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(251,191,36,0.25)",
          border: "1.5px solid rgba(251,191,36,0.7)",
          color: "#fbbf24",
          fontFamily: "monospace",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: "0.08em",
          cursor: "pointer",
          boxShadow: "0 0 14px rgba(251,191,36,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        A
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: 54,
            right: 14,
            zIndex: 9001,
            width: 260,
            maxHeight: "80vh",
            overflowY: "auto",
            background: "#13111d",
            border: "1px solid rgba(251,191,36,0.45)",
            borderRadius: 14,
            padding: "14px 14px 12px",
            fontFamily: "monospace",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 24px rgba(251,191,36,0.15)",
            color: "#fff",
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
            color: "#fbbf24", textTransform: "uppercase",
            marginBottom: 2,
          }}>
            admin debug
          </div>
          <div style={{
            fontSize: 9, color: "rgba(255,255,255,0.45)",
            marginBottom: 12, wordBreak: "break-all",
          }}>
            {user?.email}
          </div>

          {/* MOOD FORCE */}
          <div style={{
            fontSize: 9, letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.6)", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            force mood
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMoodOverride(m)}
                style={{
                  flex: "1 0 calc(50% - 6px)",
                  padding: "6px 8px",
                  background: moodOverride === m ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${moodOverride === m ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 6,
                  color: moodOverride === m ? "#fbbf24" : "rgba(255,255,255,0.8)",
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ opacity: 0.6, marginRight: 4 }}>{MOOD_EMOJI[m]}</span>
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMoodOverride(null)}
            disabled={moodOverride === null}
            style={{
              width: "100%",
              padding: "7px 0",
              background: "transparent",
              border: "1px dashed rgba(255,255,255,0.2)",
              borderRadius: 6,
              color: moodOverride ? "#fff" : "rgba(255,255,255,0.3)",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              cursor: moodOverride ? "pointer" : "not-allowed",
              marginBottom: 14,
            }}
          >
            clear override
          </button>

          {/* Reminder of how to promote */}
          <div style={{
            fontSize: 9, letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.6)", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            status
          </div>
          <div style={{
            fontSize: 10, color: "#4ade80",
            marginBottom: 4,
          }}>
            admin role active
          </div>
          <div style={{
            fontSize: 9, color: "rgba(255,255,255,0.35)",
            lineHeight: 1.5,
          }}>
            Current override:{" "}
            <span style={{ color: moodOverride ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>
              {moodOverride ?? "none (auto)"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
