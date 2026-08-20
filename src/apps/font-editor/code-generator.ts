/**
 * Generates font C code for two embedded targets, straight from the in-memory
 * `Font` model (see `bdf.ts`):
 *
 * - **u8g2**: a byte array in u8g2's native compressed glyph format (the
 *   format `bdfconv` produces), usable with `u8g2.setFont()` / `u8g2_SetFont`.
 * - **Adafruit GFX**: a `GFXfont` (bitmap + glyph table), usable with
 *   `display.setFont()`.
 *
 * Both formats are re-implemented here from the reference decoders
 * (u8g2's `u8g2_font.c`, Adafruit's `fontconvert.c`) rather than ported from
 * `bdfconv` — the encoding chosen is simple and correct, not necessarily as
 * size-optimal as the original tools.
 */

import {
  findGlyph,
  getPixel,
  tightBox,
  type Box,
  type Font,
  type Glyph,
} from "./bdf";

export interface GeneratedCode {
  code: string;
  warnings: string[];
}

function toIdentifier(name: string, fallback: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, "_");
  const prefixed = /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  return prefixed || fallback;
}

export function defaultU8g2Identifier(font: Font): string {
  return `u8g2_font_${toIdentifier(font.name, "myfont").toLowerCase()}`;
}

export function defaultGfxIdentifier(font: Font): string {
  return toIdentifier(font.name, "MyFont");
}

function toByte(value: number): number {
  return value & 0xff;
}

function hex(value: number): string {
  return `0x${toByte(value).toString(16).padStart(2, "0")}`;
}

function chunkedHex(bytes: number[], perLine = 16): string[] {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += perLine) {
    lines.push(
      bytes
        .slice(i, i + perLine)
        .map(hex)
        .join(", ") + ",",
    );
  }
  return lines;
}

/** A glyph's tight bitmap, extracted from the font's shared box frame. */
interface GlyphBox {
  code: number;
  width: number;
  height: number;
  /** BBX-style offset from the origin (baseline, left edge). */
  ox: number;
  oy: number;
  dwidth: number;
  /** Row-major, top-down, length `width * height`; empty when the glyph is blank. */
  bits: boolean[];
}

function toGlyphBox(box: Box, glyph: Glyph): GlyphBox {
  const tight = tightBox(box, glyph.pixels);
  if (!tight) {
    return {
      code: glyph.code,
      width: 0,
      height: 0,
      ox: 0,
      oy: 0,
      dwidth: glyph.dwidth,
      bits: [],
    };
  }
  const bits: boolean[] = new Array(tight.w * tight.h);
  const startCol = tight.ox - box.ox;
  const startRow = box.oy + box.h - 1 - (tight.oy + tight.h - 1);
  for (let row = 0; row < tight.h; row++) {
    for (let col = 0; col < tight.w; col++) {
      bits[row * tight.w + col] = getPixel(
        box,
        glyph.pixels,
        startCol + col,
        startRow + row,
      );
    }
  }
  return {
    code: glyph.code,
    width: tight.w,
    height: tight.h,
    ox: tight.ox,
    oy: tight.oy,
    dwidth: glyph.dwidth,
    bits,
  };
}

// ---------------------------------------------------------------------------
// u8g2
// ---------------------------------------------------------------------------

/**
 * u8g2 packs bit fields LSB-first: each field's lowest bit lands at the
 * current bit cursor, continuing into the next byte on overflow. Signed
 * fields are stored biased by `2^(bits-1)` (see `u8g2_font_decode_get_signed_bits`).
 */
class LsbBitWriter {
  private bytes: number[] = [];
  private current = 0;
  private bitPos = 0;

  writeUnsigned(value: number, bits: number) {
    for (let i = 0; i < bits; i++) {
      const bit = (value >>> i) & 1;
      this.current |= bit << this.bitPos;
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bytes.push(this.current);
        this.current = 0;
        this.bitPos = 0;
      }
    }
  }

  writeSigned(value: number, bits: number) {
    this.writeUnsigned(value + (1 << (bits - 1)), bits);
  }

  toBytes(): number[] {
    if (this.bitPos > 0) {
      this.bytes.push(this.current);
      this.current = 0;
      this.bitPos = 0;
    }
    return this.bytes;
  }
}

