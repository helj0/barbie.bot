import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../db.js';
import { getRecentTracks, getTrackUserPlaycount, pickImage } from '../lastfm.js';
import { getStreamingLinks, streamingButtonRow } from '../streamingLinks.js';
import { getServerListeners } from '../utils/serverListeners.js';
import { getSummary, buildRateButtonRow } from '../ratings.js';
import { renderNowPlayingCard } from '../render/nowPlayingCard.js';

const OTHER_LISTENERS_LIMIT = 5;

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

  // Always look up the streaming links (Last.fm never gives us these),
  // reusing their image only if Last.fm didn't already have one.
  const streamingLinks = await getStreamingLinks({ type: 'track', artist: artistName, album: albumName, track: trackName });
  const imageUrl = pickImage(recent.image) ?? streamingLinks.imageUrl;

  let userPlaycount = null;
  try {
    const info = await getTrackUserPlaycount(artistName, trackName, link.lastfm_username);
    userPlaycount = info.userPlaycount;
  } catch {
    // Non-fatal - card just omits the playcount footer.
  }

  let otherListeners;
  let ratingSummary = { average: null, count: 0 };
  if (interaction.guild) {
    try {
      const { entries } = await getServerListeners({
        guild: interaction.guild,
        type: 'track',
        artist: artistName,
        track: trackName,
        excludeDiscordId: targetDiscordUser.id,
        limit: OTHER_LISTENERS_LIMIT,
        skipLinks: true,
      });
      otherListeners = entries;
    } catch {
      // Non-fatal - card just omits the other-listeners section.
    }
    ratingSummary = getSummary(interaction.guildId, 'track', artistName, undefined, trackName);
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
    otherListeners,
    ratingSummary,
  });

  const attachment = new AttachmentBuilder(buffer, { name: 'nowplaying.png' });
  const components = [streamingButtonRow(streamingLinks)];
  if (interaction.guild) {
    components.push(buildRateButtonRow({ type: 'track', artist: artistName, track: trackName }));
  }
  await interaction.editReply({ files: [attachment], components });
}
