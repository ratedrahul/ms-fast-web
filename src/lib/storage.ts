import type { AuthSession, Settings } from "../types";

const SESSION_KEY = "msfast.session";
const SETTINGS_KEY = "msfast.settings";
const WATCHLIST_KEY = "msfast.watchlist";

const DEFAULT_WATCHLIST = ["NSE:INFY", "NSE:TCS", "NSE:RELIANCE", "NSE:HDFCBANK"];

const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "https://fast-mstock.onrender.com";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        baseUrl: (parsed.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, ""),
        gatewayKey: parsed.gatewayKey || undefined,
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { baseUrl: DEFAULT_BASE_URL };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      baseUrl: settings.baseUrl.replace(/\/$/, ""),
      gatewayKey: settings.gatewayKey || undefined,
    }),
  );
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string");
    }
  } catch {
    /* ignore corrupt storage */
  }
  return [...DEFAULT_WATCHLIST];
}

export function saveWatchlist(symbols: string[]): void {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols));
}
