import { SlashCommandBuilder } from 'discord.js';
import { rate } from '../ratings.js';

export const data = new SlashCommandBuilder()
  .setName('rate')
  .setDescription('Rate an artist, album, or track from 0-5 stars')
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('What kind of thing to rate')
      .setRequired(true)
      .addChoices(
        { name: 'Artist', value: 'artist' },
        { name: 'Album', value: 'album' },
        { name: 'Track', value: 'track' }
      )
  )
  .addIntegerOption((opt) =>
    opt.setName('rating').setDescription('0 (worst) to 5 (best)').setRequired(true).setMinValue(0).setMaxValue(5)
  )
  .addStringOption((opt) => opt.setName('artist').setDescription('Artist name').setRequired(true))
  .addStringOption((opt) => opt.setName('album').setDescription('Album name (required for type: Album)'))
  .addStringOption((opt) => opt.setName('track').setDescription('Track name (required for type: Track)'));

export async function execute(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  const type = interaction.options.getString('type', true);
  const rating = interaction.options.getInteger('rating', true);
  const artist = interaction.options.getString('artist', true);
  const album = interaction.options.getString('album') ?? undefined;
  const track = interaction.options.getString('track') ?? undefined;

  if (type === 'album' && !album) {
    await interaction.reply({ content: 'Please provide an `album` name for an album rating.', ephemeral: true });
    return;
  }
  if (type === 'track' && !track) {
    await interaction.reply({ content: 'Please provide a `track` name for a track rating.', ephemeral: true });
    return;
  }

  const summary = rate(interaction.guildId, interaction.user.id, type, artist, album, track, rating);

  const label = type === 'artist' ? artist : type === 'album' ? `${album} by ${artist}` : `${track} by ${artist}`;
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const avgText = `Server average: ${summary.average.toFixed(1)}★ from ${summary.count} rating${summary.count === 1 ? '' : 's'}.`;

  await interaction.reply({ content: `You rated **${label}** ${stars} (${rating}/5).\n${avgText}`, ephemeral: true });
}
