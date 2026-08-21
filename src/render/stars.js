import { theme } from './theme.js';
import { fontRegular } from '../fonts.js';

// Hand-drawn vector stars rather than a unicode ★/☆ glyph, same reasoning
// as the medal icons: no guarantee the bundled font covers that glyph
// cleanly on every host.
function starPath(ctx, cx, cy, r) {
  const innerR = r * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : innerR;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draws a row of 5 stars (filled/half/empty based on `average`, rounded to
 * the nearest half star) plus a "3.8 (12 ratings)" label, vertically
 * centered on y starting at x. Draws a dim empty row + "No ratings yet"
 * when count is 0.
 * @param {object} opts
 * @param {number|null} opts.average
 * @param {number} opts.count
 * @param {number} [opts.starSize]
 * @param {string} [opts.filledColor]
 * @param {string} [opts.textColor]
 * @param {string} [opts.emptyColor]
 * @returns {number} total width drawn, for layout purposes
 */
export function drawStarRating(ctx, x, y, opts = {}) {
  const {
    average,
    count,
    starSize = 15,
    filledColor = theme.rankGold,
    textColor = theme.textDim,
    emptyColor = 'rgba(255,255,255,0.15)',
  } = opts;
  const gap = starSize * 0.35;
  const r = starSize / 2;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let cursorX = x + r;
  const rounded = count > 0 ? Math.round(average * 2) / 2 : 0;

  for (let i = 0; i < 5; i++) {
    const threshold = i + 1;
    starPath(ctx, cursorX, y, r);
    if (rounded >= threshold) {
      ctx.fillStyle = filledColor;
      ctx.fill();
    } else if (rounded >= threshold - 0.5) {
      ctx.fillStyle = emptyColor;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.rect(cursorX - r, y - r, r, r * 2);
      ctx.clip();
      starPath(ctx, cursorX, y, r);
      ctx.fillStyle = filledColor;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = emptyColor;
      ctx.fill();
    }
    cursorX += starSize + gap;
  }

  const label = count > 0 ? `${average.toFixed(1)} (${count} rating${count === 1 ? '' : 's'})` : 'No ratings yet';
  ctx.fillStyle = count > 0 ? textColor : 'rgba(255,255,255,0.3)';
  ctx.font = fontRegular(13);
  ctx.fillText(label, cursorX + 6, y);

  const totalWidth = cursorX + 6 + ctx.measureText(label).width - x;
  ctx.restore();
  return totalWidth;
}
