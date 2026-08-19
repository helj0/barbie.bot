import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { setAnnounceChannel } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('medals-config')
  .setDescription('Set the channel where new medal unlocks get announced')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('Text channel to post medal announcements in')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  setAnnounceChannel(interaction.guildId, channel.id);
  await interaction.reply({
    content: `Medal unlocks will now be announced in <#${channel.id}>.`,
    ephemeral: true,
  });
}
