# Security Policy

Redial is a **development-only** tool: it renders nothing in production, but in
dev it runs an API route that writes to your source files. Bugs in that write
path (path traversal, request forgery, value injection) are treated as
security issues, not ordinary bugs.

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Report privately via **GitHub Security Advisories**: use
["Report a vulnerability"](https://github.com/SkylarKitchen/redial/security/advisories/new)
on the repo's Security tab. Do **not** open a public issue for security
reports.

Include what you'd put in a good bug report: affected route/function, a
reproduction, and impact. You should get an initial response within a week;
fixes land with a regression test before the advisory is published.

## Hardening notes for users

- Mount `<Tuner />` and the API route only in development (`NODE_ENV === "development"`), as the README shows.
- The commit server validates that write targets stay inside the project root (`src/server/pathSafety.ts`) — keep that layer intact if you fork.
