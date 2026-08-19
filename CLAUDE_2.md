# scrobble-bot — project context

Drop this file in the project root (same level as `package.json`) as
`CLAUDE.md`. Claude Code reads it automatically for context at the start of
a session.

## What this is

A Discord bot that tracks server members' Last.fm listening stats and
compares them across the server, with custom-rendered "liquid glass" style
image cards (not plain Discord embeds) and a medal/achievement system.

Built collaboratively with Claude (web chat) over several sessions. **No
code in this project has ever actually been executed** — the chat
environment that wrote it has no network access to run `npm install`, so
everything was syntax-checked (`node --check`) but never run end-to-end.
The user has been running it for real on Windows and reporting errors back;
several real bugs have already been found and fixed this way (see "Bugs
already found and fixed" below). Treat the codebase as "should work,
reviewed carefully, but unverified in a live run" rather than "battle-tested."

## Stack

- Node.js (ESM, `"type": "module"` in package.json), discord.js v14
- Last.fm public API (`ws.audioscrobbler.com`) — read-only, no OAuth. Users
  link via `/link <lastfm_username>`, no password/login involved.
- Optional Spotify Client Credentials flow (`src/spotifyArt.js`) as a
  cover-art fallback when Last.fm's image is missing — app-only auth, no
  user login.
- SQLite via `better-sqlite3` (pinned to `^13.0.0` — see bugs below) —
  single file at `DATABASE_PATH`, holds account links, a short-TTL API
  response cache, medal records, and monthly-champion tracking.
- `@napi-rs/canvas` for all image rendering (not embeds).
- Bundled font: Outfit (OFL-licensed, ships in `src/assets/fonts/`),
  registered explicitly in `src/fonts.js` — see bugs below for why.

## Directory map

```
src/
  index.js            bot entry point; loads commands, starts medal scheduler
  deploy-commands.js  one-time/on-change script to register slash commands
  db.js               all SQLite access (schema + queries)
  lastfm.js           Last.fm API client
  spotifyArt.js        optional cover-art fallback (Client Credentials)
  fonts.js            registers bundled Outfit font with @napi-rs/canvas
  commands/           one file per slash command
  render/             canvas renderers
    theme.js           color palette, rank colors
    glass.js           reusable "liquid glass" panel/row/pill primitives
    medalIcons.js      hand-drawn vector icons per medal (no emoji fonts)
    *Card.js           the actual card renderers (nowPlaying, topList,
                        leaderboard, medalCard)
  medals/
    catalog.js         medal definitions: tiers, thresholds, points, descriptions
    evaluate.js        per-user evaluator — what medals does this Last.fm
                        user currently qualify for
    scheduler.js       background job (runs every 20 min): evaluates every
                        linked member in every guild, awards new medals,
                        handles server-first claims and Monthly Champion,
                        posts announcements
  utils/
    images.js          safeLoadImage, drawCoverArt, fitText, wrapText
    period.js           Last.fm period choices shared by slash commands
```

## Slash commands (current)

`/link`, `/unlink`, `/nowplaying`, `/top`, `/servertop`, `/leaderboard`,
`/genres`, `/medals`, `/medals-leaderboard`, `/medals-config` (admin-only,
sets the medal-announcement channel).

## Design system

Dark, "liquid glass" aesthetic — translucent panels with soft drop shadows,
top specular highlights, ambient colored glow blobs on the background. All
implemented by hand in canvas (`render/glass.js`), not CSS, since canvas
can't do real `backdrop-filter`. Ranked lists (`/top`, `/servertop`,
`/leaderboard`, `/medals-leaderboard`) render in **two columns** rather than
one long vertical list.

## Medal system

