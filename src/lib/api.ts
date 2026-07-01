import type {
  ApiEnvelope,
  AuthSession,
  ConvertPositionPayload,
  HoldingRow,
  ModifyOrderPayload,
  OrderRow,
  PlaceOrderPayload,
  PositionsResponse,
  Settings,
  TradeRow,
  Variety,
} from "../types";

/** Extra payload the backend attaches when the caller IP isn't whitelisted. */
export type IpWhitelistData = {
  ip_whitelist_required?: boolean;
  server_ip?: string | null;
  help_url?: string;
  instructions?: string;
};

export class ApiError extends Error {
  status: number;
  errorType?: string | null;
  data?: IpWhitelistData | null;

  constructor(
    message: string,
    status: number,
    errorType?: string | null,
    data?: IpWhitelistData | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorType = errorType;
    this.data = data;
  }

  /** True when mStock rejected the request because the IP isn't whitelisted. */
  get isIpWhitelist(): boolean {
    return Boolean(this.data?.ip_whitelist_required);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Attach X-Api-Key / X-Access-Token from the session. */
  auth?: AuthSession | null;
  settings: Settings;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: RequestOptions): Promise<T> {
  const { method = "GET", body, auth, settings, signal } = opts;
  const url = `${settings.baseUrl.replace(/\/$/, "")}${path}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (settings.gatewayKey) headers["X-Gateway-Key"] = settings.gatewayKey;
  if (auth) {
    headers["X-Api-Key"] = auth.apiKey;
    headers["X-Access-Token"] = auth.accessToken;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    throw new ApiError(
      err instanceof Error && err.name === "AbortError"
        ? "Request cancelled"
        : "Cannot reach the MS-Fast server. Check the API base URL and your connection.",
      0,
    );
  }

  const text = await res.text();
  let payload: ApiEnvelope<T> | undefined;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      /* non-JSON (e.g. CSV) response */
    }
  }

  if (!res.ok || (payload && payload.status === "error")) {
    const message =
      payload?.message ||
      (res.status === 401
        ? "Unauthorized — your session may have expired. Please log in again."
        : `Request failed (${res.status})`);
    throw new ApiError(
      message,
      res.status,
      payload?.error_type,
      (payload?.data as IpWhitelistData | null) ?? null,
    );
  }

  return (payload ? (payload.data as T) : (text as unknown as T)) as T;
}

// --- Typed endpoint helpers ---------------------------------------------------

export const api = {
  login(settings: Settings, username: string, password: string) {
    return request<unknown>("/api/v1/auth/login", {
      method: "POST",
      body: { username, password },
      settings,
    });
  },

  session(
    settings: Settings,
    apiKey: string,
    requestToken: string,
    checksum = "L",
  ) {
    return request<Record<string, unknown>>("/api/v1/auth/session", {
      method: "POST",
      body: { api_key: apiKey, request_token: requestToken, checksum },
      settings,
    });
  },

  verifyTotp(settings: Settings, apiKey: string, totp: string) {
    return request<Record<string, unknown>>("/api/v1/auth/verify-totp", {
      method: "POST",
      body: { api_key: apiKey, totp },
      settings,
    });
  },

  fundSummary(settings: Settings, auth: AuthSession, signal?: AbortSignal) {
    return request<Record<string, string>[]>("/api/v1/auth/fund-summary", {
      method: "GET",
      auth,
      settings,
      signal,
    });
  },

  logout(settings: Settings, auth: AuthSession) {
    return request<unknown>("/api/v1/auth/logout", {
      method: "GET",
      auth,
      settings,
    });
  },

  // --- Orders ---------------------------------------------------------------

  orderBook(settings: Settings, auth: AuthSession, signal?: AbortSignal) {
    return request<OrderRow[]>("/api/v1/orders/book", {
      method: "GET",
      auth,
      settings,
      signal,
    });
  },

  tradeBook(settings: Settings, auth: AuthSession, signal?: AbortSignal) {
    return request<TradeRow[]>("/api/v1/orders/trade-book", {
      method: "GET",
      auth,
      settings,
      signal,
    });
  },

  placeOrder(
    settings: Settings,
    auth: AuthSession,
    variety: Variety,
    payload: PlaceOrderPayload,
  ) {
    return request<Record<string, unknown>>(`/api/v1/orders/${variety}`, {
      method: "POST",
      body: payload,
      auth,
      settings,
    });
  },

  modifyOrder(
    settings: Settings,
    auth: AuthSession,
    orderId: string,
    payload: ModifyOrderPayload,
  ) {
    return request<Record<string, unknown>>(
      `/api/v1/orders/regular/${encodeURIComponent(orderId)}`,
      { method: "PUT", body: payload, auth, settings },
    );
  },

  cancelOrder(settings: Settings, auth: AuthSession, orderId: string) {
    return request<Record<string, unknown>>(
      `/api/v1/orders/regular/${encodeURIComponent(orderId)}`,
      { method: "DELETE", auth, settings },
    );
  },

  cancelAll(settings: Settings, auth: AuthSession) {
    return request<Record<string, unknown>>("/api/v1/orders/cancel-all", {
      method: "POST",
      auth,
      settings,
    });
  },

  // --- Portfolio ------------------------------------------------------------

  holdings(settings: Settings, auth: AuthSession, signal?: AbortSignal) {
    return request<HoldingRow[]>("/api/v1/portfolio/holdings", {
      method: "GET",
      auth,
      settings,
      signal,
    });
  },

  positions(settings: Settings, auth: AuthSession, signal?: AbortSignal) {
    return request<PositionsResponse>("/api/v1/portfolio/positions", {
      method: "GET",
      auth,
      settings,
      signal,
    });
  },

  convertPosition(
    settings: Settings,
    auth: AuthSession,
    payload: ConvertPositionPayload,
  ) {
    return request<Record<string, unknown>>("/api/v1/portfolio/convert-position", {
      method: "POST",
      body: payload,
      auth,
      settings,
    });
  },
};
