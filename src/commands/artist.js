import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../db.js';
import { getCurrentTrackContext } from '../lastfm.js';
import { getServerListeners, ensureRequesterIncluded } from '../utils/serverListeners.js';
import { streamingButtonRow } from '../streamingLinks.js';
import { buildRateButtonRow } from '../ratings.js';
import { renderLeaderboardCard } from '../render/leaderboardCard.js';

export const data = new SlashCommandBuilder()
  .setName('artist')
  .setDescription('Compare your stats for an artist with everyone else linked in this server')
  .addStringOption((opt) =>
    opt.setName('name').setDescription("Artist name (defaults to what you're currently/last playing)")
  );

export async function execute(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  const link = getUser(interaction.user.id);
  if (!link) {
    await interaction.reply({ content: "You haven't linked a Last.fm account yet. Run `/link` first.", ephemeral: true });
    return;
  }

  let artist = interaction.options.getString('name');
  let usedNowPlaying = false;

  if (!artist) {
    const current = await getCurrentTrackContext(link.lastfm_username);
    if (!current) {
      await interaction.reply({
        content: "You don't have any scrobbles yet, so I can't tell what you're playing - provide an artist name.",
        ephemeral: true,
      });
      return;
    }
    artist = current.artist;
    usedNowPlaying = true;
  }

  await interaction.deferReply();

  const { entries, subjectName, imageUrl, ratingSummary, spotifyUrl, appleMusicUrl, youtubeUrl } = await getServerListeners({
    guild: interaction.guild,
    type: 'artist',
    artist,
  });

  const withYou = await ensureRequesterIncluded(entries, {
    guild: interaction.guild,
    type: 'artist',
    artist,
    requesterMember: interaction.member,
    requesterUsername: link.lastfm_username,
  });

  const buffer = await renderLeaderboardCard({
    subjectName,
    subjectType: 'artist',
    imageUrl,
    entries: withYou,
    ratingSummary,
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'artist.png' });
  await interaction.editReply({
    content: usedNowPlaying ? `Using what you're currently playing: **${artist}**` : undefined,
    files: [attachment],
    components: [
      streamingButtonRow({ spotifyUrl, appleMusicUrl, youtubeUrl }),
      buildRateButtonRow({ type: 'artist', artist }),
    ],
  });
}
