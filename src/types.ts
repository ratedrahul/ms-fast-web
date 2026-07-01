export type ApiEnvelope<T> = {
  status: "success" | "error";
  data: T;
  message?: string | null;
  error_type?: string | null;
};

export type SessionData = {
  user_type?: string;
  email?: string;
  user_name?: string;
  broker?: string;
  exchanges?: string[];
  products?: string[];
  order_types?: string[];
  user_id?: string;
  api_key?: string;
  access_token?: string;
  login_time?: string;
};

/** Persisted authenticated session used to sign every request. */
export type AuthSession = {
  apiKey: string;
  accessToken: string;
  userName?: string;
  email?: string;
  userId?: string;
  loginTime?: string;
};

/** Connection settings for the MS-Fast backend. */
export type Settings = {
  baseUrl: string;
  gatewayKey?: string;
};

/** A single row of the mStock fund summary (all values arrive as strings). */
export type FundSummary = Record<string, string>;

export type LoginMethod = "otp" | "totp";

// --- Orders -----------------------------------------------------------------

export type Exchange = "NSE" | "BSE" | "NFO" | "BFO" | "CDS" | "MCX";
export type TransactionType = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";
export type ProductType = "CNC" | "NRML" | "MIS" | "MTF";
export type Validity = "DAY" | "IOC";
export type Variety = "regular" | "amo" | "co";

/** Payload for placing a new order (matches the backend PlaceOrderRequest). */
export type PlaceOrderPayload = {
  tradingsymbol: string;
  exchange: Exchange;
  transaction_type: TransactionType;
  order_type: OrderType;
  quantity: number;
  product: ProductType;
  validity: Validity;
  price: number;
  trigger_price: number;
  disclosed_quantity: number;
  tag?: string;
};

/** Payload for modifying a pending order. */
export type ModifyOrderPayload = {
  order_type: OrderType;
  quantity: number;
  price: number;
  validity: Validity;
  trigger_price: number;
  disclosed_quantity: number;
};

/**
 * mStock order/trade rows carry a variable set of fields, so we keep them
 * loosely typed and read known keys defensively in the UI.
 */
export type OrderRow = Record<string, unknown>;
export type TradeRow = Record<string, unknown>;
