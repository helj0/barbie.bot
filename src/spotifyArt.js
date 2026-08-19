// Optional cover-art fallback. Last.fm increasingly returns blank/placeholder
// images, especially for artists. If Spotify credentials are configured, we
// use the app-only Client Credentials flow (no user auth) to search the
// catalog for artwork. Search + catalog lookups still work on Spotify's API
// even after their 2024-2026 endpoint restrictions - only things like
// recommendations/audio-features are gone, which we don't use here.

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
