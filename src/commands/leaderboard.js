import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getLinkedUsersInGuild } from '../db.js';
import { getServerListeners } from '../utils/serverListeners.js';
import { renderLeaderboardCard } from '../render/leaderboardCard.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Rank linked server members by how many times they\u2019ve played something')
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('What kind of thing to compare')
      .setRequired(true)
      .addChoices(
        { name: 'Artist', value: 'artist' },
        { name: 'Album', value: 'album' },
        { name: 'Track', value: 'track' }
      )
  )
  .addStringOption((opt) => opt.setName('artist').setDescription('Artist name').setRequired(true))
  .addStringOption((opt) => opt.setName('album').setDescription('Album name (required for type: Album)'))
  .addStringOption((opt) => opt.setName('track').setDescription('Track name (required for type: Track)'));

export async function execute(interaction) {
  const type = interaction.options.getString('type', true);
  const artist = interaction.options.getString('artist', true);
  const album = interaction.options.getString('album') ?? undefined;
  const track = interaction.options.getString('track') ?? undefined;

  if (type === 'album' && !album) {
    await interaction.reply({ content: 'Please provide an `album` name for an album leaderboard.', ephemeral: true });
    return;
  }
  if (type === 'track' && !track) {
    await interaction.reply({ content: 'Please provide a `track` name for a track leaderboard.', ephemeral: true });
    return;
  }

  const members = getLinkedUsersInGuild(interaction.guildId);
  if (!members.length) {
    await interaction.reply({
      content: 'Nobody in this server has linked a Last.fm account yet. Be the first with `/link`!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const { entries, subjectName, imageUrl } = await getServerListeners({
    guild: interaction.guild,
    type,
    artist,
    album,
    track,
  });

  const buffer = await renderLeaderboardCard({
    subjectName,
    subjectType: type,
    imageUrl,
    entries,
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
  await interaction.editReply({ files: [attachment] });
}
