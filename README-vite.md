# Vite + Tailwind Renderer

Dev:

- Run: `npm run electron-dev` (starts Vite at 5173 and Electron pointing to it)

Build:

- Run: `npm run build` (tsc for main + vite build for renderer)
- Launch: `npm run electron`

The renderer lives under `src/renderer` and is bundled to `dist/renderer`.
