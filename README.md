# Apartment Finder

A private, invite-only rental search for San Francisco. Pulls live listings, scores each one for
scam risk, and lets the group ask Claude questions about what's on screen.

## Features

- **Live listings** — real SF rentals fetched server-side (Redfin and ApartmentList, Craigslist behind a flag)
- **Scam probability score** — 0–100 per listing with the reasons that produced it
- **Invite-only access** — email sign-in links, restricted to an email allowlist
- **Ask Claude** — questions answered against the listings currently displayed
- **Neighborhood filter, commute estimates, map view** — as before

## Running it

```bash
npm install
cp .env.example .env      # then fill it in
npm run dev               # vite on :5173, api on :8787
```

`npm run dev` runs the frontend and API together; the Vite dev server proxies `/api` to the
backend. In production the API serves the built frontend, so only one port is exposed.

## Signing in

Enter your email on the sign-in screen; if it is in `ALLOWED_EMAILS`, the server emails you a
single-use link. Opening it signs you in and drops a session cookie. The form reports success
whichever way, so it cannot be used to test who is on the list.

This needs `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`. Without them the form is disabled and links come
from the CLI instead:

```bash
npm run invite -- you@example.com
```

Anyone in `ADMIN_EMAIL` can also mint links from the API.

## Access control

- Only addresses in `ALLOWED_EMAILS` can hold a session. Removing someone revokes them on their
  next request — no separate revocation step.
- Sign-in links are single-use and expire (`INVITE_TTL_HOURS`, default 72h).
- Requesting a link is rate limited to 5 per 15 minutes per IP.
- Invite and session tokens are stored as SHA-256 hashes, never in plaintext.
- Session cookies are `httpOnly` + `sameSite=lax`, and `secure` when `NODE_ENV=production`.
- `SESSION_SECRET` is required in production; rotating it signs everyone out.

Put the app behind HTTPS (a reverse proxy is fine) — the session cookie assumes it.

## Listing sources

| Source | Status |
| --- | --- |
| Redfin | Live |
| ApartmentList | Live |
| Craigslist | Adapter ready, off by default |

ApartmentList only renders full details (address, photos, leasing phone) for the properties it puts
on cards; the rest arrive as summaries, marked `detail: 'summary'` so the scam heuristics do not read
the missing fields as a landlord hiding something.

Craigslist returns 403 to datacenter IP ranges, which covers most VPS hosts. Check yours before
enabling it:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0" \
  "https://sfbay.craigslist.org/search/apa?format=rss"
```

`200` means set `ENABLE_CRAIGSLIST=true`. A failing source is reported in the UI and does not
take down the rest of the results.

## Scam scoring

Every listing goes through deterministic heuristics: irreversible payment methods, absent
"owners", deposits demanded before a viewing, mailed keys, urgency language, rent far below the
SF median for that bedroom count, no photos, no address. Anything scoring 25+ is additionally
sent to Claude, and the more cautious of the two verdicts wins. Results are cached for 7 days.

Scores are a prompt to look closer, not proof either way.

## Ask Claude

Backed by the Claude Code CLI in headless mode (`claude -p`), which uses a Claude subscription
rather than a metered API key. Set `CLAUDE_CODE_OAUTH_TOKEN` to a token from `claude setup-token`.
Without it the app still runs; `/api/ask` returns 503 and scoring falls back to heuristics only.

## Deploying

Node 22+ required. On the VPS:

```bash
npm ci && npm run build
cp deploy/apartment-finder.service /etc/systemd/system/
systemctl enable --now apartment-finder
```

Adjust the unit's `WorkingDirectory`/`User` to match your box. It expects `.env` alongside the
app and a writable `data/` directory for the SQLite file.

## Tech

React + TypeScript + Vite frontend, Express + SQLite (better-sqlite3) backend. `npm test` covers
the scam heuristics.
