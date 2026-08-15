import { deflate, inflate } from "pako";

/** Parsed shape of a `SpriteSet` JSON string, without pulling in the sprite editor. */
export interface SpriteSetMeta {
  width: number;
  height: number;
  spriteCount: number;
}

/** Validates and extracts metadata from a sprite set JSON string in one pass. */
export function parseSpriteSetData(data: string): SpriteSetMeta | null {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const { box, sprites } = json as Record<string, unknown>;
  if (typeof box !== "object" || box === null) return null;
  const { w, h } = box as Record<string, unknown>;
  if (typeof w !== "number" || typeof h !== "number") return null;
  if (!Array.isArray(sprites)) return null;
  return { width: w, height: h, spriteCount: sprites.length };
}

/** Compress sprite set JSON for storage in the `spriteSet.data` blob column. */
export function compressSpriteSetData(data: string): Buffer {
  return Buffer.from(deflate(data));
}

/** Decompress the `spriteSet.data` blob column back into sprite set JSON. */
export function decompressSpriteSetData(data: Buffer | Uint8Array): string {
  return new TextDecoder("utf-8").decode(inflate(data));
}
