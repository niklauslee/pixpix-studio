import { useEffect } from "react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GLYPH_RANGES } from "@/lib/charsets";

export interface ImportTtfDialogState {
  open: boolean;
  file: File | null;
  pixelSize: number;
  /** Design grid of a pixel font, once detected — null for outline fonts. */
  nativeSize: number | null;
  selected: Set<string>;
  setOpen: (open: boolean) => void;
  setPixelSize: (pixelSize: number) => void;
  setNativeSize: (nativeSize: number | null) => void;
  toggleRange: (id: string, on: boolean) => void;
  show: (file: File) => void;
}

export const useImportTtfDialog = create<ImportTtfDialogState>()((set) => ({
  open: false,
  file: null,
  pixelSize: 13,
  nativeSize: null,
  selected: new Set(),
  setOpen: (open) => set({ open }),
  setPixelSize: (pixelSize) => set({ pixelSize }),
  setNativeSize: (nativeSize) =>
    set(nativeSize ? { nativeSize, pixelSize: nativeSize } : { nativeSize }),
  toggleRange: (id, on) =>
    set((state) => {
      const selected = new Set(state.selected);
      if (on) selected.add(id);
      else selected.delete(id);
      return { selected };
    }),
  show: (file) =>
    set({
      open: true,
      file,
      pixelSize: 13,
      nativeSize: null,
      selected: new Set(),
    }),
}));

export function ImportTtfDialog({
  onImport,
}: {
  onImport: (file: File, pixelSize: number, selected: Set<string>) => void;
}) {
  const {
    open,
    file,
    pixelSize,
    nativeSize,
    selected,
    setOpen,
    setPixelSize,
    setNativeSize,
    toggleRange,
  } = useImportTtfDialog();

  // a pixel font only survives rasterization at its own design grid, so detect
  // it and make that the default size
  useEffect(() => {
    if (!file) return;
    let stale = false;
    (async () => {
      try {
        const { detectNativePixelSize } = await import(
          "@/apps/font-editor/ttf-import"
        );
        const detected = detectNativePixelSize(await file.arrayBuffer());
        if (!stale) setNativeSize(detected);
      } catch (error) {
        console.error("Failed to inspect the font:", error);
      }
    })();
    return () => {
      stale = true;
    };
  }, [file, setNativeSize]);

  const offGrid = nativeSize !== null && pixelSize % nativeSize !== 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import {file?.name}</DialogTitle>
          <DialogDescription>
            The outline font is rasterized into a bitmap at the pixel size
            below. Basic Latin is always included — add more glyph ranges as
            needed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label className="group/field flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <span>Pixel size</span>
              <span className="text-muted-foreground">
                {nativeSize
                  ? `Pixel font drawn on a ${nativeSize}px grid — use ${nativeSize} or a multiple of it`
                  : "Glyph height in pixels, roughly ascent + descent"}
              </span>
            </span>
            <Input
              type="number"
              min={4}
              max={128}
              className="w-20 shrink-0"
              value={pixelSize}
              onChange={(event) =>
                setPixelSize(Number(event.target.value) || pixelSize)
              }
            />
          </label>
          {offGrid && (
            <span className="text-xs text-amber-400">
              ⚠ {pixelSize} is not a multiple of {nativeSize} — strokes will
              break up.
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {GLYPH_RANGES.map((range) => (
            <label
              key={range.id}
              className="group/field flex items-start gap-2"
            >
              <Checkbox
                className="mt-0.5"
                checked={range.core || selected.has(range.id)}
                disabled={range.core}
                onCheckedChange={(value) => toggleRange(range.id, value === true)}
              />
              <span className="flex flex-col">
                <span>{range.label}</span>
                <span className="text-muted-foreground">
                  {range.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!file}
            onClick={() => {
              if (file) onImport(file, pixelSize, selected);
              setOpen(false);
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
