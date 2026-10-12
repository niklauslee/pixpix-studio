/**
 * Image export for a single sprite: SVG (one `<path>` per color, at the
 * sprite's native size) and PNG (scaled by an integer factor, nearest
 * neighbor). `TRANSPARENT` pixels are left out of both, so they come out
 * transparent.
 */

import { toHex, TRANSPARENT } from "./palette";
import type { Box, Sprite } from "./sprite";

export const MIN_PNG_SCALE = 1;
export const MAX_PNG_SCALE = 10;

/** File name stem for a sprite's exports — the name, minus path-hostile characters. */
export function spriteFileName(sprite: Sprite): string {
  return sprite.name.replace(/[^\w.-]+/g, "_") || "sprite";
}

/**
 * SVG for one sprite. Each row's horizontal runs of the same color become one
 * `h`/`v` rectangle in that color's path, which keeps the output small for
 * typical sprites with large flat areas.
 */
export function generateSpriteSVG(box: Box, sprite: Sprite): string {
  const runs = new Map<number, string[]>();
  for (let row = 0; row < box.h; row++) {
    let col = 0;
    while (col < box.w) {
      const color = sprite.pixels[row * box.w + col] ?? TRANSPARENT;
      let end = col + 1;
      while (end < box.w && sprite.pixels[row * box.w + end] === color) end++;
      if (color !== TRANSPARENT) {
        const list = runs.get(color) ?? [];
        list.push(`M${col} ${row}h${end - col}v1h-${end - col}z`);
        runs.set(color, list);
      }
      col = end;
    }
  }
  const paths = [...runs].map(
    ([color, list]) => `  <path fill="${toHex(color)}" d="${list.join("")}"/>`,
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="0 0 ${box.w} ${box.h}" shape-rendering="crispEdges">`,
    ...paths,
    `</svg>`,
    "",
  ].join("\n");
}

/** PNG for one sprite, each sprite pixel drawn as a `scale`×`scale` block. */
export function generateSpritePNG(
  box: Box,
  sprite: Sprite,
  scale: number,
): Promise<Blob> {
  const factor = Math.max(MIN_PNG_SCALE, Math.min(MAX_PNG_SCALE, Math.round(scale)));
  const canvas = document.createElement("canvas");
  canvas.width = box.w * factor;
  canvas.height = box.h * factor;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2D context unavailable"));
  // a fresh canvas is fully transparent, so only opaque pixels are drawn
  for (let row = 0; row < box.h; row++) {
    for (let col = 0; col < box.w; col++) {
      const color = sprite.pixels[row * box.w + col] ?? TRANSPARENT;
      if (color === TRANSPARENT) continue;
      ctx.fillStyle = toHex(color);
      ctx.fillRect(col * factor, row * factor, factor, factor);
    }
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encoding failed"));
    }, "image/png");
  });
}
