import { getLinkedUsersInGuild, cached } from '../db.js';
import { getArtistUserPlaycount, getAlbumUserPlaycount, getTrackUserPlaycount } from '../lastfm.js';
import { getStreamingLinks } from '../streamingLinks.js';
import { getSummary } from '../ratings.js';

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
 * @param {boolean} [opts.skipLinks] - skip the streaming-links lookup entirely (for callers
 *        like /nowplaying's other-listeners section that already resolved it elsewhere for
 *        the same subject and would otherwise trigger a redundant external lookup)
 * @returns {Promise<{ entries: Array<{discordId: string, displayName: string, avatarUrl: string, playcount: number}>, subjectName: string, imageUrl: string|null, ratingSummary: {average: number|null, count: number}, spotifyUrl?: string, appleMusicUrl?: string, youtubeUrl?: string }>}
 */
export async function getServerListeners(opts) {
  const { guild, type, artist, album, track, excludeDiscordId, limit = 10, skipLinks = false } = opts;
  const subjectName = type === 'artist' ? artist : type === 'album' ? album : track;

  const ratingSummary = getSummary(guild.id, type, artist, album, track);

  const members = getLinkedUsersInGuild(guild.id).filter((m) => m.discord_id !== excludeDiscordId);
  if (!members.length) {
    if (skipLinks) return { entries: [], subjectName, imageUrl: null, ratingSummary };
    const links = await getStreamingLinks({ type, artist, album, track });
    return { entries: [], subjectName, ratingSummary, ...links };
  }

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

  if (skipLinks) {
    return { entries, subjectName, imageUrl: withPlays[0]?.image ?? null, ratingSummary };
  }

  // Always look up the streaming links (Last.fm never gives us these),
  // reusing their image only if Last.fm didn't already have one.
  const links = await getStreamingLinks({ type, artist, album, track });
  const imageUrl = withPlays[0]?.image ?? links.imageUrl;

  return { entries, subjectName, ratingSummary, ...links, imageUrl };
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
