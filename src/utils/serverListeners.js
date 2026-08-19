import { getLinkedUsersInGuild, cached } from '../db.js';
import { getArtistUserPlaycount, getAlbumUserPlaycount, getTrackUserPlaycount } from '../lastfm.js';
import { findCoverArt } from '../spotifyArt.js';

const CACHE_TTL_MS = 3 * 60 * 1000;

/**
 * Fetches every linked guild member's all-time playcount for one
 * artist/album/track, ranks the ones who've actually played it, and
 * resolves Discord display info for the top results. Shared by
 * /leaderboard, /artist, /album, /track, and /nowplaying's "other
 * listeners" section.
 * @param {object} opts
 * @param {import('discord.js').Guild} opts.guild
 * @param {string} opts.type - 'artist' | 'album' | 'track'
 * @param {string} opts.artist
 * @param {string} [opts.album]
 * @param {string} [opts.track]
 * @param {string} [opts.excludeDiscordId] - omit this member entirely
 * @param {number} [opts.limit]
 * @returns {Promise<{ entries: Array<{discordId: string, displayName: string, avatarUrl: string, playcount: number}>, subjectName: string, imageUrl: string|null }>}
 */
export async function getServerListeners(opts) {
  const { guild, type, artist, album, track, excludeDiscordId, limit = 10 } = opts;
  const subjectName = type === 'artist' ? artist : type === 'album' ? album : track;

  const members = getLinkedUsersInGuild(guild.id).filter((m) => m.discord_id !== excludeDiscordId);
  if (!members.length) return { entries: [], subjectName, imageUrl: null };

  const subjectKey = type === 'artist' ? artist : type === 'album' ? `${artist}—${album}` : `${artist}—${track}`;

  const perUser = await Promise.all(
    members.map(async (m) => {
      try {
        const info = await cached(`serverlisteners:${type}:${subjectKey}:${m.lastfm_username}`, CACHE_TTL_MS, () =>
          fetchPlaycount(type, artist, album, track, m.lastfm_username)
        );
        return { discordId: m.discord_id, ...info };
      } catch {
        return null;
      }
    })
  );

  const withPlays = perUser.filter((r) => r && r.userPlaycount > 0).sort((a, b) => b.userPlaycount - a.userPlaycount);

  const entries = [];
  for (const row of withPlays.slice(0, limit)) {
    let member;
    try {
      member = await guild.members.fetch(row.discordId);
    } catch {
      continue; // left the server
    }
    entries.push({
      discordId: row.discordId,
      displayName: member.displayName,
      avatarUrl: member.displayAvatarURL({ extension: 'png', size: 64 }),
      playcount: row.userPlaycount,
    });
  }

  let imageUrl = withPlays[0]?.image ?? null;
  if (!imageUrl) {
    imageUrl = await findCoverArt({ artist, album, track });
  }

  return { entries, subjectName, imageUrl };
}

/**
 * Ensures the requester has a row in `entries` (marked isYou), even if
 * they have zero plays of the subject - /artist, /album, /track want to
 * show "your stats" regardless, not just whoever already has plays.
 */
export async function ensureRequesterIncluded(entries, { guild, type, artist, album, track, requesterMember, requesterUsername }) {
  const idx = entries.findIndex((e) => e.discordId === requesterMember.id);
  if (idx !== -1) {
    return entries.map((e, i) => (i === idx ? { ...e, isYou: true } : e));
  }

  let userPlaycount = 0;
  try {
    const info = await fetchPlaycount(type, artist, album, track, requesterUsername);
    userPlaycount = info.userPlaycount;
  } catch {
    // Leave at 0 - still show the row so "your stats" is never just missing.
  }

  const requesterEntry = {
    discordId: requesterMember.id,
    displayName: requesterMember.displayName,
    avatarUrl: requesterMember.displayAvatarURL({ extension: 'png', size: 64 }),
    playcount: userPlaycount,
    isYou: true,
  };

  return [...entries, requesterEntry].sort((a, b) => b.playcount - a.playcount);
}

async function fetchPlaycount(type, artist, album, track, username) {
  if (type === 'artist') return getArtistUserPlaycount(artist, username);
  if (type === 'album') return getAlbumUserPlaycount(artist, album, username);
  return getTrackUserPlaycount(artist, track, username);
}
