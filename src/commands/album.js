import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../db.js';
import { getCurrentTrackContext } from '../lastfm.js';
import { getServerListeners, ensureRequesterIncluded } from '../utils/serverListeners.js';
import { renderLeaderboardCard } from '../render/leaderboardCard.js';

export const data = new SlashCommandBuilder()
  .setName('album')
  .setDescription('Compare your stats for an album with everyone else linked in this server')
  .addStringOption((opt) =>
    opt.setName('album').setDescription("Album name (defaults to what you're currently/last playing)")
  )
  .addStringOption((opt) => opt.setName('artist').setDescription('Artist name (required if album is given)'));

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

  let album = interaction.options.getString('album');
  let artist = interaction.options.getString('artist');
  let usedNowPlaying = false;

  if (album && !artist) {
    await interaction.reply({ content: 'Please also provide the `artist` for that album.', ephemeral: true });
    return;
  }

  if (!album) {
    const current = await getCurrentTrackContext(link.lastfm_username);
    if (!current) {
      await interaction.reply({
        content: "You don't have any scrobbles yet, so I can't tell what you're playing - provide an album and artist.",
        ephemeral: true,
      });
      return;
    }
    if (!current.album) {
      await interaction.reply({
        content: `Your current track (**${current.track}**) doesn't have album info attached - provide an album and artist instead.`,
        ephemeral: true,
      });
      return;
    }
    album = current.album;
    artist = current.artist;
    usedNowPlaying = true;
  }

  await interaction.deferReply();

  const { entries, subjectName, imageUrl } = await getServerListeners({
    guild: interaction.guild,
    type: 'album',
    artist,
    album,
  });

  const withYou = await ensureRequesterIncluded(entries, {
    guild: interaction.guild,
    type: 'album',
    artist,
    album,
    requesterMember: interaction.member,
    requesterUsername: link.lastfm_username,
  });

  const buffer = await renderLeaderboardCard({
    subjectName,
    subjectType: 'album',
    imageUrl,
    entries: withYou,
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'album.png' });
  await interaction.editReply({
    content: usedNowPlaying ? `Using what you're currently playing: **${album}** by **${artist}**` : undefined,
    files: [attachment],
  });
}
