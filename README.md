# MS-Fast Web

A responsive **React + TypeScript** frontend (installable **PWA**) for the
[MS-Fast](https://github.com/ratedrahul/fast-mstock) mStock trading gateway.
Works on desktop browsers and phones, and can be added to the home screen.

Live backend: https://fast-mstock.onrender.com

## Features (v1)
- **Auth flow** — login with username/password, then verify via **OTP (SMS)**
  or **TOTP (authenticator app)**; the daily access token is stored locally.
- **Dashboard** — funds & margin summary with headline cards (available
  balance, clear balance, utilization, collaterals…) and a full breakdown.
- Configurable **API base URL** and optional **gateway key** from the login
  screen.
- Clean, mobile-first dark UI; PWA-installable.

> Architected so the remaining trading screens (orders, positions, market
> watch, option chain, live ticks) drop in as new routes.

## Tech
- Vite 6, React 18, TypeScript (strict)
- React Router, TanStack Query
- `vite-plugin-pwa` for offline shell + installability

## Getting started
```bash
npm install

# Point at your backend (optional – defaults to the Render deployment)
cp .env.example .env

npm run dev       # http://localhost:5173
```

## Build
```bash
npm run build     # type-checks then builds to dist/
npm run preview   # serve the production build locally
```

## Configuration
| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://fast-mstock.onrender.com` | MS-Fast backend base URL |

The API base URL and gateway key can also be set at runtime from the login
screen's **Connection settings**.

## Deploy (static hosting)
The `dist/` output is fully static — deploy to Vercel, Netlify, Cloudflare
Pages, GitHub Pages or Render (Static Site). Add a SPA rewrite so all routes
serve `index.html`:

- **Vercel/Netlify**: framework preset "Vite" handles this automatically.
- **Render Static Site**: Build `npm run build`, Publish dir `dist`, add a
  rewrite rule `/* → /index.html`.

## Security notes
- Credentials/tokens are sent directly to your MS-Fast backend and stored only
  in the browser's `localStorage`.
- The mStock access token expires at midnight — sign in again daily.
- Set a `GATEWAY_API_KEY` on the backend and enter it here for a public
  deployment.

## License
MIT
