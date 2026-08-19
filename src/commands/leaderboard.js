import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getLinkedUsersInGuild, cached } from '../db.js';
import { getArtistUserPlaycount, getAlbumUserPlaycount, getTrackUserPlaycount } from '../lastfm.js';
import { findCoverArt } from '../spotifyArt.js';
import { renderLeaderboardCard } from '../render/leaderboardCard.js';

const CACHE_TTL_MS = 3 * 60 * 1000;

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

  const subjectKey = type === 'artist' ? artist : type === 'album' ? `${artist}—${album}` : `${artist}—${track}`;

  const perUser = await Promise.all(
    members.map(async (m) => {
      try {
        const info = await cached(`leaderboard:${type}:${subjectKey}:${m.lastfm_username}`, CACHE_TTL_MS, () =>
          fetchPlaycount(type, artist, album, track, m.lastfm_username)
        );
        return { discordId: m.discord_id, ...info };
      } catch {
        return null;
      }
    })
  );

  const withPlays = perUser.filter((r) => r && r.userPlaycount > 0).sort((a, b) => b.userPlaycount - a.userPlaycount);

  // Resolve Discord display names/avatars for the top entries only.
  const entries = [];
  for (const row of withPlays.slice(0, 10)) {
    let member;
    try {
      member = await interaction.guild.members.fetch(row.discordId);
    } catch {
      continue; // user left the server
    }
    entries.push({
      displayName: member.displayName,
      avatarUrl: member.displayAvatarURL({ extension: 'png', size: 64 }),
      playcount: row.userPlaycount,
    });
  }

  const subjectName = type === 'artist' ? artist : type === 'album' ? `${album}` : `${track}`;
  let imageUrl = withPlays[0]?.image ?? null;
  if (!imageUrl) {
    imageUrl = await findCoverArt({ artist, album, track });
  }

  const buffer = await renderLeaderboardCard({
    subjectName,
    subjectType: type,
    imageUrl,
    entries,
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
  await interaction.editReply({ files: [attachment] });
}

async function fetchPlaycount(type, artist, album, track, username) {
  if (type === 'artist') return getArtistUserPlaycount(artist, username);
  if (type === 'album') return getAlbumUserPlaycount(artist, album, username);
  return getTrackUserPlaycount(artist, track, username);
}
