/**
 * Rasterizes a TTF/OTF font into the pixpix bitmap Font model (see bdf.ts):
 * each glyph is drawn onto a shared canvas at the given pixel size via
 * opentype.js + Canvas 2D, then thresholded into a boolean bitmap. Runs
 * entirely in the browser — no server involvement.
 */
import opentype from "opentype.js";
import {
  createFont,
  defaultGlyphName,
  emptyPixels,
  type Box,
  type Font,
  type Glyph,
} from "./bdf";

const PAD = 3;
const ALPHA_THRESHOLD = 128;

export interface TtfImportResult {
  font: Font;
  /** Requested codepoints the font has no glyph for. */
  missing: number[];
}

interface FoundGlyph {
  code: number;
  glyph: opentype.Glyph;
  advancePx: number;
}

const GRID_SAMPLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function gcd(a: number, b: number): number {
  while (b > 0) [a, b] = [b, a % b];
  return a;
}

/**
 * The pixel size at which one design pixel of a pixel font lands on exactly one
 * output pixel: the em divided by the common divisor of every outline
 * coordinate. Any other size cuts through the design grid and mangles the
 * strokes, so this is the size to import at (or a multiple of it).
 *
 * `null` for ordinary outline fonts, which have curves and no shared grid.
 */
export function detectNativePixelSize(buffer: ArrayBuffer): number | null {
  const otFont = opentype.parse(buffer);
  let grid = 0;
  for (const char of GRID_SAMPLE) {
    const index = otFont.charToGlyphIndex(char);
    if (index === 0) continue;
    for (const command of otFont.glyphs.get(index).path.commands) {
      if (command.type === "C" || command.type === "Q") return null;
      if (command.type === "Z") continue;
      for (const value of [command.x, command.y]) {
        if (!Number.isInteger(value)) return null;
        grid = gcd(grid, Math.abs(value));
      }
    }
  }
  if (grid <= 1) return null;
  const size = otFont.unitsPerEm / grid;
  return Number.isInteger(size) && size >= 4 && size <= 128 ? size : null;
}

/** Convert a TTF/OTF file into a pixpix Font, covering the given codepoints. */
export function importTTF(
  buffer: ArrayBuffer,
  name: string,
  pixelSize: number,
  codepoints: number[],
): TtfImportResult {
  const otFont = opentype.parse(buffer);
  const scale = pixelSize / otFont.unitsPerEm;

  const found: FoundGlyph[] = [];
  const missing: number[] = [];
  let maxWidthPx = pixelSize;
  for (const code of codepoints) {
    const index = otFont.charToGlyphIndex(String.fromCodePoint(code));
    if (index === 0) {
      missing.push(code);
      continue;
    }
    const glyph = otFont.glyphs.get(index);
    const bbox = glyph.getBoundingBox();
    const advancePx = Math.round((glyph.advanceWidth ?? 0) * scale);
    maxWidthPx = Math.max(maxWidthPx, advancePx, bbox.x2 * scale);
    found.push({ code, glyph, advancePx });
  }

  const originX = PAD;
  const baselineY = Math.round(otFont.ascender * scale) + PAD;
  const canvasWidth = Math.ceil(maxWidthPx) + PAD * 2;
  const canvasHeight = baselineY + Math.round(-otFont.descender * scale) + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  let minCol = canvasWidth;
  let maxCol = -1;
  let minRow = canvasHeight;
  let maxRow = -1;
  const masks: { code: number; advancePx: number; mask: Uint8Array }[] = [];

  for (const { code, glyph, advancePx } of found) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const path = glyph.getPath(originX, baselineY, pixelSize);
    path.fill = "#000";
    path.draw(ctx);

    const { data } = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const mask = new Uint8Array(canvasWidth * canvasHeight);
    for (let row = 0; row < canvasHeight; row++) {
      for (let col = 0; col < canvasWidth; col++) {
        if (data[(row * canvasWidth + col) * 4 + 3] < ALPHA_THRESHOLD) continue;
        mask[row * canvasWidth + col] = 1;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
      }
    }
    masks.push({ code, advancePx, mask });
  }

  const hasInk = maxCol >= 0;
  const box: Box = hasInk
    ? {
        w: maxCol - minCol + 1,
        h: maxRow - minRow + 1,
        ox: minCol - originX,
        // oy is the bottom edge of the box, which is the far side of the
        // bottom-most row: ink resting on the baseline ends at oy 0, not 1
        oy: baselineY - maxRow - 1,
      }
    : {
        w: pixelSize,
        h: pixelSize,
        ox: 0,
        oy: -Math.round(-otFont.descender * scale),
      };

  const glyphs: Glyph[] = masks.map(({ code, advancePx, mask }) => {
    const pixels = emptyPixels(box);
    if (hasInk) {
      for (let row = 0; row < box.h; row++) {
        const canvasRow = minRow + row;
        for (let col = 0; col < box.w; col++) {
          if (mask[canvasRow * canvasWidth + (minCol + col)]) {
            pixels[row * box.w + col] = true;
          }
        }
      }
    }
    return {
      code,
      name: defaultGlyphName(code),
      dwidth: advancePx,
      pixels,
    };
  });

  return {
    font: { ...createFont({ name, box, pointSize: pixelSize }), glyphs },
    missing,
  };
}
