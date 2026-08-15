/** Canvas rendering for sprites, shared by the sprite browser and the editing grid. */

import { toHex } from "./palette";
import type { Box, Sprite } from "./sprite";

/** Prepare a canvas for crisp pixel drawing at the device pixel ratio. */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  // assigning width/height reallocates the backing store, so only do it on a
  // real size change — redraws of a reused canvas are then just a clear + fill
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * Draw a sprite with its top-left corner at `x`, `y`, scaled by `scale`.
 * Unlike the icon editor's `drawIcon` (one caller-supplied fill color for all
 * "on" pixels), every pixel carries its own RGB color.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  box: Box,
  sprite: Sprite,
  x: number,
  y: number,
  scale: number,
) {
  for (let row = 0; row < box.h; row++) {
    for (let col = 0; col < box.w; col++) {
      ctx.fillStyle = toHex(sprite.pixels[row * box.w + col] ?? 0);
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}
