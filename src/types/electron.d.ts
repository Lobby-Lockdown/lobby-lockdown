// Electron API type definitions
export interface ElectronAPI {
  // Ban list operations
  listBans: () => Promise<string>;
  addBan: (steamId: string) => Promise<string>;
  removeBan: (steamId: string) => Promise<string>;
  updateBans: () => Promise<string>;
  revertBans: () => Promise<string>;
  exportBans: () => Promise<string>; // newline-separated list
  exportBansToFile: () => Promise<string>; // status message with saved path
  importBansFromFile: () => Promise<string>; // status message

  // Steam API key management
  setSteamApiKey: (apiKey: string) => Promise<boolean>;
  getSteamApiKey: () => Promise<string>;

  // File operations
  selectSaveFile: () => Promise<string | null>;
  getSaveFilePath: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<boolean>;

  // Dialog operations: removed (renderer uses custom confirm/toast)

  // Name resolution
  resolveNames: (steamIds: string[]) => Promise<Record<string, string>>;
  clearNameCache: () => Promise<boolean>;
  getNameCacheSize: () => Promise<number>;
  isEncryptionAvailable: () => Promise<boolean>;
  // Revisions
  listRevisions: () => Promise<Array<{ id: string; createdAt: string; count: number; reason: string; file: string }>>;
  revertToRevision: (id: string) => Promise<string>;
  openRevisionsFolder: () => Promise<string>;
  getCurrentBanCount: () => Promise<number>;
  // Background notifications from main
  onBackgroundToast: (
    callback: (payload: { kind?: 'info' | 'success' | 'error'; message: string }) => void
  ) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
