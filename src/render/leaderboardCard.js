import { createCanvas } from '@napi-rs/canvas';
import { theme, rankColor, rankAccentRgb } from './theme.js';
import { drawAmbientBackground, drawGlassPanel, drawGlassRow } from './glass.js';
import { drawStarRating } from './stars.js';
import { fontRegular, fontBold } from '../fonts.js';
import { safeLoadImage, drawCoverArt, fitText } from '../utils/images.js';

const WIDTH = 900;
const ROW_HEIGHT = 58;
const ROW_GAP = 8;
const HEADER_HEIGHT = 176;
const PANEL_PADDING = 20;
const OUTER_MARGIN = 30;
const COLUMN_GAP = 20;

/**
 * @param {object} opts
 * @param {string} opts.subjectName - e.g. "Radiohead" or "OK Computer"
 * @param {string} opts.subjectType - "artist" | "album" | "track"
 * @param {string|null} opts.imageUrl - cover art for the subject
 * @param {Array<{displayName: string, avatarUrl?: string, playcount: number, isYou?: boolean}>} opts.entries
 *        Already sorted descending, top 10 max. An entry with isYou highlights
 *        that row and labels it "(you)", regardless of its rank.
 * @param {{average: number|null, count: number}} [opts.ratingSummary] - server rating, if any
 */
export async function renderLeaderboardCard(opts) {
  const rows = opts.entries.slice(0, 10);
  // Ranked down the left column first, then continuing down the right -
  // not interleaved - so reading order still matches rank order.
  const splitAt = Math.ceil(rows.length / 2);
  const columns = [
    { entries: rows.slice(0, splitAt), rankOffset: 0 },
    { entries: rows.slice(splitAt), rankOffset: splitAt },
  ];
  const rowCount = Math.max(columns[0].entries.length, 1);
  const panelH = rowCount * ROW_HEIGHT + Math.max(rowCount - 1, 0) * ROW_GAP + PANEL_PADDING * 2;
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

  const ratingSummary = opts.ratingSummary ?? { average: null, count: 0 };
  drawStarRating(ctx, textX, artY + 128, ratingSummary);

  const panelX = OUTER_MARGIN;
  const panelY = OUTER_MARGIN + HEADER_HEIGHT;
  const panelW = WIDTH - OUTER_MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 24);

  const colWidth = (panelW - PANEL_PADDING * 2 - COLUMN_GAP) / 2;

  columns.forEach((column, colIndex) => {
    const rowX = panelX + PANEL_PADDING + colIndex * (colWidth + COLUMN_GAP);

    column.entries.forEach((entry, i) => {
      const rank = column.rankOffset + i + 1;
      const rowY = panelY + PANEL_PADDING + i * (ROW_HEIGHT + ROW_GAP);
      const rowCenterY = rowY + ROW_HEIGHT / 2;

      drawGlassRow(ctx, rowX, rowY, colWidth, ROW_HEIGHT, 14, entry.isYou ? theme.accent2Rgb : rankAccentRgb(rank));

      ctx.fillStyle = rankColor(rank);
      ctx.font = fontBold(14);
      ctx.textAlign = 'left';
      ctx.fillText(`#${rank}`, rowX + 14, rowCenterY + 5);

      const avatarSize = 34;
      const avatarX = rowX + 48;
      const avatarCy = rowY + ROW_HEIGHT / 2;
      const avatar = avatars[column.rankOffset + i];
      if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarCy, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarCy - avatarSize / 2, avatarSize, avatarSize);
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

      const nameX = avatarX + avatarSize + 16;
      ctx.fillStyle = entry.isYou ? theme.accent2 : theme.text;
      ctx.font = fontBold(15);
      const label = entry.isYou ? `${entry.displayName} (you)` : entry.displayName;
      ctx.fillText(fitText(ctx, label, rowX + colWidth - nameX - 76), nameX, rowCenterY + 5);

      ctx.textAlign = 'right';
      ctx.fillStyle = theme.accent2;
      ctx.font = fontBold(16);
      ctx.fillText(String(entry.playcount), rowX + colWidth - 12, rowCenterY - 2);
      ctx.fillStyle = theme.textFaint;
      ctx.font = fontRegular(10);
      ctx.fillText(opts.unitLabel ?? 'plays', rowX + colWidth - 12, rowCenterY + 13);
      ctx.textAlign = 'left';
    });
  });

  return canvas.toBuffer('image/png');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
