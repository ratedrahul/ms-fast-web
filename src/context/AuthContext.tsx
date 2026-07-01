import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthSession, Settings } from "../types";
import {
  clearSession,
  loadSession,
  loadSettings,
  saveSession,
  saveSettings,
} from "../lib/storage";

type AuthContextValue = {
  session: AuthSession | null;
  settings: Settings;
  isAuthenticated: boolean;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
  updateSettings: (settings: Settings) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const signIn = useCallback((next: AuthSession) => {
    saveSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const updateSettings = useCallback((next: Settings) => {
    saveSettings(next);
    setSettings(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      settings,
      isAuthenticated: Boolean(session?.accessToken),
      signIn,
      signOut,
      updateSettings,
    }),
    [session, settings, signIn, signOut, updateSettings],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
