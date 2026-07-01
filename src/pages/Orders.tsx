import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { ErrorNotice } from "../components/ErrorNotice";
import { Alert, Button, Field, Loading, Modal, Select } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type {
  ModifyOrderPayload,
  OrderRow,
  PlaceOrderPayload,
  TradeRow,
  Variety,
} from "../types";

type Tab = "book" | "trades" | "place";

const EXCHANGES = ["NSE", "BSE", "NFO", "BFO", "CDS", "MCX"] as const;
const ORDER_TYPES = ["MARKET", "LIMIT", "SL", "SL-M"] as const;
const PRODUCTS = ["CNC", "NRML", "MIS", "MTF"] as const;
const VALIDITIES = ["DAY", "IOC"] as const;
const VARIETIES = ["regular", "amo", "co"] as const;

/** Read the first present key from a loosely-typed mStock row as a string. */
function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
}

function isCancellable(status: string): boolean {
  const s = status.toUpperCase();
  if (/(COMPLETE|CANCELL|REJECT)/.test(s)) return false;
  return /(OPEN|PENDING|TRIGGER|RECEIVED|VALIDATION)/.test(s);
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let kind = "neutral";
  if (/COMPLETE/.test(s)) kind = "pos";
  else if (/(REJECT|CANCELL)/.test(s)) kind = "neg";
  else if (/(OPEN|PENDING|TRIGGER|RECEIVED)/.test(s)) kind = "warn";
  return <span className={`badge badge--${kind}`}>{status || "—"}</span>;
}

function SideBadge({ side }: { side: string }) {
  const buy = side.toUpperCase() === "BUY";
  return (
    <span className={`badge badge--${buy ? "buy" : "sell"}`}>{side || "—"}</span>
  );
}

export function Orders() {
  const { session, settings } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("book");
  const [notice, setNotice] = useState<string | null>(null);
  const [modifyTarget, setModifyTarget] = useState<OrderRow | null>(null);

  const auth = session!;

  const orderBook = useQuery({
    queryKey: ["order-book", settings.baseUrl, auth.apiKey],
    enabled: Boolean(session) && tab === "book",
    queryFn: ({ signal }) => api.orderBook(settings, auth, signal),
    refetchInterval: 8000,
  });

  const tradeBook = useQuery({
    queryKey: ["trade-book", settings.baseUrl, auth.apiKey],
    enabled: Boolean(session) && tab === "trades",
    queryFn: ({ signal }) => api.tradeBook(settings, auth, signal),
  });

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => api.cancelOrder(settings, auth, orderId),
    onSuccess: (_d, orderId) => {
      setNotice(`Cancel request submitted for order ${orderId}.`);
      qc.invalidateQueries({ queryKey: ["order-book"] });
    },
  });

  const cancelAllMut = useMutation({
    mutationFn: () => api.cancelAll(settings, auth),
    onSuccess: () => {
      setNotice("Cancel-all request submitted.");
      qc.invalidateQueries({ queryKey: ["order-book"] });
    },
  });

  const orders = Array.isArray(orderBook.data) ? orderBook.data : [];
  const trades = Array.isArray(tradeBook.data) ? tradeBook.data : [];

  return (
    <Layout>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em" }}>
            Orders
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
            Place, modify and track your orders and trades.
          </p>
        </div>
        {tab === "book" && (
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="ghost"
              onClick={() => orderBook.refetch()}
              loading={orderBook.isFetching}
            >
              ↻ Refresh
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm("Cancel ALL pending orders?")) cancelAllMut.mutate();
              }}
              loading={cancelAllMut.isPending}
            >
              Cancel all
            </Button>
          </div>
        )}
      </div>

      <div className="segmented" role="tablist" aria-label="Orders view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "book"}
          onClick={() => setTab("book")}
        >
          Order Book
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "trades"}
          onClick={() => setTab("trades")}
        >
          Trade Book
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "place"}
          onClick={() => setTab("place")}
        >
          Place Order
        </button>
      </div>

      {notice && <Alert kind="success">{notice}</Alert>}
      {(cancelMut.isError || cancelAllMut.isError) && (
        <ErrorNotice
          error={cancelMut.error || cancelAllMut.error}
          fallback="Cancel request failed."
        />
      )}

      {tab === "book" && (
        <OrderBookTable
          loading={orderBook.isLoading}
          error={orderBook.isError ? orderBook.error : null}
          orders={orders}
          onModify={(o) => setModifyTarget(o)}
          onCancel={(id) => cancelMut.mutate(id)}
          cancelingId={cancelMut.isPending ? cancelMut.variables : null}
        />
      )}

      {tab === "trades" && (
        <TradeBookTable
          loading={tradeBook.isLoading}
          error={tradeBook.isError ? tradeBook.error : null}
          trades={trades}
        />
      )}

      {tab === "place" && (
        <PlaceOrderForm
          onPlaced={(msg) => {
            setNotice(msg);
            setTab("book");
            qc.invalidateQueries({ queryKey: ["order-book"] });
          }}
        />
      )}

      {modifyTarget && (
        <ModifyOrderModal
          order={modifyTarget}
          onClose={() => setModifyTarget(null)}
          onDone={(msg) => {
            setModifyTarget(null);
            setNotice(msg);
            qc.invalidateQueries({ queryKey: ["order-book"] });
          }}
        />
      )}
    </Layout>
  );
}

