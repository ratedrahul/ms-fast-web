import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { ErrorNotice } from "../components/ErrorNotice";
import { Alert, Button, Field, Loading, Modal, Select } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatCurrency, formatPct, formatSigned, pnlClass } from "../lib/format";
import type {
  ConvertPositionPayload,
  HoldingRow,
  PositionRow,
  PositionsResponse,
} from "../types";

type Tab = "holdings" | "positions";

const PRODUCTS = ["CNC", "NRML", "MIS", "MTF"] as const;

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
}

function num(row: Record<string, unknown>, ...keys: string[]): number {
  const raw = pick(row, ...keys);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Normalise a positions payload into a flat "net" array. */
function toNetPositions(data: PositionsResponse | undefined): PositionRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.net ?? data.day ?? [];
}

function Metric({
  label,
  value,
  intent,
  sub,
}: {
  label: string;
  value: string;
  intent?: number;
  sub?: string;
}) {
  const cls = intent === undefined ? "" : pnlClass(intent);
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className={`stat__value ${cls}`}>{value}</div>
      {sub && <div className={`stat__sub ${cls}`}>{sub}</div>}
    </div>
  );
}

export function Portfolio() {
  const { session, settings } = useAuth();
  const auth = session!;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("holdings");
  const [notice, setNotice] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<PositionRow | null>(null);

  const holdingsQ = useQuery({
    queryKey: ["holdings", settings.baseUrl, auth.apiKey],
    enabled: Boolean(session) && tab === "holdings",
    queryFn: ({ signal }) => api.holdings(settings, auth, signal),
  });

  const positionsQ = useQuery({
    queryKey: ["positions", settings.baseUrl, auth.apiKey],
    enabled: Boolean(session) && tab === "positions",
    queryFn: ({ signal }) => api.positions(settings, auth, signal),
    refetchInterval: 10000,
  });

  const holdings = Array.isArray(holdingsQ.data) ? holdingsQ.data : [];
  const positions = toNetPositions(positionsQ.data);

  const active = tab === "holdings" ? holdingsQ : positionsQ;

  return (
    <Layout>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em" }}>
            Portfolio
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
            Your holdings and open positions with live P&amp;L.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => active.refetch()}
          loading={active.isFetching}
        >
          ↻ Refresh
        </Button>
      </div>

      <div className="segmented" role="tablist" aria-label="Portfolio view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "holdings"}
          onClick={() => setTab("holdings")}
        >
          Holdings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "positions"}
          onClick={() => setTab("positions")}
        >
          Positions
        </button>
      </div>

      {notice && <Alert kind="success">{notice}</Alert>}

      {tab === "holdings" && (
        <HoldingsView
          loading={holdingsQ.isLoading}
          error={holdingsQ.isError ? holdingsQ.error : null}
          holdings={holdings}
        />
      )}

      {tab === "positions" && (
        <PositionsView
          loading={positionsQ.isLoading}
          error={positionsQ.isError ? positionsQ.error : null}
          positions={positions}
          onConvert={(p) => setConvertTarget(p)}
        />
      )}

      {convertTarget && (
        <ConvertModal
          position={convertTarget}
          onClose={() => setConvertTarget(null)}
          onDone={(msg) => {
            setConvertTarget(null);
            setNotice(msg);
            qc.invalidateQueries({ queryKey: ["positions"] });
          }}
        />
      )}
    </Layout>
  );
}

// --- Holdings ---------------------------------------------------------------

