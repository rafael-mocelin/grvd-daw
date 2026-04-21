/**
 * auth.tsx — authentication context with three modes:
 *
 *   1. anonymous   — nothing yet (show AuthScreen)
 *   2. guest       — user chose "try without an account"; in-memory only,
 *                    nothing syncs to Supabase, wiped on refresh
 *   3. signed-in   — real Supabase user; data persists
 *
 * The admin role is read from Supabase's `app_metadata.role` field, which
 * is SERVER-only writable (clients cannot spoof it in JS). Promote a user
 * to admin by running in the Supabase SQL editor (see ADMIN_SETUP.md):
 *
 *   UPDATE auth.users
 *   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
 *   WHERE email = 'you@example.com';
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type Role = "user" | "admin";

interface AuthCtx {
  /** Supabase user, if signed in. null when anonymous or guest. */
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True when user picked "try without account" — app is usable, data is ephemeral. */
  isGuest: boolean;
  /** Role derived from Supabase app_metadata. Guests are always "user". */
  role: Role;
  /** Convenience: role === "admin". Always false for guests. */
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Enter guest mode — bypass auth without a Supabase account. */
  continueAsGuest: () => void;
  /** Leave guest mode (e.g. when clicking "sign up to save"). */
  endGuestSession: () => void;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                     */
/* -------------------------------------------------------------------------- */

const AuthContext = createContext<AuthCtx | null>(null);

function roleFromUser(u: User | null): Role {
  // app_metadata is server-controlled; clients cannot modify it via the SDK.
  const raw = (u?.app_metadata as { role?: unknown } | undefined)?.role;
  return raw === "admin" ? "admin" : "user";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        // Logging in ends any active guest session.
        if (session?.user) setIsGuest(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
  };

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
  }, []);

  const endGuestSession = useCallback(() => {
    setIsGuest(false);
  }, []);

  const role    = roleFromUser(user);
  const isAdmin = !!user && role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isGuest,
        role,
        isAdmin,
        signUp,
        signIn,
        signOut,
        continueAsGuest,
        endGuestSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
