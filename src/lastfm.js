const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

class LastfmError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LastfmError';
    this.code = code; // Last.fm error codes, e.g. 6 = "user not found"
  }
}

async function call(method, params = {}) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) throw new Error('LASTFM_API_KEY is not set');

  const url = new URL(BASE_URL);
  url.searchParams.set('method', method);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const res = await fetch(url);
  const json = await res.json().catch(() => null);

  if (!res.ok || !json || json.error) {
    const message = json?.message || `Last.fm request failed (${res.status})`;
    throw new LastfmError(message, json?.error);
  }
  return json;
}

/** Maps our friendly period keys to Last.fm's period query values. */
export const PERIODS = {
  '7day': { label: 'Last 7 Days', value: '7day' },
  '1month': { label: 'Last Month', value: '1month' },
  '3month': { label: 'Last 3 Months', value: '3month' },
  '6month': { label: 'Last 6 Months', value: '6month' },
  '12month': { label: 'Last Year', value: '12month' },
  overall: { label: 'All Time', value: 'overall' },
};

/** Throws if the username doesn't exist - useful for validating /link. */
export async function getUserInfo(username) {
  const json = await call('user.getinfo', { user: username });
  return json.user;
}

export async function getRecentTracks(username, limit = 1) {
  const json = await call('user.getrecenttracks', { user: username, limit });
  const tracks = json.recenttracks?.track ?? [];
  return Array.isArray(tracks) ? tracks : [tracks];
}

/**
 * Resolves a user's current (or most recent) track into a plain
 * {artist, album, track, isNowPlaying} shape, or null if they have no
 * scrobbles at all. Used to default /artist, /album, /track to "whatever
 * I'm playing right now" when no name is given.
 */
export async function getCurrentTrackContext(username) {
  const [recent] = await getRecentTracks(username, 1);
  if (!recent) return null;
  return {
    artist: recent.artist?.['#text'] ?? recent.artist?.name ?? null,
    album: recent.album?.['#text'] || null,
    track: recent.name,
    isNowPlaying: recent['@attr']?.nowplaying === 'true',
  };
}

export async function getTopTracks(username, period, limit = 10) {
  const json = await call('user.gettoptracks', { user: username, period, limit });
  const tracks = json.toptracks?.track ?? [];
  return Array.isArray(tracks) ? tracks : [tracks];
}

export async function getTopAlbums(username, period, limit = 10) {
  const json = await call('user.gettopalbums', { user: username, period, limit });
  const albums = json.topalbums?.album ?? [];
  return Array.isArray(albums) ? albums : [albums];
}

export async function getTopArtists(username, period, limit = 10) {
  const json = await call('user.gettopartists', { user: username, period, limit });
  const artists = json.topartists?.artist ?? [];
  return Array.isArray(artists) ? artists : [artists];
}

/** All-time play count for one artist, for one user (used by /leaderboard). */
export async function getArtistUserPlaycount(artist, username) {
  const json = await call('artist.getinfo', { artist, username, autocorrect: 1 });
  return {
    name: json.artist?.name ?? artist,
    mbid: json.artist?.mbid,
    userPlaycount: Number(json.artist?.stats?.userplaycount ?? 0),
    image: pickImage(json.artist?.image),
  };
}

/** Global (not user-specific) info for an artist - used by the "Underground"/"Chart Topper" taste medals. */
export async function getArtistInfo(artist) {
  const json = await call('artist.getinfo', { artist, autocorrect: 1 });
  return {
    name: json.artist?.name ?? artist,
    listeners: Number(json.artist?.stats?.listeners ?? 0),
    image: pickImage(json.artist?.image),
  };
}

/** Just the total distinct-item count for a top-artists period, without fetching every item (used by the "Crate Digger" medal). */
export async function getTopArtistsMeta(username, period) {
  const json = await call('user.gettopartists', { user: username, period, limit: 1 });
  return { total: Number(json.topartists?.['@attr']?.total ?? 0) };
}

/** All-time play count for one album, for one user (used by /leaderboard). */
export async function getAlbumUserPlaycount(artist, album, username) {
  const json = await call('album.getinfo', { artist, album, username, autocorrect: 1 });
  return {
    name: json.album?.name ?? album,
    artist: json.album?.artist ?? artist,
    userPlaycount: Number(json.album?.userplaycount ?? 0),
    image: pickImage(json.album?.image),
  };
}

/** All-time play count for one track, for one user (used by /leaderboard). */
export async function getTrackUserPlaycount(artist, track, username) {
  const json = await call('track.getinfo', { artist, track, username, autocorrect: 1 });
  return {
    name: json.track?.name ?? track,
    artist: json.track?.artist?.name ?? artist,
    userPlaycount: Number(json.track?.userplaycount ?? 0),
    image: pickImage(json.track?.album?.image),
  };
}

/** Global top tags for an artist - used as a genre proxy. */
export async function getArtistTopTags(artist) {
  const json = await call('artist.gettoptags', { artist, autocorrect: 1 });
  const tags = json.toptags?.tag ?? [];
  return Array.isArray(tags) ? tags : [tags];
}

/** Last.fm returns an array of {size, #text} image objects; pick the biggest. */
export function pickImage(images) {
  if (!images || !Array.isArray(images)) return null;
  const order = ['extralarge', 'large', 'medium', 'small'];
  for (const size of order) {
    const found = images.find((i) => i.size === size && i['#text']);
    if (found) return found['#text'];
  }
  const anyWithUrl = images.find((i) => i['#text']);
  return anyWithUrl ? anyWithUrl['#text'] : null;
}

export { LastfmError };
