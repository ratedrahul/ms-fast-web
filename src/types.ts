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
