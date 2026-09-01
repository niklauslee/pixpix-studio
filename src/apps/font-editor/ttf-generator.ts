/**
 * Generates a TrueType (.ttf) file from the BDF font model. Each glyph's
 * pixel bitmap is traced into vector contours (one square per pixel merged
 * into clean outlines, holes wound oppositely), assembled into an in-memory
 * SVG font, and converted to real glyf outlines with `svg2ttf`.
 *
 * The em square maps to `ascent + descent` pixels at 64 font units per
 * pixel, so all outline coordinates and advances stay integral.
 */

import svg2ttf from "svg2ttf";
import {
  defaultGlyphName,
  fontFamily,
  getPixel,
  type Box,
  type Font,
} from "./bdf";

/** Font units per pixel. */
const S = 64;

type Point = [number, number];

/**
 * Trace the boundary of a glyph bitmap into closed contours of grid-vertex
 * coordinates (vx in 0..w, vy in 0..h, y pointing down like editor rows).
 *
 * Boundary edges are emitted per filled pixel, directed so the filled side
 * is on the walker's left; linking them into loops therefore yields outer
 * contours and holes with opposite windings, no fixup pass needed. At a
 * checkerboard vertex (two diagonally touching pixels) the left turn is
 * preferred so each contour stays on its own pixel and never self-intersects.
 */
function traceContours(box: Box, pixels: boolean[]): Point[][] {
  interface Edge {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    used: boolean;
  }
  const stride = box.w + 1;
  const edgesByStart = new Map<number, Edge[]>();
  const edges: Edge[] = [];
  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const edge = { x1, y1, x2, y2, used: false };
    edges.push(edge);
    const key = y1 * stride + x1;
    const list = edgesByStart.get(key);
    if (list) list.push(edge);
    else edgesByStart.set(key, [edge]);
  };

  for (let r = 0; r < box.h; r++) {
    for (let c = 0; c < box.w; c++) {
      if (!getPixel(box, pixels, c, r)) continue;
      if (!getPixel(box, pixels, c, r + 1)) addEdge(c, r + 1, c + 1, r + 1);
      if (!getPixel(box, pixels, c, r - 1)) addEdge(c + 1, r, c, r);
      if (!getPixel(box, pixels, c - 1, r)) addEdge(c, r, c, r + 1);
      if (!getPixel(box, pixels, c + 1, r)) addEdge(c + 1, r + 1, c + 1, r);
    }
  }

  const contours: Point[][] = [];
  for (const start of edges) {
    if (start.used) continue;
    const loop: Point[] = [];
    const startKey = start.y1 * stride + start.x1;
    let edge = start;
    for (;;) {
      edge.used = true;
      loop.push([edge.x1, edge.y1]);
      const endKey = edge.y2 * stride + edge.x2;
      if (endKey === startKey) break;
      const candidates = edgesByStart
        .get(endKey)!
        .filter((next) => !next.used);
      let next = candidates[0];
      if (candidates.length > 1) {
        // left turn relative to the incoming direction (dx, dy) -> (dy, -dx)
        const dx = edge.y2 - edge.y1;
        const dy = edge.x1 - edge.x2;
        next =
          candidates.find(
            (c) => c.x2 - c.x1 === dx && c.y2 - c.y1 === dy,
          ) ?? next;
      }
      edge = next;
    }

    // drop collinear intermediate vertices
    const n = loop.length;
    const compact = loop.filter(([x, y], i) => {
      const [px, py] = loop[(i + n - 1) % n];
      const [nx, ny] = loop[(i + 1) % n];
      return (x - px) * (ny - y) !== (y - py) * (nx - x);
    });
    contours.push(compact);
  }
  return contours;
}

/** SVG path data for one glyph, in y-up font units off the baseline. */
function glyphPath(box: Box, pixels: boolean[]): string {
  return traceContours(box, pixels)
    .map((contour) => {
      const points = contour
        .map(
          ([vx, vy]) =>
            `${(box.ox + vx) * S} ${(box.oy + (box.h - vy)) * S}`,
        )
        .join("L");
      return `M${points}Z`;
    })
    .join("");
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Assemble the font as an in-memory SVG font document. */
export function generateSVGFont(font: Font): string {
  const emPixels =
    font.ascent + font.descent > 0 ? font.ascent + font.descent : font.box.h;
  const defaultAdvance = Math.max(0, font.box.w + font.box.ox) * S;
  const family = escapeXML(fontFamily(font));

  const seen = new Set<number>();
  const glyphs: string[] = [];
  for (const glyph of font.glyphs) {
    if (glyph.code < 0 || seen.has(glyph.code)) continue;
    seen.add(glyph.code);
    const name = /^[A-Za-z0-9._]+$/.test(glyph.name)
      ? glyph.name
      : defaultGlyphName(glyph.code);
    // svg2ttf requires a `d` attribute; an empty one is a valid blank glyph
    const d = glyphPath(font.box, glyph.pixels);
    glyphs.push(
      `<glyph glyph-name="${name}" unicode="&#x${glyph.code.toString(16)};"` +
        ` horiz-adv-x="${glyph.dwidth * S}" d="${d}"/>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"><defs>`,
    `<font horiz-adv-x="${defaultAdvance}">`,
    `<font-face font-family="${family}" units-per-em="${emPixels * S}"` +
      ` ascent="${font.ascent * S}" descent="${-font.descent * S}"/>`,
    `<missing-glyph horiz-adv-x="${defaultAdvance}"/>`,
    ...glyphs,
    `</font>`,
    `</defs></svg>`,
  ].join("\n");
}

/** The font as TrueType file bytes. */
export function generateTTF(font: Font): Uint8Array<ArrayBuffer> {
  return new Uint8Array(svg2ttf(generateSVGFont(font), { version: "1.0" }).buffer);
}
