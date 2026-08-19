import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getGuildMedalRows } from '../db.js';
import { medalPoints } from '../medals/catalog.js';
import { renderLeaderboardCard } from '../render/leaderboardCard.js';

export const data = new SlashCommandBuilder()
  .setName('medals-leaderboard')
  .setDescription('Rank linked server members by total medal points');

export async function execute(interaction) {
  const rows = getGuildMedalRows(interaction.guildId);
  if (!rows.length) {
    await interaction.reply({
      content: 'No medals have been earned in this server yet.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const pointsByUser = new Map();
  for (const row of rows) {
    const points = medalPoints(row.medal_key, row.tier);
    pointsByUser.set(row.discord_id, (pointsByUser.get(row.discord_id) ?? 0) + points);
  }

  const ranked = [...pointsByUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const entries = [];
  for (const [discordId, points] of ranked) {
    let member;
    try {
      member = await interaction.guild.members.fetch(discordId);
    } catch {
      continue; // user left the server
    }
    entries.push({
      displayName: member.displayName,
      avatarUrl: member.displayAvatarURL({ extension: 'png', size: 64 }),
      playcount: points,
    });
  }

  const buffer = await renderLeaderboardCard({
    subjectName: 'Medal points',
    subjectType: 'server',
    imageUrl: null,
    entries,
    unitLabel: 'points',
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'medals-leaderboard.png' });
  await interaction.editReply({ files: [attachment] });
}
