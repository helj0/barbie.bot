import 'dotenv/config';
import './fonts.js'; // registers the bundled Outfit font before anything renders a canvas
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { startMedalScheduler } from './medals/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  // Guilds is enough for slash commands + guild.members.fetch(id) lookups
  // (a single-member fetch doesn't require the privileged GuildMembers
  // intent - that's only needed for bulk member caching, which this bot
  // never does). Keeping intents minimal avoids the Discord Developer
  // Portal "Privileged Gateway Intents" toggle entirely.
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = await import(pathToFileURL(path.join(commandsDir, file)).href);
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[commands] ${file} is missing "data" or "execute" - skipping.`);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}. ${client.commands.size} commands loaded.`);
  startMedalScheduler(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`Received unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const payload = { content: 'Something went wrong running that command.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exitCode = 1;
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exitCode = 1;
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

console.log('Booting scrobble-bot, logging in to Discord...');

try {
  await client.login(process.env.DISCORD_TOKEN);
} catch (err) {
  console.error('Failed to log in to Discord:', err);
  process.exit(1);
}
