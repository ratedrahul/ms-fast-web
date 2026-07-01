import { useState } from "react";
import { ApiError } from "../lib/api";
import { Alert } from "./ui";

/**
 * Renders an API error. For the mStock "IP not whitelisted" error it shows the
 * server's outbound IP with a copy button and a link to update it at mStock;
 * everything else falls back to a plain error alert.
 */
export function ErrorNotice({
  error,
  fallback = "Something went wrong.",
}: {
  error: unknown;
  fallback?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (error instanceof ApiError && error.isIpWhitelist) {
    const ip = error.data?.server_ip;
    const helpUrl = error.data?.help_url || "https://trade.mstock.com";

    async function copyIp() {
      if (!ip) return;
      try {
        await navigator.clipboard.writeText(ip);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* clipboard blocked — user can still copy manually */
      }
    }

    return (
      <div className="alert alert--error ip-notice" role="alert">
        <div className="ip-notice__title">IP address not whitelisted</div>
        <p className="ip-notice__text">
          mStock rejected this request because the server calling it isn&apos;t
          on your API IP allow-list. Add the IP below as a Primary or Secondary
          IP in your mStock API settings, then try again.
        </p>

        {ip ? (
          <div className="ip-notice__ip">
            <code>{ip}</code>
            <button type="button" className="btn btn--ghost" onClick={copyIp}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        ) : (
          <p className="ip-notice__text">
            Couldn&apos;t determine the server IP automatically — open the API
            settings to see the incoming IP.
          </p>
        )}

        <a
          className="btn btn--primary ip-notice__link"
          href={helpUrl}
          target="_blank"
          rel="noreferrer"
        >
          Update IP at mStock →
        </a>
      </div>
    );
  }

  const message = error instanceof ApiError ? error.message : fallback;
  return <Alert kind="error">{message}</Alert>;
}
