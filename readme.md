This Product Requirements Document (PRD) outlines the core architecture and functionality of **FlowState Finance**, an invoice and payment tracking application tailored for UK-based small businesses and freelancers.

---

# Product Requirements Document: FlowState Finance (Electron Desktop)

## 1. Executive Summary
FlowState Finance is a professional-grade desktop application designed for UK businesses to manage the end-to-end invoice lifecycle. It focuses on UK tax compliance (VAT), multi-currency support, and professional branding, providing a localized alternative to global cloud-based accounting platforms.

## 2. Target Audience
*   UK-based freelancers, creative consultants, and small limited companies.
*   Users requiring offline-first data sovereignty (Local Electron app).
*   Professionals needing high-quality, branded PDF invoices with consistent UK formatting.

## 3. Core Functional Requirements

### A. Company Configuration & Branding
*   **Profile Management:** Store company legal details (Name, Address, Company Number, VAT Number).
*   **Branding Engine:** 
    *   Logo upload (PNG/JPG).
    *   Dynamic accent color selection (custom hex or presets) applied to PDF headers and UI.
*   **Banking Data:** Secure storage of bank details (Account Name, Sort Code, IBAN, BIC) for automated inclusion in PDF footers.

### B. Invoice Management
*   **Lifecycle:** Draft → Sent → Partially Paid → Paid → Overdue.
*   **Creation:** 
    *   Client database integration (lookup existing or create new).
    *   Dynamic line-item generation (auto-calculating subtotal, VAT @ 20%, and grand total).
    *   Customizable invoice prefixes and notes.
*   **PDF Engine:** Professional, branded PDF generation.
    *   Includes company header, branding colors, "Bill To" section, line-item table, VAT breakdown, and bank details.
*   **Communication:** Email triggering (using locally managed templates) for invoice delivery and overdue reminders.

### C. Financial Tracking & Reporting
*   **Payment Tracking:** Record partial or full payments against specific invoices.
*   **Dashboard Analytics:**
    *   **KPI Metrics:** Total Invoiced, VAT Collected (Payable), VAT Outstanding, Monthly Trends.
    *   **Visualizations:** Monthly invoicing bar charts, revenue distribution by status (pie chart), and client leaderboard (by revenue).

### D. Client Relationship Management
*   **Client Profiles:** Manage contacts, billing addresses, and historical invoice links.
*   **Defaulting:** UK-localized defaults (e.g., London as the default city).

## 4. Technical Constraints (Electron Architecture)

### A. Data Persistence
*   Since the app will run as an Electron desktop instance, you must replace the existing cloud-based backend with a local database strategy (e.g., **SQLite** or **PouchDB**).
*   **Local File System:** Securely store generated PDFs in a dedicated user-selected directory.

### B. Localization & Formatting
*   **Currency:** Fixed to GBP (£) with `en-GB` formatting standards (two decimal places).
*   **Date Standards:** `dd/MM/yyyy` format.

## 5. UI/UX Design Principles
*   **Professional, Dark-Themed UI:** Low-light palette (Navy/Slate) to reduce eye strain during finance tasks.
*   **Responsiveness:** Fluid layout that scales from small desktop windows to full-screen monitors.
*   **Feedback Loops:** Visual cues for save status, PDF generation success, and payment recording.

## 6. Development Roadmap

### Phase 1: Foundation
*   Setup Electron/React/TypeScript environment.
*   Implement local SQLite database layer (replace the current API SDK).
*   Establish state management (Redux or Zustand) to mirror the existing UI.

### Phase 2: Core Engine
*   Build the Invoice generation logic (JS-to-PDF).
*   Implement company settings storage (JSON config).
*   Build the CRUD operations for Invoices, Clients, and Payments.

### Phase 3: Reporting & Polish
*   Implement Recharts or similar for the Dashboard analytics.
*   Implement PDF branding engine (Logo/Color injection).
*   Final styling and UK-specific polish (VAT/Currency validation).

---

### Comparison for your Dev (Cloud vs. Electron)
| Feature | Original (Current) | Target (Electron) |
| :--- | :--- | :--- |
| **Backend** | Base44 (Cloud) | Local SQLite |
| **Auth** | Managed by Platform | Not required / Local Profile |
| **PDF Storage** | Cloud Storage | Local `/documents/invoices/` |
| **Deployment** | Web-hosted | Desktop Installer (.dmg / .exe) |

*Note: Since the existing app relies heavily on `base44` SDK calls for data operations, your dev will need to create a **Data Access Layer** abstraction that switches from API calls to local database queries.*
