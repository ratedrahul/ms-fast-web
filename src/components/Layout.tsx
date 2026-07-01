import type { ReactNode } from "react";

export function Layout({
  right,
  children,
}: {
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" className="brand__logo" />
          <div>
            <div>MS-Fast</div>
            <div className="brand__tag">mStock Trading</div>
          </div>
        </div>
        {right}
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
