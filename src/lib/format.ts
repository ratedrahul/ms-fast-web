const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** Format a numeric string as INR currency; falls back to the raw value. */
export function formatCurrency(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return inr.format(n);
}

/** Format a value as INR with an explicit +/- sign (for P&L figures). */
export function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${inr.format(Math.abs(value))}`;
}

/** Format a percentage with sign and two decimals. */
export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** CSS modifier for a P&L number: positive/negative/neutral. */
export function pnlClass(value: number): string {
  if (value > 0) return "pnl--pos";
  if (value < 0) return "pnl--neg";
  return "";
}

/** Humanise an UPPER_SNAKE_CASE key into "Title Case". */
export function humanize(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "U").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
