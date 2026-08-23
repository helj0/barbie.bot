# Privacy Policy — barbie.bot

Last updated: 2026-08-23

barbie.bot ("the bot") is a Discord bot that compares server members'
Last.fm listening stats. This page explains what it stores, why, and how
to get it removed.

## What the bot stores

When you run `/link`, the bot stores:

- Your Discord user ID and the ID of the server you linked in
- The Last.fm username you provided
- The time you linked

That's it for account linking — no password, no OAuth token, nothing from
Spotify or Apple. Last.fm usernames are looked up through Last.fm's public,
read-only API, the same data anyone can already see on your public Last.fm
profile.

Using the bot's other features can additionally store:

- **Medals** you've earned (`/medals`) — which medal, tier, and when
- **Ratings** you've given (`/rate` or the "Rate" button) — the artist/
  album/track, your 0–5 score, and when, scoped to the server you rated
  it in
- **Monthly listening snapshots**, used only to compute the recurring
  Monthly Champion medal
- A short-lived cache (typically a few minutes) of responses from Last.fm/
  Spotify/Apple Music, so repeated commands don't hammer those APIs

All of this is scoped to the server(s) you've used the bot in — the bot
doesn't merge or compare data about you across unrelated servers.

## What the bot does *not* do

- No passwords, no Spotify/Apple account login, no OAuth of any kind
- No selling, renting, or sharing your data with advertisers or data brokers
- No tracking outside of Discord — the bot only acts in response to
  commands and button clicks you or someone in your server initiates
- No reading of message content — Discord slash commands and buttons don't
  give the bot access to your regular messages

## Third-party services this bot talks to

To answer a command, the bot may send an outbound request containing an
artist/album/track/username to:

- **[Last.fm](https://www.last.fm/api)** — the primary data source for
  listening stats
- **[Spotify](https://developer.spotify.com/documentation/web-api)**
  (optional, only if the server operator configured it) — cover-art
  fallback and the "Open in Spotify" link, via app-only credentials with
  no access to your Spotify account
- **[Apple's iTunes Search API](https://performance-partners.apple.com/search-api)**
  — the "Open in Apple Music" link, no account or credentials involved
- **YouTube** — the "Open in YouTube" button is a plain search-results
  link; the bot never calls a YouTube API

These are read-only, unauthenticated (or app-only) lookups — none of them
receive your Discord identity, only the music metadata needed to answer
the command.

## Who can see your data

Anything the bot displays (now-playing cards, leaderboards, medals,
ratings) is visible to members of the server(s) you've used it in, the
same as any other bot output in that server. The server operator running
their own instance of the bot can access the raw database on their
hosting.

## How to remove your data

Run `/unlink` to remove your account link (Discord ID ↔ Last.fm username)
immediately. Medals and ratings tied to your Discord ID may persist after
unlinking, since they belong to the server's history rather than the link
itself — if you'd like those fully erased too, open a request at the
GitHub repository below and it'll be handled manually.

## Contact

Questions, concerns, or data removal requests:
[github.com/helj0/barbie.bot](https://github.com/helj0/barbie.bot) — open
an issue.

## Changes to this policy

If what the bot collects changes meaningfully, this page will be updated
and the "Last updated" date above will reflect it.
