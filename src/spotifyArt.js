// Optional cover-art fallback. Last.fm increasingly returns blank/placeholder
// images, especially for artists. If Spotify credentials are configured, we
// use the app-only Client Credentials flow (no user auth) to search the
// catalog for artwork. Search + catalog lookups still work on Spotify's API
// even after their 2024-2026 endpoint restrictions - only things like
// recommendations/audio-features are gone, which we don't use here.
//
// findSpotifyMatch is also used by streamingLinks.js to build the "Open in
// Spotify" button - that part works even without Spotify credentials
// configured, falling back to a plain open.spotify.com search URL instead
// of a direct catalog match.

let tokenCache = { token: null, expiresAt: 0 };

function isConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 5000) {
    return tokenCache.token;
  }
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`);
  const json = await res.json();
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return tokenCache.token;
}

async function searchSpotify(type, query) {
  const token = await getToken();
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', type);
  url.searchParams.set('limit', '1');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Best-effort cover art lookup. Returns an image URL or null.
 * Falls through silently if Spotify isn't configured or the lookup fails -
 * callers should already have a Last.fm image as their primary source.
 */
export async function findCoverArt({ artist, album, track }) {
  if (!isConfigured()) return null;
  try {
    if (album) {
      const json = await searchSpotify('album', `album:${album} artist:${artist}`);
      const img = json?.albums?.items?.[0]?.images?.[0]?.url;
      if (img) return img;
    }
    if (track) {
      const json = await searchSpotify('track', `track:${track} artist:${artist}`);
      const img = json?.tracks?.items?.[0]?.album?.images?.[0]?.url;
      if (img) return img;
    }
    if (artist) {
      const json = await searchSpotify('artist', artist);
      const img = json?.artists?.items?.[0]?.images?.[0]?.url;
      if (img) return img;
    }
  } catch {
    // Best-effort only - swallow errors and let the caller fall back to a placeholder.
    return null;
  }
  return null;
}

/** A plain Spotify search URL - works with zero configuration, used as the ultimate fallback for the "Open in Spotify" button. */
export function spotifySearchUrl({ artist, album, track }) {
  const query = [track, album, artist].filter(Boolean).join(' ');
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

/**
 * Looks up one specific artist/album/track on Spotify and returns both its
 * artwork and its open.spotify.com link. Unlike findCoverArt (which tries
 * album, then track, then artist, to find *any* usable image), this does
 * exactly one targeted search matching `type`, since the link needs to
 * point at the right kind of page, not just any nearby match.
 * @param {object} opts
 * @param {'artist'|'album'|'track'} opts.type
 * @param {string} opts.artist
 * @param {string} [opts.album]
 * @param {string} [opts.track]
 * @returns {Promise<{imageUrl: string|null, spotifyUrl: string}>} spotifyUrl always resolves to something clickable.
 */
export async function findSpotifyMatch({ type, artist, album, track }) {
  const fallbackUrl = spotifySearchUrl({ artist, album, track });
  if (!isConfigured()) return { imageUrl: null, spotifyUrl: fallbackUrl };

  try {
    let item;
    if (type === 'album') {
      const json = await searchSpotify('album', `album:${album} artist:${artist}`);
      item = json?.albums?.items?.[0];
      if (item) return { imageUrl: item.images?.[0]?.url ?? null, spotifyUrl: item.external_urls?.spotify ?? fallbackUrl };
    } else if (type === 'track') {
      const json = await searchSpotify('track', `track:${track} artist:${artist}`);
      item = json?.tracks?.items?.[0];
      if (item) return { imageUrl: item.album?.images?.[0]?.url ?? null, spotifyUrl: item.external_urls?.spotify ?? fallbackUrl };
    } else {
      const json = await searchSpotify('artist', artist);
      item = json?.artists?.items?.[0];
      if (item) return { imageUrl: item.images?.[0]?.url ?? null, spotifyUrl: item.external_urls?.spotify ?? fallbackUrl };
    }
  } catch {
    // Best-effort only - fall through to the search-URL fallback below.
  }
  return { imageUrl: null, spotifyUrl: fallbackUrl };
}
