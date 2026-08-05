# FlowState Finance

Offline-first Electron desktop app for UK freelancers and small businesses. Manage clients, invoices, offers, payments, branded PDFs, and CSV reports — all stored locally as JSON.

## Features

- **Company branding** — logo, accent colour, VAT/company numbers, UK bank details
- **Invoices** — draft → sent → partial → paid → overdue, with 20% VAT defaults (GBP, en-GB dates)
- **Offers / quotations** — professional PDFs, convert accepted offers to invoices
- **Payments** — record partial/full payments and auto-update status
- **Dashboard** — KPIs, monthly charts, status breakdown, client leaderboard
- **PDF engine** — branded A4 invoices & offers saved under `~/Documents/FlowState Finance/`
- **CSV reports** — export invoices, payments, or clients
- **JSON storage** — single local file in the Electron userData folder (`flowstate-data.json`)

## Requirements

- macOS
- Node.js 20+

## Run (development)

```bash
npm install
npm run dev
```

This starts Vite and opens the Electron window.

## Build a macOS app

```bash
npm run electron:build
```

Output appears in `release/` (`.dmg` / `.zip`).

## First-time setup

1. Open **Settings** and fill in your company, VAT, bank details, and logo
2. Add a **Client**
3. Create an **Invoice** or **Offer**, then click **PDF**

## Data locations

| Data | Location |
|------|----------|
| JSON database | Electron `userData` / `data/flowstate-data.json` |
| Invoice PDFs | `~/Documents/FlowState Finance/invoices/` |
| Offer PDFs | `~/Documents/FlowState Finance/offers/` |
| CSV exports | Chosen via save dialog |

## Tech stack

Electron · React · TypeScript · Vite · Zustand · PDFKit · Recharts
