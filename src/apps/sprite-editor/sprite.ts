/**
 * Sprite set model. Every sprite in a set shares one fixed pixel box, same as
 * the icon editor's `IconSet` — but each pixel is a packed 24-bit RGB color
 * (`0xRRGGBB`, see `palette.ts`) instead of a boolean.
 */

import { DEFAULT_PALETTE } from "./palette";

export interface Box {
  w: number;
  h: number;
}

export interface Sprite {
  name: string;
  /** Row-major RGB (`0xRRGGBB`) bitmap in the set's box frame, length = `box.w * box.h`. */
  pixels: number[];
}

export interface SpriteSet {
  box: Box;
  /** The set's editable swatch list (`0xRRGGBB`), shown in the toolbar — not a constraint on pixel values. */
  palette: number[];
  /** Sprites, in creation/import order. */
  sprites: Sprite[];
}

export function pixelCount(box: Box): number {
  return box.w * box.h;
}

export function emptyPixels(box: Box): number[] {
  return new Array(pixelCount(box)).fill(0);
}

export function getPixel(
  box: Box,
  pixels: number[],
  col: number,
  row: number,
): number {
  if (col < 0 || col >= box.w || row < 0 || row >= box.h) return 0;
  return pixels[row * box.w + col] ?? 0;
}

export function findSprite(project: SpriteSet, name: string): Sprite | null {
  return project.sprites.find((sprite) => sprite.name === name) ?? null;
}

/** First available name of the form `base`, `base_1`, `base_2`, ... */
export function uniqueName(project: SpriteSet, base: string): string {
  if (!findSprite(project, base)) return base;
  let index = 1;
  while (findSprite(project, `${base}_${index}`)) index++;
  return `${base}_${index}`;
}

export function createSprite(box: Box, name: string): Sprite {
  return { name, pixels: emptyPixels(box) };
}

export function createSpriteSet(box: Partial<Box> = {}): SpriteSet {
  return { box: { w: 16, h: 16, ...box }, palette: [...DEFAULT_PALETTE], sprites: [] };
}

/**
 * Copy a bitmap from one box frame into another, top-left anchored. Pixels
 * falling outside the new box are dropped; new cells fill with `0`.
 */
export function remapPixels(from: Box, pixels: number[], to: Box): number[] {
  const result = emptyPixels(to);
  const w = Math.min(from.w, to.w);
  const h = Math.min(from.h, to.h);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      result[row * to.w + col] = getPixel(from, pixels, col, row);
    }
  }
  return result;
}

/** Move every sprite into a new box, top-left anchored. */
export function resizeBox(project: SpriteSet, box: Box): SpriteSet {
  const from = project.box;
  if (box.w === from.w && box.h === from.h) return project;
  const sprites = project.sprites.map((sprite) => ({
    ...sprite,
    pixels: remapPixels(from, sprite.pixels, box),
  }));
  return { ...project, box, sprites };
}

/** Pack a pixel bitmap 3 bytes/pixel (RGB) and base64-encode it for JSON. */
function packPixels(pixels: number[]): string {
  const bytes = new Uint8Array(pixels.length * 3);
  for (let i = 0; i < pixels.length; i++) {
    const color = pixels[i] & 0xffffff;
    bytes[i * 3] = (color >> 16) & 0xff;
    bytes[i * 3 + 1] = (color >> 8) & 0xff;
    bytes[i * 3 + 2] = color & 0xff;
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Reverse of {@link packPixels}, padded/truncated to `count` pixels. */
function unpackPixels(packed: string, count: number): number[] {
  const binary = atob(packed);
  const pixels = new Array<number>(count).fill(0);
  for (let i = 0; i < count; i++) {
    const r = binary.charCodeAt(i * 3);
    if (r !== r) break; // NaN once past the end of `binary`
    const g = binary.charCodeAt(i * 3 + 1) || 0;
    const b = binary.charCodeAt(i * 3 + 2) || 0;
    pixels[i] = (r << 16) | (g << 8) | b;
  }
  return pixels;
}

interface SerializedSprite {
  name: string;
  /** `packPixels` output — kept as a compact base64 string instead of a JSON number array. */
  pixels: string;
}

export function serializeSpriteSet(project: SpriteSet): string {
  const sprites: SerializedSprite[] = project.sprites.map((sprite) => ({
    name: sprite.name,
    pixels: packPixels(sprite.pixels),
  }));
  return JSON.stringify({ box: project.box, palette: project.palette, sprites });
}

/** Parse and validate sprite set JSON. Throws on invalid input. */
export function parseSpriteSet(json: string): SpriteSet {
  const parsed = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Not a valid sprite set file");
  }
  const { box, palette, sprites } = parsed as Record<string, unknown>;
  if (
    typeof box !== "object" ||
    box === null ||
    typeof (box as Box).w !== "number" ||
    typeof (box as Box).h !== "number"
  ) {
    throw new Error("Not a valid sprite set file");
  }
  if (!Array.isArray(sprites)) throw new Error("Not a valid sprite set file");
  const validBox = { w: Math.max(1, (box as Box).w), h: Math.max(1, (box as Box).h) };
  const validPalette = Array.isArray(palette)
    ? palette.filter((value): value is number => typeof value === "number")
    : [];
  const count = pixelCount(validBox);
  const validSprites: Sprite[] = sprites.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as SerializedSprite).name !== "string" ||
      typeof (item as SerializedSprite).pixels !== "string"
    ) {
      throw new Error("Not a valid sprite set file");
    }
    return {
      name: (item as SerializedSprite).name,
      pixels: unpackPixels((item as SerializedSprite).pixels, count),
    };
  });
  return {
    box: validBox,
    palette: validPalette.length > 0 ? validPalette : [...DEFAULT_PALETTE],
    sprites: validSprites,
  };
}
