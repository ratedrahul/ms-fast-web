import { useQuery } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { Alert, Button, Loading } from "../components/ui";
import { ErrorNotice } from "../components/ErrorNotice";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatCurrency, humanize } from "../lib/format";
import type { FundSummary } from "../types";

// Headline metrics shown as big cards (in display order), if present.
const HEADLINE: { key: string; label: string; hero?: boolean }[] = [
  { key: "AVAILABLE_BALANCE", label: "Available Balance", hero: true },
  { key: "CLEAR_BALANCE", label: "Clear Balance" },
  { key: "AMOUNT_UTILIZED", label: "Amount Utilized" },
  { key: "COLLATERALS", label: "Collaterals" },
  { key: "SUM_OF_ALL", label: "Sum of All" },
  { key: "PAY_OUT_AMT", label: "Payout Amount" },
];

export function Dashboard() {
  const { session, settings } = useAuth();

  const query = useQuery({
    queryKey: ["fund-summary", settings.baseUrl, session?.apiKey],
    enabled: Boolean(session),
    queryFn: ({ signal }) => api.fundSummary(settings, session!, signal),
  });

  const summary: FundSummary | undefined = Array.isArray(query.data)
    ? query.data[0]
    : (query.data as FundSummary | undefined);

  return (
    <Layout>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em" }}>
            Funds & Margin
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
            {session?.loginTime
              ? `Logged in ${session.loginTime}`
              : "Live account summary"}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => query.refetch()}
          loading={query.isFetching}
        >
          ↻ Refresh
        </Button>
      </div>

      {query.isLoading && <Loading label="Fetching fund summary…" />}

      {query.isError && (
        <ErrorNotice
          error={query.error}
          fallback="Could not load fund summary."
        />
      )}

      {summary && (
        <>
          <div className="stat-grid">
            {HEADLINE.filter((h) => summary[h.key] !== undefined).map((h) => (
              <div key={h.key} className={`stat ${h.hero ? "stat--hero" : ""}`}>
                <div className="stat__label">{h.label}</div>
                <div
                  className={`stat__value ${h.hero ? "stat__value--pos" : ""}`}
                >
                  {formatCurrency(summary[h.key])}
                </div>
              </div>
            ))}
          </div>

          <details className="disclosure" open style={{ marginTop: 28 }}>
            <summary>Full breakdown</summary>
            <div className="kv" style={{ marginTop: 14 }}>
              {Object.entries(summary).map(([key, value]) => (
                <div className="kv__row" key={key}>
                  <span className="kv__key">{humanize(key)}</span>
                  <span className="kv__val">
                    {isCurrencyKey(key) ? formatCurrency(value) : value || "—"}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </>
      )}

      {!query.isLoading && !query.isError && !summary && (
        <Alert kind="info">No fund summary data was returned.</Alert>
      )}
    </Layout>
  );
}

function isCurrencyKey(key: string): boolean {
  const nonCurrency = new Set(["LIMIT_TYPE", "SEG", "MTM_COMBINED"]);
  if (nonCurrency.has(key)) return false;
  return /BALANCE|MARGIN|AMT|AMOUNT|LIMIT|COLLATERAL|FUND|PROFIT|RECEIVABLE|SUM|HOLDING|UTILIZE|PREMIUM|PEAK/.test(
    key,
  );
}