/** Alternating run lengths, always starting with a (possibly zero-length) off-run. */
function computeRuns(bits: boolean[]): number[] {
  const runs: number[] = [];
  let current = false;
  let length = 0;
  for (const bit of bits) {
    if (bit === current) {
      length++;
    } else {
      runs.push(length);
      current = bit;
      length = 1;
    }
  }
  runs.push(length);
  return runs;
}

function unsignedBitsNeeded(max: number): number {
  let bits = 1;
  while (bits < 8 && (1 << bits) - 1 < max) bits++;
  return bits;
}

function signedBitsNeeded(min: number, max: number): number {
  let bits = 1;
  while (bits < 8) {
    const lo = -(1 << (bits - 1));
    const hi = (1 << (bits - 1)) - 1;
    if (min >= lo && max <= hi) break;
    bits++;
  }
  return bits;
}

function maxRunLength(glyphs: GlyphBox[], parity: 0 | 1): number {
  let max = 0;
  for (const g of glyphs) {
    if (g.width === 0) continue;
    const runs = computeRuns(g.bits);
    for (let i = parity; i < runs.length; i += 2)
      if (runs[i] > max) max = runs[i];
  }
  return max;
}

interface U8g2Widths {
  width: number;
  height: number;
  x: number;
  y: number;
  d: number;
  zero: number;
  one: number;
}

function computeU8g2Widths(glyphs: GlyphBox[]): U8g2Widths {
  let maxW = 0;
  let maxH = 0;
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let minD = 0;
  let maxD = 0;
  for (const g of glyphs) {
    if (g.width > maxW) maxW = g.width;
    if (g.height > maxH) maxH = g.height;
    if (g.width > 0) {
      if (g.ox < minX) minX = g.ox;
      if (g.ox > maxX) maxX = g.ox;
      if (g.oy < minY) minY = g.oy;
      if (g.oy > maxY) maxY = g.oy;
    }
    if (g.dwidth < minD) minD = g.dwidth;
    if (g.dwidth > maxD) maxD = g.dwidth;
  }
  return {
    width: unsignedBitsNeeded(Math.min(maxW, 255)),
    height: unsignedBitsNeeded(Math.min(maxH, 255)),
    x: signedBitsNeeded(minX, maxX),
    y: signedBitsNeeded(minY, maxY),
    d: signedBitsNeeded(minD, maxD),
    zero: unsignedBitsNeeded(Math.min(maxRunLength(glyphs, 0), 255)),
    one: unsignedBitsNeeded(Math.min(maxRunLength(glyphs, 1), 255)),
  };
}

/** Encodes one glyph's header fields plus RLE bitmap, per u8g2_font_decode_glyph(). */
function encodeU8g2Glyph(g: GlyphBox, widths: U8g2Widths): number[] {
  const bw = new LsbBitWriter();
  bw.writeUnsigned(Math.min(g.width, 255), widths.width);
  bw.writeUnsigned(Math.min(g.height, 255), widths.height);
  bw.writeSigned(g.ox, widths.x);
  bw.writeSigned(g.oy, widths.y);
  bw.writeSigned(g.dwidth, widths.d);

  if (g.width > 0) {
    const maxZero = (1 << widths.zero) - 1;
    const maxOne = (1 << widths.one) - 1;
    const runs = computeRuns(g.bits);
    const emit = (zeros: number, ones: number) => {
      bw.writeUnsigned(zeros, widths.zero);
      bw.writeUnsigned(ones, widths.one);
      bw.writeUnsigned(0, 1); // stop bit — never repeat a pair, always emit fresh ones
    };
    for (let i = 0; i < runs.length; i += 2) {
      let zeros = runs[i];
      const ones = runs[i + 1] ?? 0;
      while (zeros > maxZero) {
        emit(maxZero, 0);
        zeros -= maxZero;
      }
      let remainingOnes = ones;
      const firstOnes = Math.min(remainingOnes, maxOne);
      emit(zeros, firstOnes);
      remainingOnes -= firstOnes;
      while (remainingOnes > 0) {
        const chunk = Math.min(remainingOnes, maxOne);
        emit(0, chunk);
        remainingOnes -= chunk;
      }
    }
  }
  return bw.toBytes();
}

