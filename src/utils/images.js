import { loadImage } from '@napi-rs/canvas';
import { fontRegular } from '../fonts.js';

const PLACEHOLDER_COLOR = '#2b2d31';

/**
 * Fetches a remote image and decodes it for canvas use.
 * Returns null on any failure so callers can draw a placeholder instead of
 * crashing a whole card render because one album had no art.
 */
export async function safeLoadImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch {
    return null;
  }
}

/**
 * Draws a rounded-rect clipped image (or a placeholder if img is null),
 * with a thin glass-edge stroke and a soft top-light glaze so artwork reads
 * as part of the same frosted-glass material as the surrounding card.
 */
export function drawCoverArt(ctx, img, x, y, size, radius = 10) {
  ctx.save();
  roundedRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, '#3a3d52');
    grad.addColorStop(1, '#20222f');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = fontRegular(Math.floor(size * 0.4));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', x + size / 2, y + size / 2 + 2);
  }

  // Soft top glaze, same treatment as the glass panels around it.
  const glaze = ctx.createLinearGradient(x, y, x, y + size * 0.5);
  glaze.addColorStop(0, 'rgba(255,255,255,0.22)');
  glaze.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glaze;
  ctx.fillRect(x, y, size, size * 0.5);
  ctx.restore();

  roundedRectPath(ctx, x + 0.5, y + 0.5, size - 1, size - 1, radius);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Truncates text with an ellipsis so it fits within maxWidth. */
export function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

/** Greedily wraps text into lines no wider than maxWidth (uses ctx's current font). */
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
