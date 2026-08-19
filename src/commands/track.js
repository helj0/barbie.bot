import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../db.js';
import { getCurrentTrackContext } from '../lastfm.js';
import { getServerListeners, ensureRequesterIncluded } from '../utils/serverListeners.js';
import { renderLeaderboardCard } from '../render/leaderboardCard.js';

export const data = new SlashCommandBuilder()
  .setName('track')
  .setDescription('Compare your stats for a track with everyone else linked in this server')
  .addStringOption((opt) =>
    opt.setName('track').setDescription("Track name (defaults to what you're currently/last playing)")
  )
  .addStringOption((opt) => opt.setName('artist').setDescription('Artist name (required if track is given)'));

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

  let track = interaction.options.getString('track');
  let artist = interaction.options.getString('artist');
  let usedNowPlaying = false;

  if (track && !artist) {
    await interaction.reply({ content: 'Please also provide the `artist` for that track.', ephemeral: true });
    return;
  }

  if (!track) {
    const current = await getCurrentTrackContext(link.lastfm_username);
    if (!current) {
      await interaction.reply({
        content: "You don't have any scrobbles yet, so I can't tell what you're playing - provide a track and artist.",
        ephemeral: true,
      });
      return;
    }
    track = current.track;
    artist = current.artist;
    usedNowPlaying = true;
  }

  await interaction.deferReply();

  const { entries, subjectName, imageUrl } = await getServerListeners({
    guild: interaction.guild,
    type: 'track',
    artist,
    track,
  });

  const withYou = await ensureRequesterIncluded(entries, {
    guild: interaction.guild,
    type: 'track',
    artist,
    track,
    requesterMember: interaction.member,
    requesterUsername: link.lastfm_username,
  });

  const buffer = await renderLeaderboardCard({
    subjectName,
    subjectType: 'track',
    imageUrl,
    entries: withYou,
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'track.png' });
  await interaction.editReply({
    content: usedNowPlaying ? `Using what you're currently playing: **${track}** by **${artist}**` : undefined,
    files: [attachment],
  });
}
