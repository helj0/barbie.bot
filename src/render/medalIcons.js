// Each icon is drawn inside a circle of the given radius `r`, centered at
// (cx, cy). Callers set fillStyle/strokeStyle before calling - icons are
// drawn as flat shapes so they read clearly at small sizes (badge case) and
// large sizes (announcement card) alike.

export function drawMedalIcon(ctx, cx, cy, r, medalKey) {
  const icon = ICONS[medalKey] ?? drawStar;
  icon(ctx, cx, cy, r);
}

function drawPlay(ctx, cx, cy, r) {
  // Scrobbler - a play triangle
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.65);
  ctx.lineTo(cx - r * 0.5, cy + r * 0.65);
  ctx.lineTo(cx + r * 0.7, cy);
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx, cx, cy, r) {
  // Devotee
  const lobeR = r * 0.42;
  ctx.beginPath();
  ctx.arc(cx - lobeR * 0.9, cy - lobeR * 0.5, lobeR, 0, Math.PI * 2);
  ctx.arc(cx + lobeR * 0.9, cy - lobeR * 0.5, lobeR, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 0.85, cy - lobeR * 0.15);
  ctx.lineTo(cx, cy + r * 0.75);
  ctx.lineTo(cx + r * 0.85, cy - lobeR * 0.15);
  ctx.closePath();
  ctx.fill('nonzero');
}

function drawRepeat(ctx, cx, cy, r) {
  // On Repeat - circular arrow
  ctx.save();
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, -Math.PI * 0.15, Math.PI * 1.5);
  ctx.stroke();
  const angle = Math.PI * 1.5;
  const ax = cx + Math.cos(angle) * r * 0.55;
  const ay = cy + Math.sin(angle) * r * 0.55;
  ctx.beginPath();
  ctx.moveTo(ax - r * 0.2, ay - r * 0.03);
  ctx.lineTo(ax + r * 0.05, ay - r * 0.28);
  ctx.lineTo(ax + r * 0.22, ay + r * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCrate(ctx, cx, cy, r) {
  // Crate Digger - stacked bars
  const barW = r * 1.3;
  const barH = r * 0.28;
  const gap = r * 0.14;
  for (let i = 0; i < 3; i++) {
    const y = cy - barH * 1.5 - gap + i * (barH + gap);
    roundedRect(ctx, cx - barW / 2, y, barW, barH, barH * 0.3);
    ctx.fill();
  }
}

function drawSparkle(ctx, cx, cy, r) {
  // Genre Hopper - four-point sparkle
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.8);
  ctx.quadraticCurveTo(cx + r * 0.15, cy - r * 0.15, cx + r * 0.8, cy);
  ctx.quadraticCurveTo(cx + r * 0.15, cy + r * 0.15, cx, cy + r * 0.8);
  ctx.quadraticCurveTo(cx - r * 0.15, cy + r * 0.15, cx - r * 0.8, cy);
  ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 0.15, cx, cy - r * 0.8);
  ctx.closePath();
  ctx.fill();
}

function drawDownArrow(ctx, cx, cy, r) {
  // Underground
  ctx.save();
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.6);
  ctx.lineTo(cx, cy + r * 0.35);
  ctx.moveTo(cx - r * 0.35, cy + r * 0.05);
  ctx.lineTo(cx, cy + r * 0.45);
  ctx.lineTo(cx + r * 0.35, cy + r * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawUpArrow(ctx, cx, cy, r) {
  // Chart Topper
  ctx.save();
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.6);
  ctx.lineTo(cx, cy - r * 0.35);
  ctx.moveTo(cx - r * 0.35, cy - r * 0.05);
  ctx.lineTo(cx, cy - r * 0.45);
  ctx.lineTo(cx + r * 0.35, cy - r * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawFlag(ctx, cx, cy, r) {
  // Trailblazer
  ctx.save();
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.4, cy - r * 0.7);
  ctx.lineTo(cx - r * 0.4, cy + r * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.4, cy - r * 0.62);
  ctx.lineTo(cx + r * 0.6, cy - r * 0.38);
  ctx.lineTo(cx - r * 0.4, cy - r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCrown(ctx, cx, cy, r) {
  // Scrobble Legend
  const baseY = cy + r * 0.35;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.6, baseY);
  ctx.lineTo(cx - r * 0.6, cy - r * 0.05);
  ctx.lineTo(cx - r * 0.3, cy + r * 0.15);
  ctx.lineTo(cx, cy - r * 0.55);
  ctx.lineTo(cx + r * 0.3, cy + r * 0.15);
  ctx.lineTo(cx + r * 0.6, cy - r * 0.05);
  ctx.lineTo(cx + r * 0.6, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawTrophy(ctx, cx, cy, r) {
  // Monthly Champion
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.4, cy - r * 0.5);
  ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.1, cx, cy + r * 0.15);
  ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.1, cx + r * 0.4, cy - r * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(cx - r * 0.08, cy + r * 0.12, r * 0.16, r * 0.25);
  roundedRect(ctx, cx - r * 0.3, cy + r * 0.35, r * 0.6, r * 0.12, r * 0.04);
  ctx.fill();

  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.beginPath();
  ctx.arc(cx - r * 0.48, cy - r * 0.2, r * 0.18, Math.PI * 0.25, Math.PI * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + r * 0.48, cy - r * 0.2, r * 0.18, Math.PI * 1.6, Math.PI * 2.75);
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx, cx, cy, r) {
  // Fallback icon for any medal key without a dedicated design
  const spikes = 5;
  const outerR = r * 0.75;
  const innerR = r * 0.32;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const ICONS = {
  scrobbler: drawPlay,
  devotee: drawHeart,
  onrepeat: drawRepeat,
  cratedigger: drawCrate,
  genrehopper: drawSparkle,
  underground: drawDownArrow,
  charttopper: drawUpArrow,
  trailblazer: drawFlag,
  scrobblelegend: drawCrown,
  monthlychampion: drawTrophy,
};
