// Resolves "open this elsewhere" links for the platform buttons on cards
// centered on one specific artist/album/track. Spotify (spotifyArt.js)
// needs configured credentials to get an exact match, and falls back to a
// search URL without them. Apple Music uses Apple's iTunes Search API,
// which is free and needs no credentials or API key at all - it always
// tries for an exact match. YouTube has no equivalent free lookup, so it's
// always just a search-results link, not a claim of the "right" video.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { findSpotifyMatch } from './spotifyArt.js';

function joinedQuery({ artist, album, track }) {
  return [track, album, artist].filter(Boolean).join(' ');
}

async function findAppleMusicMatch({ type, artist, album, track }) {
  const fallbackUrl = `https://music.apple.com/us/search?term=${encodeURIComponent(joinedQuery({ artist, album, track }))}`;
  try {
    const entity = type === 'artist' ? 'musicArtist' : type === 'album' ? 'album' : 'song';
    const term = type === 'artist' ? artist : type === 'album' ? `${artist} ${album}` : `${artist} ${track}`;

    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', term);
    url.searchParams.set('entity', entity);
    url.searchParams.set('limit', '1');

    const res = await fetch(url);
    if (!res.ok) return { imageUrl: null, url: fallbackUrl };
    const json = await res.json();
    const item = json?.results?.[0];
    if (!item) return { imageUrl: null, url: fallbackUrl };

    const link = item.trackViewUrl ?? item.collectionViewUrl ?? item.artistLinkUrl ?? fallbackUrl;
    const imageUrl = item.artworkUrl100 ? item.artworkUrl100.replace('100x100', '600x600') : null;
    return { imageUrl, url: link };
  } catch {
    return { imageUrl: null, url: fallbackUrl };
  }
}

function youtubeSearchUrl({ artist, album, track }) {
  const query = [artist, track ?? album].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * Resolves Spotify + Apple Music links in parallel (reusing whichever gives
 * us a cover image first) plus a YouTube search link, in one call.
 * @param {object} opts
 * @param {'artist'|'album'|'track'} opts.type
 * @param {string} opts.artist
 * @param {string} [opts.album]
 * @param {string} [opts.track]
 * @returns {Promise<{imageUrl: string|null, spotifyUrl: string, appleMusicUrl: string, youtubeUrl: string}>}
 */
export async function getStreamingLinks({ type, artist, album, track }) {
  const [spotify, apple] = await Promise.all([
    findSpotifyMatch({ type, artist, album, track }),
    findAppleMusicMatch({ type, artist, album, track }),
  ]);

  return {
    imageUrl: spotify.imageUrl ?? apple.imageUrl ?? null,
    spotifyUrl: spotify.spotifyUrl,
    appleMusicUrl: apple.url,
    youtubeUrl: youtubeSearchUrl({ artist, album, track }),
  };
}

/** A row of link buttons for message components - one per platform provided. */
export function streamingButtonRow({ spotifyUrl, appleMusicUrl, youtubeUrl }) {
  const row = new ActionRowBuilder();
  if (spotifyUrl) {
    row.addComponents(new ButtonBuilder().setLabel('Spotify').setEmoji('🎧').setStyle(ButtonStyle.Link).setURL(spotifyUrl));
  }
  if (appleMusicUrl) {
    row.addComponents(new ButtonBuilder().setLabel('Apple Music').setEmoji('🍎').setStyle(ButtonStyle.Link).setURL(appleMusicUrl));
  }
  if (youtubeUrl) {
    row.addComponents(new ButtonBuilder().setLabel('YouTube').setEmoji('▶️').setStyle(ButtonStyle.Link).setURL(youtubeUrl));
  }
  return row;
}
