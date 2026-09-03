import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCode, type Font, type Glyph } from "./bdf";
import { useFontStore } from "./font-store";
import { drawGlyph, setupCanvas } from "./render";

const THUMB_SIZE = 26;

/** Glyphs per page — the list is paged so huge fonts stay cheap to render. */
const PAGE_SIZE = 256;

/**
 * Parse a codepoint written as a character (`A`), hex (`U+41`, `0x41`) or a
 * decimal number (`65`).
 */
export function parseCodepoint(text: string): number | null {
  const value = text.trim();
  if (value.length === 0) return null;
  const hex = value.match(/^(?:U\+|u\+|0x|0X)([0-9a-fA-F]+)$/);
  if (hex) return parseInt(hex[1], 16);
  if (/^\d+$/.test(value)) return Number(value);
  const chars = [...value];
  if (chars.length === 1) return chars[0].codePointAt(0)!;
  return null;
}

/**
 * Short label identifying a codepoint: the character itself, or its hex code
 * when it has no printable form.
 */
function charLabel(code: number): string {
  if (code === 0x20) return "SP";
  if (code < 0x21 || (code >= 0x7f && code <= 0xa0)) {
    return code.toString(16).toUpperCase().padStart(2, "0");
  }
  return String.fromCodePoint(code);
}

function matches(glyph: Glyph, filter: string): boolean {
  const value = filter.trim();
  if (value.length === 0) return true;
  if (glyph.name.toLowerCase().includes(value.toLowerCase())) return true;
  if (formatCode(glyph.code).includes(value.toUpperCase())) return true;
  return parseCodepoint(value) === glyph.code;
}

function GlyphThumb({
  font,
  glyph,
  color,
  size = THUMB_SIZE,
}: {
  font: Font;
  glyph: Glyph;
  color: string;
  /** Largest thumbnail edge in screen pixels. */
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { box } = font;
  const scale = Math.max(1, Math.floor(size / Math.max(box.w, box.h)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, box.w * scale, box.h * scale);
    if (!ctx) return;
    ctx.fillStyle = color;
    drawGlyph(
      ctx,
      font,
      glyph,
      -box.ox * scale,
      (box.oy + box.h) * scale,
      scale,
    );
  }, [font, glyph, scale, color, box.w, box.h, box.ox, box.oy]);

  // the layout size is set here, not just in the effect: a freshly mounted
  // canvas would otherwise paint once at its default 300x150
  return (
    <canvas
      ref={canvasRef}
      style={{ width: box.w * scale, height: box.h * scale }}
    />
  );
}

interface GlyphListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function GlyphList({ className, ...others }: GlyphListProps) {
  const font = useFontStore((state) => state.font);
  const code = useFontStore((state) => state.code);
  const filter = useFontStore((state) => state.filter);
  const setFilter = useFontStore((state) => state.setFilter);
  const selectCode = useFontStore((state) => state.selectCode);
  const addGlyph = useFontStore((state) => state.addGlyph);

  const filtered = useMemo(
    () => font.glyphs.filter((glyph) => matches(glyph, filter)),
    [font.glyphs, filter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const [requested, setRequested] = useState(0);
  const page = Math.min(requested, pageCount - 1);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // follow the selection onto its page when it is picked from outside the list
  const selectedIndex = filtered.findIndex((glyph) => glyph.code === code);
  useEffect(() => {
    if (selectedIndex >= 0) setRequested(Math.floor(selectedIndex / PAGE_SIZE));
  }, [selectedIndex]);

  const handleAdd = () => {
    const value = parseCodepoint(filter);
    if (value === null || value < 0) return;
    addGlyph(value);
    setFilter("");
  };

  return (
    <div
      className={cn("absolute inset-0 flex flex-col", className)}
      {...others}
    >
      <div className="flex h-10 shrink-0 items-center justify-between px-4 text-sm">
        <div>Glyphs</div>
        <div className="text-xs text-muted-foreground">
          {font.glyphs.length}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 px-4 pb-2">
        <Input
          value={filter}
          placeholder="char or U+XXXX"
          className="h-7"
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (filtered.length === 1) selectCode(filtered[0].code);
              else handleAdd();
            }
          }}
        />
        <Button
          variant="outline"
          size="icon-sm"
          title="Add a glyph for the searched codepoint"
          disabled={parseCodepoint(filter) === null}
          onClick={handleAdd}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div className="grid grid-cols-8 gap-2 px-3 pb-3">
            {visible.map((glyph, index) => {
              const selected = glyph.code === code;
              return (
                // keyed by cell position, not codepoint: paging then redraws the
                // existing canvases instead of allocating a page worth of new ones
                <button
                  key={index}
                  title={`${formatCode(glyph.code)} ${glyph.name}`}
                  className="flex min-w-0 cursor-pointer flex-col items-center gap-0.5"
                  onClick={() => selectCode(glyph.code)}
                >
                  <div
                    className={cn(
                      "flex aspect-square w-full items-center justify-center overflow-hidden border-[1.5px] border-neutral-800 hover:bg-neutral-800",
                      selected && "border-neutral-100 bg-neutral-100",
                    )}
                  >
                    <GlyphThumb
                      font={font}
                      glyph={glyph}
                      color={selected ? "#000000" : "#f5f5f5"}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-xs leading-none",
                      selected ? "text-neutral-100" : "text-muted-foreground",
                    )}
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {charLabel(glyph.code)}
                  </span>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground/60">
              No glyphs
            </div>
          )}
        </ScrollArea>
      </div>
      {pageCount > 1 && (
        <div className="flex h-8 shrink-0 items-center justify-between gap-1 border-t-[1.5px] border-neutral-800 px-3">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Previous page"
            disabled={page === 0}
            onClick={() => setRequested(page - 1)}
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <div className="font-mono text-[10px] text-muted-foreground">
            {visible.length > 0 && (
              <>
                {formatCode(visible[0].code)} –{" "}
                {formatCode(visible[visible.length - 1].code)}
              </>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {page + 1} / {pageCount}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => setRequested(page + 1)}
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
