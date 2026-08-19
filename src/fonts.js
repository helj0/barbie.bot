import { GlobalFonts } from '@napi-rs/canvas';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Registered as two distinct family names (rather than one family with two
// weights) so font selection is unambiguous regardless of how a given
// platform's font matcher resolves numeric/keyword weights - every ctx.font
// string in this codebase names one of these two exactly.
const REGULAR_FAMILY = 'Outfit';
const BOLD_FAMILY = 'Outfit Bold';

GlobalFonts.registerFromPath(path.join(__dirname, 'assets/fonts/Outfit-Regular.ttf'), REGULAR_FAMILY);
GlobalFonts.registerFromPath(path.join(__dirname, 'assets/fonts/Outfit-Bold.ttf'), BOLD_FAMILY);

/** e.g. fontRegular(18) -> '18px Outfit' */
export function fontRegular(sizePx) {
  return `${sizePx}px ${REGULAR_FAMILY}`;
}

/** e.g. fontBold(18) -> '18px "Outfit Bold"' */
export function fontBold(sizePx) {
  return `${sizePx}px "${BOLD_FAMILY}"`;
}
