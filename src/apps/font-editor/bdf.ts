/**
 * BDF font model, parser and serializer.
 *
 * Glyph bitmaps are stored in the *font box frame* — every glyph shares the
 * font bounding box, so the editor can present a single fixed grid. Per-glyph
 * bounding boxes are recomputed (tightly) when serializing, which keeps the
 * output compact without changing how the glyph renders.
 *
 * BDF y axis points up from the baseline, the editor grid rows go down, so:
 *
 *   x = box.ox + col            col = x - box.ox
 *   y = box.oy + box.h - 1 - row    row = box.oy + box.h - 1 - y
 */

/** A BDF bounding box: size plus offset from the origin (baseline, left edge). */
export interface Box {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export interface Glyph {
  /** Codepoint (BDF `ENCODING`). */
  code: number;
  /** Glyph name (BDF `STARTCHAR`). */
  name: string;
  /** Advance width in pixels (BDF `DWIDTH`). */
  dwidth: number;
  /** Row-major bitmap in the font box frame, length = `box.w * box.h`. */
  pixels: boolean[];
}

export interface Font {
  /** BDF `FONT` — for u8g2 codegen this is the name that must match. */
  name: string;
  /** Point size (first value of BDF `SIZE`). */
  pointSize: number;
  resolutionX: number;
  resolutionY: number;
  /** Pixels above the baseline (`FONT_ASCENT`). */
  ascent: number;
  /** Pixels below the baseline (`FONT_DESCENT`). */
  descent: number;
  /** Font bounding box, also the editing grid. */
  box: Box;
  /** Other XLFD properties, preserved verbatim in file order. */
  properties: [string, string][];
  /** Glyphs, always sorted by codepoint. */
  glyphs: Glyph[];
}

/** Properties derived from `Font` fields, so they are never preserved as-is. */
const MANAGED_PROPERTIES = [
  "FONT_ASCENT",
  "FONT_DESCENT",
  "PIXEL_SIZE",
  "POINT_SIZE",
  "RESOLUTION_X",
  "RESOLUTION_Y",
];

export function pixelCount(box: Box): number {
  return box.w * box.h;
}

export function emptyPixels(box: Box): boolean[] {
  return new Array(pixelCount(box)).fill(false);
}

export function getPixel(
  box: Box,
  pixels: boolean[],
  col: number,
  row: number,
): boolean {
  if (col < 0 || col >= box.w || row < 0 || row >= box.h) return false;
  return pixels[row * box.w + col] === true;
}

export function findGlyph(font: Font, code: number): Glyph | null {
  return font.glyphs.find((glyph) => glyph.code === code) ?? null;
}

/** Default glyph name for a codepoint, following the X11 `uniXXXX` convention. */
export function defaultGlyphName(code: number): string {
  return `uni${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Family name: the family field of an XLFD name, or the name as-is. */
export function fontFamily(font: Font): string {
  const name = font.name.trim();
  if (name.startsWith("-")) {
    const family = name.split("-")[2];
    if (family) return family;
  }
  return name || "pixpix";
}

/** Sanitized family name for use as a download file name (no extension). */
export function fontFileName(font: Font): string {
  return fontFamily(font).replace(/[^A-Za-z0-9._-]+/g, "-") || "pixpix";
}

export function formatCode(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function createGlyph(font: Font, code: number): Glyph {
  return {
    code,
    name: defaultGlyphName(code),
    dwidth: font.box.w + font.box.ox,
    pixels: emptyPixels(font.box),
  };
}

export function createFont(partial: Partial<Font> = {}): Font {
  const box = partial.box ?? { w: 8, h: 8, ox: 0, oy: -1 };
  return {
    name: "pixpix",
    pointSize: box.h,
    resolutionX: 75,
    resolutionY: 75,
    ascent: box.h + box.oy,
    descent: -box.oy,
    properties: [],
    glyphs: [],
    ...partial,
    box,
  };
}

/**
 * Copy a bitmap from one box frame into another, keeping pixels at the same
 * position relative to the origin. Pixels falling outside the new box are
 * dropped.
 */
export function remapPixels(from: Box, pixels: boolean[], to: Box): boolean[] {
  const result = emptyPixels(to);
  for (let row = 0; row < to.h; row++) {
    const y = to.oy + to.h - 1 - row;
    const fromRow = from.oy + from.h - 1 - y;
    for (let col = 0; col < to.w; col++) {
      const x = to.ox + col;
      if (getPixel(from, pixels, x - from.ox, fromRow)) {
        result[row * to.w + col] = true;
      }
    }
  }
  return result;
}

/**
 * Move every glyph into a new font box, keeping pixels at the same position
 * relative to the origin. Pixels falling outside the new box are dropped.
 */
export function resizeBox(font: Font, box: Box): Font {
  const from = font.box;
  if (
    box.w === from.w &&
    box.h === from.h &&
    box.ox === from.ox &&
    box.oy === from.oy
  ) {
    return font;
  }
  const glyphs = font.glyphs.map((glyph) => ({
    ...glyph,
    pixels: remapPixels(from, glyph.pixels, box),
  }));
  return { ...font, box, glyphs };
}

/** Tight bounding box of the set pixels, or null when the glyph is blank. */
export function tightBox(box: Box, pixels: boolean[]): Box | null {
  let minCol = box.w;
  let minRow = box.h;
  let maxCol = -1;
  let maxRow = -1;
  for (let row = 0; row < box.h; row++) {
    for (let col = 0; col < box.w; col++) {
      if (!pixels[row * box.w + col]) continue;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
    }
  }
  if (maxCol < 0) return null;
  return {
    w: maxCol - minCol + 1,
    h: maxRow - minRow + 1,
    ox: box.ox + minCol,
    oy: box.oy + (box.h - 1 - maxRow),
  };
}

function parseNumbers(rest: string): number[] {
  return rest
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => Number(token));
}

function splitKeyword(line: string): [string, string] {
  const index = line.search(/\s/);
  if (index < 0) return [line, ""];
  return [line.slice(0, index), line.slice(index + 1).trim()];
}

function unquote(value: string): string {
  const match = value.match(/^"(.*)"$/s);
  return match ? match[1].replace(/""/g, '"') : value;
}

/** A glyph as it appears in the file, before being moved into the font box. */
interface RawGlyph {
  code: number;
  name: string;
  dwidth: number;
  box: Box;
  rows: string[];
}

function unionBox(a: Box, b: Box): Box {
  const left = Math.min(a.ox, b.ox);
  const right = Math.max(a.ox + a.w, b.ox + b.w);
  const bottom = Math.min(a.oy, b.oy);
  const top = Math.max(a.oy + a.h, b.oy + b.h);
  return { w: right - left, h: top - bottom, ox: left, oy: bottom };
}

/** Place a raw glyph bitmap into the font box frame. */
function toBoxFrame(raw: RawGlyph, box: Box): boolean[] {
  const pixels = emptyPixels(box);
  const bytesPerRow = Math.ceil(raw.box.w / 8);
  for (let rawRow = 0; rawRow < raw.box.h; rawRow++) {
    const hex = raw.rows[rawRow] ?? "";
    const bytes: number[] = [];
    for (let i = 0; i < bytesPerRow; i++) {
      bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2) || "0", 16) || 0);
    }
    const y = raw.box.oy + raw.box.h - 1 - rawRow;
    const row = box.oy + box.h - 1 - y;
    if (row < 0 || row >= box.h) continue;
    for (let rawCol = 0; rawCol < raw.box.w; rawCol++) {
      const bit = (bytes[rawCol >> 3] >> (7 - (rawCol % 8))) & 1;
      if (!bit) continue;
      const col = raw.box.ox + rawCol - box.ox;
      if (col < 0 || col >= box.w) continue;
      pixels[row * box.w + col] = true;
    }
  }
  return pixels;
}

/**
 * Parse BDF text. Unknown keywords are ignored; the font bounding box is
 * widened when a glyph does not fit into the declared `FONTBOUNDINGBOX`.
 */
export function parseBDF(text: string): Font {
  const lines = text.split(/\r?\n/);
  let name = "unnamed";
  let pointSize = 0;
  let resolutionX = 75;
  let resolutionY = 75;
  let ascent: number | null = null;
  let descent: number | null = null;
  let box: Box | null = null;
  const properties: [string, string][] = [];
  const raws: RawGlyph[] = [];

  let inProperties = false;
  let raw: RawGlyph | null = null;
  let inBitmap = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const [keyword, rest] = splitKeyword(trimmed);

    if (inBitmap) {
      if (keyword === "ENDCHAR") {
        inBitmap = false;
        if (raw && raw.code >= 0) raws.push(raw);
        raw = null;
      } else if (raw && /^[0-9a-fA-F]+$/.test(trimmed)) {
        raw.rows.push(trimmed);
      }
      continue;
    }

    switch (keyword) {
      case "FONT":
        name = unquote(rest) || name;
        break;
      case "SIZE": {
        const [size, resX, resY] = parseNumbers(rest);
        if (Number.isFinite(size)) pointSize = size;
        if (Number.isFinite(resX)) resolutionX = resX;
        if (Number.isFinite(resY)) resolutionY = resY;
        break;
      }
      case "FONTBOUNDINGBOX": {
        const [w, h, ox, oy] = parseNumbers(rest);
        box = { w, h, ox, oy };
        break;
      }
      case "STARTPROPERTIES":
        inProperties = true;
        break;
      case "ENDPROPERTIES":
        inProperties = false;
        break;
      case "COMMENT":
        break;
      case "STARTCHAR":
        raw = {
          code: -1,
          name: rest || "unnamed",
          dwidth: 0,
          box: { w: 0, h: 0, ox: 0, oy: 0 },
          rows: [],
        };
        break;
      case "ENCODING":
        if (raw) raw.code = parseNumbers(rest)[0] ?? -1;
        break;
      case "DWIDTH":
        if (raw) raw.dwidth = parseNumbers(rest)[0] ?? 0;
        break;
      case "BBX":
        if (raw) {
          const [w, h, ox, oy] = parseNumbers(rest);
          raw.box = { w, h, ox, oy };
        }
        break;
      case "BITMAP":
        inBitmap = true;
        break;
      case "ENDFONT":
        break;
      default:
        if (inProperties) {
          if (keyword === "FONT_ASCENT") ascent = parseNumbers(rest)[0] ?? 0;
          else if (keyword === "FONT_DESCENT")
            descent = parseNumbers(rest)[0] ?? 0;
          if (!MANAGED_PROPERTIES.includes(keyword)) {
            properties.push([keyword, rest]);
          }
        }
        break;
    }
  }

  if (!box) {
    box = raws.reduce<Box>((acc, item) => unionBox(acc, item.box), {
      w: 1,
      h: 1,
      ox: 0,
      oy: 0,
    });
  }
  // make sure every glyph fits into the editing grid
  for (const item of raws) {
    if (item.box.w > 0 && item.box.h > 0) box = unionBox(box, item.box);
  }

  const glyphs: Glyph[] = raws.map((item) => ({
    code: item.code,
    name: item.name,
    dwidth: item.dwidth,
    pixels: toBoxFrame(item, box!),
  }));
  glyphs.sort((a, b) => a.code - b.code);

  return {
    name,
    pointSize: pointSize || box.h,
    resolutionX,
    resolutionY,
    ascent: ascent ?? box.h + box.oy,
    descent: descent ?? -box.oy,
    box,
    properties,
    glyphs,
  };
}

/** Scalable width: advance in 1/1000 of the em, as BDF defines it. */
function scalableWidth(font: Font, dwidth: number): number {
  const pixelsPerEm = (font.pointSize * font.resolutionX) / 72;
  if (pixelsPerEm <= 0) return 0;
  return Math.round((dwidth / pixelsPerEm) * 1000);
}

function bitmapRows(box: Box, tight: Box, pixels: boolean[]): string[] {
  const bytesPerRow = Math.ceil(tight.w / 8);
  const rows: string[] = [];
  const startCol = tight.ox - box.ox;
  const startRow = box.oy + box.h - 1 - (tight.oy + tight.h - 1);
  for (let row = 0; row < tight.h; row++) {
    const bytes = new Array(bytesPerRow).fill(0);
    for (let col = 0; col < tight.w; col++) {
      if (!getPixel(box, pixels, startCol + col, startRow + row)) continue;
      bytes[col >> 3] |= 1 << (7 - (col % 8));
    }
    rows.push(
      bytes
        .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
        .join(""),
    );
  }
  return rows;
}

/** Serialize a font back to BDF text. */
export function serializeBDF(font: Font): string {
  const { box } = font;
  const out: string[] = [];
  out.push("STARTFONT 2.1");
  out.push("COMMENT Generated by Pixpix Font Editor");
  out.push(`FONT ${font.name}`);
  out.push(`SIZE ${font.pointSize} ${font.resolutionX} ${font.resolutionY}`);
  out.push(`FONTBOUNDINGBOX ${box.w} ${box.h} ${box.ox} ${box.oy}`);

  const properties: [string, string][] = [
    ...font.properties,
    [
      "PIXEL_SIZE",
      String(Math.round((font.pointSize * font.resolutionY) / 72)),
    ],
    ["POINT_SIZE", String(font.pointSize * 10)],
    ["RESOLUTION_X", String(font.resolutionX)],
    ["RESOLUTION_Y", String(font.resolutionY)],
    ["FONT_ASCENT", String(font.ascent)],
    ["FONT_DESCENT", String(font.descent)],
  ];
  out.push(`STARTPROPERTIES ${properties.length}`);
  for (const [key, value] of properties) out.push(`${key} ${value}`);
  out.push("ENDPROPERTIES");

  out.push(`CHARS ${font.glyphs.length}`);
  for (const glyph of font.glyphs) {
    const tight = tightBox(box, glyph.pixels);
    out.push(`STARTCHAR ${glyph.name}`);
    out.push(`ENCODING ${glyph.code}`);
    out.push(`SWIDTH ${scalableWidth(font, glyph.dwidth)} 0`);
    out.push(`DWIDTH ${glyph.dwidth} 0`);
    if (tight) {
      out.push(`BBX ${tight.w} ${tight.h} ${tight.ox} ${tight.oy}`);
      out.push("BITMAP");
      out.push(...bitmapRows(box, tight, glyph.pixels));
    } else {
      out.push("BBX 0 0 0 0");
      out.push("BITMAP");
    }
    out.push("ENDCHAR");
  }
  out.push("ENDFONT");
  return out.join("\n") + "\n";
}