/** `[encoding][entrySize][data...]`, terminated by a `[0, 0]` sentinel. */
function buildAsciiSegment(
  glyphs: GlyphBox[],
  widths: U8g2Widths,
  warnings: string[],
): number[] {
  const bytes: number[] = [];
  for (const g of glyphs) {
    const data = encodeU8g2Glyph(g, widths);
    const size = 2 + data.length;
    if (size > 255) {
      warnings.push(
        `Glyph U+${g.code.toString(16)} is too large to encode for u8g2 (${size} bytes) — skipped.`,
      );
      continue;
    }
    bytes.push(toByte(g.code), size, ...data);
  }
  bytes.push(0, 0);
  return bytes;
}

/** A single jump-table block covering every codepoint above 0xFF. */
function buildUnicodeSegment(
  glyphs: GlyphBox[],
  widths: U8g2Widths,
  warnings: string[],
): number[] {
  const entries: number[] = [];
  let maxEncoding = 0xffff;
  if (glyphs.length > 0) {
    maxEncoding = glyphs[glyphs.length - 1].code;
    for (const g of glyphs) {
      const data = encodeU8g2Glyph(g, widths);
      const size = 3 + data.length;
      if (size > 255) {
        warnings.push(
          `Glyph U+${g.code.toString(16)} is too large to encode for u8g2 (${size} bytes) — skipped.`,
        );
        continue;
      }
      entries.push((g.code >> 8) & 0xff, g.code & 0xff, size, ...data);
    }
  }
  entries.push(0, 0); // block terminator
  const header = [0, 4, (maxEncoding >> 8) & 0xff, maxEncoding & 0xff]; // delta=4 (single block)
  return [...header, ...entries];
}

