import type { AuthSession, Settings, StreamStatus, Tick } from "../types";

/**
 * Parse an mStock/Kite binary tick frame into ticks.
 *
 * Frame layout (big-endian):
 *   int16  number of packets
 *   repeated: int16 packet length, then <length> bytes of packet data
 *
 * Packet layout (by size):
 *   8    LTP mode         → token(4) ltp(4)
 *   28/32 index quote     → token(4) ltp(4) high low open close ...
 *   44/184 full quote     → token(4) ltp(4) lastQty avgPrice volume buyQty
 *                            sellQty open high low close ...
 * Prices are integers scaled by a segment divisor (100 for most segments).
 */
export function parseTicks(buffer: ArrayBuffer): Tick[] {
  const dv = new DataView(buffer);
  const ticks: Tick[] = [];
  if (buffer.byteLength < 2) return ticks;

  const packets = dv.getInt16(0);
  let offset = 2;

  for (let p = 0; p < packets; p++) {
    if (offset + 2 > buffer.byteLength) break;
    const size = dv.getInt16(offset);
    offset += 2;
    if (offset + size > buffer.byteLength) break;

    const start = offset;
    const token = dv.getInt32(start);
    const segment = token & 0xff;
    let divisor = 100;
    if (segment === 3) divisor = 10000000; // NSE currency
    else if (segment === 6) divisor = 10000; // BSE currency

    if (size === 8) {
      ticks.push({ token, lastPrice: dv.getInt32(start + 4) / divisor });
    } else if (size === 28 || size === 32) {
      ticks.push({
        token,
        lastPrice: dv.getInt32(start + 4) / divisor,
        ohlc: {
          high: dv.getInt32(start + 8) / divisor,
          low: dv.getInt32(start + 12) / divisor,
          open: dv.getInt32(start + 16) / divisor,
          close: dv.getInt32(start + 20) / divisor,
        },
      });
    } else if (size === 44 || size === 184) {
      ticks.push({
        token,
        lastPrice: dv.getInt32(start + 4) / divisor,
        volume: dv.getInt32(start + 16),
        buyQuantity: dv.getInt32(start + 20),
        sellQuantity: dv.getInt32(start + 24),
        ohlc: {
          open: dv.getInt32(start + 28) / divisor,
          high: dv.getInt32(start + 32) / divisor,
          low: dv.getInt32(start + 36) / divisor,
          close: dv.getInt32(start + 40) / divisor,
        },
      });
    }
    offset += size;
  }
  return ticks;
}

function wsUrl(settings: Settings, auth: AuthSession): string {
  const base = settings.baseUrl.replace(/\/$/, "").replace(/^http/i, "ws");
  const q = new URLSearchParams({
    api_key: auth.apiKey,
    access_token: auth.accessToken,
  });
  return `${base}/ws/ticks?${q.toString()}`;
}

type TickerHandlers = {
  onTicks: (ticks: Tick[]) => void;
  onStatus: (status: StreamStatus) => void;
};

/**
 * Manages the relayed websocket connection, subscription state and
 * auto-reconnect. Speaks the Kite control protocol (subscribe / mode) which
 * the MS-Fast relay forwards to mStock verbatim.
 */
export class Ticker {
  private ws: WebSocket | null = null;
  private tokens = new Set<number>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closedByUser = false;

  constructor(
    private settings: Settings,
    private auth: AuthSession,
    private handlers: TickerHandlers,
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  private open(): void {
    this.handlers.onStatus(this.attempts > 0 ? "reconnecting" : "connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(this.settings, this.auth));
    } catch {
      this.handlers.onStatus("error");
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.handlers.onStatus("connected");
      if (this.tokens.size) this.send(Array.from(this.tokens));
    };

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        const ticks = parseTicks(ev.data);
        if (ticks.length) this.handlers.onTicks(ticks);
      }
      // Text frames are order/trade updates — ignored for the watchlist.
    };

    ws.onerror = () => this.handlers.onStatus("error");

    ws.onclose = () => {
      this.ws = null;
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    this.attempts += 1;
    const delay = Math.min(1000 * 2 ** this.attempts, 15000);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private send(tokens: number[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !tokens.length) return;
    this.ws.send(JSON.stringify({ a: "subscribe", v: tokens }));
    this.ws.send(JSON.stringify({ a: "mode", v: ["full", tokens] }));
  }

  subscribe(tokens: number[]): void {
    const fresh = tokens.filter((t) => !this.tokens.has(t));
    fresh.forEach((t) => this.tokens.add(t));
    if (fresh.length) this.send(fresh);
  }

  unsubscribe(tokens: number[]): void {
    tokens.forEach((t) => this.tokens.delete(t));
    if (this.ws?.readyState === WebSocket.OPEN && tokens.length) {
      this.ws.send(JSON.stringify({ a: "unsubscribe", v: tokens }));
    }
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.tokens.clear();
    this.ws?.close();
    this.ws = null;
  }
}
