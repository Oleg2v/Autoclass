# autoclass-comments

Cloudflare Worker that stores and serves the review comments for the Auto Class site
(the Figma-style layer in `public/review/`). The site reaches it same-origin through the
Pages Function `functions/api/comments/[[path]].js` and the `COMMENTS` service binding
declared in the repo-root `wrangler.toml`.

```
browser ── /api/comments/* ──▶ Pages Function ──(service binding COMMENTS)──▶ this Worker
                                                                                 │ RPC
                                                                                 ▼
                                                              Durable Object CommentsRoom
                                                              (SQLite storage, one instance)
```

## Why a Durable Object with SQLite, not D1

- The deploy token has no D1 permission, while Durable Objects ship with the Worker itself.
- A SQLite-backed Durable Object runs the same SQLite engine as D1 (`ctx.storage.sql`).
- It is strongly consistent: one instance (`idFromName("autoclass")`) serialises every write,
  so per-page comment numbers (`num` 1, 2, 3…) are allocated without races.
- There are zero extra services to create or bind: the `[[migrations]]` entry in `wrangler.toml`
  (`new_sqlite_classes = ["CommentsRoom"]`) provisions storage on the first deploy.

## Files

| File | Purpose |
| --- | --- |
| `src/index.js` | HTTP router, auth (`X-Review-Key`), validation, CSV export, notifications via `ctx.waitUntil` |
| `src/room.js` | `CommentsRoom` Durable Object: schema, queries, delete rules, rate limit |
| `src/validate.js` | Input validation and length caps |
| `src/notify.js` | ntfy JSON publish, generic webhook, Telegram `sendMessage` |
| `.dev.vars.example` | Dummy local secrets. Copy it to `.dev.vars`, which is gitignored |

## API

All routes need the header `X-Review-Key: <REVIEW_KEY>` (otherwise `401`), except `OPTIONS`,
which answers `204` with an `Allow` header. CORS is not enabled, because the browser always
calls the API same-origin through Pages.

| Method | Path | Body / query | Result |
| --- | --- | --- | --- |
| GET | `/api/comments?page=home[&clientId=]` | | `{ threads: [...] }`, oldest first |
| POST | `/api/comments` | `{ page, anchor, author, text, clientId }` | thread, `201` |
| GET | `/api/comments/:id` | | thread |
| PATCH | `/api/comments/:id` | `{ resolved: boolean, author }` | thread |
| DELETE | `/api/comments/:id?clientId=` | | `{ ok, id }`: only the creator, and only with no replies |
| POST | `/api/comments/:id/replies` | `{ author, text, clientId }` | reply, `201` |
| DELETE | `/api/comments/:id/replies/:rid?clientId=` | | `{ ok, id }`: only the creator, and only if nobody has replied after it |
| GET | `/api/comments/export?format=json\|csv` | | every thread on every page, as an attachment |

Thread: `{ id, num, page, anchor, author, text, created, resolved, resolvedBy, resolvedAt, replies: [{ id, author, text, created }] }`.
List, create, and reply responses also carry `mine: true|false` when the request's `clientId` matches
the creator. The widget uses it to offer "delete". `clientId` itself is never returned.

`anchor = { selector, xPct, yPct, dir, docXPct, docY, vw, vh, snippet }`:
- `xPct`, `yPct`, and `docXPct` are numbers in 0..100. Float noise of ±0.5 is clamped.
- `dir` is `"rtl"` or `"ltr"`.
- `docY` is in 0..1e6. `vw` and `vh` are in 1..20000.

Limits: `selector` ≤ 500 (rejected if longer), `snippet` ≤ 120 (truncated), `author` ≤ 60, `text` ≤ 2000.
Text is trimmed, `\r\n` becomes `\n`, and control characters are stripped. Text or author that
draws nothing (only spaces, zero-width or bidi format characters) is rejected. Bidi embedding /
override / isolate characters are stripped from `author` and `snippet`. `selector` is reduced to
one line without control characters.
Text is stored raw: the widget renders it with `textContent` only.

Errors are JSON `{ error, message, field? }` with status `400` (validation), `401`, `403` (not the
creator), `404`, `409` (has replies), `413` (body > 16 KB), `429` (rate limit, with `Retry-After`).

Rate limit: 30 writes per minute per client and 200 writes per minute in total, counted inside the
Durable Object (in memory, so it resets if the object is evicted after inactivity). A client is the
`CF-Connecting-IP` address for IPv4, and its /64 prefix for IPv6 (one subscriber usually holds a
whole /64). Reads are not limited.

Bodies are read up to 16 KB even when sent chunked. The Pages Function also answers `401` for a
request without `X-Review-Key` and `413` for a declared `Content-Length` over 16 KB without
forwarding the body; otherwise it streams the body through instead of buffering it.

## Secrets and vars

| Name | Kind | Required | Meaning |
| --- | --- | --- | --- |
| `REVIEW_KEY` | secret | yes | shared key from the review link `?review=<key>`. Without it the API answers `503` |
| `NTFY_TOPIC` | secret | no | ntfy.sh topic. Use a long random name, because the notification links contain the review key |
| `NOTIFY_EMAIL` | secret | no | e-mail address that ntfy.sh forwards each notification to |
| `WEBHOOK_URL` | secret | no | POST target for `{ event, thread, reply, url }`, or `https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>` |
| `NTFY_SERVER` | var | no | self-hosted ntfy base URL (default `https://ntfy.sh`) |
| `PUBLIC_SITE_URL` | var | no | default `https://autoclass.kikkey.com`, used for notification links |

## Deploy

Run these from this folder. Deploy the Worker before the Pages project, because Pages binds to it by name.

```sh
npx wrangler deploy
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"   # make a key
npx wrangler secret put REVIEW_KEY
npx wrangler secret put NTFY_TOPIC      # optional
npx wrangler secret put NOTIFY_EMAIL    # optional
npx wrangler secret put WEBHOOK_URL     # optional
```

Then deploy the site as usual (`npx wrangler pages deploy` from the repo root). The root
`wrangler.toml` adds the `COMMENTS` binding. If the Worker is missing or unreachable, the Pages
Function answers `503 {"error":"comments_unavailable"}`.

## Local development

```sh
cp .dev.vars.example .dev.vars          # set REVIEW_KEY; leave NTFY_TOPIC unset so nothing external is called
npx wrangler dev --local --port 8787
curl -H 'X-Review-Key: change-me-dev-key' 'http://127.0.0.1:8787/api/comments?page=home'
```

To run the whole site with the Pages Function, keep `wrangler dev` running and start
`npx wrangler pages dev` from the repo root (after `npm run build`). The `COMMENTS` binding connects
to the local Worker through the wrangler dev registry. Wrangler shows it as `local [connected]`.

## Data and backups

Everything lives in the `CommentsRoom` instance named `autoclass` (tables `threads`, `replies`,
`counters`). Download `GET /api/comments/export?format=json` (or `csv`) to archive it. The CSV has
one row per message, a UTF-8 BOM so Excel opens Hebrew and Russian correctly, and spreadsheet-formula
neutralisation (cells that start with `=`, `+`, `-`, or `@` get a leading `'`).
