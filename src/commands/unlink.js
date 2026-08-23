import { SlashCommandBuilder } from 'discord.js';
import { unlinkUser, purgeUserData } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('Disconnect your Last.fm account and erase your medals/ratings from this bot');

export async function execute(interaction) {
  const removed = unlinkUser(interaction.user.id);
  const { medalsDeleted, ratingsDeleted } = purgeUserData(interaction.user.id);

  if (!removed) {
    await interaction.reply({ content: "You don't have a Last.fm account linked.", ephemeral: true });
    return;
  }

  const cleared = [];
  if (medalsDeleted) cleared.push(`${medalsDeleted} medal${medalsDeleted === 1 ? '' : 's'}`);
  if (ratingsDeleted) cleared.push(`${ratingsDeleted} rating${ratingsDeleted === 1 ? '' : 's'}`);
  const extra = cleared.length ? ` Also cleared ${cleared.join(' and ')}.` : '';

  await interaction.reply({
    content: `Unlinked your Last.fm account.${extra} Run \`/link\` any time to reconnect.`,
    ephemeral: true,
  });
}
