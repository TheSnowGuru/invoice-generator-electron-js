import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DataStore } from './store';
import { generateInvoicePdf, generateOfferPdf, type InvoiceDocKind } from './pdf';
import { exportInvoicesCsv, exportPaymentsCsv, exportClientsCsv } from './csv';
import type { CompanySettings, Client, Invoice, Offer, Payment } from './types';

const execFileAsync = promisify(execFile);

process.env.DIST = path.join(__dirname, '../dist');

let mainWindow: BrowserWindow | null = null;
let store: DataStore;

function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeSegment(name: string): string {
  const cleaned = (name || 'Unknown')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'Unknown';
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getInvoicesRoot(): string {
  const custom = store.getCompany().pdfOutputDir?.trim();
  const dir =
    custom || path.join(app.getPath('documents'), 'MyFinance', 'invoices');
  return ensureDir(dir);
}

function getOffersRoot(): string {
  const customInvoices = store.getCompany().pdfOutputDir?.trim();
  const dir = customInvoices
    ? path.join(path.dirname(customInvoices), 'offers')
    : path.join(app.getPath('documents'), 'MyFinance', 'offers');
  return ensureDir(dir);
}

function clientFilePath(root: string, clientName: string, fileName: string): string {
  const clientDir = ensureDir(path.join(root, safeSegment(clientName)));
  return path.join(clientDir, fileName);
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
    title: 'MyFinance',
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
  ipcMain.handle('data:getAll', () => store.getAll());

  ipcMain.handle('company:get', () => store.getCompany());
  ipcMain.handle('company:save', (_e, company: CompanySettings) => {
    const saved = store.saveCompany(company);
    mainWindow?.setBackgroundColor(windowBg(saved.theme));
    return saved;
  });

  ipcMain.handle('clients:list', () => store.listClients());
  ipcMain.handle('clients:save', (_e, client: Client) => store.saveClient(client));
  ipcMain.handle('clients:delete', (_e, id: string) => store.deleteClient(id));

  ipcMain.handle('invoices:list', () => store.listInvoices());
  ipcMain.handle('invoices:save', (_e, invoice: Invoice) => store.saveInvoice(invoice));
  ipcMain.handle('invoices:delete', (_e, id: string) => store.deleteInvoice(id));

  ipcMain.handle('offers:list', () => store.listOffers());
  ipcMain.handle('offers:save', (_e, offer: Offer) => store.saveOffer(offer));
  ipcMain.handle('offers:delete', (_e, id: string) => store.deleteOffer(id));

  ipcMain.handle('payments:list', () => store.listPayments());
  ipcMain.handle('payments:save', (_e, payment: Payment) => store.savePayment(payment));
  ipcMain.handle('payments:delete', (_e, id: string) => store.deletePayment(id));

  ipcMain.handle(
    'pdf:invoice',
    async (_e, invoiceId: string, kind: InvoiceDocKind = 'invoice') => {
      const invoice = store.listInvoices().find((i) => i.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      const client = store.listClients().find((c) => c.id === invoice.clientId);
      if (!client) throw new Error('Client not found');
      const company = store.getCompany();
      const suffix = kind === 'invoice' ? '' : `-${kind}`;
      const safeNumber = safeSegment(invoice.number.replace(/[^\w.-]+/g, '_'));
      const fileName = `${safeNumber}${suffix}.pdf`;
      const outPath = clientFilePath(getInvoicesRoot(), client.name, fileName);
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
      const safeNumber = safeSegment(offer.number.replace(/[^\w.-]+/g, '_'));
      const suffix = style === 'pricing' ? '-pricing' : '-quotation';
      const fileName = `${safeNumber}${suffix}.pdf`;
      const outPath = clientFilePath(getOffersRoot(), client.name, fileName);
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

  ipcMain.handle('share:readFile', async (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found');
    const buf = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      mime: 'application/pdf',
      data: buf,
    };
  });

  ipcMain.handle('share:whatsapp', async (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found');
    if (process.platform !== 'darwin') {
      throw new Error('WhatsApp share is available on macOS');
    }
    try {
      await execFileAsync('osascript', [
        '-e',
        `set the clipboard to (POSIX file ${JSON.stringify(filePath)})`,
      ]);
    } catch {
      // clipboard is optional
    }
    try {
      await execFileAsync('open', ['-a', 'WhatsApp', filePath]);
    } catch {
      await execFileAsync('open', ['-a', 'WhatsApp']);
      throw new Error(
        'Opened WhatsApp — paste (\u2318V) to attach the PDF, or use Share\u2026 and pick WhatsApp'
      );
    }
    return true;
  });

  ipcMain.handle('share:mac', async (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found');
    if (process.platform !== 'darwin') throw new Error('System share is available on macOS');

    const escaped = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `
      ObjC.import('AppKit');
      const url = $.NSURL.fileURLWithPath("${escaped}");
      const picker = $.NSSharingServicePicker.alloc.initWithItems([url]);
      const mouse = $.NSEvent.mouseLocation;
      const rect = $.NSMakeRect(mouse.x, mouse.y, 1, 1);
      const view = $.NSView.alloc.initWithFrame(rect);
      const window = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
        rect,
        $.NSBorderlessWindowMask,
        $.NSBackingStoreBuffered,
        false
      );
      window.setOpaque(false);
      window.setBackgroundColor($.NSColor.clearColor);
      window.setLevel($.NSFloatingWindowLevel);
      window.setContentView(view);
      window.orderFrontRegardless();
      picker.showRelativeToRect_ofView_preferredEdge(rect, view, $.NSMaxYEdge);
      delay(0.3);
    `;
    try {
      await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
        timeout: 120000,
      });
      return true;
    } catch {
      shell.showItemInFolder(filePath);
      return false;
    }
  });

  ipcMain.handle('csv:export', async (_e, kind: 'invoices' | 'payments' | 'clients') => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: `Export ${kind} CSV`,
      defaultPath: path.join(app.getPath('documents'), `myfinance-${kind}.csv`),
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

  ipcMain.handle('dialog:pickInvoicesFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choose invoices folder',
      defaultPath: getInvoicesRoot(),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('paths:invoicesRoot', () => getInvoicesRoot());

  ipcMain.handle('fs:readDataUrl', async (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/png';
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
