/**
 * RGB color helpers, plus the starter swatch list for new sprite sets.
 * Pixels and palette entries are both packed 24-bit RGB integers
 * (`0xRRGGBB`) — unlike the old fixed 16-color CGA/EGA palette, every
 * sprite set now carries its own editable `palette` swatch list (see
 * `sprite.ts`), and any RGB color can be painted whether or not it's in
 * that list.
 */

export function packRGB(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function toHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

export function fromHex(hex: string): number {
  return parseInt(hex.replace("#", ""), 16) & 0xffffff;
}

/** Starter swatches for a new sprite set — the old fixed CGA/EGA palette, now just a default. */
export const DEFAULT_PALETTE: readonly number[] = [
  0x000000, // black
  0x0000aa, // blue
  0x00aa00, // green
  0x00aaaa, // cyan
  0xaa0000, // red
  0xaa00aa, // magenta
  0xaa5500, // brown
  0xaaaaaa, // light gray
  0x555555, // dark gray
  0x5555ff, // light blue
  0x55ff55, // light green
  0x55ffff, // light cyan
  0xff5555, // light red
  0xff55ff, // light magenta
  0xffff55, // yellow
  0xffffff, // white
];
