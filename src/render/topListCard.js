import { createCanvas } from '@napi-rs/canvas';
import { theme, rankColor, rankAccentRgb } from './theme.js';
import { drawAmbientBackground, drawGlassPanel, drawGlassRow } from './glass.js';
import { fontRegular, fontBold } from '../fonts.js';
import { safeLoadImage, drawCoverArt, fitText } from '../utils/images.js';

const WIDTH = 900;
const ROW_HEIGHT = 66;
const ROW_GAP = 8;
const HEADER_HEIGHT = 96;
const PANEL_PADDING = 20;
const OUTER_MARGIN = 30;
const COLUMN_GAP = 20;

/**
 * @param {string} title - e.g. "yuki's Top Artists"
 * @param {string} subtitle - e.g. "Last Month"
 * @param {Array<{name: string, subtext?: string, imageUrl?: string, playcount: number}>} items
 */
export async function renderTopListCard(title, subtitle, items) {
  const rows = items.slice(0, 10);
  // Ranked down the left column first, then continuing down the right -
  // not interleaved - so reading order still matches rank order.
  const splitAt = Math.ceil(rows.length / 2);
  const columns = [
    { items: rows.slice(0, splitAt), rankOffset: 0 },
    { items: rows.slice(splitAt), rankOffset: splitAt },
  ];
  const rowCount = Math.max(columns[0].items.length, 1);
  const panelH = rowCount * ROW_HEIGHT + (rowCount - 1) * ROW_GAP + PANEL_PADDING * 2;
  const height = HEADER_HEIGHT + panelH + OUTER_MARGIN;

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  drawAmbientBackground(ctx, WIDTH, height);

  ctx.fillStyle = theme.text;
  ctx.font = fontBold(32);
  ctx.fillText(fitText(ctx, title, WIDTH - OUTER_MARGIN * 2), OUTER_MARGIN, 48);
  ctx.fillStyle = theme.accent;
  ctx.font = fontRegular(15);
  ctx.fillText(subtitle, OUTER_MARGIN, 74);

  const panelX = OUTER_MARGIN;
  const panelY = HEADER_HEIGHT;
  const panelW = WIDTH - OUTER_MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 24);

  const images = await Promise.all(rows.map((r) => safeLoadImage(r.imageUrl)));
  const colWidth = (panelW - PANEL_PADDING * 2 - COLUMN_GAP) / 2;

  columns.forEach((column, colIndex) => {
    const colX = panelX + PANEL_PADDING + colIndex * (colWidth + COLUMN_GAP);

    column.items.forEach((item, i) => {
      const rank = column.rankOffset + i + 1;
      const rowY = panelY + PANEL_PADDING + i * (ROW_HEIGHT + ROW_GAP);
      const rowCenterY = rowY + ROW_HEIGHT / 2;

      drawGlassRow(ctx, colX, rowY, colWidth, ROW_HEIGHT, 14, rankAccentRgb(rank));

      ctx.fillStyle = rankColor(rank);
      ctx.font = fontBold(16);
      ctx.textAlign = 'left';
      ctx.fillText(String(rank), colX + 14, rowCenterY + 6);

      const artSize = 44;
      const artX = colX + 40;
      drawCoverArt(ctx, images[column.rankOffset + i], artX, rowY + (ROW_HEIGHT - artSize) / 2, artSize, 10);

      const textX = artX + artSize + 14;
      const maxTextWidth = colX + colWidth - textX - 66;
      ctx.fillStyle = theme.text;
      ctx.font = fontBold(15);
      ctx.fillText(fitText(ctx, item.name, maxTextWidth), textX, rowCenterY - 3);

      if (item.subtext) {
        ctx.fillStyle = theme.textDim;
        ctx.font = fontRegular(11);
        ctx.fillText(fitText(ctx, item.subtext, maxTextWidth), textX, rowCenterY + 14);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = theme.accent2;
      ctx.font = fontBold(15);
      ctx.fillText(String(item.playcount), colX + colWidth - 12, rowCenterY - 2);
      ctx.fillStyle = theme.textFaint;
      ctx.font = fontRegular(10);
      ctx.fillText('plays', colX + colWidth - 12, rowCenterY + 13);
      ctx.textAlign = 'left';
    });
  });

  return canvas.toBuffer('image/png');
}
