import * as electron from 'electron';
const { app, ipcMain } = electron;
import * as path from 'path';
import { fileURLToPath } from 'url';
// (child_process exec was used for legacy CLI spawning; no longer needed)
import axios from 'axios';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import {
  listBans,
  addBan as libAddBan,
  removeBan as libRemoveBan,
  updateFromCommunity,
  revertFromBackup,
  addMany as libAddMany,
} from './ban_lib.js';
import GVAS from './gvas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep a global reference of the window object
let mainWindow: electron.BrowserWindow | null = null;

// Simple persistent cache for steamId -> name
type NameCache = Record<string, string>;
let nameCache: NameCache = {};
let cacheLoaded = false;
let saveTimer: NodeJS.Timeout | null = null;
let autoUpdateTimer: NodeJS.Timeout | null = null;
let isQuitting = false;
let tray: electron.Tray | null = null;

// Encrypted secrets persisted with Electron safeStorage
function getSecretsPath() {
  return path.join(app.getPath('userData'), 'secrets.json');
}

async function readSecrets(): Promise<{ steamApiKeyEnc?: string }> {
  try {
    const p = getSecretsPath();
    const data = await fs.readFile(p, 'utf8');
    return JSON.parse(data || '{}');
  } catch {
    return {};
  }
}

async function writeSecrets(secrets: { steamApiKeyEnc?: string }) {
  try {
    const p = getSecretsPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(secrets, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

// Simple app config persisted to disk
type AppConfig = {
  autoUpdateEnabled: boolean;
  lastUpdateAt?: string;
  firstRunCheckDone?: boolean;
};
let appConfig: AppConfig = { autoUpdateEnabled: true };

function getCachePath() {
  // userData is available after app is ready, but this function is only used then
  return path.join(app.getPath('userData'), 'names-cache.json');
}

async function loadNameCache() {
  try {
    const p = getCachePath();
    const data = await fs.readFile(p, 'utf8');
    nameCache = JSON.parse(data || '{}');
  } catch {
    // no cache yet
    nameCache = {};
  } finally {
    cacheLoaded = true;
  }
}

async function saveNameCacheDebounced() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const p = getCachePath();
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, JSON.stringify(nameCache, null, 2), 'utf8');
    } catch {
      // ignore save errors
    }
  }, 500);
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'app-config.json');
}

async function loadAppConfig() {
  try {
    const p = getConfigPath();
    const data = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(data || '{}');
    appConfig = { autoUpdateEnabled: true, ...parsed } as AppConfig;
  } catch {
    appConfig = { autoUpdateEnabled: true };
  }
}

