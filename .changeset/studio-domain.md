---
"lintscope": patch
---

Open the studio at the new hosted-UI domain (`lintscope.vercel.app`).

`lintscope@0.1.0` opened `registry-seven-khaki.vercel.app/studio`; after the
domain move that page redirects to the new origin, but the CLI's CORS allow-list
(derived from the hosted-UI origin) still expected the old one — so the studio
handshake failed. The CLI now targets the new origin directly. Also consolidates
`DEFAULT_HOSTED_UI` + the allow-origin resolution into a shared `hosted-ui` module.