// --- Order book -------------------------------------------------------------

function OrderBookTable({
  loading,
  error,
  orders,
  onModify,
  onCancel,
  cancelingId,
}: {
  loading: boolean;
  error: unknown;
  orders: OrderRow[];
  onModify: (o: OrderRow) => void;
  onCancel: (orderId: string) => void;
  cancelingId: string | null;
}) {
  if (loading) return <Loading label="Loading order book…" />;
  if (error) return <ErrorNotice error={error} fallback="Could not load orders." />;
  if (orders.length === 0)
    return <Alert kind="info">No orders yet today.</Alert>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Instrument</th>
            <th>Side</th>
            <th>Type</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th>Status</th>
            <th className="num">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const id = pick(o, "order_id", "nOrdNo", "order_no");
            const status = pick(o, "status", "ordSt");
            const symbol = pick(o, "tradingsymbol", "trdSym", "symbol");
            const side = pick(o, "transaction_type", "trnsTp", "buy_sell");
            const type = pick(o, "order_type", "prcTp");
            const qty = pick(o, "quantity", "qty", "orderQty");
            const filled = pick(o, "filled_quantity", "fldQty");
            const price = pick(o, "price", "prc");
            const trigger = pick(o, "trigger_price", "trgPrc");
            const time = pick(o, "order_timestamp", "ordDtTm", "orderTime");
            const cancellable = isCancellable(status);
            return (
              <tr key={id || i}>
                <td className="dim">{time.split(" ").slice(-1)[0] || time || "—"}</td>
                <td>
                  <div className="cell-strong">{symbol || "—"}</div>
                  <div className="cell-sub">
                    {pick(o, "exchange", "exch") || ""}
                    {id ? ` · #${id}` : ""}
                  </div>
                </td>
                <td>
                  <SideBadge side={side} />
                </td>
                <td className="dim">{type || "—"}</td>
                <td className="num">
                  {filled && filled !== qty ? `${filled}/${qty}` : qty || "—"}
                </td>
                <td className="num">
                  {Number(price) > 0
                    ? formatCurrency(price)
                    : Number(trigger) > 0
                      ? `trg ${formatCurrency(trigger)}`
                      : "MKT"}
                </td>
                <td>
                  <StatusBadge status={status} />
                </td>
                <td className="num">
                  {cancellable && id ? (
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        onClick={() => onModify(o)}
                      >
                        Modify
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--xs"
                        onClick={() => onCancel(id)}
                        disabled={cancelingId === id}
                      >
                        {cancelingId === id ? "…" : "Cancel"}
                      </button>
                    </div>
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
  );
}

// --- Trade book -------------------------------------------------------------

function TradeBookTable({
  loading,
  error,
  trades,
}: {
  loading: boolean;
  error: unknown;
  trades: TradeRow[];
}) {
  if (loading) return <Loading label="Loading trade book…" />;
  if (error) return <ErrorNotice error={error} fallback="Could not load trades." />;
  if (trades.length === 0)
    return <Alert kind="info">No trades executed today.</Alert>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Instrument</th>
            <th>Side</th>
            <th className="num">Qty</th>
            <th className="num">Avg Price</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const symbol = pick(t, "tradingsymbol", "trdSym", "symbol");
            const side = pick(t, "transaction_type", "trnsTp", "buy_sell");
            const qty = pick(t, "quantity", "fldQty", "fillQty", "qty");
            const price = pick(t, "average_price", "fillPrice", "price", "avgPrc");
            const time = pick(t, "fill_timestamp", "exchange_timestamp", "fillTime");
            const orderId = pick(t, "order_id", "nOrdNo", "order_no");
            const tradeId = pick(t, "trade_id", "fillId", "trdNo");
            return (
              <tr key={tradeId || orderId || i}>
                <td className="dim">{time.split(" ").slice(-1)[0] || time || "—"}</td>
                <td>
                  <div className="cell-strong">{symbol || "—"}</div>
                  <div className="cell-sub">{pick(t, "exchange", "exch") || ""}</div>
                </td>
                <td>
                  <SideBadge side={side} />
                </td>
                <td className="num">{qty || "—"}</td>
                <td className="num">{formatCurrency(price)}</td>
                <td className="dim">{orderId ? `#${orderId}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Place order ------------------------------------------------------------

function PlaceOrderForm({ onPlaced }: { onPlaced: (msg: string) => void }) {
  const { session, settings } = useAuth();
  const auth = session!;

  const [variety, setVariety] = useState<Variety>("regular");
  const [tradingsymbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState("MARKET");
  const [product, setProduct] = useState("CNC");
  const [validity, setValidity] = useState("DAY");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("0");
  const [trigger, setTrigger] = useState("0");
  const [disclosed, setDisclosed] = useState("0");
  const [tag, setTag] = useState("");

  const needsPrice = orderType === "LIMIT" || orderType === "SL";
  const needsTrigger = orderType === "SL" || orderType === "SL-M";

  const mut = useMutation({
    mutationFn: (payload: PlaceOrderPayload) =>
      api.placeOrder(settings, auth, variety, payload),
    onSuccess: (data) => {
      const id =
        (data?.["order_id"] as string) ||
        (data?.["nOrdNo"] as string) ||
        "";
      onPlaced(id ? `Order placed successfully (#${id}).` : "Order placed successfully.");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const payload: PlaceOrderPayload = {
      tradingsymbol: tradingsymbol.trim(),
      exchange: exchange as PlaceOrderPayload["exchange"],
      transaction_type: side,
      order_type: orderType as PlaceOrderPayload["order_type"],
      quantity: Number(quantity),
      product: product as PlaceOrderPayload["product"],
      validity: validity as PlaceOrderPayload["validity"],
      price: needsPrice ? Number(price) : 0,
      trigger_price: needsTrigger ? Number(trigger) : 0,
      disclosed_quantity: Number(disclosed) || 0,
      tag: tag.trim() || undefined,
    };
    mut.mutate(payload);
  }

  return (
    <div className="card card--pad" style={{ maxWidth: 640 }}>
      {mut.isError && (
        <ErrorNotice error={mut.error} fallback="Could not place the order." />
      )}

      <form onSubmit={submit}>
        <div className="buysell" role="tablist" aria-label="Transaction type">
          <button
            type="button"
            role="tab"
            aria-selected={side === "BUY"}
            className="buysell__btn buysell__btn--buy"
            onClick={() => setSide("BUY")}
          >
            BUY
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={side === "SELL"}
            className="buysell__btn buysell__btn--sell"
            onClick={() => setSide("SELL")}
          >
            SELL
          </button>
        </div>

        <Field
          label="Trading symbol"
          placeholder="e.g. INFY-EQ"
          value={tradingsymbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          autoComplete="off"
          required
        />

        <div className="form-grid">
          <Select
            label="Exchange"
            value={exchange}
            options={EXCHANGES}
            onChange={(e) => setExchange(e.target.value)}
          />
          <Select
            label="Product"
            value={product}
            options={PRODUCTS}
            onChange={(e) => setProduct(e.target.value)}
          />
          <Select
            label="Order type"
            value={orderType}
            options={ORDER_TYPES}
            onChange={(e) => setOrderType(e.target.value)}
          />
          <Select
            label="Validity"
            value={validity}
            options={VALIDITIES}
            onChange={(e) => setValidity(e.target.value)}
          />
          <Field
            label="Quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Select
            label="Variety"
            value={variety}
            options={VARIETIES}
            onChange={(e) => setVariety(e.target.value as Variety)}
          />
          {needsPrice && (
            <Field
              label="Price"
              type="number"
              min={0}
              step="0.05"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          )}
          {needsTrigger && (
            <Field
              label="Trigger price"
              type="number"
              min={0}
              step="0.05"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            />
          )}
        </div>

        <details className="disclosure">
          <summary>Advanced</summary>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <Field
              label="Disclosed qty"
              type="number"
              min={0}
              value={disclosed}
              onChange={(e) => setDisclosed(e.target.value)}
            />
            <Field
              label="Tag"
              placeholder="optional"
              value={tag}
              maxLength={20}
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
        </details>

        <div style={{ marginTop: 8 }}>
          <Button
            type="submit"
            loading={mut.isPending}
            className={side === "SELL" ? "btn--sell-full" : ""}
          >
            {side} {tradingsymbol || "order"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- Modify modal -----------------------------------------------------------

function ModifyOrderModal({
  order,
  onClose,
  onDone,
}: {
  order: OrderRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { session, settings } = useAuth();
  const auth = session!;
  const orderId = pick(order, "order_id", "nOrdNo", "order_no");

  const [orderType, setOrderType] = useState(
    pick(order, "order_type", "prcTp") || "LIMIT",
  );
  const [quantity, setQuantity] = useState(pick(order, "quantity", "qty") || "1");
  const [price, setPrice] = useState(pick(order, "price", "prc") || "0");
  const [validity, setValidity] = useState(pick(order, "validity", "validity") || "DAY");
  const [trigger, setTrigger] = useState(pick(order, "trigger_price", "trgPrc") || "0");
  const [disclosed, setDisclosed] = useState(
    pick(order, "disclosed_quantity", "dsclsdQty") || "0",
  );

  const mut = useMutation({
    mutationFn: (payload: ModifyOrderPayload) =>
      api.modifyOrder(settings, auth, orderId, payload),
    onSuccess: () => onDone(`Modify request submitted for order ${orderId}.`),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    mut.mutate({
      order_type: orderType as ModifyOrderPayload["order_type"],
      quantity: Number(quantity),
      price: Number(price),
      validity: validity as ModifyOrderPayload["validity"],
      trigger_price: Number(trigger),
      disclosed_quantity: Number(disclosed) || 0,
    });
  }

  return (
    <Modal title={`Modify order #${orderId}`} onClose={onClose}>
      {mut.isError && (
        <ErrorNotice error={mut.error} fallback="Could not modify the order." />
      )}
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        {pick(order, "tradingsymbol", "trdSym") || "Order"} ·{" "}
        {pick(order, "transaction_type", "trnsTp")}
      </p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Select
            label="Order type"
            value={orderType}
            options={ORDER_TYPES}
            onChange={(e) => setOrderType(e.target.value)}
          />
          <Select
            label="Validity"
            value={validity}
            options={VALIDITIES}
            onChange={(e) => setValidity(e.target.value)}
          />
          <Field
            label="Quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Field
            label="Price"
            type="number"
            min={0}
            step="0.05"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Field
            label="Trigger price"
            type="number"
            min={0}
            step="0.05"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
          />
          <Field
            label="Disclosed qty"
            type="number"
            min={0}
            value={disclosed}
            onChange={(e) => setDisclosed(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
