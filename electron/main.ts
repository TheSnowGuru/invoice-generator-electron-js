import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { DataStore } from './store';
import { generateInvoicePdf, generateOfferPdf, type InvoiceDocKind } from './pdf';
import { exportInvoicesCsv, exportPaymentsCsv, exportClientsCsv } from './csv';
import type { CompanySettings, Client, Invoice, Offer, Payment } from './types';

process.env.DIST = path.join(__dirname, '../dist');

let mainWindow: BrowserWindow | null = null;
let store: DataStore;

function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getPdfDir() {
  const dir = path.join(app.getPath('documents'), 'FlowState Finance', 'invoices');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getOffersPdfDir() {
  const dir = path.join(app.getPath('documents'), 'FlowState Finance', 'offers');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function windowBg(theme?: string) {
  return theme === 'light' ? '#f4f7fb' : '#0f172a';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'FlowState Finance',
    backgroundColor: windowBg(store.getCompany().theme),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }
}

function registerIpc() {
  // ---- Bootstrap / bulk ----
  ipcMain.handle('data:getAll', () => store.getAll());

  // ---- Company ----
  ipcMain.handle('company:get', () => store.getCompany());
  ipcMain.handle('company:save', (_e, company: CompanySettings) => {
    const saved = store.saveCompany(company);
    mainWindow?.setBackgroundColor(windowBg(saved.theme));
    return saved;
  });

  // ---- Clients ----
  ipcMain.handle('clients:list', () => store.listClients());
  ipcMain.handle('clients:save', (_e, client: Client) => store.saveClient(client));
  ipcMain.handle('clients:delete', (_e, id: string) => store.deleteClient(id));

  // ---- Invoices ----
  ipcMain.handle('invoices:list', () => store.listInvoices());
  ipcMain.handle('invoices:save', (_e, invoice: Invoice) => store.saveInvoice(invoice));
  ipcMain.handle('invoices:delete', (_e, id: string) => store.deleteInvoice(id));

  // ---- Offers ----
  ipcMain.handle('offers:list', () => store.listOffers());
  ipcMain.handle('offers:save', (_e, offer: Offer) => store.saveOffer(offer));
  ipcMain.handle('offers:delete', (_e, id: string) => store.deleteOffer(id));

  // ---- Payments ----
  ipcMain.handle('payments:list', () => store.listPayments());
  ipcMain.handle('payments:save', (_e, payment: Payment) => store.savePayment(payment));
  ipcMain.handle('payments:delete', (_e, id: string) => store.deletePayment(id));

  // ---- PDF ----
  ipcMain.handle(
    'pdf:invoice',
    async (_e, invoiceId: string, kind: InvoiceDocKind = 'invoice') => {
      const invoice = store.listInvoices().find((i) => i.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      const client = store.listClients().find((c) => c.id === invoice.clientId);
      if (!client) throw new Error('Client not found');
      const company = store.getCompany();
      const suffix = kind === 'invoice' ? '' : `-${kind}`;
      const safeNumber = invoice.number.replace(/[^\w.-]+/g, '_');
      const outPath = path.join(getPdfDir(), `${safeNumber}${suffix}.pdf`);
      await generateInvoicePdf({
        invoice,
        client,
        company,
        outPath,
        kind,
        payments: store.listPayments(),
      });
      return outPath;
    }
  );

  ipcMain.handle(
    'pdf:offer',
    async (_e, offerId: string, style: 'pricing' | 'quotation' = 'pricing') => {
      const offer = store.listOffers().find((o) => o.id === offerId);
      if (!offer) throw new Error('Offer not found');
      const client = store.listClients().find((c) => c.id === offer.clientId);
      if (!client) throw new Error('Client not found');
      const company = store.getCompany();
      const safeNumber = offer.number.replace(/[^\w.-]+/g, '_');
      const suffix = style === 'pricing' ? '-pricing' : '-quotation';
      const outPath = path.join(getOffersPdfDir(), `${safeNumber}${suffix}.pdf`);
      await generateOfferPdf({ offer, client, company, outPath, style });
      return outPath;
    }
  );

  ipcMain.handle('pdf:open', async (_e, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle('pdf:reveal', async (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // ---- CSV export ----
  ipcMain.handle('csv:export', async (_e, kind: 'invoices' | 'payments' | 'clients') => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: `Export ${kind} CSV`,
      defaultPath: path.join(app.getPath('documents'), `flowstate-${kind}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return null;

    if (kind === 'invoices') {
      exportInvoicesCsv(filePath, store.listInvoices(), store.listClients(), store.listPayments());
    } else if (kind === 'payments') {
      exportPaymentsCsv(filePath, store.listPayments(), store.listInvoices());
    } else {
      exportClientsCsv(filePath, store.listClients(), store.listInvoices(), store.listPayments());
    }
    return filePath;
  });

  // ---- Logo picker ----
  ipcMain.handle('dialog:pickLogo', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select company logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const src = result.filePaths[0];
    const destDir = path.join(getDataDir(), 'assets');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const ext = path.extname(src);
    const dest = path.join(destDir, `logo${ext}`);
    fs.copyFileSync(src, dest);
    return dest;
  });

  ipcMain.handle('fs:readDataUrl', async (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  });
}

app.whenReady().then(() => {
  store = new DataStore(getDataDir());
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
