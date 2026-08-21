import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exitCode = 1;
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exitCode = 1;
});

console.log('[boot] starting up, node', process.version);

console.log('[boot] loading fonts...');
try {
  await import('./fonts.js'); // registers the bundled Outfit font before anything renders a canvas
  console.log('[boot] fonts loaded OK');
} catch (err) {
  console.error('[boot] FAILED loading fonts.js:', err);
  process.exit(1);
}

console.log('[boot] loading discord.js...');
const { Client, Collection, GatewayIntentBits, Events } = await import('discord.js');
console.log('[boot] discord.js loaded OK');

console.log('[boot] loading medal scheduler...');
const { startMedalScheduler } = await import('./medals/scheduler.js');
console.log('[boot] medal scheduler module loaded OK');

console.log('[boot] loading ratings...');
const { handleRateButton, handleRateSelect } = await import('./ratings.js');
console.log('[boot] ratings module loaded OK');

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

console.log(`[boot] loading ${commandFiles.length} command files...`);
for (const file of commandFiles) {
  try {
    const command = await import(pathToFileURL(path.join(commandsDir, file)).href);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[commands] ${file} is missing "data" or "execute" - skipping.`);
    }
  } catch (err) {
    console.error(`[boot] FAILED loading command file ${file}:`, err);
    process.exit(1);
  }
}
console.log(`[boot] ${client.commands.size} commands loaded OK`);

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}. ${client.commands.size} commands loaded.`);
  startMedalScheduler(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
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
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('rate:')) {
    try {
      await handleRateButton(interaction);
    } catch (err) {
      console.error('Error handling rate button:', err);
      await interaction.reply({ content: 'Something went wrong opening the rating picker.', ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rateselect:')) {
    try {
      await handleRateSelect(interaction);
    } catch (err) {
      console.error('Error handling rate select:', err);
      await interaction.reply({ content: 'Something went wrong recording that rating.', ephemeral: true }).catch(() => {});
    }
    return;
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

console.log('[boot] logging in to Discord...');

try {
  await client.login(process.env.DISCORD_TOKEN);
} catch (err) {
  console.error('[boot] FAILED to log in to Discord:', err);
  process.exit(1);
}
