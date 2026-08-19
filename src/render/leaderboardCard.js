import { createCanvas } from '@napi-rs/canvas';
import { theme, rankColor, rankAccentRgb } from './theme.js';
import { drawAmbientBackground, drawGlassPanel, drawGlassRow } from './glass.js';
import { fontRegular, fontBold } from '../fonts.js';
import { safeLoadImage, drawCoverArt, fitText } from '../utils/images.js';

const WIDTH = 900;
const ROW_HEIGHT = 58;
const ROW_GAP = 8;
const HEADER_HEIGHT = 176;
const PANEL_PADDING = 20;
const OUTER_MARGIN = 30;

/**
 * @param {object} opts
 * @param {string} opts.subjectName - e.g. "Radiohead" or "OK Computer"
 * @param {string} opts.subjectType - "artist" | "album" | "track"
 * @param {string|null} opts.imageUrl - cover art for the subject
 * @param {Array<{displayName: string, avatarUrl?: string, playcount: number}>} opts.entries
 *        Already sorted descending, top 10 max.
 */
export async function renderLeaderboardCard(opts) {
  const rows = opts.entries.slice(0, 10);
  const panelH = Math.max(rows.length, 1) * ROW_HEIGHT + Math.max(rows.length - 1, 0) * ROW_GAP + PANEL_PADDING * 2;
  const height = OUTER_MARGIN + HEADER_HEIGHT + panelH + OUTER_MARGIN;

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  drawAmbientBackground(ctx, WIDTH, height);

  const [art, avatars] = await Promise.all([
    safeLoadImage(opts.imageUrl),
    Promise.all(rows.map((r) => safeLoadImage(r.avatarUrl))),
  ]);

  const artSize = 120;
  const artX = OUTER_MARGIN;
  const artY = OUTER_MARGIN;
  drawCoverArt(ctx, art, artX, artY, artSize, 20);

  const textX = artX + artSize + 28;
  ctx.fillStyle = theme.textDim;
  ctx.font = fontRegular(15);
  ctx.fillText(`Server leaderboard · ${capitalize(opts.subjectType)}`, textX, artY + 30);

  ctx.fillStyle = theme.text;
  ctx.font = fontBold(34);
  ctx.fillText(fitText(ctx, opts.subjectName, WIDTH - textX - OUTER_MARGIN), textX, artY + 72);

  if (rows.length) {
    const total = rows.reduce((sum, r) => sum + r.playcount, 0);
    ctx.fillStyle = theme.accent;
    ctx.font = fontRegular(15);
    ctx.fillText(
      `${total} combined ${opts.unitLabel ?? 'plays'} across ${rows.length} listener${rows.length === 1 ? '' : 's'}`,
      textX,
      artY + 100
    );
  } else {
    ctx.fillStyle = theme.textFaint;
    ctx.font = fontRegular(15);
    ctx.fillText('No linked members have played this yet', textX, artY + 100);
  }

  const panelX = OUTER_MARGIN;
  const panelY = OUTER_MARGIN + HEADER_HEIGHT;
  const panelW = WIDTH - OUTER_MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 24);

  rows.forEach((entry, i) => {
    const rowX = panelX + PANEL_PADDING;
    const rowY = panelY + PANEL_PADDING + i * (ROW_HEIGHT + ROW_GAP);
    const rowW = panelW - PANEL_PADDING * 2;
    const rowCenterY = rowY + ROW_HEIGHT / 2;

    drawGlassRow(ctx, rowX, rowY, rowW, ROW_HEIGHT, 14, rankAccentRgb(i + 1));

    ctx.fillStyle = rankColor(i + 1);
    ctx.font = fontBold(15);
    ctx.textAlign = 'left';
    ctx.fillText(`#${i + 1}`, rowX + 16, rowCenterY + 5);

    const avatarSize = 36;
    const avatarX = rowX + 56;
    const avatarCy = rowY + ROW_HEIGHT / 2;
    if (avatars[i]) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarCy, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatars[i], avatarX, avatarCy - avatarSize / 2, avatarSize, avatarSize);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarCy, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarCy, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();

    const nameX = avatarX + avatarSize + 18;
    ctx.fillStyle = theme.text;
    ctx.font = fontBold(17);
    ctx.fillText(fitText(ctx, entry.displayName, rowX + rowW - nameX - 110), nameX, rowCenterY + 6);

    ctx.textAlign = 'right';
    ctx.fillStyle = theme.accent2;
    ctx.font = fontBold(19);
    ctx.fillText(String(entry.playcount), rowX + rowW - 16, rowCenterY - 1);
    ctx.fillStyle = theme.textFaint;
    ctx.font = fontRegular(11);
    ctx.fillText(opts.unitLabel ?? 'plays', rowX + rowW - 16, rowCenterY + 15);
    ctx.textAlign = 'left';
  });

  return canvas.toBuffer('image/png');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
