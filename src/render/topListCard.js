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

/**
 * @param {string} title - e.g. "yuki's Top Artists"
 * @param {string} subtitle - e.g. "Last Month"
 * @param {Array<{name: string, subtext?: string, imageUrl?: string, playcount: number}>} items
 */
export async function renderTopListCard(title, subtitle, items) {
  const rows = items.slice(0, 10);
  const panelH = rows.length * ROW_HEIGHT + (rows.length - 1) * ROW_GAP + PANEL_PADDING * 2;
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

  rows.forEach((item, i) => {
    const rowX = panelX + PANEL_PADDING;
    const rowY = panelY + PANEL_PADDING + i * (ROW_HEIGHT + ROW_GAP);
    const rowW = panelW - PANEL_PADDING * 2;
    const rowCenterY = rowY + ROW_HEIGHT / 2;

    drawGlassRow(ctx, rowX, rowY, rowW, ROW_HEIGHT, 14, rankAccentRgb(i + 1));

    ctx.fillStyle = rankColor(i + 1);
    ctx.font = fontBold(18);
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), rowX + 16, rowCenterY + 6);

    const artSize = 44;
    const artX = rowX + 48;
    drawCoverArt(ctx, images[i], artX, rowY + (ROW_HEIGHT - artSize) / 2, artSize, 10);

    const textX = artX + artSize + 18;
    const maxTextWidth = rowX + rowW - textX - 100;
    ctx.fillStyle = theme.text;
    ctx.font = fontBold(18);
    ctx.fillText(fitText(ctx, item.name, maxTextWidth), textX, rowCenterY - 3);

    if (item.subtext) {
      ctx.fillStyle = theme.textDim;
      ctx.font = fontRegular(13);
      ctx.fillText(fitText(ctx, item.subtext, maxTextWidth), textX, rowCenterY + 15);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = theme.accent2;
    ctx.font = fontBold(17);
    ctx.fillText(String(item.playcount), rowX + rowW - 16, rowCenterY - 2);
    ctx.fillStyle = theme.textFaint;
    ctx.font = fontRegular(11);
    ctx.fillText('plays', rowX + rowW - 16, rowCenterY + 14);
    ctx.textAlign = 'left';
  });

  return canvas.toBuffer('image/png');
}
