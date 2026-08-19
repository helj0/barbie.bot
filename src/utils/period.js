import { PERIODS } from '../lastfm.js';

/** Discord slash command "choices" array built from our period map. */
export const PERIOD_CHOICES = Object.entries(PERIODS).map(([value, { label }]) => ({
  name: label,
  value,
}));

export function periodLabel(periodKey) {
  return PERIODS[periodKey]?.label ?? periodKey;
}
