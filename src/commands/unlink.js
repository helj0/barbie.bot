import { SlashCommandBuilder } from 'discord.js';
import { unlinkUser } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('Disconnect your Last.fm account from this bot');

export async function execute(interaction) {
  const removed = unlinkUser(interaction.user.id);
  await interaction.reply({
    content: removed
      ? 'Unlinked your Last.fm account. Run `/link` any time to reconnect.'
      : "You don't have a Last.fm account linked.",
    ephemeral: true,
  });
}
