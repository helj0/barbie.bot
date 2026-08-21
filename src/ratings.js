// The 0-5 star rating system: /rate, the "Rate" button attached to
// /nowplaying, /artist, /album, /track, and /leaderboard cards, and the
// select-menu picker that button opens. Ratings are scoped per-guild, same
// as the rest of the bot's "compare within your server" design.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { cacheGet, cacheSet, upsertRating, getRatingSummary } from './db.js';

// Long enough that a Rate button on an old message still works if someone
// scrolls back to it, without keeping the pending-rate cache forever.
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeKey(s) {
  return (s ?? '').trim().toLowerCase();
}

function subjectKeyFor(type, artist, album, track) {
  if (type === 'artist') return `artist:${normalizeKey(artist)}`;
  if (type === 'album') return `album:${normalizeKey(artist)}:${normalizeKey(album)}`;
  return `track:${normalizeKey(artist)}:${normalizeKey(track)}`;
}

function subjectLabelFor(type, artist, album, track) {
  if (type === 'artist') return artist;
  if (type === 'album') return `${album} by ${artist}`;
  return `${track} by ${artist}`;
}

/** Ratings summary ({average, count}) for display on cards - average is null when count is 0. */
export function getSummary(guildId, type, artist, album, track) {
  return getRatingSummary(guildId, type, subjectKeyFor(type, artist, album, track));
}

/** Records/updates one user's rating and returns the fresh summary. */
export function rate(guildId, discordId, type, artist, album, track, rating) {
  const key = subjectKeyFor(type, artist, album, track);
  const label = subjectLabelFor(type, artist, album, track);
  upsertRating(guildId, discordId, type, key, label, rating);
  return getRatingSummary(guildId, type, key);
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * A "Rate" button for a card. Its subject is stashed in the cache table
 * under a short random token rather than crammed into the customId itself,
 * since Discord customIds cap at 100 chars and artist/album/track names
 * routinely wouldn't fit.
 */
export function buildRateButtonRow({ type, artist, album, track }) {
  const token = randomToken();
  cacheSet(`ratepayload:${token}`, { type, artist, album, track }, PENDING_TTL_MS);

  const button = new ButtonBuilder()
    .setCustomId(`rate:${token}`)
    .setLabel('Rate')
    .setEmoji('⭐')
    .setStyle(ButtonStyle.Secondary);
  return new ActionRowBuilder().addComponents(button);
}

const STAR_OPTION_LABELS = ['0 ★ — not for me', '1 ★', '2 ★', '3 ★', '4 ★', '5 ★ — perfect'];

/** Handles a "Rate" button click - shows an ephemeral 0-5 star picker. */
export async function handleRateButton(interaction) {
  const token = interaction.customId.slice('rate:'.length);
  const payload = cacheGet(`ratepayload:${token}`);
  if (!payload) {
    await interaction.reply({ content: 'This rate button has expired - run the command again.', ephemeral: true });
    return;
  }

  const label = subjectLabelFor(payload.type, payload.artist, payload.album, payload.track);
  const select = new StringSelectMenuBuilder()
    .setCustomId(`rateselect:${token}`)
    .setPlaceholder('Pick a rating')
    .addOptions(STAR_OPTION_LABELS.map((optionLabel, value) => ({ label: optionLabel, value: String(value) })));

  await interaction.reply({
    content: `Rate **${label}**:`,
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

/** Handles the star-picker select menu - records the rating and confirms in place. */
export async function handleRateSelect(interaction) {
  const token = interaction.customId.slice('rateselect:'.length);
  const payload = cacheGet(`ratepayload:${token}`);
  if (!payload) {
    await interaction.update({ content: 'This rate button has expired - run the command again.', components: [] });
    return;
  }

  const rating = Number(interaction.values[0]);
  const { type, artist, album, track } = payload;
  const label = subjectLabelFor(type, artist, album, track);
  const summary = rate(interaction.guildId, interaction.user.id, type, artist, album, track, rating);

  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const avgText = `Server average: ${summary.average.toFixed(1)}★ from ${summary.count} rating${summary.count === 1 ? '' : 's'}.`;

  await interaction.update({
    content: `You rated **${label}** ${stars} (${rating}/5).\n${avgText}`,
    components: [],
  });
}
