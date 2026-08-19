console.log('[boot][scheduler] loading discord.js...');
const { AttachmentBuilder } = await import('discord.js');
console.log('[boot][scheduler] discord.js OK');

console.log('[boot][scheduler] loading db.js...');
const {
  getAllGuildIds,
  getLinkedUsersInGuild,
  getGuildSettings,
  awardMedal,
  guildHasMedal,
  ensureMonthlySnapshot,
  getMonthlySnapshot,
  getMonthlyChampion,
  upsertMonthlyChampion,
} = await import('../db.js');
console.log('[boot][scheduler] db.js OK');

console.log('[boot][scheduler] loading evaluate.js...');
const { evaluatePersonalMedals } = await import('./evaluate.js');
console.log('[boot][scheduler] evaluate.js OK');

console.log('[boot][scheduler] loading catalog.js...');
const { MEDALS } = await import('./catalog.js');
console.log('[boot][scheduler] catalog.js OK');

console.log('[boot][scheduler] loading medalCard.js...');
const { renderMedalAnnouncement } = await import('../render/medalCard.js');
console.log('[boot][scheduler] medalCard.js OK');

const DEFAULT_INTERVAL_MS = 20 * 60 * 1000; // 20 min - matches evaluator's own cache TTL

export function startMedalScheduler(client, intervalMs = DEFAULT_INTERVAL_MS) {
  const run = () => runMedalCycle(client).catch((err) => console.error('[medals] cycle failed:', err));
  // Run once shortly after startup, then on the configured interval.
  setTimeout(run, 15_000);
  setInterval(run, intervalMs);
}

async function runMedalCycle(client) {
  const guildIds = getAllGuildIds();
  for (const guildId of guildIds) {
    await evaluateGuild(client, guildId).catch((err) =>
      console.error(`[medals] guild ${guildId} evaluation failed:`, err)
    );
  }
}

async function evaluateGuild(client, guildId) {
  const members = getLinkedUsersInGuild(guildId);
  if (!members.length) return;

  const yearMonth = currentYearMonth();
  const newlyEarned = []; // { discordId, medalKey, tier, context }
  let monthLeader = null; // { discordId, plays }

  for (const member of members) {
    let evaluation;
    try {
      evaluation = await evaluatePersonalMedals(member.lastfm_username);
    } catch (err) {
      console.error(`[medals] evaluating ${member.lastfm_username} failed:`, err);
      continue;
    }

    for (const { key, tier, context } of evaluation.results) {
      const def = MEDALS[key];
      if (def.serverFirst) {
        // Only the first person in the guild to cross the line gets it.
        if (guildHasMedal(guildId, key, tier)) continue;
      }
      const isNew = awardMedal(member.discord_id, guildId, key, tier, context);
      if (isNew) newlyEarned.push({ discordId: member.discord_id, medalKey: key, tier, context });
    }

    // Monthly Champion bookkeeping: baseline this user's plays-this-month
    // against a snapshot taken at the start of the month, then track the
    // current leader.
    ensureMonthlySnapshot(guildId, member.discord_id, yearMonth, evaluation.lifetimePlays);
    const snapshot = getMonthlySnapshot(guildId, member.discord_id, yearMonth);
    const playsThisMonth = Math.max(0, evaluation.lifetimePlays - snapshot.start_playcount);
    if (!monthLeader || playsThisMonth > monthLeader.plays) {
      monthLeader = { discordId: member.discord_id, plays: playsThisMonth };
    }
  }

  await handleMonthlyChampion(client, guildId, yearMonth, monthLeader);

  if (newlyEarned.length) {
    await announceMedals(client, guildId, newlyEarned);
  }
}

async function handleMonthlyChampion(client, guildId, yearMonth, monthLeader) {
  if (!monthLeader) return;
  const existing = getMonthlyChampion(guildId);

  if (existing && existing.year_month !== yearMonth) {
    // Month rolled over since we last checked - finalize the previous
    // month's leader as a permanent medal.
    const isNew = awardMedal(existing.discord_id, guildId, 'monthlychampion', 'gold', {
      month: existing.year_month,
      plays: existing.playcount,
    });
    if (isNew) {
      await announceMedals(client, guildId, [
        {
          discordId: existing.discord_id,
          medalKey: 'monthlychampion',
          tier: 'gold',
          context: { month: existing.year_month, plays: existing.playcount },
        },
      ]);
    }
  }

  upsertMonthlyChampion(guildId, yearMonth, monthLeader.discordId, monthLeader.plays);
}

async function announceMedals(client, guildId, newlyEarned) {
  const settings = getGuildSettings(guildId);
  if (!settings?.announce_channel_id) return; // no channel configured - medals still saved, just not posted

  let channel;
  try {
    channel = await client.channels.fetch(settings.announce_channel_id);
  } catch {
    return; // channel deleted or bot no longer has access
  }
  if (!channel?.isTextBased()) return;

  for (const earned of newlyEarned) {
    let discordUser;
    try {
      discordUser = await client.users.fetch(earned.discordId);
    } catch {
      continue;
    }

    const buffer = await renderMedalAnnouncement({
      displayName: discordUser.username,
      avatarUrl: discordUser.displayAvatarURL({ extension: 'png', size: 128 }),
      medalKey: earned.medalKey,
      tier: earned.tier,
      context: earned.context,
    });
    const attachment = new AttachmentBuilder(buffer, { name: 'medal.png' });
    await channel.send({ files: [attachment] }).catch((err) => console.error('[medals] announce send failed:', err));
  }
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
