# 🎮 Lobby Lockdown

[![build-windows](https://github.com/Lobby-Lockdown/lobby-lockdown/actions/workflows/build-windows.yml/badge.svg)](https://github.com/Lobby-Lockdown/lobby-lockdown/actions/workflows/build-windows.yml)
[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](#)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-38B2AC?logo=tailwindcss&logoColor=white)](#)
[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)](#)

Desktop app to manage your Lockdown Protocol ban list. View, add, remove, and sync bans from the community list, with optional player-name lookups via the Steam Web API. Runs in the tray and can auto‑update hourly.

Built with Electron + Vite + Tailwind + TypeScript.

> ⚠️ Disclaimer: Not affiliated with Lockdown Protocol or Mirage Creative Lab. Data is user‑submitted and provided as‑is. See the full [DISCLAIMER](./DISCLAIMER).

---

## 💬 Community

[![Join our Discord](https://img.shields.io/discord/1399508907512168730?color=7289DA&label=Discord&logo=discord&style=for-the-badge)](https://discord.gg/Kc9KRBJPMA)

## 🚀 Features

- View current ban list instantly
- Add/Remove players with validation + de‑duplication
- Update from community list with automatic backups
- Revert to previous state (revisions history)
- Optional player‑name lookups (Steam Web API)
- System tray: Open, Update Now, Auto Update, Quit

## ⬇️ Download

[Download the latest EXE](https://github.com/Lobby-Lockdown/lobby-lockdown/releases/latest/) (Windows).

## 📁 Project layout

```
.
├─ assets/                 # Icon and static assets
├─ dist/                   # Build output (main, preload, renderer)
├─ src/
│  ├─ renderer/            # Vite + Tailwind UI
│  ├─ components/          # React components
│  ├─ types/               # Preload API typings
│  ├─ ban_lib.ts           # Ban operations (list/add/remove/update/revert)
│  ├─ gvas.ts              # Save_BanList.sav parser/writer
│  ├─ main.ts              # Electron main (IPC, tray, scheduler, caches)
│  └─ preload.js           # Safe API surface (contextBridge)
├─ package.json            # Scripts + electron‑builder config
├─ vite.config.ts          # Vite config (renderer)
├─ tailwind.config.js      # Tailwind config
├─ postcss.config.cjs      # PostCSS config
└─ tsconfig.json
```

## 🛠 Requirements

- Node.js 18+
- npm

## 🧭 Getting started

```bash
git clone https://github.com/Lobby-Lockdown/lobby-lockdown.git
cd lobby-lockdown
npm install

# Dev (Vite + Electron, strict port 5173)
npm run dev

# Build production (tsc + vite)
npm run build

# Run the built app
npm run electron
```

## 🧩 NPM scripts

- dev – start Vite, watch main, and launch Electron
- build – compile main (tsc) and renderer (vite)
- electron – build then run Electron against the built files
- build:win – build and package Windows artifacts (portable + NSIS)
- lint, lint:fix – ESLint checks
- format, format:check – Prettier formatting
- cli – run the maintenance CLI (`src/ban_cli.ts`)

Run: `npm run <script>`

## 🔌 CLI (optional)

Minimal wrapper for scripting/automation:

```
npm run cli -- list|add <id>|remove <id>|update|revert
```

Steam64 IDs must be 17 digits starting with `7656`.

## ⚙️ Settings & storage

- Steam API Key – stored with Electron `safeStorage` (encrypted). Set it in Settings.
- Name cache – persisted by the main process in the app data folder (`names-cache.json`).
- App config – persisted in the app data folder (`app-config.json`).
- Revisions – snapshots of your ban list are saved under the app data folder.

Note: the app data folder is Electron’s `app.getPath('userData')` on your system.

## 📦 Packaging (Windows)

Build portable + installer with electron‑builder:

```
npm run build:win
```

Artifacts are written to `release/` per the config in `package.json`.

## 🌐 Environment variables (optional)

- `LOCKDOWN_SAVE_PATH` – full path to `Save_BanList.sav` (otherwise we try the default under `%LOCALAPPDATA%`).
- `STEAM_API_KEY` – enables player‑name lookups; can also be set from Settings.

## 🔧 Troubleshooting

- Dev window blank: ensure port 5173 is free; `npm run dev` starts the Vite server and Electron waits for it.
- Save file issues: make sure the game isn’t writing the save; set a custom path in Settings if needed.
- Name lookups: set a valid Steam Web API key in Settings.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).
