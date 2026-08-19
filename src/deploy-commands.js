import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env before deploying commands.');
  process.exit(1);
}

const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

const commandJson = [];
for (const file of commandFiles) {
  const command = await import(pathToFileURL(path.join(commandsDir, file)).href);
  if (command.data) commandJson.push(command.data.toJSON());
}

const rest = new REST().setToken(DISCORD_TOKEN);

try {
  if (DISCORD_GUILD_ID) {
    // Guild commands update instantly - great for local testing.
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
      body: commandJson,
    });
    console.log(`Registered ${commandJson.length} commands to guild ${DISCORD_GUILD_ID}.`);
  } else {
    // Global commands can take up to an hour to propagate to all servers.
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commandJson });
    console.log(`Registered ${commandJson.length} global commands (may take up to an hour to appear).`);
  }
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
