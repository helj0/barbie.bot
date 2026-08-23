# Scrobble Bot

A Discord bot that compares server members' Last.fm listening stats with
rendered, album-art-rich image cards.

[Privacy Policy](./PRIVACY.md)

Data source: **Last.fm's public read-only API**. Members link a Last.fm
username (no OAuth/password needed) — the bot only reads public scrobble
history, so it works immediately even for years of existing history, and
never touches anyone's Spotify login. If you'd rather use Spotify directly,
see "Why Last.fm and not Spotify" below.

## Commands

| Command | Description |
|---|---|
| `/link username:<lastfm_username>` | Connect your Discord account to a Last.fm username |
| `/unlink` | Disconnect your account |
| `/nowplaying [user]` | Currently playing (or last played) track, with art |
| `/top type:<tracks\|albums\|artists> [period] [user]` | One listener's top N for a time range |
| `/servertop type:<tracks\|albums\|artists> [period]` | Aggregated top N across every linked member |
| `/leaderboard type:<artist\|album\|track> artist:<name> [album] [track]` | Ranks linked members by all-time plays of one specific artist/album/track |
| `/artist [name]` | Your stats for an artist vs. everyone else linked in the server; defaults to what you're currently/last playing |
| `/album [album] [artist]` | Same, for an album |
| `/track [track] [artist]` | Same, for a track |
| `/rate type:<artist\|album\|track> rating:<0-5> artist:<name> [album] [track]` | Rate something 0-5 stars; also available as a "Rate" button under the cards above |
| `/genres [period] [user]` | Genre breakdown derived from a listener's top artists' Last.fm tags |
| `/medals [user]` | Shows a listener's earned medal badge case |
| `/medals-leaderboard` | Ranks linked members by total medal points |
| `/medals-config channel:<#channel>` | **Admin only.** Sets the channel new medal unlocks get announced in |

Periods: Last 7 Days, Last Month, Last 3 Months, Last 6 Months, Last Year, All Time.

## The medal system

A background job (`src/medals/scheduler.js`) runs every 20 minutes, checks
every linked member against the medal catalog (`src/medals/catalog.js`),
records anything newly earned, and posts an announcement image if you've
set an announce channel with `/medals-config`. Medals persist even if you
never configure a channel - they'll just show up in `/medals` without a
public announcement.

**Categories:**
- **Milestone** (personal, tiered bronze/silver/gold) - Scrobbler (lifetime
  plays), Devotee (plays of one artist), On Repeat (plays of one album)
- **Variety** (personal, tiered) - Crate Digger (distinct artists in a
  month), Genre Hopper (distinct genre tags in a month)
- **Taste** (personal, single-tier, playful) - Underground / Chart Topper,
  based on how niche or mainstream your monthly top artists are by average
  Last.fm listener count
