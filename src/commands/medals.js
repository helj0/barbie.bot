import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser, getUserMedals } from '../db.js';
import { medalPoints } from '../medals/catalog.js';
import { renderBadgeCase } from '../render/medalCard.js';

export const data = new SlashCommandBuilder()
  .setName('medals')
  .setDescription("Show a listener's earned medals")
  .addUserOption((opt) => opt.setName('user').setDescription('Whose medals to show (defaults to you)'));

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

  const earnedMedals = getUserMedals(targetDiscordUser.id, interaction.guildId);
  const totalPoints = earnedMedals.reduce((sum, m) => sum + medalPoints(m.medal_key, m.tier), 0);

  const buffer = await renderBadgeCase({
    displayName: targetDiscordUser.username,
    earnedMedals,
    totalPoints,
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'medals.png' });
  await interaction.editReply({ files: [attachment] });
}
