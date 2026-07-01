import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Button } from "./ui";
import { initials } from "../lib/format";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/orders", label: "Orders", end: false },
  { to: "/portfolio", label: "Portfolio", end: false },
  { to: "/watchlist", label: "Watchlist", end: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { session, settings, signOut } = useAuth();

  async function handleLogout() {
    try {
      if (session) await api.logout(settings, session);
    } catch {
      /* clear the local session even if the upstream logout fails */
    } finally {
      signOut();
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__left">
          <div className="brand">
            <img src="/favicon.svg" alt="" className="brand__logo" />
            <div>
              <div>MS-Fast</div>
              <div className="brand__tag">mStock Trading</div>
            </div>
          </div>
          <nav className="nav" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `nav__link ${isActive ? "nav__link--active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="user-pill">
          <div className="avatar">{initials(session?.userName)}</div>
          <div className="user-pill__meta">
            <span className="user-pill__name">{session?.userName || "Trader"}</span>
            <span className="user-pill__sub">
              {session?.email || session?.userId}
            </span>
          </div>
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
