/**
 * AuthScreen — first-impression gate, UI v1 game-feel rebuild.
 *
 * Priority order on this screen:
 *   1. "Try it" — primary call-to-action. Drops the user into the app as
 *      a guest, no account needed. Progress is in-memory only; refreshing
 *      the page wipes everything. Best path for first-timers.
 *   2. Log in / Sign up — secondary path for returning users or people
 *      ready to save their work.
 *
 * No GRVD wordmark — placeholder name only. The mascot disc is the brand.
 */

import { useState } from "react";
import { useAuth } from "../lib/auth";
import { ChunkyButton, ChunkyPill } from "../ui/Chunky";

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
    <div className="min-h-[100dvh] w-full bg-grvd-base text-white relative overflow-hidden">
      {/* Soft radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-page-glow"
      />

      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 max-w-[420px] mx-auto">
        {/* Mascot disc — gradient sphere, no wordmark */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="w-28 h-28 rounded-full bg-gradient-to-br from-grvd-purple to-grvd-magenta shadow-chunky animate-puck-bob flex items-center justify-center"
            style={{ boxShadow: "0 16px 40px rgba(167,139,250,0.4), 0 6px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.25)" }}
          >
            <span className="text-5xl drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)]">🎛️</span>
          </div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/45 text-center">
            the artist daw
          </div>
        </div>

        {/* Primary CTA — try first, sign up later */}
        <ChunkyButton
          variant="hero"
          size="lg"
          icon="→"
          onClick={continueAsGuest}
          className="w-full max-w-[340px]"
        >
          try it
        </ChunkyButton>
        <p className="mt-3 mb-6 max-w-[320px] text-center font-mono text-[10px] leading-relaxed text-white/45">
          make a song. customize your DAW. no account needed.
          <br />
          sign up only when you want to save your work.
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-[340px] mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <div className="font-mono text-[9px] tracking-[0.22em] text-white/35">OR</div>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Card */}
        <div className="w-full max-w-[340px] rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-chunky-press">
          {/* Tab switcher */}
          <div className="flex gap-1.5 mb-5">
            {(["login", "signup"] as Mode[]).map((m) => (
              <ChunkyPill
                key={m}
                variant={mode === m ? "purple" : "ghost"}
                size="sm"
                onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className="flex-1"
              >
                {m}
              </ChunkyPill>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputCx}
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={inputCx}
            />
            {mode === "signup" && (
              <input
                type="password"
                placeholder="confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={inputCx}
              />
            )}

            {error && (
              <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 font-mono text-[11px] text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-grvd-lime/30 bg-grvd-lime/10 px-3 py-2 font-mono text-[11px] text-grvd-lime">
                {success}
              </div>
            )}

            <ChunkyButton
              variant="hero"
              size="md"
              type="submit"
              disabled={loading}
              className="w-full mt-1"
            >
              {loading ? "…" : mode === "login" ? "log in →" : "create account →"}
            </ChunkyButton>
          </form>
        </div>

        <div className="mt-5 font-mono text-[9.5px] text-white/20 text-center leading-relaxed">
          prototype · no bad outcomes guaranteed
        </div>
      </div>
    </div>
  );
}

const inputCx = [
  "w-full px-4 py-2.5 rounded-2xl",
  "bg-white/5 border-2 border-white/10",
  "font-mono text-[13px] text-white",
  "outline-none focus:border-grvd-purple/60 focus:bg-white/8",
  "transition-colors shadow-chunky-press",
].join(" ");
