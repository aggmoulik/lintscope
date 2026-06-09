# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report privately via
GitHub's [private vulnerability reporting](https://github.com/aggmoulik/lintscope/security/advisories/new)
(Security → Report a vulnerability), or email the maintainer listed on the
[GitHub profile](https://github.com/aggmoulik).

We'll acknowledge within a few days and keep you updated through to a fix + disclosure.

## Supported versions

lintscope is pre-1.0; security fixes land on the latest published `0.x` release.

## Threat model (what to look at)

The interesting surface is the **local CLI HTTP server** that the hosted `/studio`
page talks to. It runs on `127.0.0.1` and is protected by several layers — a bug in
any of these is worth reporting:

- **Origin allowlist + CORS** — only the configured hosted UI origin may read responses.
- **Per-session token** — all data endpoints (`/init`, `/report`, `/file`, `/scan`,
  `/events`) require a `crypto.randomUUID()` token; `/handshake` is the only
  unauthenticated endpoint and is origin/CORS-gated so only the real UI can read it.
- **DNS-rebinding guard** — requests with a non-loopback `Host` header are rejected.
- **Private Network Access** preflight handling for public-origin → localhost requests.
- **Path-traversal guard** — `GET /file` enforces `projectRoot` containment (`safePath`).
- **Data locality** — the `/studio` page must only ever call the local CLI server; it
  makes no third-party/analytics calls that could see your code or diagnostics.

If you find a way to read a project's source/diagnostics from another origin, exfiltrate
the session token, or escape `projectRoot`, that's a vulnerability — please report it.
