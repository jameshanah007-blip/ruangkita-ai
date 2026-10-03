"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AuthUser = {
  id: string;
  name?: string | null;
};

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  refresh: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Session check failed");

      const data = await response.json();
      const nextAuthenticated = data.authenticated === true;
      setAuthenticated(nextAuthenticated);
      setUser(nextAuthenticated ? data.user || null : null);
      return nextAuthenticated;
    } catch {
      setAuthenticated(false);
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
    });
    setAuthenticated(false);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ loading, authenticated, user, refresh, signOut }),
    [loading, authenticated, user, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
