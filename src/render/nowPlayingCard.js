import { createCanvas } from '@napi-rs/canvas';
import { theme } from './theme.js';
import { drawAmbientBackground, drawGlassPanel, drawGlassRow, drawPill } from './glass.js';
import { fontRegular, fontBold } from '../fonts.js';
import { safeLoadImage, drawCoverArt, fitText } from '../utils/images.js';

const WIDTH = 900;
const MAIN_HEIGHT = 320;
const MARGIN = 24;

const OTHER_SECTION_GAP = 18;
const OTHER_HEADER_HEIGHT = 30;
const OTHER_ROW_HEIGHT = 46;
const OTHER_ROW_GAP = 6;
const OTHER_PANEL_PADDING = 16;

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
 * @param {Array<{displayName: string, avatarUrl?: string, playcount: number}>} [opts.otherListeners]
 *        Other linked server members who've played this track, ranked. Pass an array
 *        (possibly empty) to render the section at all; omit to skip it entirely
 *        (e.g. when not run inside a guild).
 */
export async function renderNowPlayingCard(opts) {
  const showOtherSection = Array.isArray(opts.otherListeners);
  const otherListeners = opts.otherListeners ?? [];
  const otherRowCount = Math.max(otherListeners.length, 1);
  const otherPanelH = showOtherSection
    ? OTHER_HEADER_HEIGHT +
      otherRowCount * OTHER_ROW_HEIGHT +
      Math.max(otherRowCount - 1, 0) * OTHER_ROW_GAP +
      OTHER_PANEL_PADDING * 2
    : 0;

  const mainPanelH = MAIN_HEIGHT - MARGIN * 2;
  const height = MARGIN + mainPanelH + (showOtherSection ? OTHER_SECTION_GAP + otherPanelH : 0) + MARGIN;

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  drawAmbientBackground(ctx, WIDTH, height);

  const panelX = MARGIN;
  const panelY = MARGIN;
  const panelW = WIDTH - MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, mainPanelH, 26);

  const [art, avatar, otherAvatars] = await Promise.all([
    safeLoadImage(opts.imageUrl),
    safeLoadImage(opts.avatarUrl),
    Promise.all(otherListeners.map((l) => safeLoadImage(l.avatarUrl))),
  ]);

  const artSize = mainPanelH - 56;
  const artX = panelX + 28;
  const artY = panelY + (mainPanelH - artSize) / 2;
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

  if (showOtherSection) {
    const otherPanelY = panelY + mainPanelH + OTHER_SECTION_GAP;
    drawGlassPanel(ctx, panelX, otherPanelY, panelW, otherPanelH, 22);

    ctx.fillStyle = theme.textDim;
    ctx.font = fontBold(14);
    ctx.fillText('Other listeners in this server', panelX + OTHER_PANEL_PADDING, otherPanelY + 26);

    const listX = panelX + OTHER_PANEL_PADDING;
    const listY = otherPanelY + OTHER_HEADER_HEIGHT + OTHER_PANEL_PADDING - 8;
    const listW = panelW - OTHER_PANEL_PADDING * 2;

    if (!otherListeners.length) {
      ctx.fillStyle = theme.textFaint;
      ctx.font = fontRegular(14);
      ctx.fillText("Nobody else linked in this server has played this track yet.", listX, listY + OTHER_ROW_HEIGHT / 2 + 5);
    } else {
      otherListeners.forEach((listener, i) => {
        const rowY = listY + i * (OTHER_ROW_HEIGHT + OTHER_ROW_GAP);
        const rowCenterY = rowY + OTHER_ROW_HEIGHT / 2;

        drawGlassRow(ctx, listX, rowY, listW, OTHER_ROW_HEIGHT, 12, null);

        const avatarSize = 28;
        const avatarX = listX + 14;
        const otherAvatar = otherAvatars[i];
        if (otherAvatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, rowCenterY, avatarSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(otherAvatar, avatarX, rowCenterY - avatarSize / 2, avatarSize, avatarSize);
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, rowCenterY, avatarSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        const nameX = avatarX + avatarSize + 14;
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.text;
        ctx.font = fontBold(14);
        ctx.fillText(fitText(ctx, listener.displayName, listX + listW - nameX - 80), nameX, rowCenterY + 5);

        ctx.textAlign = 'right';
        ctx.fillStyle = theme.accent2;
        ctx.font = fontBold(14);
        const playsText = `${listener.playcount} play${listener.playcount === 1 ? '' : 's'}`;
        ctx.fillText(playsText, listX + listW - 14, rowCenterY + 5);
        ctx.textAlign = 'left';
      });
    }
  }

  return canvas.toBuffer('image/png');
}
