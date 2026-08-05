# MyFinance

Offline-first Electron desktop app for UK freelancers and small businesses. Manage clients, invoices, offers, payments, branded PDFs, and CSV reports — all stored locally as JSON. No cloud account required.

## Features

- **Company branding** — logo, accent colour, VAT/company numbers, UK bank details
- **Appearance** — dark and light themes (Settings → Appearance)
- **Invoices** — lifecycle draft → sent → partial → paid → overdue, with configurable VAT (default 20%), GBP, and `dd/MM/yyyy` dates
- **Document PDFs (Actions ▾)** — tax invoice, proforma invoice, receipt, and payment reminder from each invoice
- **Offers / quotations** — premium **pricing offer** PDF plus classic quotation; convert accepted offers into draft invoices
- **Payments** — record partial or full payments; invoice status updates automatically
- **Clients** — contacts, billing addresses, and revenue totals
- **Dashboard** — KPIs (invoiced, VAT collected/outstanding, amount due), monthly charts, status pie chart, client leaderboard
- **PDF engine** — branded A4 invoices & offers (header, line items, VAT breakdown, bank details)
- **CSV reports** — export invoices, payments, or clients for spreadsheets / accountants
- **JSON storage** — single local database file; offline-first data sovereignty

## Requirements

- macOS (Apple Silicon arm64 build)
- Node.js 20+ (for development / building only)

## Install from DMG

1. Build (or use an existing build):

```bash
npm install
npm run electron:build
```

2. Open the installer:

`release/MyFinance-1.0.0-arm64.dmg`

3. Drag **MyFinance** into **Applications**
4. First launch (unsigned build): right-click the app → **Open** → **Open**

## Run (development)

```bash
npm install
npm run dev
```

Starts Vite and opens the Electron window with hot reload.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development mode (Vite + Electron) |
| `npm run build` | Production web/electron bundle only |
| `npm run electron:build` | Build macOS `.dmg` into `release/` |
| `npm run typecheck` | TypeScript check (renderer + main) |

## First-time setup

1. Open **Settings**
   - Fill in company legal details, VAT, and bank details
   - Upload a logo and pick an accent colour
   - Choose **Dark** or **Light** theme
   - Optionally set a custom invoices folder
2. Add a **Client**
3. Create an **Invoice** or **Offer**, then generate a PDF from **Actions**
4. Optionally record **Payments** and export **Reports** as CSV

## Data locations

| Data | Location |
|------|----------|
| JSON database | `~/Library/Application Support/myfinance/data/myfinance-data.json` |
| Logo assets | `~/Library/Application Support/myfinance/data/assets/` |
| Invoice PDFs | `~/Documents/MyFinance/invoices/{ClientName}/` (or custom folder in Settings) |
| Offer PDFs | `~/Documents/MyFinance/offers/{ClientName}/` |
| CSV exports | Chosen via save dialog |
| macOS installer | `release/MyFinance-1.0.0-arm64.dmg` |

## Tech stack

Electron · React · TypeScript · Vite · Zustand · PDFKit · Recharts

## Notes

- Currency is fixed to **GBP (£)** with `en-GB` formatting
- The packaged app is currently **unsigned**; Gatekeeper may require a right-click → Open on first launch
- Rebuild the DMG after code changes with `npm run electron:build`