- **Competitive** (server-wide) - Trailblazer / Scrobble Legend (first
  member in *this* server to cross a lifetime scrobble threshold, one
  holder per guild, permanent), Monthly Champion (most scrobbles in the
  server this month - recomputed continuously, finalized as a permanent
  medal for whoever's leading when the month rolls over)

**How "this month" is measured:** Last.fm doesn't expose a per-artist or
per-user "scrobbles this calendar month" figure directly, so Monthly
Champion is computed by snapshotting each user's lifetime playcount the
first time they're evaluated each month, then tracking the delta. This
means a user's first day in a new month sets their baseline - if the bot
was offline for the first few days of the month, that's a slightly late
(but self-correcting) baseline, not a data-loss issue.

Add more medals by extending the `MEDALS` object in
`src/medals/catalog.js` and adding matching evaluation logic in
`src/medals/evaluate.js` (personal) or `src/medals/scheduler.js`
(server-wide/recurring).

## 1. Get your credentials

- **Discord bot**: [Discord Developer Portal](https://discord.com/developers/applications) →
  New Application → Bot → copy the token. Under OAuth2 → URL Generator, tick
  `bot` and `applications.commands` scopes, `Send Messages` + `Attach Files`
  permissions, and use the generated URL to invite it to your test server.
- **Last.fm API key**: [last.fm/api/account/create](https://www.last.fm/api/account/create)
  — no callback URL needed, this is read-only.
- **Spotify (optional)**: only used as a cover-art fallback when Last.fm's
  image is missing. Create an app at the
  [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and
  grab the Client ID/Secret (Client Credentials flow — no redirect URI
  needed). Skip this if you don't care about the occasional missing artist
  photo.

Copy `.env.example` to `.env` and fill in the values. Set `DISCORD_GUILD_ID`
to your test server's ID while developing — guild-scoped commands register
instantly, whereas global commands take up to an hour to show up.

## 2. Run it locally

```bash
npm install
npm run deploy-commands   # registers the slash commands
npm start                 # or `npm run dev` for auto-restart on file changes
```

Then in your test server: `/link username:<your last.fm username>`, then try
`/nowplaying`, `/top type:artists`, `/servertop type:tracks`, `/genres`, and
`/leaderboard type:artist artist:<some artist you and a friend both listen to>`.

## 3. Deploying to the cloud

The app is deliberately stateless-except-for-one-file: everything persists
in a single SQLite database (`./data/bot.sqlite` by default) that just needs
to live on a persistent disk/volume. That makes it portable to pretty much
any host:

- **Railway / Render / Fly.io**: push this repo, set the env vars from
  `.env.example` in the dashboard, attach a small persistent volume mounted
  at `/app/data` (all three have a free/cheap tier for this), and set the
  start command to `node src/index.js` (or just use the included
  `Dockerfile` — all three auto-detect it).
- **A VPS / Raspberry Pi**: `git clone`, `npm install --omit=dev`, run under
  `pm2` or a `systemd` service so it restarts on crash/reboot, point
  `DATABASE_PATH` at a real path, done.
- **Docker anywhere**: `docker build -t scrobble-bot .` then
  `docker run --env-file .env -v scrobble-data:/app/data scrobble-bot`.

Whichever you land on, remember to run `npm run deploy-commands` once after
first deploy (and again any time you add/change a command's options).

## Design notes / what's intentionally simple for a prototype

- **No scrobble-polling worker.** Last.fm already stores full listening
  history and exposes period-filtered top-tracks/albums/artists endpoints
  directly, so there's no need to run our own 24/7 poller or store every
  play ourselves — we just query Last.fm live and cache briefly (see
  `src/db.js`'s `cached()` helper) so a `/servertop` call across a big
  server doesn't hammer the API.
- **`/leaderboard` is all-time, not period-filtered.** Last.fm's per-item
  play count (`artist.getinfo` / `album.getinfo` / `track.getinfo` with a
  `username`) is a lifetime total, not scoped to a date range. Getting a
  "who played this most *last month*" leaderboard would require either
  Last.fm's weekly-chart endpoints (coarser, artist-only) or storing our own
  scrobble log — a reasonable v2 if you want it.
- **SQLite, not Postgres.** Simple, zero-ops, and completely sufficient for
  what's stored (account links + a short-lived cache). Swapping to Postgres
  later is a same-shaped, small change to `src/db.js` if you outgrow it.

## Why Last.fm and not Spotify directly

Spotify's Web API can't build this feature set well: `recently-played` only
returns your last ~50 tracks (no deep history), there's no per-track/album
scrobble-count endpoint at all, and Spotify has progressively locked down
the API (Nov 2024 and Feb 2026 changes removed audio-features, recommendations,
related-artists, artist's-top-tracks, and more for new apps). Last.fm's
`user.getTopTracks/Albums/Artists` with a `period` param, plus per-item
`userplaycount`, map directly onto everything in the spec. Members link
Spotify → Last.fm scrobbling once (a toggle in Spotify's own settings) and
their existing history is already there.
