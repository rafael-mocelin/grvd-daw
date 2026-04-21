/**
 * AuthScreen — first-impression gate.
 *
 * Priority order on this screen:
 *   1. "Try it" — primary call-to-action. Drops the user into the app as
 *      a guest, no account needed. Progress is in-memory only; refreshing
 *      the page wipes everything. Best path for first-timers.
 *   2. Log in / Sign up — secondary path for returning users or people
 *      ready to save their work.
 *
 * The whole "sign up before anything" flow was walled-off behind a tab
 * switcher previously; now signup is only nagged when the user actually
 * tries to save a song.
 */

import { useState } from "react";
import { useAuth } from "../lib/auth";

type Mode = "login" | "signup";

export function AuthScreen() {
  const { signIn, signUp, continueAsGuest } = useAuth();

  const [mode,     setMode]     = useState<Mode>("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError("email and password are required.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setError("passwords don't match.");
        return;
      }
    }

    setLoading(true);
    const { error: authError } =
      mode === "signup"
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);
    setLoading(false);

    if (authError) {
      setError(authError.toLowerCase());
    } else if (mode === "signup") {
      setSuccess("check your email to confirm your account, then log in.");
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0a0a0f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "monospace",
    }}>
      {/* Logo / wordmark */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🎛️</div>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: "0.15em",
          color: "#fff", textTransform: "uppercase",
        }}>
          GRVD
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginTop: 2 }}>
          the artist daw
        </div>
      </div>

      {/* Primary CTA — try first, sign up later */}
      <button
        onClick={continueAsGuest}
        style={{
          width: "100%", maxWidth: 360,
          padding: "14px 0",
          background: "rgba(124,58,237,0.9)",
          border: "none", borderRadius: 12,
          color: "#fff", fontFamily: "monospace",
          fontSize: 14, fontWeight: 900, letterSpacing: "0.1em",
          cursor: "pointer",
          boxShadow: "0 0 32px rgba(124,58,237,0.45)",
          textTransform: "uppercase",
        }}
      >
        try it →
      </button>
      <div style={{
        marginTop: 8, marginBottom: 20,
        fontSize: 10, color: "rgba(255,255,255,0.4)",
        letterSpacing: "0.06em", textAlign: "center",
        maxWidth: 320,
      }}>
        make a song. customize your DAW. no account needed.
        <br />
        sign up only when you want to save your work.
      </div>

      {/* Divider */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", maxWidth: 360, marginBottom: 16,
      }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em" }}>
          OR
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      </div>

      {/* Card — login / signup for returning users */}
      <div style={{
        width: "100%", maxWidth: 360,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "24px 24px",
      }}>
        {/* Tab switcher */}
        <div style={{
          display: "flex",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 8, padding: 3,
          marginBottom: 24,
        }}>
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              style={{
                flex: 1, padding: "6px 0",
                borderRadius: 6,
                background: mode === m ? "rgba(124,58,237,0.7)" : "transparent",
                border: "none",
                color: mode === m ? "#fff" : "rgba(255,255,255,0.35)",
                fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                letterSpacing: "0.06em",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            style={inputStyle}
          />
          {mode === "signup" && (
            <input
              type="password"
              placeholder="confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          )}

          {error && (
            <div style={{
              padding: "8px 12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 8,
              color: "#f87171", fontSize: 11,
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: "8px 12px",
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 8,
              color: "#86efac", fontSize: 11,
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "11px 0",
              background: loading ? "rgba(124,58,237,0.35)" : "rgba(124,58,237,0.85)",
              border: "none", borderRadius: 10,
              color: "#fff", fontFamily: "monospace",
              fontSize: 13, fontWeight: 900, letterSpacing: "0.08em",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              boxShadow: loading ? "none" : "0 0 20px rgba(124,58,237,0.35)",
            }}
          >
            {loading ? "…" : mode === "login" ? "log in →" : "create account →"}
          </button>
        </form>
      </div>

      <div style={{
        marginTop: 20,
        fontSize: 10, color: "rgba(255,255,255,0.18)",
        textAlign: "center", lineHeight: 1.7,
      }}>
        prototype · no bad outcomes guaranteed
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  fontFamily: "monospace", fontSize: 13,
  outline: "none",
  transition: "border-color 0.15s",
};
