export const theme = {
  text: '#fafafa',
  textDim: '#b8bac4',
  textFaint: '#6f7280',

  accent: '#2ecc71',
  accentRgb: '46,204,113',

  accent2: '#c4b5fd',
  accent2Rgb: '139,92,246',

  rankGold: '#f2c94c',
  rankGoldRgb: '242,201,76',
  rankSilver: '#c9ccd6',
  rankSilverRgb: '201,204,214',
  rankBronze: '#d68b52',
  rankBronzeRgb: '214,139,82',
};

export function rankColor(rank) {
  if (rank === 1) return theme.rankGold;
  if (rank === 2) return theme.rankSilver;
  if (rank === 3) return theme.rankBronze;
  return theme.textDim;
}

/** RGB triple (no "rgba(...)" wrapper) for tinting a rank-1/2/3 glass row, or null for unranked. */
export function rankAccentRgb(rank) {
  if (rank === 1) return theme.rankGoldRgb;
  if (rank === 2) return theme.rankSilverRgb;
  if (rank === 3) return theme.rankBronzeRgb;
  return null;
}
