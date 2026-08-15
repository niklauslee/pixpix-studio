/**
 * Bitmap operations on a sprite's pixel array. Every function returns a new
 * array — pixel arrays are treated as immutable so React and the undo stack can
 * compare them by reference. Unlike the icon editor, pixels are packed RGB
 * colors (`0xRRGGBB`) rather than booleans, so every tool takes a `color`
 * parameter instead of an `on` flag.
 */

import { emptyPixels, getPixel, type Box } from "./sprite";

/**
 * `eyedropper` doesn't paint — `sprite-canvas.tsx` intercepts it before it
 * ever reaches the bitmap operations above and reads a pixel's color into
 * the store's `color` instead.
 */
export type Tool =
  | "pen"
  | "eraser"
  | "line"
  | "rect"
  | "rect-fill"
  | "fill"
  | "eyedropper";

export interface Point {
  col: number;
  row: number;
}

function set(box: Box, pixels: number[], point: Point, color: number) {
  const { col, row } = point;
  if (col < 0 || col >= box.w || row < 0 || row >= box.h) return;
  pixels[row * box.w + col] = color;
}

export function setPixel(
  box: Box,
  pixels: number[],
  point: Point,
  color: number,
): number[] {
  const next = [...pixels];
  set(box, next, point, color);
  return next;
}

/** Bresenham line, the same algorithm the editor core uses for Line shapes. */
export function drawLine(
  box: Box,
  pixels: number[],
  from: Point,
  to: Point,
  color: number,
): number[] {
  const next = [...pixels];
  let { col, row } = from;
  const dx = Math.abs(to.col - col);
  const dy = Math.abs(to.row - row);
  const sx = col < to.col ? 1 : -1;
  const sy = row < to.row ? 1 : -1;
  let error = dx - dy;
  while (true) {
    set(box, next, { col, row }, color);
    if (col === to.col && row === to.row) break;
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      col += sx;
    }
    if (doubled < dx) {
      error += dx;
      row += sy;
    }
  }
  return next;
}

export function drawRect(
  box: Box,
  pixels: number[],
  from: Point,
  to: Point,
  color: number,
  fill: boolean,
): number[] {
  const next = [...pixels];
  const left = Math.min(from.col, to.col);
  const right = Math.max(from.col, to.col);
  const top = Math.min(from.row, to.row);
  const bottom = Math.max(from.row, to.row);
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const edge =
        row === top || row === bottom || col === left || col === right;
      if (fill || edge) set(box, next, { col, row }, color);
    }
  }
  return next;
}

/** 4-way flood fill starting at `point`. */
export function floodFill(
  box: Box,
  pixels: number[],
  point: Point,
  color: number,
): number[] {
  const target = getPixel(box, pixels, point.col, point.row);
  if (target === color) return pixels;
  const next = [...pixels];
  const stack: Point[] = [point];
  while (stack.length > 0) {
    const { col, row } = stack.pop()!;
    if (col < 0 || col >= box.w || row < 0 || row >= box.h) continue;
    if (next[row * box.w + col] !== target) continue;
    next[row * box.w + col] = color;
    stack.push(
      { col: col + 1, row },
      { col: col - 1, row },
      { col, row: row + 1 },
      { col, row: row - 1 },
    );
  }
  return next;
}

export function shift(
  box: Box,
  pixels: number[],
  dcol: number,
  drow: number,
): number[] {
  const next = emptyPixels(box);
  for (let row = 0; row < box.h; row++) {
    for (let col = 0; col < box.w; col++) {
      next[row * box.w + col] = getPixel(box, pixels, col - dcol, row - drow);
    }
  }
  return next;
}

export function flipHorizontal(box: Box, pixels: number[]): number[] {
  const next = emptyPixels(box);
  for (let row = 0; row < box.h; row++) {
    for (let col = 0; col < box.w; col++) {
      next[row * box.w + col] = getPixel(box, pixels, box.w - 1 - col, row);
    }
  }
  return next;
}

export function flipVertical(box: Box, pixels: number[]): number[] {
  const next = emptyPixels(box);
  for (let row = 0; row < box.h; row++) {
    for (let col = 0; col < box.w; col++) {
      next[row * box.w + col] = getPixel(box, pixels, col, box.h - 1 - row);
    }
  }
  return next;
}

export function clear(box: Box): number[] {
  return emptyPixels(box);
}