function HoldingsView({
  loading,
  error,
  holdings,
}: {
  loading: boolean;
  error: unknown;
  holdings: HoldingRow[];
}) {
  const totals = useMemo(() => {
    let invested = 0;
    let current = 0;
    let dayPnl = 0;
    for (const h of holdings) {
      const qty = num(h, "quantity", "Quantity") + num(h, "t1_quantity");
      const avg = num(h, "average_price", "avgPrice");
      const ltp = num(h, "last_price", "ltp") || num(h, "close_price");
      invested += avg * qty;
      current += ltp * qty;
      dayPnl += num(h, "day_change") * qty;
    }
    const pnl = current - invested;
    return { invested, current, pnl, dayPnl };
  }, [holdings]);

  if (loading) return <Loading label="Loading holdings…" />;
  if (error) return <ErrorNotice error={error} fallback="Could not load holdings." />;
  if (holdings.length === 0)
    return <Alert kind="info">You have no holdings.</Alert>;

  const pctChange = totals.invested ? (totals.pnl / totals.invested) * 100 : 0;

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <Metric label="Invested" value={formatCurrency(totals.invested)} />
        <Metric label="Current" value={formatCurrency(totals.current)} />
        <Metric
          label="Total P&L"
          value={formatSigned(totals.pnl)}
          intent={totals.pnl}
          sub={formatPct(pctChange)}
        />
        <Metric
          label="Day's P&L"
          value={formatSigned(totals.dayPnl)}
          intent={totals.dayPnl}
        />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Instrument</th>
              <th className="num">Qty</th>
              <th className="num">Avg</th>
              <th className="num">LTP</th>
              <th className="num">Cur. Value</th>
              <th className="num">P&L</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const qty = num(h, "quantity", "Quantity") + num(h, "t1_quantity");
              const avg = num(h, "average_price", "avgPrice");
              const ltp = num(h, "last_price", "ltp") || num(h, "close_price");
              const value = ltp * qty;
              const pnl = value - avg * qty;
              const pct = avg * qty ? (pnl / (avg * qty)) * 100 : 0;
              return (
                <tr key={pick(h, "tradingsymbol", "isin") || i}>
                  <td>
                    <div className="cell-strong">
                      {pick(h, "tradingsymbol", "symbol") || "—"}
                    </div>
                    <div className="cell-sub">{pick(h, "exchange", "exch")}</div>
                  </td>
                  <td className="num">{qty || "—"}</td>
                  <td className="num">{formatCurrency(avg)}</td>
                  <td className="num">{formatCurrency(ltp)}</td>
                  <td className="num">{formatCurrency(value)}</td>
                  <td className={`num ${pnlClass(pnl)}`}>
                    <div>{formatSigned(pnl)}</div>
                    <div className="cell-sub">{formatPct(pct)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// --- Positions --------------------------------------------------------------

function PositionsView({
  loading,
  error,
  positions,
  onConvert,
}: {
  loading: boolean;
  error: unknown;
  positions: PositionRow[];
  onConvert: (p: PositionRow) => void;
}) {
  const totalPnl = useMemo(
    () => positions.reduce((sum, p) => sum + num(p, "pnl", "m2m", "unrealised"), 0),
    [positions],
  );

  if (loading) return <Loading label="Loading positions…" />;
  if (error) return <ErrorNotice error={error} fallback="Could not load positions." />;
  if (positions.length === 0)
    return <Alert kind="info">You have no open positions today.</Alert>;

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <Metric
          label="Total P&L"
          value={formatSigned(totalPnl)}
          intent={totalPnl}
        />
        <Metric label="Open positions" value={String(positions.length)} />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Product</th>
              <th className="num">Net Qty</th>
              <th className="num">Avg</th>
              <th className="num">LTP</th>
              <th className="num">P&L</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => {
              const netQty = num(p, "quantity", "netQty", "net_quantity");
              const avg = num(p, "average_price", "buy_price", "avgPrice");
              const ltp = num(p, "last_price", "ltp") || num(p, "close_price");
              const pnl = num(p, "pnl", "m2m", "unrealised");
              const product = pick(p, "product", "prod");
              const symbol = pick(p, "tradingsymbol", "symbol");
              const canConvert = netQty !== 0 && Boolean(symbol);
              return (
                <tr key={symbol || i}>
                  <td>
                    <div className="cell-strong">{symbol || "—"}</div>
                    <div className="cell-sub">{pick(p, "exchange", "exch")}</div>
                  </td>
                  <td>
                    <span className="badge badge--neutral">{product || "—"}</span>
                  </td>
                  <td className={`num ${netQty < 0 ? "pnl--neg" : ""}`}>
                    {netQty || "—"}
                  </td>
                  <td className="num">{formatCurrency(avg)}</td>
                  <td className="num">{formatCurrency(ltp)}</td>
                  <td className={`num ${pnlClass(pnl)}`}>{formatSigned(pnl)}</td>
                  <td className="num">
                    {canConvert ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        onClick={() => onConvert(p)}
                      >
                        Convert
                      </button>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// --- Convert modal ----------------------------------------------------------

function ConvertModal({
  position,
  onClose,
  onDone,
}: {
  position: PositionRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { session, settings } = useAuth();
  const auth = session!;

  const symbol = pick(position, "tradingsymbol", "symbol");
  const netQty = num(position, "quantity", "netQty", "net_quantity");
  const currentProduct = pick(position, "product", "prod") || "MIS";

  const [oldProduct, setOldProduct] = useState(currentProduct);
  const [newProduct, setNewProduct] = useState(
    currentProduct === "MIS" ? "CNC" : "MIS",
  );
  const [quantity, setQuantity] = useState(String(Math.abs(netQty) || 1));

  const mut = useMutation({
    mutationFn: (payload: ConvertPositionPayload) =>
      api.convertPosition(settings, auth, payload),
    onSuccess: () => onDone(`Conversion request submitted for ${symbol}.`),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    mut.mutate({
      tradingsymbol: symbol,
      exchange: (pick(position, "exchange", "exch") ||
        "NSE") as ConvertPositionPayload["exchange"],
      transaction_type: netQty >= 0 ? "BUY" : "SELL",
      position_type: "DAY",
      quantity: Number(quantity),
      old_product: oldProduct as ConvertPositionPayload["old_product"],
      new_product: newProduct as ConvertPositionPayload["new_product"],
    });
  }

  return (
    <Modal title={`Convert ${symbol}`} onClose={onClose}>
      {mut.isError && (
        <ErrorNotice error={mut.error} fallback="Could not convert the position." />
      )}
      <form onSubmit={submit}>
        <div className="form-grid">
          <Select
            label="From product"
            value={oldProduct}
            options={PRODUCTS}
            onChange={(e) => setOldProduct(e.target.value)}
          />
          <Select
            label="To product"
            value={newProduct}
            options={PRODUCTS}
            onChange={(e) => setNewProduct(e.target.value)}
          />
          <Field
            label="Quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Convert
          </Button>
        </div>
      </form>
    </Modal>
  );
}
