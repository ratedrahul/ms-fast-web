import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Layout } from "../components/Layout";
import { ErrorNotice } from "../components/ErrorNotice";
import { Alert, Button } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Ticker } from "../lib/ticker";
import { loadWatchlist, saveWatchlist } from "../lib/storage";
import { formatCurrency, formatPct, formatSigned, pnlClass } from "../lib/format";
import type { Quote, StreamStatus, Tick } from "../types";

const STATUS_LABEL: Record<StreamStatus, string> = {
  idle: "Offline",
  connecting: "Connecting…",
  connected: "Live",
  reconnecting: "Reconnecting…",
  error: "Connection error",
};

function normalizeSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  // Accept "NSE:INFY" or bare "INFY" (defaulting to NSE).
  const withEx = s.includes(":") ? s : `NSE:${s}`;
  return /^[A-Z]+:[A-Z0-9&\-]+$/.test(withEx) ? withEx : null;
}

export function Watchlist() {
  const { session, settings } = useAuth();
  const auth = session!;

  const [symbols, setSymbols] = useState<string[]>(() => loadWatchlist());
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [seedError, setSeedError] = useState<unknown>(null);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const tickerRef = useRef<Ticker | null>(null);
  const tokenToSymbol = useRef<Map<number, string>>(new Map());
  const prevTokens = useRef<number[]>([]);
  const pending = useRef<Map<number, Tick>>(new Map());
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    rafRef.current = null;
    const batch = pending.current;
    if (!batch.size) return;
    pending.current = new Map();
    setQuotes((prev) => {
      const next = { ...prev };
      batch.forEach((tick, token) => {
        const sym = tokenToSymbol.current.get(token);
        if (!sym || !next[sym]) return;
        const q = next[sym];
        const dir =
          tick.lastPrice > q.ltp ? "up" : tick.lastPrice < q.ltp ? "down" : q.dir;
        next[sym] = {
          ...q,
          ltp: tick.lastPrice,
          dir,
          seq: q.seq + 1,
          close: tick.ohlc?.close ?? q.close,
          open: tick.ohlc?.open ?? q.open,
          high: tick.ohlc?.high ?? q.high,
          low: tick.ohlc?.low ?? q.low,
          volume: tick.volume ?? q.volume,
        };
      });
      return next;
    });
  }, []);

  const onTicks = useCallback(
    (ticks: Tick[]) => {
      ticks.forEach((t) => pending.current.set(t.token, t));
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  // Open one relayed websocket for the whole session.
  useEffect(() => {
    if (!session) return;
    const ticker = new Ticker(settings, auth, { onTicks, onStatus: setStatus });
    tickerRef.current = ticker;
    ticker.connect();
    return () => {
      ticker.close();
      tickerRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, settings.baseUrl]);

  // Seed quotes over REST and (re)subscribe whenever the symbol list changes.
  useEffect(() => {
    if (!session || symbols.length === 0) {
      setQuotes({});
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setSeedError(null);
        const data = await api.ohlc(settings, auth, symbols, controller.signal);
        if (cancelled) return;
        const t2s = new Map<number, string>();
        const seeded: Record<string, Quote> = {};
        for (const sym of symbols) {
          const d = data[sym];
          const ltp = d?.last_price ?? 0;
          seeded[sym] = {
            symbol: sym,
            token: d?.instrument_token,
            ltp,
            close: d?.ohlc?.close ?? ltp,
            open: d?.ohlc?.open,
            high: d?.ohlc?.high,
            low: d?.ohlc?.low,
            seq: 0,
            dir: "",
          };
          if (d?.instrument_token) t2s.set(d.instrument_token, sym);
        }
        tokenToSymbol.current = t2s;
        setQuotes(seeded);

        const newTokens = Array.from(t2s.keys());
        const removed = prevTokens.current.filter((t) => !t2s.has(t));
        if (removed.length) tickerRef.current?.unsubscribe(removed);
        tickerRef.current?.subscribe(newTokens);
        prevTokens.current = newTokens;
      } catch (e) {
        if (!cancelled) setSeedError(e);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(","), session?.accessToken, settings.baseUrl]);

  function addSymbol(e: FormEvent) {
    e.preventDefault();
    const sym = normalizeSymbol(input);
    if (!sym) {
      setInputError("Use the form EXCHANGE:SYMBOL, e.g. NSE:INFY");
      return;
    }
    if (symbols.includes(sym)) {
      setInputError("Already in your watchlist.");
      return;
    }
    const next = [...symbols, sym];
    setSymbols(next);
    saveWatchlist(next);
    setInput("");
    setInputError(null);
  }

  function removeSymbol(sym: string) {
    const next = symbols.filter((s) => s !== sym);
    setSymbols(next);
    saveWatchlist(next);
  }

  const rows = useMemo(
    () => symbols.map((s) => quotes[s]).filter(Boolean) as Quote[],
    [symbols, quotes],
  );

  const statusKind =
    status === "connected"
      ? "pos"
      : status === "error"
        ? "neg"
        : "warn";

  return (
    <Layout>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em" }}>
            Watchlist
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
            Live quotes streamed over websocket.
          </p>
        </div>
        <span className={`badge badge--${statusKind} status-pill`}>
          <span className={`dot dot--${statusKind}`} />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <form className="add-symbol" onSubmit={addSymbol}>
        <input
          className="input"
          placeholder="Add instrument, e.g. NSE:INFY"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInputError(null);
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" variant="ghost">
          + Add
        </Button>
      </form>
      {inputError && <Alert kind="error">{inputError}</Alert>}
      {seedError != null && (
        <ErrorNotice error={seedError} fallback="Could not load quotes." />
      )}

      {rows.length === 0 ? (
        <Alert kind="info">
          Your watchlist is empty. Add an instrument like NSE:INFY above.
        </Alert>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th className="num">LTP</th>
                <th className="num">Change</th>
                <th className="num">Open</th>
                <th className="num">High</th>
                <th className="num">Low</th>
                <th className="num"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const change = q.ltp - q.close;
                const pct = q.close ? (change / q.close) * 100 : 0;
                return (
                  <tr key={q.symbol}>
                    <td>
                      <div className="cell-strong">{q.symbol.split(":")[1]}</div>
                      <div className="cell-sub">{q.symbol.split(":")[0]}</div>
                    </td>
                    <td className="num">
                      <span
                        key={q.seq}
                        className={`ltp ${q.dir ? `flash-${q.dir}` : ""}`}
                      >
                        {q.ltp ? formatCurrency(q.ltp) : "—"}
                      </span>
                    </td>
                    <td className={`num ${pnlClass(change)}`}>
                      <div>{q.ltp ? formatSigned(change) : "—"}</div>
                      <div className="cell-sub">{q.ltp ? formatPct(pct) : ""}</div>
                    </td>
                    <td className="num dim">{q.open ? formatCurrency(q.open) : "—"}</td>
                    <td className="num dim">{q.high ? formatCurrency(q.high) : "—"}</td>
                    <td className="num dim">{q.low ? formatCurrency(q.low) : "—"}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${q.symbol}`}
                        title="Remove"
                        onClick={() => removeSymbol(q.symbol)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Live ticks flow only while the market is open. Outside market hours the
        last snapshot is shown.
      </p>
    </Layout>
  );
}
