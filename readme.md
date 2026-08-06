# MyFinance

UK-focused invoice, offer, and client billing app for freelancers and small businesses.

- **Desktop (Electron)** — full offline app, PDFs on disk, macOS / Windows installers from [Releases](https://github.com/TheSnowGuru/invoice-generator-electron-js/releases).
- **Web / iPad (PWA on Vercel)** — installable in Safari (**Add to Home Screen**), data in the browser; access protected by a **server-side** password (not embedded in the frontend).

## Quick start (desktop)

```bash
npm install
npm run dev
```

Build installers:

```bash
npm run electron:build:mac   # or electron:build:win / electron:build:all
```

## Web app (Vercel)

Production URL (example): **https://myfinance-beryl.vercel.app**

### Security model

| Layer | What it does |
|--------|----------------|
| **Edge middleware** | Blocks the SPA and APIs until a valid `HttpOnly` session cookie is set. Unauthenticated users only see `login.html` and `POST /api/auth/login`. |
| **API routes** (`/api/auth/*`) | Verify passwords with **scrypt** on the server. Session signing uses `SESSION_SECRET`. |
| **Password storage** | Prefer **Vercel KV** (`auth:password_hash`) so you can change the password in **Settings → Web access**. Without KV, login still works from env vars but password changes require linking KV. |
| **Frontend** | No password hashes or secrets in the JavaScript bundle (`VITE_HOSTED_AUTH` only toggles the settings UI and optional in-app sign-in fallback). |

### Vercel environment variables

Set these in the Vercel project (**Settings → Environment Variables**):

| Variable | Required | Purpose |
|----------|----------|---------|
| `ACCESS_PASSWORD` | Yes | Initial web access password (server only). |
| `SESSION_SECRET` | Yes | Random string, **at least 16 characters**, used to sign session cookies. |

Optional but recommended for **changing the password in the app**:

1. In Vercel: **Storage → Create KV database** and connect it to the project.
2. After KV is linked, use **Settings → Web access** in the app to set a new password.

### Deploy

```bash
npm run build:pwa:vercel
vercel deploy --prod
```

Or connect the GitHub repo to Vercel; `vercel.json` runs `npm run build:pwa:vercel` on each deploy.

### Local PWA preview (no server auth)

```bash
npm run build:pwa
npm run preview:pwa
```

Hosted auth is **off** unless `VITE_HOSTED_AUTH=true` (Vercel build only).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Electron + Vite dev server |
| `npm run build:pwa` | Static PWA build |
| `npm run build:pwa:vercel` | PWA + hosted auth UI for Vercel |
| `npm run preview:pwa` | Preview PWA locally |
| `npm run typecheck` | TypeScript check |

## Data

- **Electron:** JSON store under the app user data directory; PDFs in Documents/MyFinance (or a folder you choose in Settings).
- **Web PWA:** `localStorage` via the web platform API (per device; not synced with desktop automatically).

## License

MIT