export function generateU8g2Font(
  font: Font,
  identifier: string,
): GeneratedCode {
  const warnings: string[] = [];
  const dropped = font.glyphs.filter((g) => g.code > 0xffff);
  if (dropped.length > 0) {
    warnings.push(
      `${dropped.length} glyph(s) above U+FFFF are not representable in u8g2's 16-bit encoding and were omitted.`,
    );
  }

  const inRange = font.glyphs.filter((g) => g.code <= 0xffff);
  const allBoxes = inRange.map((g) => toGlyphBox(font.box, g));
  const oversized = allBoxes.filter((g) => g.width > 255 || g.height > 255);
  if (oversized.length > 0) {
    warnings.push(
      `${oversized.length} glyph(s) exceed u8g2's 255x255 per-glyph size limit and were omitted.`,
    );
  }
  const glyphs = allBoxes.filter((g) => g.width <= 255 && g.height <= 255);
  const widths = computeU8g2Widths(glyphs);

  const below = glyphs.filter((g) => g.code < 0x41);
  const upper = glyphs.filter((g) => g.code >= 0x41 && g.code < 0x61);
  const lower = glyphs.filter((g) => g.code >= 0x61 && g.code <= 0xff);
  const unicode = glyphs.filter((g) => g.code > 0xff);

  const belowBytes = buildAsciiSegment(below, widths, warnings);
  const upperBytes = buildAsciiSegment(upper, widths, warnings);
  const lowerBytes = buildAsciiSegment(lower, widths, warnings);
  const unicodeBytes = buildUnicodeSegment(unicode, widths, warnings);

  const startUpperA = belowBytes.length;
  const startLowerA = startUpperA + upperBytes.length;
  const startUnicode = startLowerA + lowerBytes.length;
  // Only these three header offsets are 16-bit-limited — everything past them (including the
  // whole unicode segment) is walked one glyph at a time via single-byte entry sizes, so the
  // total blob size itself is unbounded.
  if (startUnicode > 0xffff) {
    warnings.push(
      "The Basic Latin / Latin-1 glyph tables exceed 64KB — u8g2's 16-bit segment offsets will overflow. Trim the glyph set.",
    );
  }

  const maxCharWidth = glyphs.reduce((max, g) => Math.max(max, g.width), 0);
  const maxCharHeight = glyphs.reduce((max, g) => Math.max(max, g.height), 0);

  const header = new Array(23).fill(0);
  header[0] = Math.min(glyphs.length, 0xff);
  header[1] = 0; // bbx_mode: proportional
  header[2] = widths.zero;
  header[3] = widths.one;
  header[4] = widths.width;
  header[5] = widths.height;
  header[6] = widths.x;
  header[7] = widths.y;
  header[8] = widths.d;
  header[9] = toByte(maxCharWidth);
  header[10] = toByte(maxCharHeight);
  header[11] = toByte(font.box.ox);
  header[12] = toByte(font.box.oy);
  header[13] = toByte(font.ascent);
  header[14] = toByte(-font.descent);
  header[15] = toByte(font.ascent);
  header[16] = toByte(-font.descent);
  header[17] = (startUpperA >> 8) & 0xff;
  header[18] = startUpperA & 0xff;
  header[19] = (startLowerA >> 8) & 0xff;
  header[20] = startLowerA & 0xff;
  header[21] = (startUnicode >> 8) & 0xff;
  header[22] = startUnicode & 0xff;

  const bytes = [
    ...header,
    ...belowBytes,
    ...upperBytes,
    ...lowerBytes,
    ...unicodeBytes,
  ];

  const lines = [
    `// u8g2 font generated by Pixpix Font Editor from "${font.name}"`,
    `// ${glyphs.length} glyphs, ${bytes.length} bytes`,
    "//",
    `// Usage:`,
    `//   u8g2.setFont(${identifier});           // Arduino (C++)`,
    `//   u8g2_SetFont(&u8g2, ${identifier});     // C`,
    `const uint8_t ${identifier}[] U8X8_FONT_SECTION("${identifier}") = {`,
    ...chunkedHex(bytes).map((line) => `  ${line}`),
    "};",
  ];
  return { code: lines.join("\n"), warnings };
}

// ---------------------------------------------------------------------------
// Adafruit GFX
// ---------------------------------------------------------------------------

/** Adafruit packs bits MSB-first, continuously across rows, byte-padded per glyph. */
class MsbBitWriter {
  private bytes: number[] = [];
  private current = 0;
  private count = 0;

  writeBit(bit: boolean) {
    this.current = (this.current << 1) | (bit ? 1 : 0);
    this.count++;
    if (this.count === 8) {
      this.bytes.push(this.current);
      this.current = 0;
      this.count = 0;
    }
  }

  toBytes(): number[] {
    if (this.count > 0) {
      this.bytes.push(this.current << (8 - this.count));
      this.current = 0;
      this.count = 0;
    }
    return this.bytes;
  }
}

interface GfxGlyphEntry {
  code: number;
  offset: number;
  width: number;
  height: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
}

const GFX_GAP_WARNING_THRESHOLD = 2000;

