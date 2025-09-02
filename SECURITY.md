Security Policy

Reporting a Vulnerability

- Please report security issues privately by opening a security advisory on GitHub or contacting the maintainers via Discord.
- Do not open public issues for potential vulnerabilities.

Scope

- Electron app (main, preload, renderer)
- Ban list library and GVAS parser

Out of scope

- 3rd-party services (Steam Web API availability/errors)
- User-provided ban entries

Best practices

- Avoid storing secrets on disk; Steam API key is optional and not persisted by default.
- Preload exposes only the minimal API surface needed.
