/**
 * Fixed 16-color palette shared by every sprite set — the classic CGA/EGA
 * 16-color palette used by 8-bit-era computers. Pixel values are indices
 * into this array; unlike the icon editor's boolean on/off pixels, index 0
 * is a real opaque color (black), not transparency.
 */
export const PALETTE: readonly string[] = [
  "#000000", // black
  "#0000aa", // blue
  "#00aa00", // green
  "#00aaaa", // cyan
  "#aa0000", // red
  "#aa00aa", // magenta
  "#aa5500", // brown
  "#aaaaaa", // light gray
  "#555555", // dark gray
  "#5555ff", // light blue
  "#55ff55", // light green
  "#55ffff", // light cyan
  "#ff5555", // light red
  "#ff55ff", // light magenta
  "#ffff55", // yellow
  "#ffffff", // white
];
