import { createCanvas } from '@napi-rs/canvas';
import { theme } from './theme.js';
import { drawAmbientBackground, drawGlassPanel, drawPill } from './glass.js';
import { fontRegular, fontBold } from '../fonts.js';
import { safeLoadImage, drawCoverArt, fitText } from '../utils/images.js';

const WIDTH = 900;
const HEIGHT = 320;
const MARGIN = 24;

/**
 * @param {object} opts
 * @param {string} opts.displayName - Discord display name
 * @param {string} opts.avatarUrl
 * @param {string} opts.trackName
 * @param {string} opts.artistName
 * @param {string} opts.albumName
 * @param {string|null} opts.imageUrl
 * @param {boolean} opts.isNowPlaying - true = currently playing, false = last played
 * @param {number|null} opts.userPlaycount - total plays of this track by this user, if known
 */
export async function renderNowPlayingCard(opts) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  drawAmbientBackground(ctx, WIDTH, HEIGHT);

  const panelX = MARGIN;
  const panelY = MARGIN;
  const panelW = WIDTH - MARGIN * 2;
  const panelH = HEIGHT - MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 26);

  const [art, avatar] = await Promise.all([
    safeLoadImage(opts.imageUrl),
    safeLoadImage(opts.avatarUrl),
  ]);

  const artSize = panelH - 56;
  const artX = panelX + 28;
  const artY = panelY + (panelH - artSize) / 2;
  drawCoverArt(ctx, art, artX, artY, artSize, 18);

  const textX = artX + artSize + 36;
  const textMaxWidth = panelX + panelW - textX - 28;

  drawPill(ctx, textX, artY + 2, opts.isNowPlaying ? 'NOW PLAYING' : 'LAST PLAYED', {
    accentRgb: opts.isNowPlaying ? theme.accentRgb : '150,152,163',
    textColor: opts.isNowPlaying ? theme.accent : theme.textDim,
    font: fontBold(13),
    height: 26,
    dot: opts.isNowPlaying,
  });

  ctx.fillStyle = theme.text;
  ctx.font = fontBold(38);
  ctx.fillText(fitText(ctx, opts.trackName, textMaxWidth), textX, artY + 80);

  ctx.fillStyle = theme.textDim;
  ctx.font = fontRegular(26);
  ctx.fillText(fitText(ctx, opts.artistName, textMaxWidth), textX, artY + 114);

  if (opts.albumName) {
    ctx.fillStyle = theme.textFaint;
    ctx.font = fontRegular(20);
    ctx.fillText(fitText(ctx, opts.albumName, textMaxWidth), textX, artY + 144);
  }

  // Footer: avatar + display name (left), playcount pill (right)
  const footerY = artY + artSize - 30;
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(textX + 16, footerY, 16, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, textX, footerY - 16, 32, 32);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(textX + 16, footerY, 16, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = theme.text;
  ctx.font = fontRegular(15);
  ctx.fillText(opts.displayName, textX + 40, footerY + 5);

  if (opts.userPlaycount !== null && opts.userPlaycount !== undefined) {
    const countText = `${opts.userPlaycount} play${opts.userPlaycount === 1 ? '' : 's'}`;
    ctx.font = fontBold(15);
    const pillWidth = ctx.measureText(countText).width + 28;
    drawPill(ctx, textX + textMaxWidth - pillWidth, footerY - 15, countText, {
      accentRgb: theme.accent2Rgb,
      textColor: theme.accent2,
      font: fontBold(15),
      height: 30,
    });
  }

  return canvas.toBuffer('image/png');
}
