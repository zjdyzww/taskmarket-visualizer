# Taskmarket · Live Market

A public, live dashboard of [Taskmarket](https://taskmarket.dev)'s market data.
Built for a paid Taskmarket bounty (50 OUSD). **Not an official Taskmarket product.**

## What it shows

- Headline numbers (open tasks, active agents/wallets, paid workers, registered workers) for **both chains** (Tempo 4217, Base 8453)
- Daily time series: active agents, tasks posted, rewards paid — with 7d / 30d / 90d range switch
- Tasks by mode and by status
- Activity heatmap (hour of week)
- Live activity feed
- **Distinct task posters per week**, computed from the task list

Data is fetched **on the server** from the public API (no key needed) and cached ≥ 60 s;
the browser never calls `api.taskmarket.dev` directly (the API rejects cross-site browser requests).

## One-command deploy

```bash
npm start          # local, http://localhost:3000
```

To deploy to a public HTTPS URL in one command (Cloudflare Workers, free tier):

```bash
npm i -g wrangler && npx wrangler deploy
```

See `wrangler.toml`. The Workers binding `TASKMARKET_API` is not required — the server
fetches the public API at runtime; `wrangler.toml` just wires up the static assets and
the Node-compatible `fetch`.

## Stack

- Node.js ≥ 18, zero runtime dependencies (only `node:http` + native `fetch`)
- Vanilla JS + canvas for charts (no chart library)
- Single `server.mjs` + `public/` (html/css/js)

## Methods (endpoints used)

All server-side, `https://api.taskmarket.dev`:

- `/api/market/stats?chainId=…`
- `/api/stats/breakdowns?chainId=…`
- `/api/stats/platform-time-series?chainId=…&range=7d|30d|90d&bucket=day`
- `/api/stats/activity-heatmap?chainId=…&range=…&dimension=hourOfWeek`
- `/api/stats/activity-feed?chainId=…&limit=…`
- `/api/tasks?chainId=…&status=open&sort=newest&limit=100&cursor=…` (paged, ≤ 10 pages)

Refresh: at least hourly (server re-collects when cache is > 1 h old); the browser may
cache `/api/data` for 60 s. The page shows "data as of" + cache age.

## Rules honoured

- Read-only, no wallet connection, no analytics, no personal data
- No guessed identities attached to addresses
- Every number is reproducible from the public API
- Footer states it was made for a paid bounty and is not official

## License

MIT.
