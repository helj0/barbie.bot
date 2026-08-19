import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../db.js';
import { getRecentTracks, getTrackUserPlaycount, pickImage } from '../lastfm.js';
import { findCoverArt } from '../spotifyArt.js';
import { renderNowPlayingCard } from '../render/nowPlayingCard.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription("Show what you (or someone else) are currently/last listening to")
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Whose Now Playing to show (defaults to you)')
  );

export async function execute(interaction) {
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

  const [recent] = await getRecentTracks(link.lastfm_username, 1);
  if (!recent) {
    await interaction.editReply(`No scrobbles found yet for **${link.lastfm_username}**.`);
    return;
  }

  const isNowPlaying = recent['@attr']?.nowplaying === 'true';
  const trackName = recent.name;
  const artistName = recent.artist?.['#text'] ?? recent.artist?.name ?? 'Unknown Artist';
  const albumName = recent.album?.['#text'] ?? '';

  let imageUrl = pickImage(recent.image);
  if (!imageUrl) {
    imageUrl = await findCoverArt({ artist: artistName, album: albumName, track: trackName });
  }

  let userPlaycount = null;
  try {
    const info = await getTrackUserPlaycount(artistName, trackName, link.lastfm_username);
    userPlaycount = info.userPlaycount;
  } catch {
    // Non-fatal - card just omits the playcount footer.
  }

  const buffer = await renderNowPlayingCard({
    displayName: targetDiscordUser.username,
    avatarUrl: targetDiscordUser.displayAvatarURL({ extension: 'png', size: 128 }),
    trackName,
    artistName,
    albumName,
    imageUrl,
    isNowPlaying,
    userPlaycount,
  });

  const attachment = new AttachmentBuilder(buffer, { name: 'nowplaying.png' });
  await interaction.editReply({ files: [attachment] });
}
