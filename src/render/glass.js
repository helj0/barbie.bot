import { roundedRectPath } from '../utils/images.js';
import { fontBold } from '../fonts.js';

/**
 * Dark ambient background with soft colored glow blobs, standing in for the
 * frosted/backdrop-blur look you'd get with real CSS backdrop-filter -
 * canvas has no native background blur, so the "glass" read comes from
 * layering translucent gradients + soft drop shadows on top of this instead.
 */
export function drawAmbientBackground(ctx, width, height) {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#0a0b12');
  base.addColorStop(1, '#050508');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  drawGlowBlob(ctx, width * 0.12, height * 0.05, width * 0.4, 'rgba(46,140,90,0.22)');
  drawGlowBlob(ctx, width * 0.92, height * 0.1, width * 0.32, 'rgba(120,70,200,0.2)');
  drawGlowBlob(ctx, width * 0.75, height * 0.95, width * 0.35, 'rgba(50,90,180,0.18)');
}

function drawGlowBlob(ctx, cx, cy, radius, color) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

/**
 * A large frosted-glass panel: soft drop shadow (real canvas shadowBlur, so
 * it actually lifts off the background), translucent gradient fill, a top
 * "glaze" highlight, and a bright hairline rim across the top edge to
 * suggest a curved glass surface catching light.
 */
export function drawGlassPanel(ctx, x, y, w, h, r = 22) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = 'rgba(5,5,8,0.6)';
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  const fillGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  fillGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
  fillGrad.addColorStop(0.6, 'rgba(255,255,255,0.03)');
  fillGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = fillGrad;
  ctx.fillRect(x, y, w, h);

  const glazeGrad = ctx.createLinearGradient(x, y, x, y + h * 0.5);
  glazeGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
  glazeGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glazeGrad;
  ctx.fillRect(x, y, w, h * 0.5);
  ctx.restore();

  roundedRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const lineGrad = ctx.createLinearGradient(x + r, y, x + w - r, y);
  lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
  lineGrad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + r, y + 1);
  ctx.lineTo(x + w - r, y + 1);
  ctx.stroke();
}

/**
 * A smaller glass "row" for list items inside a panel - lighter shadow,
 * optional accent tint (used for #1/#2/#3 rank rows).
 * @param {string|null} accentRgb - e.g. "242,201,76" (no shadow prefix)
 */
export function drawGlassRow(ctx, x, y, w, h, r = 14, accentRgb = null) {
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  const fillGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  if (accentRgb) {
    fillGrad.addColorStop(0, `rgba(${accentRgb},0.16)`);
    fillGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
  } else {
    fillGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    fillGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
  }
  ctx.fillStyle = fillGrad;
  ctx.fillRect(x, y, w, h);

  const glazeGrad = ctx.createLinearGradient(x, y, x, y + h);
  glazeGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
  glazeGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glazeGrad;
  ctx.fillRect(x, y, w, h * 0.6);
  ctx.restore();

  roundedRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = accentRgb ? `rgba(${accentRgb},0.35)` : 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * A small glowing capsule badge, e.g. "NOW PLAYING" or "47 plays".
 * Returns its rendered width so callers can position things after it.
 */
export function drawPill(ctx, x, y, text, opts = {}) {
  const {
    font = fontBold(14),
    textColor = '#ffffff',
    accentRgb = '255,255,255',
    paddingX = 14,
    height = 28,
    dot = false,
  } = opts;

  ctx.font = font;
  const textWidth = ctx.measureText(text).width;
  const dotSpace = dot ? 14 : 0;
  const w = textWidth + paddingX * 2 + dotSpace;
  const h = height;

  roundedRectPath(ctx, x, y, w, h, h / 2);
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, `rgba(${accentRgb},0.18)`);
  grad.addColorStop(1, `rgba(${accentRgb},0.06)`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = `rgba(${accentRgb},0.4)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  let textX = x + paddingX;
  if (dot) {
    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.arc(x + paddingX + 3, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    textX += 10;
  }

  ctx.fillStyle = textColor;
  ctx.font = font;
  const prevBaseline = ctx.textBaseline;
  const prevAlign = ctx.textAlign;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, textX, y + h / 2 + 1);
  ctx.textBaseline = prevBaseline;
  ctx.textAlign = prevAlign;

  return w;
}
