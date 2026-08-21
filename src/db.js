import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || './data/bot.sqlite';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id       TEXT PRIMARY KEY,
    guild_id         TEXT NOT NULL,
    lastfm_username  TEXT NOT NULL,
    linked_at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_guild ON users (guild_id);

  -- Generic short-TTL cache for Last.fm/Spotify responses so a single
  -- /servertop, /leaderboard, or medal evaluation pass (which fans out to
  -- every linked member) doesn't hammer upstream APIs or rate limits.
  CREATE TABLE IF NOT EXISTS cache (
    cache_key   TEXT PRIMARY KEY,
    value_json  TEXT NOT NULL,
    expires_at  INTEGER NOT NULL
  );

  -- Per-guild bot config. Currently just the medal-announcement channel.
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id             TEXT PRIMARY KEY,
    announce_channel_id  TEXT
  );

  -- Earned medals. tier is NULL for single-tier medals. The unique
  -- constraint is what makes awarding idempotent - re-evaluating a medal a
  -- user already has is a silent no-op.
  CREATE TABLE IF NOT EXISTS user_medals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id    TEXT NOT NULL,
    guild_id      TEXT NOT NULL,
    medal_key     TEXT NOT NULL,
    tier          TEXT,
    context_json  TEXT,
    earned_at     INTEGER NOT NULL,
    UNIQUE(discord_id, guild_id, medal_key, tier)
  );
  CREATE INDEX IF NOT EXISTS idx_user_medals_guild ON user_medals (guild_id);
  CREATE INDEX IF NOT EXISTS idx_user_medals_user ON user_medals (discord_id, guild_id);

  -- Per-user, per-calendar-month baseline lifetime playcount, so we can
  -- compute "plays this month" as (current lifetime playcount - baseline)
  -- without needing our own scrobble log. Written lazily: the first
  -- evaluation pass each month for a user sets the baseline.
  CREATE TABLE IF NOT EXISTS monthly_snapshot (
    guild_id        TEXT NOT NULL,
    discord_id      TEXT NOT NULL,
    year_month      TEXT NOT NULL,
    start_playcount INTEGER NOT NULL,
    PRIMARY KEY (guild_id, discord_id, year_month)
  );

  -- Tracks the current leader for the in-progress month's Monthly Champion
  -- medal, per guild. Overwritten as the lead changes; finalized into
  -- user_medals when year_month rolls over.
  CREATE TABLE IF NOT EXISTS monthly_champion (
    guild_id    TEXT NOT NULL,
    year_month  TEXT NOT NULL,
    discord_id  TEXT NOT NULL,
    playcount   INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (guild_id, year_month)
  );

  -- One rating (0-5) per member per artist/album/track, scoped to the guild
  -- they rated it in - mirrors the rest of the bot's "compare within your
  -- server" scope rather than pooling opinions across unrelated servers.
  -- subject_key is a normalized (trimmed/lowercased) lookup key so ratings
  -- from /rate and from the card Rate buttons land on the same row
  -- regardless of exact capitalization; subject_label keeps a display copy.
  CREATE TABLE IF NOT EXISTS ratings (
    guild_id      TEXT NOT NULL,
    discord_id    TEXT NOT NULL,
    subject_type  TEXT NOT NULL,
    subject_key   TEXT NOT NULL,
    subject_label TEXT NOT NULL,
    rating        INTEGER NOT NULL,
    rated_at      INTEGER NOT NULL,
    PRIMARY KEY (guild_id, discord_id, subject_type, subject_key)
  );
  CREATE INDEX IF NOT EXISTS idx_ratings_subject ON ratings (guild_id, subject_type, subject_key);
`);

// ---- account linking -------------------------------------------------

export function linkUser(discordId, guildId, lastfmUsername) {
  db.prepare(
    `INSERT INTO users (discord_id, guild_id, lastfm_username, linked_at)
     VALUES (@discordId, @guildId, @lastfmUsername, @now)
     ON CONFLICT(discord_id) DO UPDATE SET
       guild_id = excluded.guild_id,
       lastfm_username = excluded.lastfm_username,
       linked_at = excluded.linked_at`
  ).run({ discordId, guildId, lastfmUsername, now: Date.now() });
}

export function unlinkUser(discordId) {
  const result = db.prepare(`DELETE FROM users WHERE discord_id = ?`).run(discordId);
  return result.changes > 0;
}

export function getUser(discordId) {
  return db.prepare(`SELECT * FROM users WHERE discord_id = ?`).get(discordId);
}

export function getLinkedUsersInGuild(guildId) {
  return db.prepare(`SELECT * FROM users WHERE guild_id = ?`).all(guildId);
}

export function getAllGuildIds() {
  return db.prepare(`SELECT DISTINCT guild_id FROM users`).all().map((r) => r.guild_id);
}

// ---- cache -------------------------------------------------------------

export function cacheGet(key) {
  const row = db.prepare(`SELECT value_json, expires_at FROM cache WHERE cache_key = ?`).get(key);
  if (!row) return undefined;
  if (row.expires_at < Date.now()) {
    db.prepare(`DELETE FROM cache WHERE cache_key = ?`).run(key);
    return undefined;
  }
  return JSON.parse(row.value_json);
}

export function cacheSet(key, value, ttlMs) {
  db.prepare(
    `INSERT INTO cache (cache_key, value_json, expires_at)
     VALUES (@key, @value, @expiresAt)
     ON CONFLICT(cache_key) DO UPDATE SET
       value_json = excluded.value_json,
       expires_at = excluded.expires_at`
  ).run({ key, value: JSON.stringify(value), expiresAt: Date.now() + ttlMs });
}

/** Wrap an async fetcher with cache-aside semantics. */
export async function cached(key, ttlMs, fetcher) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  cacheSet(key, value, ttlMs);
  return value;
}

// ---- guild settings ------------------------------------------------------

export function getGuildSettings(guildId) {
  return db.prepare(`SELECT * FROM guild_settings WHERE guild_id = ?`).get(guildId);
}

export function setAnnounceChannel(guildId, channelId) {
  db.prepare(
    `INSERT INTO guild_settings (guild_id, announce_channel_id)
     VALUES (@guildId, @channelId)
     ON CONFLICT(guild_id) DO UPDATE SET announce_channel_id = excluded.announce_channel_id`
  ).run({ guildId, channelId });
}

// ---- medals --------------------------------------------------------------

/** Returns true if this was newly earned (false if the user already had it). */
export function awardMedal(discordId, guildId, medalKey, tier, context = {}) {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO user_medals (discord_id, guild_id, medal_key, tier, context_json, earned_at)
       VALUES (@discordId, @guildId, @medalKey, @tier, @context, @now)`
    )
    .run({
      discordId,
      guildId,
      medalKey,
      tier: tier ?? null,
      context: JSON.stringify(context),
      now: Date.now(),
    });
  return result.changes > 0;
}