10 medals across 4 categories in `src/medals/catalog.js`:
- **Milestone** (bronze/silver/gold/**platinum**): Scrobbler, Devotee, On Repeat
- **Variety** (bronze/silver/gold/platinum): Crate Digger, Genre Hopper
- **Taste** (single gold tier): Underground, Chart Topper
- **Competitive**: Trailblazer + Scrobble Legend (server-first claims, one
  holder per guild ever), Monthly Champion (recurring — recomputed
  continuously via a lifetime-playcount snapshot taken at the start of each
  month, finalized into a permanent medal when the month rolls over)

Badge case (`/medals`) shows **every** catalog medal as a grid cell —
earned ones show their medallion + tier + a wrapped description; unearned
ones show a dashed "Locked" ring. Medallion icons are hand-drawn canvas
paths per medal key (`render/medalIcons.js`), deliberately not emoji, to
avoid emoji-font inconsistency across hosts.

Adding a new medal: add an entry to `MEDALS` in `catalog.js` (tiers +
description), then add matching evaluation logic in `medals/evaluate.js`
(personal) or `medals/scheduler.js` (server-wide/recurring). No render
changes needed unless you want a bespoke icon — add one to `ICONS` in
`render/medalIcons.js`, otherwise it falls back to a generic star.

## Bugs already found and fixed (don't reintroduce these)

1. **Windows ESM path bug**: `index.js` and `deploy-commands.js` originally
   did `await import(path.join(commandsDir, file))` — works on POSIX, but
   crashes on Windows with `ERR_UNSUPPORTED_ESM_URL_SCHEME` because
   `C:\...` gets parsed as a URL scheme. Fixed by wrapping with
   `pathToFileURL(...).href`. If you add any other dynamic `import()` of a
   filesystem path anywhere, use the same pattern.
2. **better-sqlite3 native build**: originally pinned `^11.3.0`, which has
   no prebuilt binary for newer Node versions (forces a from-source compile
   requiring Python + a C++ toolchain — fails on a clean Windows machine).
   Bumped to `^13.0.0`, which ships prebuilt binaries and avoids this
   entirely. Don't downgrade without checking prebuild availability first.
3. **Privileged Discord intent**: originally requested
   `GatewayIntentBits.GuildMembers` in the client constructor, which
   requires manually enabling "Server Members Intent" in the Discord
   Developer Portal — bot crashes with "Used disallowed intents" if it
   isn't toggled on. Removed it: the only guild-member usage in this
   codebase is `guild.members.fetch(<single id>)` in `leaderboard.js` and
   `medals-leaderboard.js`, which works fine over plain REST without the
   privileged intent (that intent is only needed for bulk member caching,
   which nothing here does). If you ever add a feature that needs the full
   member list, you'll need to both add the intent back **and** tell the
   user to enable it in the portal.
4. **Font rendering ("garbled squiggly lines")**: originally used
   `ctx.font = '... sans-serif'` everywhere, relying on the OS to resolve a
   generic family — broke on the user's Windows machine (fell back to
   something unreadable). Fixed by bundling an actual font file
   (`src/assets/fonts/Outfit-{Regular,Bold}.ttf`, OFL-licensed) and
   registering it explicitly via `@napi-rs/canvas`'s `GlobalFonts` in
   `src/fonts.js`, then referencing it by exact name everywhere via the
   `fontRegular()`/`fontBold()` helpers exported from that file. **Never
   write a raw `ctx.font = '...px sans-serif'` string again** — always use
   `fontRegular(size)` / `fontBold(size)` from `../fonts.js` (or `./fonts.js`
   depending on location), so text rendering stays host-independent.

## Deployment status

Not yet deployed anywhere permanent as of this handoff — the user has been
running it locally on Windows for testing. They were walked through two
options for hosting:
- **Railway**: no real free tier anymore (2026) — $5 trial then $5/mo
  Hobby. Deploy via CLI (`railway up`) or GitHub, uses the existing
  `Dockerfile` automatically. Needs a Volume mounted at `/app/data` for the
  SQLite file to survive restarts.
- **Render**: free web services exist but **cannot attach a persistent
  disk**, so the free tier is not viable for this bot (would wipe the
  database on every restart). Needs at least the Starter plan ($7/mo) as a
  **Background Worker** (not Web Service) with a disk mounted at
  `/app/data`. Deploys via GitHub push only (no CLI zip-upload path like
  Railway's), and auto-redeploys on every `git push` once connected.

Whichever host they pick, remind them: any change that adds/renames a slash
command's name or options needs one manual `npm run deploy-commands` run
afterward — Discord doesn't pick that up automatically the way ordinary
code changes do.

## Working style notes for continuing this project

- The user is on Windows, using PowerShell, and has needed real hand-holding
  through Node/npm/PowerShell execution-policy basics — they're capable but
  not a professional developer. Explanations that assume less prior
  knowledge land better than terse ones.
- Nothing in this repo has been run by the assistant — only the user can
  actually execute it. When making changes, be extra careful about syntax
  correctness and cross-platform behavior (Windows path handling in
  particular has already bitten this project once).
- The user likes seeing a quick visual mockup (built with plain HTML/CSS
  mimicking the canvas output) before/after visual changes land in the real
  renderer, to sanity-check direction before a full implementation pass.
