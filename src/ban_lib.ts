import GVAS from './gvas.js';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

function getPaths() {
  const explicit = process.env.LOCKDOWN_SAVE_PATH?.trim();
  const banListFilePath =
    explicit && explicit.length > 0
      ? explicit
      : path.join(
          process.env.LOCALAPPDATA || '',
          'LockdownProtocol/Saved/SaveGames/Save_BanList.sav'
        );
  const bakFilePath = banListFilePath.replace(/\.sav$/i, '.bak');
  return { banListFilePath, bakFilePath };
}

function ensureBackup(): void {
  const { banListFilePath, bakFilePath } = getPaths();
  if (fs.existsSync(banListFilePath)) {
    try {
      fs.copyFileSync(banListFilePath, bakFilePath);
    } catch {
      // ignore backup errors; caller may still proceed
    }
  }
}

function validateSteamId(steamId: string) {
  if (!/^7656\d{13}$/.test(steamId)) {
    throw new Error('Invalid Steam64 ID format. It should be 17 digits starting with 7656.');
  }
}

export function listBans(): string[] {
  const { banListFilePath } = getPaths();
  // Avoid creating backups for read-only list operations
  const banList = new GVAS(banListFilePath, { createBackup: false });
  return banList.getBanList();
}

export function listBansPlain(): string {
  return listBans().join('\n');
}

export function addBan(steamId: string): string {
  validateSteamId(steamId);
  ensureBackup();
  const { banListFilePath } = getPaths();
  const banList = new GVAS(banListFilePath, { createBackup: false });
  const added = banList.addPlayersToBanList([steamId]);
  return `Successfully added ${added} player(s) to your ban list!`;
}

export function removeBan(steamId: string): string {
  validateSteamId(steamId);
  ensureBackup();
  const { banListFilePath } = getPaths();
  const banList = new GVAS(banListFilePath, { createBackup: false });
  const removed = banList.removePlayerFromBanList(steamId);
  return `Successfully removed ${removed} player(s) from your ban list!`;
}

export function addMany(steamIds: string[]): string {
  const ids = Array.from(new Set(steamIds.map((id) => id.trim()).filter(Boolean)));
  const valid = ids.filter((id) => /^7656\d{13}$/.test(id));
  if (valid.length === 0) return 'No valid Steam IDs to add.';
  ensureBackup();
  const { banListFilePath } = getPaths();
  const banList = new GVAS(banListFilePath, { createBackup: false });
  const added = banList.addPlayersToBanList(valid);
  return `Successfully added ${added} player(s) to your ban list!`;
}

export async function updateFromCommunity(): Promise<string> {
  const url =
    'https://raw.githubusercontent.com/Lobby-Lockdown/lobby-lockdown/refs/heads/main/bans.txt';
  const { data } = await axios.get<string>(url);
  const steamIds = data
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => Buffer.from(line, 'base64').toString('utf8'));

  ensureBackup();
  const { banListFilePath } = getPaths();
  const banList = new GVAS(banListFilePath, { createBackup: false });
  const added = banList.addPlayersToBanList(steamIds);
  return `Successfully added ${added} new players from the community ban list!`;
}

export function revertFromBackup(): string {
  const { banListFilePath, bakFilePath } = getPaths();
  if (!fs.existsSync(bakFilePath)) {
    throw new Error('No backup file (.bak) found to revert from.');
  }
  fs.copyFileSync(bakFilePath, banListFilePath);
  return 'Successfully reverted ban list from backup.';
}
