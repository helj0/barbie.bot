import { SlashCommandBuilder } from 'discord.js';
import { getUserInfo, LastfmError } from '../lastfm.js';
import { linkUser } from '../db.js';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Connect your Last.fm account to this server')
  .addStringOption((opt) =>
    opt.setName('username').setDescription('Your Last.fm username').setRequired(true)
  );

export async function execute(interaction) {
  const username = interaction.options.getString('username', true).trim();
  await interaction.deferReply({ ephemeral: true });

  try {
    const info = await getUserInfo(username);
    linkUser(interaction.user.id, interaction.guildId, info.name);

    const totalScrobbles = Number(info.playcount ?? 0).toLocaleString();
    await interaction.editReply(
      `Linked to Last.fm user **${info.name}** (${totalScrobbles} total scrobbles). ` +
        `You can now use \`/nowplaying\`, \`/top\`, \`/genres\`, and show up in \`/servertop\` and \`/leaderboard\`.`
    );
  } catch (err) {
    if (err instanceof LastfmError && err.code === 6) {
      await interaction.editReply(`Couldn't find a Last.fm user called **${username}**. Double-check the spelling.`);
      return;
    }
    console.error('[/link] failed:', err);
    await interaction.editReply('Something went wrong reaching Last.fm. Try again in a moment.');
  }
}
