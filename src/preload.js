/* eslint-env node */
// Preload runs in Electron's isolated world; keep CommonJS require
// eslint-disable-next-line no-undef
const { contextBridge, ipcRenderer } = require('electron');

// Define the API interface
const electronAPI = {
  // Ban list operations
  listBans: () => ipcRenderer.invoke('list-bans'),
  addBan: (steamId) => ipcRenderer.invoke('add-ban', steamId),
  removeBan: (steamId) => ipcRenderer.invoke('remove-ban', steamId),
  updateBans: () => ipcRenderer.invoke('update-bans'),
  revertBans: () => ipcRenderer.invoke('revert-bans'),
  exportBans: () => ipcRenderer.invoke('export-bans'),
  exportBansToFile: () => ipcRenderer.invoke('export-bans-to-file'),
  importBansFromFile: () => ipcRenderer.invoke('import-bans-from-file'),

  // Steam API key management
  setSteamApiKey: (apiKey) => ipcRenderer.invoke('set-steam-api-key', apiKey),
  getSteamApiKey: () => ipcRenderer.invoke('get-steam-api-key'),

  // File operations
  selectSaveFile: () => ipcRenderer.invoke('select-save-file'),
  getSaveFilePath: () => ipcRenderer.invoke('get-save-file-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Dialog operations (legacy removed; renderer uses custom components)
  // Name resolution
  resolveNames: (steamIds) => ipcRenderer.invoke('resolve-names', steamIds),
  clearNameCache: () => ipcRenderer.invoke('clear-name-cache'),
  getNameCacheSize: () => ipcRenderer.invoke('get-name-cache-size'),
  // Capabilities
  isEncryptionAvailable: () => ipcRenderer.invoke('encryption-available'),
  // Revisions
  listRevisions: () => ipcRenderer.invoke('list-revisions'),
  revertToRevision: (id) => ipcRenderer.invoke('revert-to-revision', id),
  openRevisionsFolder: () => ipcRenderer.invoke('open-revisions-folder'),
  getCurrentBanCount: () => ipcRenderer.invoke('get-current-ban-count'),
  // Background notifications from main → renderer
  onBackgroundToast: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('background-toast', handler);
    return () => ipcRenderer.removeListener('background-toast', handler);
  },
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
