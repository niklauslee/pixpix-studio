/** A contiguous Unicode block offered as a glyph range when creating a font. */
export interface GlyphRange {
  id: string;
  label: string;
  description: string;
  start: number;
  end: number;
  /** Always included and not user-toggleable. */
  core?: boolean;
}

export const GLYPH_RANGES: GlyphRange[] = [
  {
    id: "basic-latin",
    label: "Basic Latin",
    description: "A–Z, a–z, digits, punctuation",
    start: 0x20,
    end: 0x7e,
    core: true,
  },
  {
    id: "latin1-supplement",
    label: "Latin-1 Supplement",
    description: "Western European accents (À é ü ñ ç ß) and symbols (© ° ±)",
    start: 0xa0,
    end: 0xff,
  },
  {
    id: "latin-extended-a",
    label: "Latin Extended-A",
    description: "Central/Eastern European (Č Ž Ł Ő Š)",
    start: 0x100,
    end: 0x17f,
  },
  {
    id: "greek",
    label: "Greek",
    description: "Greek and Coptic (Α–Ω, α–ω)",
    start: 0x370,
    end: 0x3ff,
  },
  {
    id: "cyrillic",
    label: "Cyrillic",
    description: "Russian and other Slavic languages (А–Я, а–я)",
    start: 0x400,
    end: 0x4ff,
  },
];

/** Sorted, deduplicated codepoints covered by the given range ids (core ranges are always included). */
export function codepointsForRanges(rangeIds: ReadonlySet<string>): number[] {
  const codes = new Set<number>();
  for (const range of GLYPH_RANGES) {
    if (!range.core && !rangeIds.has(range.id)) continue;
    for (let code = range.start; code <= range.end; code++) codes.add(code);
  }
  return [...codes].sort((a, b) => a - b);
}