export function getUserMedals(discordId, guildId) {
  return db
    .prepare(`SELECT * FROM user_medals WHERE discord_id = ? AND guild_id = ? ORDER BY earned_at ASC`)
    .all(discordId, guildId);
}

export function hasMedal(discordId, guildId, medalKey, tier = null) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM user_medals WHERE discord_id = ? AND guild_id = ? AND medal_key = ? AND tier IS ?`
      )
      .get(discordId, guildId, medalKey, tier)
  );
}

/** True if *anyone* in the guild already holds this medal/tier (for server-first claims). */
export function guildHasMedal(guildId, medalKey, tier = null) {
  return Boolean(
    db.prepare(`SELECT 1 FROM user_medals WHERE guild_id = ? AND medal_key = ? AND tier IS ?`).get(guildId, medalKey, tier)
  );
}

/** Medal counts + point totals per user in a guild, for /medals-leaderboard. */
export function getGuildMedalTally(guildId) {
  return db
    .prepare(
      `SELECT discord_id, COUNT(*) as medal_count
       FROM user_medals WHERE guild_id = ? GROUP BY discord_id`
    )
    .all(guildId);
}

/** Every (medal_key, tier) a guild has awarded, per user - used to compute point totals for the leaderboard. */
export function getGuildMedalRows(guildId) {
  return db.prepare(`SELECT discord_id, medal_key, tier FROM user_medals WHERE guild_id = ?`).all(guildId);
}

// ---- monthly snapshot / champion tracking --------------------------------

export function getMonthlySnapshot(guildId, discordId, yearMonth) {
  return db
    .prepare(`SELECT * FROM monthly_snapshot WHERE guild_id = ? AND discord_id = ? AND year_month = ?`)
    .get(guildId, discordId, yearMonth);
}

export function ensureMonthlySnapshot(guildId, discordId, yearMonth, currentPlaycount) {
  db.prepare(
    `INSERT OR IGNORE INTO monthly_snapshot (guild_id, discord_id, year_month, start_playcount)
     VALUES (@guildId, @discordId, @yearMonth, @start)`
  ).run({ guildId, discordId, yearMonth, start: currentPlaycount });
}

export function getMonthlyChampion(guildId) {
  return db
    .prepare(`SELECT * FROM monthly_champion WHERE guild_id = ? ORDER BY year_month DESC LIMIT 1`)
    .get(guildId);
}

export function upsertMonthlyChampion(guildId, yearMonth, discordId, playcount) {
  db.prepare(
    `INSERT INTO monthly_champion (guild_id, year_month, discord_id, playcount, updated_at)
     VALUES (@guildId, @yearMonth, @discordId, @playcount, @now)
     ON CONFLICT(guild_id, year_month) DO UPDATE SET
       discord_id = excluded.discord_id,
       playcount = excluded.playcount,
       updated_at = excluded.updated_at`
  ).run({ guildId, yearMonth, discordId, playcount, now: Date.now() });
}

// ---- ratings ---------------------------------------------------------

export function upsertRating(guildId, discordId, subjectType, subjectKey, subjectLabel, rating) {
  db.prepare(
    `INSERT INTO ratings (guild_id, discord_id, subject_type, subject_key, subject_label, rating, rated_at)
     VALUES (@guildId, @discordId, @subjectType, @subjectKey, @subjectLabel, @rating, @now)
     ON CONFLICT(guild_id, discord_id, subject_type, subject_key) DO UPDATE SET
       subject_label = excluded.subject_label,
       rating = excluded.rating,
       rated_at = excluded.rated_at`
  ).run({ guildId, discordId, subjectType, subjectKey, subjectLabel, rating, now: Date.now() });
}

export function getRatingSummary(guildId, subjectType, subjectKey) {
  const row = db
    .prepare(
      `SELECT AVG(rating) as average, COUNT(*) as count
       FROM ratings WHERE guild_id = ? AND subject_type = ? AND subject_key = ?`
    )
    .get(guildId, subjectType, subjectKey);
  return { average: row.count > 0 ? row.average : null, count: row.count };
}

export function getUserRating(guildId, discordId, subjectType, subjectKey) {
  const row = db
    .prepare(`SELECT rating FROM ratings WHERE guild_id = ? AND discord_id = ? AND subject_type = ? AND subject_key = ?`)
    .get(guildId, discordId, subjectType, subjectKey);
  return row ? row.rating : null;
}

export default db;
