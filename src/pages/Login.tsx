import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import type { AuthSession, LoginMethod, Settings } from "../types";

type Step = "credentials" | "verify";

export function Login() {
  const navigate = useNavigate();
  const { settings, updateSettings, signIn } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [method, setMethod] = useState<LoginMethod>("otp");

  // connection settings
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [gatewayKey, setGatewayKey] = useState(settings.gatewayKey ?? "");

  // credentials
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function currentSettings(): Settings {
    const next: Settings = {
      baseUrl: baseUrl.trim().replace(/\/$/, ""),
      gatewayKey: gatewayKey.trim() || undefined,
    };
    updateSettings(next);
    return next;
  }

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const s = currentSettings();
      await api.login(s, username.trim(), password);
      setStep("verify");
      setInfo(
        method === "otp"
          ? "An OTP has been sent to your registered mobile number."
          : "Credentials accepted. Enter the current code from your authenticator app.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const s = currentSettings();
      const data =
        method === "otp"
          ? await api.session(s, apiKey.trim(), code.trim())
          : await api.verifyTotp(s, apiKey.trim(), code.trim());

      const accessToken = String(data["access_token"] ?? "");
      if (!accessToken) {
        throw new ApiError("No access token returned by the server.", 502);
      }
      const session: AuthSession = {
        apiKey: apiKey.trim(),
        accessToken,
        userName: (data["user_name"] as string) || undefined,
        email: (data["email"] as string) || undefined,
        userId: (data["user_id"] as string) || undefined,
        loginTime: (data["login_time"] as string) || undefined,
      };
      signIn(session);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div style={{ width: "min(440px, 100%)" }}>
        <div className="brand" style={{ justifyContent: "center", marginBottom: 20 }}>
          <img src="/favicon.svg" alt="" className="brand__logo" />
          <div style={{ fontSize: 20 }}>MS-Fast</div>
        </div>

        {step === "credentials" ? (
          <Card title="Sign in" subtitle="Connect to your mStock account via the MS-Fast gateway.">
            <div
              className="segmented"
              role="tablist"
              aria-label="Verification method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={method === "otp"}
                onClick={() => setMethod("otp")}
              >
                OTP (SMS)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === "totp"}
                onClick={() => setMethod("totp")}
              >
                TOTP (App)
              </button>
            </div>

            {error && <Alert kind="error">{error}</Alert>}

            <form onSubmit={handleCredentials}>
              <Field
                label="mStock API Key"
                placeholder="your api key"
                value={apiKey}
                autoComplete="off"
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
              <Field
                label="Username / Client ID"
                placeholder="MA1234567"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Field
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <details className="disclosure">
                <summary>Connection settings</summary>
                <div style={{ marginTop: 14 }}>
                  <Field
                    label="API base URL"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    hint="Your deployed MS-Fast backend."
                  />
                  <Field
                    label="Gateway key (optional)"
                    placeholder="only if GATEWAY_API_KEY is set"
                    value={gatewayKey}
                    autoComplete="off"
                    onChange={(e) => setGatewayKey(e.target.value)}
                  />
                </div>
              </details>

              <div style={{ marginTop: 8 }}>
                <Button type="submit" loading={loading}>
                  {method === "otp" ? "Send OTP" : "Continue"}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card
            title={method === "otp" ? "Enter OTP" : "Enter authenticator code"}
            subtitle={
              method === "otp"
                ? "Check the SMS sent to your registered mobile."
                : "Open your authenticator app and enter the 6-digit code."
            }
          >
            {info && <Alert kind="info">{info}</Alert>}
            {error && <Alert kind="error">{error}</Alert>}

            <form onSubmit={handleVerify}>
              <Field
                label={method === "otp" ? "One-time password" : "TOTP code"}
                className="input--otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                required
                autoFocus
              />
              <div style={{ marginTop: 8 }}>
                <Button type="submit" loading={loading}>
                  Verify & sign in
                </Button>
              </div>
            </form>

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button
                type="button"
                className="btn btn--link"
                onClick={() => {
                  setStep("credentials");
                  setCode("");
                  setError(null);
                  setInfo(null);
                }}
              >
                ← Back
              </button>
            </div>
          </Card>
        )}

        <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 18 }}>
          Credentials are sent directly to your MS-Fast backend and stored only
          in this browser.
        </p>
      </div>
    </div>
  );
}
