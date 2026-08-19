import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getLinkedUsersInGuild, cached } from '../db.js';
import { getTopTracks, getTopAlbums, getTopArtists, pickImage } from '../lastfm.js';
import { PERIOD_CHOICES, periodLabel } from '../utils/period.js';
import { renderTopListCard } from '../render/topListCard.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min - keeps repeated calls cheap without going stale for long
const PER_USER_LIMIT = 50; // pull generously before merging; a user's #7 could be the server's #1 combined

export const data = new SlashCommandBuilder()
  .setName('servertop')
  .setDescription('Aggregate top tracks, albums, or artists across everyone linked in this server')
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('What to rank')
      .setRequired(true)
      .addChoices(
        { name: 'Tracks', value: 'tracks' },
        { name: 'Albums', value: 'albums' },
        { name: 'Artists', value: 'artists' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('period')
      .setDescription('Time range (defaults to Last Month)')
      .addChoices(...PERIOD_CHOICES)
  );

export async function execute(interaction) {
  const type = interaction.options.getString('type', true);
  const period = interaction.options.getString('period') ?? '1month';

  const members = getLinkedUsersInGuild(interaction.guildId);
  if (!members.length) {
    await interaction.reply({
      content: 'Nobody in this server has linked a Last.fm account yet. Be the first with `/link`!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const perUserResults = await Promise.all(
    members.map((m) =>
      cached(`servertop:${type}:${period}:${m.lastfm_username}`, CACHE_TTL_MS, () =>
        fetchTop(type, period, m.lastfm_username)
      ).catch(() => [])
    )
  );

  const merged = new Map(); // key -> { name, subtext, imageUrl, playcount }
  perUserResults.forEach((items) => {
    items.forEach((item) => {
      const key = item.subtext ? `${item.name}—${item.subtext}` : item.name;
      const existing = merged.get(key);
      if (existing) {
        existing.playcount += item.playcount;
      } else {
        merged.set(key, { ...item });
      }
    });
  });

  const ranked = [...merged.values()].sort((a, b) => b.playcount - a.playcount).slice(0, 10);

  if (!ranked.length) {
    await interaction.editReply(`No ${type} data found for this server in that period.`);
    return;
  }

  const title = `Server Top ${capitalize(type)}`;
  const subtitle = `${periodLabel(period)} · ${members.length} linked member${members.length === 1 ? '' : 's'}`;
  const buffer = await renderTopListCard(title, subtitle, ranked);
  const attachment = new AttachmentBuilder(buffer, { name: 'servertop.png' });
  await interaction.editReply({ files: [attachment] });
}

async function fetchTop(type, period, username) {
  if (type === 'tracks') {
    const tracks = await getTopTracks(username, period, PER_USER_LIMIT);
    return tracks.map((t) => ({
      name: t.name,
      subtext: t.artist?.name,
      imageUrl: pickImage(t.image),
      playcount: Number(t.playcount ?? 0),
    }));
  }
  if (type === 'albums') {
    const albums = await getTopAlbums(username, period, PER_USER_LIMIT);
    return albums.map((a) => ({
      name: a.name,
      subtext: a.artist?.name,
      imageUrl: pickImage(a.image),
      playcount: Number(a.playcount ?? 0),
    }));
  }
  const artists = await getTopArtists(username, period, PER_USER_LIMIT);
  return artists.map((a) => ({
    name: a.name,
    subtext: null,
    imageUrl: pickImage(a.image),
    playcount: Number(a.playcount ?? 0),
  }));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
