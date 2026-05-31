import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase/client";
import type { AppRole } from "@/lib/auth-roles";
import { isAppRole, resolveUserRole } from "@/lib/auth-roles";
import {
  fetchResidentByUserId,
  type BlockRow,
  type FlatRow,
  type ResidentRow,
} from "@/services/supabase/community";

export type ProfileRow = {
  role: AppRole;
  full_name: string | null;
  phone: string | null;
  block_id: string | null;
  flat_number: string | null;
  family_count: number | null;
  flat_id: string | null;
};

export type ResidentHome = {
  resident: ResidentRow;
  flat: FlatRow;
  block: BlockRow;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  /** Populated for logged-in users linked to `residents.user_id` */
  residentHome: ResidentHome | null;
  initialized: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [residentHome, setResidentHome] = useState<ResidentHome | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, full_name, phone, block_id, flat_number, family_count, flat_id")
      .eq("id", u.id)
      .maybeSingle();

    if (error) {
      console.error("[AuthContext] Error loading profile from 'profiles' table:", error);
    }

    if (error || !data?.role || !isAppRole(data.role)) {
      const role = await resolveUserRole(u);
      const name =
        typeof u.user_metadata?.full_name === "string"
          ? (u.user_metadata.full_name as string)
          : null;
      setProfile({
        role,
        full_name: name,
        phone: null,
        block_id: null,
        flat_number: null,
        family_count: null,
        flat_id: null,
      });
      setResidentHome(null);
      if (role === "resident") {
        const home = await fetchResidentByUserId(u.id);
        setResidentHome(home);
      }
      return;
    }

    const row = data as ProfileRow;
    setProfile(row);

    if (row.role === "resident") {
      let home = await fetchResidentByUserId(u.id);
      if (!home && row.flat_id) {
        console.log("[AuthContext] Self-healing mapping: resident row missing, creating...");
        try {
          const email = u.email || "";
          const { checkPreRegisteredResident, claimResidentProfile, registerResidentRpc } = await import("@/services/supabase/community");
          const preReg = await checkPreRegisteredResident(email);
          if (preReg && preReg.found) {
            await claimResidentProfile(email);
          } else {
            await registerResidentRpc({
              flatId: row.flat_id,
              fullName: row.full_name || email.split("@")[0] || "Resident",
              email: email,
              phone: row.phone || "",
              familyCount: row.family_count || 1
            });
          }
          home = await fetchResidentByUserId(u.id);
        } catch (err) {
          console.error("[AuthContext] Self-healing mapping error:", err);
        }
      }
      setResidentHome(home);
    } else {
      setResidentHome(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (s?.user) await loadProfile(s.user);
    else {
      setProfile(null);
      setResidentHome(null);
    }
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let initial = null;
      try {
        const { data } = await supabase.auth.getSession();
        initial = data.session;
      } catch (err: any) {
        if (err?.message?.includes("Refresh Token")) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
      }
      if (cancelled) return;
      setSession(initial);
      setUser(initial?.user ?? null);
      if (initial?.user) await loadProfile(initial.user);
      else {
        setProfile(null);
        setResidentHome(null);
      }
      if (!cancelled) setInitialized(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      try {
        console.log(`[AuthContext] Auth state change: ${event}`);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        
        if (nextSession?.user) {
          setLoading(true);
          await loadProfile(nextSession.user);
          setLoading(false);
        } else {
          setProfile(null);
          setResidentHome(null);
          setLoading(false);
        }

        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          setInitialized(true);
        }
      } catch (err) {
        console.error("[AuthContext] Error in onAuthStateChange handler:", err);
        setLoading(false);
        setInitialized(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      residentHome,
      initialized,
      loading,
      refreshProfile,
    }),
    [session, user, profile, residentHome, initialized, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Paired with `AuthProvider` for app-wide session; not a separate route component. */
// eslint-disable-next-line react-refresh/only-export-components -- context hook
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