export function generateAdafruitGfxFont(
  font: Font,
  identifier: string,
  useProgmem: boolean,
): GeneratedCode {
  const warnings: string[] = [];
  const codes = font.glyphs.map((g) => g.code).filter((c) => c <= 0xffff);
  const dropped = font.glyphs.length - codes.length;
  if (dropped > 0) {
    warnings.push(
      `${dropped} glyph(s) above U+FFFF are not representable in Adafruit GFX's 16-bit range and were omitted.`,
    );
  }
  if (codes.length === 0) {
    return {
      code: "// No glyphs to export.",
      warnings: ["Font has no glyphs."],
    };
  }

  const first = Math.min(...codes);
  const last = Math.max(...codes);
  const span = last - first + 1;
  const gaps = span - codes.length;
  if (gaps > 0) {
    warnings.push(
      `Adafruit GFX fonts cover one contiguous range (U+${first.toString(16)}–U+${last.toString(16)}, ` +
        `${span} codepoints) — ${gaps} missing glyph(s) in that span were filled with blanks.` +
        (span > GFX_GAP_WARNING_THRESHOLD
          ? " That's a very large range for a sparse font; consider exporting a smaller, contiguous glyph set."
          : ""),
    );
  }

  const bitmap: number[] = [];
  const entries: GfxGlyphEntry[] = [];
  let oversized = 0;
  for (let code = first; code <= last; code++) {
    const glyph = findGlyph(font, code);
    const offset = bitmap.length;
    if (!glyph) {
      entries.push({
        code,
        offset,
        width: 0,
        height: 0,
        xAdvance: 0,
        xOffset: 0,
        yOffset: 0,
      });
      continue;
    }
    const g = toGlyphBox(font.box, glyph);
    if (g.width === 0 || g.height === 0) {
      entries.push({
        code,
        offset,
        width: 0,
        height: 0,
        xAdvance: g.dwidth,
        xOffset: 0,
        yOffset: 0,
      });
      continue;
    }
    if (g.width > 255 || g.height > 255) {
      oversized++;
      entries.push({
        code,
        offset,
        width: 0,
        height: 0,
        xAdvance: g.dwidth,
        xOffset: 0,
        yOffset: 0,
      });
      continue;
    }
    const bw = new MsbBitWriter();
    for (const bit of g.bits) bw.writeBit(bit);
    bitmap.push(...bw.toBytes());
    entries.push({
      code,
      offset,
      width: g.width,
      height: g.height,
      xAdvance: g.dwidth,
      xOffset: g.ox,
      yOffset: 1 - (g.oy + g.height),
    });
  }

  if (oversized > 0) {
    warnings.push(
      `${oversized} glyph(s) exceed Adafruit GFX's 255x255 per-glyph size limit and were omitted.`,
    );
  }
  if (bitmap.length > 0xffff) {
    warnings.push(
      "Bitmap data exceeds 64KB — GFXglyph's 16-bit bitmapOffset will overflow. Trim the glyph set.",
    );
  }

  const yAdvance = Math.max(1, font.ascent + font.descent);
  const progmem = useProgmem ? " PROGMEM" : "";

  const lines = [
    `// Adafruit GFX font generated by Pixpix Font Editor from "${font.name}"`,
    `// ${entries.length} glyphs (U+${first.toString(16)}–U+${last.toString(16)}), ${bitmap.length} bitmap bytes`,
    "//",
    "// Usage:",
    `//   display.setFont(&${identifier});`,
    "",
    `const uint8_t ${identifier}Bitmaps[]${progmem} = {`,
    ...chunkedHex(bitmap).map((line) => `  ${line}`),
    "};",
    "",
    `const GFXglyph ${identifier}Glyphs[]${progmem} = {`,
    ...entries.map((e) => {
      const label =
        e.code >= 0x20 && e.code < 0x7f
          ? ` // '${String.fromCharCode(e.code)}'`
          : ` // U+${e.code.toString(16).padStart(4, "0")}`;
      return `  { ${e.offset}, ${e.width}, ${e.height}, ${e.xAdvance}, ${e.xOffset}, ${e.yOffset} },${label}`;
    }),
    "};",
    "",
    `const GFXfont ${identifier} PROGMEM = {`,
    `  (uint8_t *)${identifier}Bitmaps, (GFXglyph *)${identifier}Glyphs,`,
    `  0x${first.toString(16).padStart(2, "0")}, 0x${last.toString(16).padStart(2, "0")}, ${yAdvance}`,
    "};",
  ];
  return { code: lines.join("\n"), warnings };
}
