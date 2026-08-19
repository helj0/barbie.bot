import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas } from '@napi-rs/canvas';
import { getUser, cached } from '../db.js';
import { getTopArtists, getArtistTopTags } from '../lastfm.js';
import { PERIOD_CHOICES, periodLabel } from '../utils/period.js';
import { theme } from '../render/theme.js';
import { drawAmbientBackground, drawGlassPanel } from '../render/glass.js';
import { fitText, roundedRectPath } from '../utils/images.js';
import { fontRegular, fontBold } from '../fonts.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // artist tags barely change - cache for a day

export const data = new SlashCommandBuilder()
  .setName('genres')
  .setDescription('Show a listener\u2019s top genres, derived from their most-played artists\u2019 tags')
  .addStringOption((opt) =>
    opt
      .setName('period')
      .setDescription('Time range (defaults to Last Month)')
      .addChoices(...PERIOD_CHOICES)
  )
  .addUserOption((opt) => opt.setName('user').setDescription('Whose genres to show (defaults to you)'));

export async function execute(interaction) {
  const period = interaction.options.getString('period') ?? '1month';
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

  // Weight each artist's tags by that artist's playcount, so heavily-played
  // artists influence the genre mix more than one-off listens.
  const topArtists = await getTopArtists(link.lastfm_username, period, 20);
  if (!topArtists.length) {
    await interaction.editReply(`No listening data found for **${link.lastfm_username}** in that period.`);
    return;
  }

  const tagScores = new Map();
  await Promise.all(
    topArtists.map(async (artist) => {
      const weight = Number(artist.playcount ?? 1);
      try {
        const tags = await cached(`tags:${artist.name}`, CACHE_TTL_MS, () => getArtistTopTags(artist.name));
        // Last.fm returns tags pre-ranked; weight the top few more than the tail.
        tags.slice(0, 5).forEach((tag, idx) => {
          const tagWeight = weight * (5 - idx);
          tagScores.set(tag.name, (tagScores.get(tag.name) ?? 0) + tagWeight);
        });
      } catch {
        // skip artists whose tag lookup fails
      }
    })
  );

  const ranked = [...tagScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!ranked.length) {
    await interaction.editReply(`Couldn't derive genre tags for **${link.lastfm_username}**'s top artists.`);
    return;
  }

  const buffer = renderGenreBarChart(`${targetDiscordUser.username}'s Top Genres`, periodLabel(period), ranked);
  const attachment = new AttachmentBuilder(buffer, { name: 'genres.png' });
  await interaction.editReply({ files: [attachment] });
}

function renderGenreBarChart(title, subtitle, ranked) {
  const WIDTH = 800;
  const ROW_HEIGHT = 50;
  const ROW_GAP = 4;
  const HEADER_HEIGHT = 92;
  const PANEL_PADDING = 22;
  const OUTER_MARGIN = 30;
  const panelH = ranked.length * ROW_HEIGHT + (ranked.length - 1) * ROW_GAP + PANEL_PADDING * 2;
  const height = HEADER_HEIGHT + panelH + OUTER_MARGIN;

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  drawAmbientBackground(ctx, WIDTH, height);

  ctx.fillStyle = theme.text;
  ctx.font = fontBold(30);
  ctx.fillText(fitText(ctx, title, WIDTH - OUTER_MARGIN * 2), OUTER_MARGIN, 46);
  ctx.fillStyle = theme.accent;
  ctx.font = fontRegular(15);
  ctx.fillText(subtitle, OUTER_MARGIN, 70);

  const panelX = OUTER_MARGIN;
  const panelY = HEADER_HEIGHT;
  const panelW = WIDTH - OUTER_MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 22);

  const maxScore = ranked[0][1];
  const labelWidth = 170;
  const barAreaX = panelX + PANEL_PADDING + labelWidth + 20;
  const barAreaWidth = panelX + panelW - PANEL_PADDING - barAreaX - 20;

  ranked.forEach(([name, score], i) => {
    const rowY = panelY + PANEL_PADDING + i * (ROW_HEIGHT + ROW_GAP);
    const barHeight = 24;
    const barY = rowY + (ROW_HEIGHT - barHeight) / 2;
    const barWidth = Math.max(8, (score / maxScore) * barAreaWidth);

    ctx.fillStyle = theme.text;
    ctx.font = fontBold(17);
    ctx.textAlign = 'right';
    ctx.fillText(fitText(ctx, capitalize(name), labelWidth), barAreaX - 20, barY + barHeight * 0.72);
    ctx.textAlign = 'left';

    // Track (empty bar), so the filled portion reads as a glass gauge.
    roundedRectPath(ctx, barAreaX, barY, barAreaWidth, barHeight, barHeight / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();

    const accentHex = i === 0 ? theme.rankGold : theme.accent2;
    ctx.save();
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(barAreaX, 0, barAreaX + barWidth, 0);
    grad.addColorStop(0, i === 0 ? theme.rankGold : theme.accent);
    grad.addColorStop(1, theme.accent2);
    ctx.fillStyle = grad;
    roundedRectPath(ctx, barAreaX, barY, barWidth, barHeight, barHeight / 2);
    ctx.fill();
    ctx.restore();

    // Glass glaze on top half of the bar
    const glaze = ctx.createLinearGradient(barAreaX, barY, barAreaX, barY + barHeight * 0.5);
    glaze.addColorStop(0, 'rgba(255,255,255,0.35)');
    glaze.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    roundedRectPath(ctx, barAreaX, barY, barWidth, barHeight, barHeight / 2);
    ctx.clip();
    ctx.fillStyle = glaze;
    ctx.fillRect(barAreaX, barY, barWidth, barHeight * 0.5);
    ctx.restore();
  });

  return canvas.toBuffer('image/png');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
