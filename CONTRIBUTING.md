Contributing to Lobby Lockdown

Thanks for your interest in contributing! This project is an Electron + Vite + Tailwind app written in TypeScript.

Development setup

- Node.js 18+ and npm
- Install: npm install
- Dev run: npm run dev (Vite + tsc watch + Electron)
- Build: npm run build (tsc + vite)
- Package (Windows portable exe): npm run build:win

Coding guidelines

- Keep changes small and focused; prefer TypeScript types where practical
- Avoid spawning external tools in Electron main; call local functions
- Maintain renderer isolation: only expose safe APIs via preload
- Write clear commit messages; include before/after behavior when fixing bugs

Linting

- Run npm run lint (warnings allowed, no errors)
- Prefer fixing warnings in touched files; you can leave unrelated warnings as-is

Submitting changes

- Fork the repo and open a PR from your branch
- Describe the problem, the solution, and any trade-offs
- Attach screenshots for UI changes when helpful

Security

- Do not include secrets in commits or logs
- Network calls should be explicit and minimal

Thank you for helping improve Lobby Lockdown!
