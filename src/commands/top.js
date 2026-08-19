import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../db.js';
import { getTopTracks, getTopAlbums, getTopArtists, pickImage } from '../lastfm.js';
import { PERIOD_CHOICES, periodLabel } from '../utils/period.js';
import { renderTopListCard } from '../render/topListCard.js';

export const data = new SlashCommandBuilder()
  .setName('top')
  .setDescription('Show top tracks, albums, or artists for a listener')
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
  )
  .addUserOption((opt) => opt.setName('user').setDescription('Whose stats to show (defaults to you)'));

export async function execute(interaction) {
  const type = interaction.options.getString('type', true);
  const period = interaction.options.getString('period') ?? '1month';
  const targetDiscordUser = interaction.options.getUser('user') ?? interaction.user;

  const link = getUser(targetDiscordUser.id);
  if (!link) {
    await interaction.reply({
      content:
        targetDiscordUser.id === interaction.user.id
          ? "You haven't linked a Last.fm account yet. Run `/link` first."
          : `${targetDiscordUser.username} hasn't linked a Last.fm account yet.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  let items = [];
  if (type === 'tracks') {
    const tracks = await getTopTracks(link.lastfm_username, period, 10);
    items = tracks.map((t) => ({
      name: t.name,
      subtext: t.artist?.name,
      imageUrl: pickImage(t.image),
      playcount: Number(t.playcount ?? 0),
    }));
  } else if (type === 'albums') {
    const albums = await getTopAlbums(link.lastfm_username, period, 10);
    items = albums.map((a) => ({
      name: a.name,
      subtext: a.artist?.name,
      imageUrl: pickImage(a.image),
      playcount: Number(a.playcount ?? 0),
    }));
  } else {
    const artists = await getTopArtists(link.lastfm_username, period, 10);
    items = artists.map((a) => ({
      name: a.name,
      subtext: null,
      imageUrl: pickImage(a.image),
      playcount: Number(a.playcount ?? 0),
    }));
  }

  if (!items.length) {
    await interaction.editReply(`No ${type} found for **${link.lastfm_username}** in that period.`);
    return;
  }

  const title = `${targetDiscordUser.username}'s Top ${capitalize(type)}`;
  const buffer = await renderTopListCard(title, periodLabel(period), items);
  const attachment = new AttachmentBuilder(buffer, { name: 'top.png' });
  await interaction.editReply({ files: [attachment] });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
