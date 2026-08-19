import { createCanvas } from '@napi-rs/canvas';
import { theme } from './theme.js';
import { drawAmbientBackground, drawGlassPanel, drawGlassRow, drawPill } from './glass.js';
import { fontRegular, fontBold } from '../fonts.js';
import { safeLoadImage, fitText, wrapText } from '../utils/images.js';
import { drawMedalIcon } from './medalIcons.js';
import { MEDALS } from '../medals/catalog.js';

const TIER_COLORS = {
  bronze: { hex: theme.rankBronze, rgb: theme.rankBronzeRgb },
  silver: { hex: theme.rankSilver, rgb: theme.rankSilverRgb },
  gold: { hex: theme.rankGold, rgb: theme.rankGoldRgb },
  platinum: { hex: theme.rankPlatinum, rgb: theme.rankPlatinumRgb },
};
const TIER_ORDER = { bronze: 1, silver: 2, gold: 3, platinum: 4 };

/** A glowing medallion disc with its icon etched in the center. */
function drawMedallion(ctx, cx, cy, radius, tier, medalKey) {
  const color = TIER_COLORS[tier] ?? TIER_COLORS.bronze;

  ctx.save();
  ctx.shadowColor = `rgba(${color.rgb},0.55)`;
  ctx.shadowBlur = radius * 0.7;
  const bodyGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
  bodyGrad.addColorStop(0, `rgba(${color.rgb},0.9)`);
  bodyGrad.addColorStop(1, `rgba(${color.rgb},0.55)`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `rgba(${color.rgb},0.9)`;
  ctx.lineWidth = Math.max(1.5, radius * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Icon, etched in translucent white with a soft dark contact shadow so it
  // reads against both the light and dark parts of the tier gradient.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = radius * 0.15;
  ctx.fillStyle = 'rgba(10,8,4,0.28)';
  ctx.strokeStyle = 'rgba(10,8,4,0.28)';
  drawMedalIcon(ctx, cx + radius * 0.04, cy + radius * 0.05, radius * 0.5, medalKey);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  drawMedalIcon(ctx, cx, cy, radius * 0.5, medalKey);

  // Top-left specular highlight, on top of the icon like a curved glass cap.
  const glazeGrad = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.4,
    0,
    cx - radius * 0.35,
    cy - radius * 0.4,
    radius * 0.9
  );
  glazeGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
  glazeGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glazeGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** An empty, dashed-ring slot for a medal that hasn't been earned yet. */
function drawLockedMedallion(ctx, cx, cy, radius) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = Math.max(1.2, radius * 0.06);
  ctx.setLineDash([radius * 0.22, radius * 0.18]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * A single "medal earned" card for scheduler announcements.
 * @param {object} opts
 * @param {string} opts.displayName
 * @param {string} opts.avatarUrl
 * @param {string} opts.medalKey
 * @param {string} opts.tier
 * @param {object} opts.context - medal-specific detail (e.g. { value: 512, artist: 'Radiohead' })
 */
export async function renderMedalAnnouncement(opts) {
  const WIDTH = 760;
  const HEIGHT = 220;
  const MARGIN = 22;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  drawAmbientBackground(ctx, WIDTH, HEIGHT);

  const panelX = MARGIN;
  const panelY = MARGIN;
  const panelW = WIDTH - MARGIN * 2;
  const panelH = HEIGHT - MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 24);

  const def = MEDALS[opts.medalKey];
  const medallionR = 56;
  const medallionCx = panelX + 34 + medallionR;
  const medallionCy = panelY + panelH / 2;
  drawMedallion(ctx, medallionCx, medallionCy, medallionR, opts.tier, opts.medalKey);

  const textX = medallionCx + medallionR + 34;
  const textMaxWidth = panelX + panelW - textX - 24;

  drawPill(ctx, textX, panelY + 22, 'MEDAL UNLOCKED', {
    accentRgb: TIER_COLORS[opts.tier]?.rgb ?? theme.accent2Rgb,
    textColor: TIER_COLORS[opts.tier]?.hex ?? theme.accent2,
    font: fontBold(12),
    height: 24,
  });

  ctx.fillStyle = theme.text;
  ctx.font = fontBold(30);
  ctx.fillText(fitText(ctx, def?.name ?? opts.medalKey, textMaxWidth), textX, panelY + 76);

  ctx.fillStyle = theme.textDim;
  ctx.font = fontRegular(16);
  const description = describeContext(opts.medalKey, opts.tier, opts.context);
  ctx.fillText(fitText(ctx, description, textMaxWidth), textX, panelY + 104);

  const avatar = await safeLoadImage(opts.avatarUrl);
  const footerY = panelY + panelH - 30;
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(textX + 14, footerY, 14, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, textX, footerY - 14, 28, 28);
    ctx.restore();
  }
  ctx.fillStyle = theme.text;
  ctx.font = fontRegular(15);
  ctx.fillText(opts.displayName, textX + 34, footerY + 5);

  return canvas.toBuffer('image/png');
}

/**
 * The badge-case grid for /medals - one cell per medal in the catalog. A
 * medal the user has earned shows its highest tier + icon; anything not
 * yet earned shows as a locked, dashed-ring slot.
 * @param {object} opts
 * @param {string} opts.displayName
 * @param {Array<{medal_key: string, tier: string|null, context_json: string}>} opts.earnedMedals
 * @param {number} opts.totalPoints
 */
export async function renderBadgeCase(opts) {
  const WIDTH = 900;
  const COLS = 5;
  const CELL_W = 148;
  const CELL_H = 178;
  const CELL_GAP = 12;
  const HEADER_HEIGHT = 90;
  const PANEL_PADDING = 24;
  const OUTER_MARGIN = 30;
  const DESC_MAX_LINES = 3;
  const DESC_LINE_HEIGHT = 13;

  const bestTierByKey = new Map();
  for (const m of opts.earnedMedals) {
    const existing = bestTierByKey.get(m.medal_key);
    if (!existing || (TIER_ORDER[m.tier] ?? 0) > (TIER_ORDER[existing.tier] ?? 0)) {
      bestTierByKey.set(m.medal_key, m);
    }
  }

  const cells = Object.keys(MEDALS).map((key) => ({ key, earned: bestTierByKey.get(key) ?? null }));
  const rows = Math.max(1, Math.ceil(cells.length / COLS));
  const panelH = rows * CELL_H + (rows - 1) * CELL_GAP + PANEL_PADDING * 2;
  const height = OUTER_MARGIN + HEADER_HEIGHT + panelH + OUTER_MARGIN;

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  drawAmbientBackground(ctx, WIDTH, height);

  ctx.fillStyle = theme.text;
  ctx.font = fontBold(30);
  ctx.fillText(`${opts.displayName}'s badge case`, OUTER_MARGIN, OUTER_MARGIN + 34);
  ctx.fillStyle = theme.accent2;
  ctx.font = fontRegular(15);
  ctx.fillText(
    `${bestTierByKey.size} of ${cells.length} medals · ${opts.totalPoints} points`,
    OUTER_MARGIN,
    OUTER_MARGIN + 60
  );

  const panelX = OUTER_MARGIN;
  const panelY = OUTER_MARGIN + HEADER_HEIGHT;
  const panelW = WIDTH - OUTER_MARGIN * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 24);

  cells.forEach((cell, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cellX = panelX + PANEL_PADDING + col * (CELL_W + CELL_GAP);
    const cellY = panelY + PANEL_PADDING + row * (CELL_H + CELL_GAP);

    drawGlassRow(ctx, cellX, cellY, CELL_W, CELL_H, 16, null);

    const def = MEDALS[cell.key];
    const centerX = cellX + CELL_W / 2;
    if (cell.earned) {
      drawMedallion(ctx, centerX, cellY + 38, 26, cell.earned.tier ?? 'bronze', cell.key);
    } else {
      drawLockedMedallion(ctx, centerX, cellY + 38, 26);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = cell.earned ? theme.text : theme.textFaint;
    ctx.font = fontBold(13);
    ctx.fillText(fitText(ctx, def?.name ?? cell.key, CELL_W - 16), centerX, cellY + 76);

    if (cell.earned?.tier) {
      ctx.fillStyle = TIER_COLORS[cell.earned.tier]?.hex ?? theme.textDim;
      ctx.font = fontRegular(11);
      ctx.fillText(capitalize(cell.earned.tier), centerX, cellY + 93);
    } else {
      ctx.fillStyle = theme.textFaint;
      ctx.font = fontRegular(11);
      ctx.fillText('Locked', centerX, cellY + 93);
    }

    // Description: the earned tier's threshold if held, otherwise the
    // entry (bronze/only) tier's, so a locked medal still tells you the
    // first goalpost to aim for.
    ctx.fillStyle = cell.earned ? theme.textDim : theme.textFaint;
    ctx.font = fontRegular(10);
    const referenceTier = cell.earned?.tier ?? def?.tiers[0]?.tier;
    const tierDef = def?.tiers.find((t) => t.tier === referenceTier) ?? def?.tiers[0];
    const description = tierDef?.threshold ? def.description(tierDef.threshold) : def?.description();
    const lines = wrapText(ctx, description ?? '', CELL_W - 20).slice(0, DESC_MAX_LINES);
    if (lines.length === DESC_MAX_LINES) {
      let last = lines[DESC_MAX_LINES - 1];
      while (last.length > 1 && ctx.measureText(last + '…').width > CELL_W - 20) {
        last = last.slice(0, -1).trimEnd();
      }
      lines[DESC_MAX_LINES - 1] = last + '…';
    }
    lines.forEach((line, li) => {
      ctx.fillText(line, centerX, cellY + 110 + li * DESC_LINE_HEIGHT);
    });

    ctx.textAlign = 'left';
  });

  return canvas.toBuffer('image/png');
}

function describeContext(medalKey, tier, context) {
  const def = MEDALS[medalKey];
  if (!def) return '';
  const tierDef = def.tiers.find((t) => t.tier === tier);
  if (medalKey === 'devotee' && context?.artist) {
    return `${context.value} plays of ${context.artist}`;
  }
  if (medalKey === 'onrepeat' && context?.album) {
    return `${context.value} plays of ${context.album}`;
  }
  if (medalKey === 'monthlychampion' && context?.plays) {
    return `${context.plays.toLocaleString()} plays in ${context.month ?? 'the month'}`;
  }
  if ((medalKey === 'underground' || medalKey === 'charttopper') && context?.avgListeners) {
    return `Averaging ${context.avgListeners.toLocaleString()} listeners per artist`;
  }
  if (tierDef?.threshold) return def.description(tierDef.threshold);
  return def.description();
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
