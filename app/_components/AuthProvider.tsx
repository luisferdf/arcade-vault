"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean; // true hasta resolver getUser() + perfil en el montaje
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const resolve = async (authUser: User | null) => {
      if (!authUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", authUser.id)
        .maybeSingle();
      if (!active) return;
      setUser({
        id: authUser.id,
        email: authUser.email ?? "",
        username: data?.username ?? null,
      });
      setLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => resolve(data.user));

    // No se hacen llamadas a Supabase dentro del callback (puede bloquear el
    // cliente): se difiere con setTimeout.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => resolve(session?.user ?? null), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo(
    () => ({ user, loading, signOut }),
    [user, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
