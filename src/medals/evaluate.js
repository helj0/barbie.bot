import { cached } from '../db.js';
import {
  getUserInfo,
  getTopArtists,
  getTopArtistsMeta,
  getTopAlbums,
  getArtistInfo,
  getArtistTopTags,
} from '../lastfm.js';
import { MEDALS } from './catalog.js';

// Cache Last.fm lookups for roughly one scheduler cycle so re-running the
// evaluator doesn't refetch data that hasn't had time to change, but stays
// fresh enough that a real listening session shows up on the next pass.
const EVAL_TTL_MS = 20 * 60 * 1000;
const TAG_TTL_MS = 24 * 60 * 60 * 1000; // artist tags barely change

/**
 * @param {string} username - Last.fm username
 * @returns {Promise<{ results: Array<{key: string, tier: string, context: object}>, lifetimePlays: number }>}
 */
export async function evaluatePersonalMedals(username) {
  const results = [];

  const info = await cached(`medals:userinfo:${username}`, EVAL_TTL_MS, () => getUserInfo(username));
  const lifetimePlays = Number(info?.playcount ?? 0);
  pushQualifyingTiers(results, 'scrobbler', lifetimePlays);

  const [topArtistOverall] = await cached(`medals:topartist:overall:${username}`, EVAL_TTL_MS, () =>
    getTopArtists(username, 'overall', 1)
  );
  if (topArtistOverall) {
    pushQualifyingTiers(results, 'devotee', Number(topArtistOverall.playcount ?? 0), {
      artist: topArtistOverall.name,
    });
  }

  const [topAlbumOverall] = await cached(`medals:topalbum:overall:${username}`, EVAL_TTL_MS, () =>
    getTopAlbums(username, 'overall', 1)
  );
  if (topAlbumOverall) {
    pushQualifyingTiers(results, 'onrepeat', Number(topAlbumOverall.playcount ?? 0), {
      album: topAlbumOverall.name,
      artist: topAlbumOverall.artist?.name,
    });
  }

  const artistCountThisMonth = await cached(`medals:artistcount:1month:${username}`, EVAL_TTL_MS, () =>
    getTopArtistsMeta(username, '1month')
  );
  pushQualifyingTiers(results, 'cratedigger', artistCountThisMonth.total);

  // Genre Hopper + taste medals both key off this month's top 10 artists,
  // so fetch it once and reuse for both.
  const monthTopArtists = await cached(`medals:topartists:1month:${username}`, EVAL_TTL_MS, () =>
    getTopArtists(username, '1month', 10)
  );

  if (monthTopArtists.length) {
    const tagSet = new Set();
    const listenerCounts = [];

    await Promise.all(
      monthTopArtists.map(async (artist) => {
        try {
          const tags = await cached(`tags:${artist.name}`, TAG_TTL_MS, () => getArtistTopTags(artist.name));
          tags.slice(0, 3).forEach((t) => tagSet.add(t.name.toLowerCase()));
        } catch {
          // one artist's tag lookup failing shouldn't sink the whole evaluation
        }
        try {
          const artistInfo = await cached(`medals:artistinfo:${artist.name}`, EVAL_TTL_MS, () =>
            getArtistInfo(artist.name)
          );
          if (artistInfo.listeners > 0) listenerCounts.push(artistInfo.listeners);
        } catch {
          // same - skip this artist's contribution to the average
        }
      })
    );

    pushQualifyingTiers(results, 'genrehopper', tagSet.size);

    if (listenerCounts.length) {
      const avgListeners = listenerCounts.reduce((a, b) => a + b, 0) / listenerCounts.length;
      if (avgListeners < 50000) {
        results.push({ key: 'underground', tier: 'gold', context: { avgListeners: Math.round(avgListeners) } });
      }
      if (avgListeners > 3000000) {
        results.push({ key: 'charttopper', tier: 'gold', context: { avgListeners: Math.round(avgListeners) } });
      }
    }
  }

  return { results, lifetimePlays };
}

function pushQualifyingTiers(results, medalKey, value, context = {}) {
  const def = MEDALS[medalKey];
  for (const tierDef of def.tiers) {
    if (value >= tierDef.threshold) {
      results.push({ key: medalKey, tier: tierDef.tier, context: { ...context, value } });
    }
  }
}