async function saveAppConfig() {
  try {
    const p = getConfigPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(appConfig, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

// =========================
// File helpers
// =========================
function getBanListPath(): string {
  const current = process.env.LOCKDOWN_SAVE_PATH;
  if (current && current.length > 0) return current;
  try {
    const defaultPath = path.join(
      process.env.LOCALAPPDATA || '',
      'LockdownProtocol/Saved/SaveGames/Save_BanList.sav'
    );
    return fsSync.existsSync(defaultPath) ? defaultPath : '';
  } catch {
    return '';
  }
}

function getBanPaths() {
  const sav = getBanListPath();
  const bak = sav ? sav.replace(/\.sav$/i, '.bak') : '';
  return { sav, bak };
}

function getMTime(file: string): number {
  try {
    return fsSync.statSync(file).mtimeMs || 0;
  } catch {
    return 0;
  }
}

async function filesEqual(a: string, b: string): Promise<boolean> {
  try {
    if (!a || !b || !fsSync.existsSync(a) || !fsSync.existsSync(b)) return false;
    const [abuf, bbuf] = await Promise.all([fs.readFile(a), fs.readFile(b)]);
    return abuf.length === bbuf.length && abuf.equals(bbuf);
  } catch {
    return false;
  }
}

// Parse messages like "Successfully added 0 new players from the community ban list!"
function parseAddedFromMessage(msg: string): number {
  const m = msg?.match(/Successfully\s+added\s+(\d+)/i);
  return m && m[1] ? parseInt(m[1], 10) || 0 : 0;
}

// Wraps a mutation that touches the ban list and snapshots the pre-change .bak
// only when the .sav actually changes.
async function runMutationWithSnapshot(
  reason: 'manual-add' | 'manual-remove' | 'community-update' | 'auto-update',
  mutate: () => Promise<string> | string
): Promise<string> {
  const { sav, bak } = getBanPaths();
  const before = sav ? getMTime(sav) : 0;
  const msg = await Promise.resolve(mutate());
  const after = sav ? getMTime(sav) : 0;
  if (after > before && bak && fsSync.existsSync(bak)) {
    await snapshotFrom(bak, reason);
  }
  return msg;
}

function createWindow(): void {
  // Create the browser window
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 900,
    minHeight: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Preload is copied to dist during build
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../assets/lobby-lockdown.ico'),
  });

  // Hide the native menu bar
  try {
    mainWindow.setMenuBarVisibility(false);
  } catch {
    /* ignore */
  }

  // Load renderer: always use Vite dev server in development to avoid stale bundles
  const isDevEnv = process.env.NODE_ENV === 'development';
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  // In production, dist/main.js runs from the dist folder; renderer output is at dist/renderer/index.html
  const loadProd = () => mainWindow!.loadFile(path.join(__dirname, 'renderer/index.html'));
  if (isDevEnv) {
    const tryLoadDev = (attempt = 1) => {
      mainWindow!.loadURL(devUrl).catch(() => {
        if (attempt < 5) setTimeout(() => tryLoadDev(attempt + 1), 300);
      });
    };
    tryLoadDev();
  } else {
    loadProd();
  }

  // Set the app icon
  mainWindow.setIcon(path.join(__dirname, '../assets/lobby-lockdown.ico'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Intercept close to hide to tray
  mainWindow.on('close', (e: electron.Event) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function setAppMenu() {
  try {
    const isMac = process.platform === 'darwin';
    const template: electron.MenuItemConstructorOptions[] = [];
    if (isMac) template.push({ role: 'appMenu' });
    template.push({ role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' });
    template.push({
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () =>
            electron.shell.openExternal('https://github.com/Lobby-Lockdown/lobby-lockdown'),
        },
        {
          label: 'Report an Issue',
          click: () =>
            electron.shell.openExternal(
              'https://github.com/Lobby-Lockdown/lobby-lockdown/issues/new/choose'
            ),
        },
        {
          label: 'Documentation (README)',
          click: () =>
            electron.shell.openExternal('https://github.com/Lobby-Lockdown/lobby-lockdown#readme'),
        },
      ],
    });
    const menu = electron.Menu.buildFromTemplate(template);
    electron.Menu.setApplicationMenu(menu);
  } catch {
    // ignore menu errors
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  await loadNameCache();
  await loadAppConfig();
  let didRunFirstCheck = false;
  // Default save path to the standard LOCALAPPDATA location if present
  try {
    const defaultPath = path.join(
      process.env.LOCALAPPDATA || '',
      'LockdownProtocol/Saved/SaveGames/Save_BanList.sav'
    );
    if (!process.env.LOCKDOWN_SAVE_PATH && defaultPath && fsSync.existsSync(defaultPath)) {
      process.env.LOCKDOWN_SAVE_PATH = defaultPath;
    }
  } catch {
    // ignore
  }
  // First-run: check for community updates once regardless of auto update settings
  try {
    if (!appConfig.firstRunCheckDone) {
      await performCommunityUpdate(true);
      appConfig.firstRunCheckDone = true;
      await saveAppConfig();
      didRunFirstCheck = true;
    }
  } catch {
    // ignore first-run check errors
  }
  // Load Steam API key from encrypted secrets (if present)
  try {
    const secrets = await readSecrets();
    if (secrets.steamApiKeyEnc && electron.safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(secrets.steamApiKeyEnc, 'base64');
      const key = electron.safeStorage.decryptString(buf);
      if (key) process.env.STEAM_API_KEY = key;
    }
  } catch {
    // continue without persisted key
  }
  createWindow();
  setAppMenu();
  createTray();
  if (appConfig.autoUpdateEnabled) scheduleAutoUpdate(!didRunFirstCheck);
});

// Quit when all windows are closed
// Keep running in background (do not quit when all windows closed)
app.on('window-all-closed', () => {
  // no-op to allow background tray operation
});

app.on('activate', () => {
  // On macOS it's common to re-create a window when dock icon is clicked
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (autoUpdateTimer) clearInterval(autoUpdateTimer);
});

// (Removed legacy IPC handlers for spawning CLI and env var access)

// Ban list operations
ipcMain.handle('list-bans', async () => {
  try {
    const ids = listBans();
    // Maintain plain output for renderer parsing
    return ids.join('\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

// Export/import
ipcMain.handle('export-bans', async () => {
  try {
    const ids = listBans();
    return ids.join('\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

ipcMain.handle('export-bans-to-file', async () => {
  try {
    const ids = listBans();
    const result = await electron.dialog.showSaveDialog(mainWindow!, {
      title: 'Save Ban List',
      defaultPath: path.join(app.getPath('documents'), 'lobby-banlist.txt'),
      filters: [
        { name: 'Text File', extensions: ['txt'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return 'Export canceled';
    const filePath = result.filePath;
    const isJson = filePath.toLowerCase().endsWith('.json');
    const content = isJson ? JSON.stringify({ steamIds: ids }, null, 2) : ids.join('\n');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return `Exported ${ids.length} ID${ids.length === 1 ? '' : 's'} to ${filePath}`;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

ipcMain.handle('import-bans-from-file', async () => {
  try {
    const result = await electron.dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Text or JSON', extensions: ['txt', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return 'Import canceled';
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');
    let ids: string[] = [];
    try {
      const parsed: unknown = JSON.parse(content);
      if (Array.isArray(parsed)) {
        ids = (parsed as unknown[]).map((v) => String(v));
      } else if (typeof parsed === 'object' && parsed !== null) {
        const maybe = parsed as { steamIds?: unknown };
        if (Array.isArray(maybe.steamIds)) {
          ids = maybe.steamIds.map((v) => String(v));
        }
      }
    } catch {
      ids = content
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const msg = await runMutationWithSnapshot('manual-add', () => libAddMany(ids));
    return msg;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

ipcMain.handle('add-ban', async (_event: electron.IpcMainInvokeEvent, steamId: string) => {
  try {
    return await runMutationWithSnapshot('manual-add', () => libAddBan(steamId));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

ipcMain.handle('remove-ban', async (_event: electron.IpcMainInvokeEvent, steamId: string) => {
  try {
    return await runMutationWithSnapshot('manual-remove', () => libRemoveBan(steamId));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

ipcMain.handle('update-bans', async () => {
  try {
    const msg = await runMutationWithSnapshot('community-update', () => updateFromCommunity());
    const added = parseAddedFromMessage(msg);
    return added > 0 ? msg : 'Ban list is up to date — no new community bans.';
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

ipcMain.handle('revert-bans', async () => {
  try {
    const { sav, bak } = getBanPaths();
    if (sav && bak && fsSync.existsSync(sav) && fsSync.existsSync(bak)) {
      const equal = await filesEqual(sav, bak);
      if (!equal) {
        await snapshotFrom(sav, 'manual-revert');
      }
    }
    const msg = revertFromBackup();
    return msg;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
});

// Steam API key management
ipcMain.handle('set-steam-api-key', async (_event: electron.IpcMainInvokeEvent, apiKey: string) => {
  const value = (apiKey || '').trim();
  try {
    if (!value) {
      // Remove saved key
      await writeSecrets({});
      delete process.env.STEAM_API_KEY;
      return true;
    }
    if (electron.safeStorage.isEncryptionAvailable()) {
      const enc = electron.safeStorage.encryptString(value);
      await writeSecrets({ steamApiKeyEnc: enc.toString('base64') });
      process.env.STEAM_API_KEY = value;
      return true;
    }
    // Fallback: session only
    process.env.STEAM_API_KEY = value;
    return false;
  } catch {
    process.env.STEAM_API_KEY = value || '';
    return false;
  }
});

ipcMain.handle('get-steam-api-key', async () => {
  try {
    const secrets = await readSecrets();
    if (secrets.steamApiKeyEnc && electron.safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(secrets.steamApiKeyEnc, 'base64');
      return electron.safeStorage.decryptString(buf);
    }
  } catch {
    // ignore
  }
  return process.env.STEAM_API_KEY || '';
});

// File operations
ipcMain.handle('select-save-file', async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Save Files', extensions: ['sav'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    process.env.LOCKDOWN_SAVE_PATH = result.filePaths[0];
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-save-file-path', () => getBanListPath());

// App info and external links
ipcMain.handle('get-app-version', () => {
  try {
    return app.getVersion();
  } catch {
    return '';
  }
});

ipcMain.handle('open-external', async (_event: electron.IpcMainInvokeEvent, url: string) => {
  try {
    await electron.shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
});

// Environment capabilities
ipcMain.handle('encryption-available', () => {
  try {
    return electron.safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
});

// (Legacy dialog IPC removed; renderer uses custom React confirm/toast)

// Resolve player names (batched)
ipcMain.handle('resolve-names', async (_event: electron.IpcMainInvokeEvent, steamIds: string[]) => {
  const apiKey = process.env.STEAM_API_KEY;
  if (!steamIds?.length) return {};

  // Ensure cache is loaded
  if (!cacheLoaded) {
    await loadNameCache();
  }

  // Split into cache hits and misses
  const uniqueIds = Array.from(new Set(steamIds));
  const hits: Record<string, string> = {};
  const misses: string[] = [];
  for (const id of uniqueIds) {
    if (nameCache[id]) hits[id] = nameCache[id];
    else misses.push(id);
  }

  // If no API key or nothing to fetch, return hits only
  if (!apiKey || misses.length === 0) {
    return hits;
  }

  const chunks: string[][] = [];
  const size = 100;
  for (let i = 0; i < misses.length; i += size) chunks.push(misses.slice(i, i + size));
  const fetched: Record<string, string> = {};
  for (const chunk of chunks) {
    try {
      const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${chunk.join(
        ','
      )}`;
      const { data } = await axios.get(url);
      const players = data?.response?.players || [];
      for (const p of players) {
        if (p?.steamid && p?.personaname) fetched[p.steamid] = p.personaname as string;
      }
    } catch {
      // ignore batch errors to keep UI snappy
    }
  }

  // Update cache with fetched names
  let changed = false;
  for (const [id, name] of Object.entries(fetched)) {
    if (!nameCache[id] || nameCache[id] !== name) {
      nameCache[id] = name;
      changed = true;
    }
  }
  if (changed) await saveNameCacheDebounced();

  // Merge hits and fetched and return only requested ids
  const merged: Record<string, string> = { ...hits, ...fetched };
  return merged;
});

// Name cache maintenance
ipcMain.handle('clear-name-cache', async () => {
  try {
    nameCache = {};
    cacheLoaded = true;
    try {
      const p = getCachePath();
      await fs.unlink(p);
    } catch {
      // ignore if file doesn't exist
    }
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('get-name-cache-size', async () => {
  if (!cacheLoaded) {
    await loadNameCache();
  }
  try {
    return Object.keys(nameCache).length;
  } catch {
    return 0;
  }
});

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../assets/lobby-lockdown.ico');
    tray = new electron.Tray(iconPath);
    tray.setToolTip('Lobby Lockdown');

    const contextMenu = () =>
      electron.Menu.buildFromTemplate([
        {
          label: 'Open Lobby Lockdown',
          click: () => {
            if (!mainWindow) createWindow();
            mainWindow?.show();
            mainWindow?.focus();
          },
        },
        {
          label: 'Update Now',
          click: () => performCommunityUpdate(false),
        },
        {
          label: appConfig.autoUpdateEnabled ? 'Auto Update: On' : 'Auto Update: Off',
          click: async () => {
            appConfig.autoUpdateEnabled = !appConfig.autoUpdateEnabled;
            await saveAppConfig();
            if (appConfig.autoUpdateEnabled) scheduleAutoUpdate();
            else cancelAutoUpdate();
            tray?.setContextMenu(contextMenu());
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);

    tray.setContextMenu(contextMenu());
    tray.on('click', () => {
      if (!mainWindow) {
        createWindow();
      }
      if (mainWindow?.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow?.show();
      }
    });
  } catch {
    // fail silently if tray cannot be created
  }
}

function cancelAutoUpdate() {
  if (autoUpdateTimer) clearInterval(autoUpdateTimer);
  autoUpdateTimer = null;
}

function scheduleAutoUpdate(runImmediately: boolean = true) {
  cancelAutoUpdate();
  const hour = 60 * 60 * 1000;
  // run once on schedule start (optional)
  if (runImmediately) performCommunityUpdate(true);
  autoUpdateTimer = setInterval(() => performCommunityUpdate(true), hour);
}

let isUpdating = false;
async function performCommunityUpdate(silent: boolean) {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const msg = await runMutationWithSnapshot('auto-update', () => updateFromCommunity());
    const added = parseAddedFromMessage(msg);
    const display = added > 0 ? msg : 'Ban list is up to date — no new community bans.';
    appConfig.lastUpdateAt = new Date().toISOString();
    await saveAppConfig();
    if (!silent) showTrayMessage('Community Update', display);
    // Always notify renderer via background toast for automatic operations
    try {
      electron.BrowserWindow.getAllWindows().forEach((w: electron.BrowserWindow) =>
        w.webContents.send('background-toast', {
          kind: added > 0 ? 'success' : 'info',
          message: display,
        })
      );
    } catch {
      /* noop */
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    if (!silent) showTrayMessage('Community Update Failed', err);
    try {
      electron.BrowserWindow.getAllWindows().forEach((w: electron.BrowserWindow) =>
        w.webContents.send('background-toast', {
          kind: 'error',
          message: `Community update failed: ${err}`,
        })
      );
    } catch {
      /* noop */
    }
  } finally {
    isUpdating = false;
  }
}

type TrayWithBalloon = electron.Tray & {
  displayBalloon?: (opts: { title: string; content: string }) => void;
};

function hasDisplayBalloon(t: electron.Tray): t is TrayWithBalloon & {
  displayBalloon: (opts: { title: string; content: string }) => void;
} {
  return typeof (t as TrayWithBalloon).displayBalloon === 'function';
}

function showTrayMessage(title: string, content: string) {
  // On Windows, Tray.displayBalloon is available
  if (process.platform === 'win32' && tray && hasDisplayBalloon(tray)) {
    tray.displayBalloon({ title, content });
  } else if (electron.Notification && electron.Notification.isSupported()) {
    const n = new electron.Notification({ title, body: content });
    n.show();
  }
}

// =========================
// Ban list revision history
// =========================
type RevisionMeta = {
  id: string; // timestamp id
  createdAt: string; // ISO time
  count: number; // number of steam ids
  reason: string; // manual-add, manual-remove, community-update, manual-revert, auto-update
  file: string; // absolute path to snapshot
};

function getRevisionsDir() {
  return path.join(app.getPath('userData'), 'revisions');
}

function tsId(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function countSteamIds(filePath: string): Promise<number> {
  try {
    const g = new GVAS(filePath, { createBackup: false });
    const ids = g.getBanList();
    return Array.isArray(ids) ? ids.length : 0;
  } catch {
    return 0;
  }
}

// (legacy snapshotBanList removed; use snapshotFrom when a change is detected)

async function snapshotFrom(filePath: string, reason: string): Promise<void> {
  try {
    const src = filePath;
    if (!src || !fsSync.existsSync(src)) return;
    const dir = getRevisionsDir();
    await fs.mkdir(dir, { recursive: true });
    const id = tsId();
    const dest = path.join(dir, `${id}.sav`);
    const count = await countSteamIds(src);
    await fs.copyFile(src, dest);
    const meta: RevisionMeta = {
      id,
      createdAt: new Date().toISOString(),
      count,
      reason,
      file: dest,
    };
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(meta, null, 2), 'utf8');
    await pruneRevisions(25);
  } catch {
    // ignore snapshot failures
  }
}

async function readRevisions(): Promise<RevisionMeta[]> {
  try {
    const dir = getRevisionsDir();
    const entries = await fs.readdir(dir);
    const metas: RevisionMeta[] = [];
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      try {
        const meta = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8')) as RevisionMeta;
        metas.push(meta);
      } catch {
        // ignore bad entries
      }
    }
    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return metas;
  } catch {
    return [];
  }
}

ipcMain.handle('list-revisions', async () => {
  return await readRevisions();
});

ipcMain.handle('revert-to-revision', async (_event: electron.IpcMainInvokeEvent, id: string) => {
  try {
    const list = await readRevisions();
    const rev = list.find((r) => r.id === id);
    if (!rev) throw new Error('Revision not found');
    const target = getBanListPath();
    if (!target) throw new Error('No save file selected');
    const equal = await filesEqual(target, rev.file);
    if (equal) {
      return `Already at revision ${id}`;
    }
    await snapshotFrom(target, 'manual-revert-to-revision');
    await fs.copyFile(rev.file, target);
    return `Reverted to revision ${id} (${rev.count} entries)`;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to revert';
    return `Error: ${msg}`;
  }
});

async function pruneRevisions(max: number) {
  try {
    const list = await readRevisions(); // newest first
    if (list.length <= max) return;
    const toDelete = list.slice(max);
    for (const rev of toDelete) {
      try {
        await fs.unlink(rev.file);
      } catch {
        /* ignore delete error */
      }
      try {
        await fs.unlink(path.join(getRevisionsDir(), `${rev.id}.json`));
      } catch {
        /* ignore delete error */
      }
    }
  } catch {
    // ignore
  }
}

ipcMain.handle('open-revisions-folder', async () => {
  try {
    const dir = getRevisionsDir();
    await fs.mkdir(dir, { recursive: true });
    const res = await electron.shell.openPath(dir);
    return res || '';
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to open folder';
    return `Error: ${msg}`;
  }
});

ipcMain.handle('get-current-ban-count', async () => {
  try {
    const p = getBanListPath();
    if (!p) return 0;
    return await countSteamIds(p);
  } catch {
    return 0;
  }
});
