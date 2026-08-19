// Every medal is either:
//  - personal: evaluated independently per linked user, any number of people can hold it
//  - serverFirst: personal thresholds, but only the first person in a guild to
//    cross the line gets it (one holder per guild, ever)
//  - recurring: re-evaluated every cycle; the holder can change (Monthly Champion)
//
// Tiers are checked low-to-high; a user can hold multiple tiers of the same
// medal (e.g. Scrobbler bronze AND silver) - award() is idempotent per tier.

export const MEDALS = {
  scrobbler: {
    name: 'Scrobbler',
    category: 'milestone',
    description: (t) => `Reach ${t.toLocaleString()} lifetime scrobbles`,
    tiers: [
      { tier: 'bronze', threshold: 500, points: 10 },
      { tier: 'silver', threshold: 2500, points: 25 },
      { tier: 'gold', threshold: 10000, points: 50 },
      { tier: 'platinum', threshold: 25000, points: 100 },
    ],
  },
  devotee: {
    name: 'Devotee',
    category: 'milestone',
    description: (t) => `Play a single artist ${t.toLocaleString()} times`,
    tiers: [
      { tier: 'bronze', threshold: 100, points: 10 },
      { tier: 'silver', threshold: 250, points: 25 },
      { tier: 'gold', threshold: 500, points: 50 },
      { tier: 'platinum', threshold: 1000, points: 100 },
    ],
  },
  onrepeat: {
    name: 'On Repeat',
    category: 'milestone',
    description: (t) => `Play a single album ${t.toLocaleString()} times`,
    tiers: [
      { tier: 'bronze', threshold: 50, points: 10 },
      { tier: 'silver', threshold: 100, points: 25 },
      { tier: 'gold', threshold: 200, points: 50 },
      { tier: 'platinum', threshold: 400, points: 100 },
    ],
  },
  cratedigger: {
    name: 'Crate Digger',
    category: 'variety',
    description: (t) => `Listen to ${t} different artists in one month`,
    tiers: [
      { tier: 'bronze', threshold: 30, points: 10 },
      { tier: 'silver', threshold: 60, points: 25 },
      { tier: 'gold', threshold: 100, points: 50 },
      { tier: 'platinum', threshold: 150, points: 100 },
    ],
  },
  genrehopper: {
    name: 'Genre Hopper',
    category: 'variety',
    description: (t) => `Span ${t} different genre tags in one month`,
    tiers: [
      { tier: 'bronze', threshold: 5, points: 10 },
      { tier: 'silver', threshold: 8, points: 25 },
      { tier: 'gold', threshold: 12, points: 50 },
      { tier: 'platinum', threshold: 16, points: 100 },
    ],
  },
  underground: {
    name: 'Underground',
    category: 'taste',
    description: () => 'Average under 50,000 listeners across your monthly top 10 artists',
    tiers: [{ tier: 'gold', points: 30 }],
  },
  charttopper: {
    name: 'Chart Topper',
    category: 'taste',
    description: () => 'Average over 3,000,000 listeners across your monthly top 10 artists',
    tiers: [{ tier: 'gold', points: 30 }],
  },
  trailblazer: {
    name: 'Trailblazer',
    category: 'competitive',
    description: () => 'First in the server to pass 1,000 lifetime scrobbles',
    tiers: [{ tier: 'gold', threshold: 1000, points: 75 }],
    serverFirst: true,
  },
  scrobblelegend: {
    name: 'Scrobble Legend',
    category: 'competitive',
    description: () => 'First in the server to pass 10,000 lifetime scrobbles',
    tiers: [{ tier: 'gold', threshold: 10000, points: 100 }],
    serverFirst: true,
  },
  monthlychampion: {
    name: 'Monthly Champion',
    category: 'competitive',
    description: () => 'Most scrobbles in the server this month',
    tiers: [{ tier: 'gold', points: 40 }],
    recurring: true,
  },
};

export function medalPoints(medalKey, tier) {
  const def = MEDALS[medalKey];
  const tierDef = def?.tiers.find((t) => t.tier === tier);
  return tierDef?.points ?? 0;
}
