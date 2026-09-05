import { useEffect } from "react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ImportTtfDialogState {
  open: boolean;
  file: File | null;
  pixelSize: number;
  /** Design grid of a pixel font, once detected — null for outline fonts. */
  nativeSize: number | null;
  setOpen: (open: boolean) => void;
  setPixelSize: (pixelSize: number) => void;
  setNativeSize: (nativeSize: number | null) => void;
  show: (file: File) => void;
}

export const useImportTtfDialog = create<ImportTtfDialogState>()((set) => ({
  open: false,
  file: null,
  pixelSize: 13,
  nativeSize: null,
  setOpen: (open) => set({ open }),
  setPixelSize: (pixelSize) => set({ pixelSize }),
  setNativeSize: (nativeSize) =>
    set(nativeSize ? { nativeSize, pixelSize: nativeSize } : { nativeSize }),
  show: (file) => set({ open: true, file, pixelSize: 13, nativeSize: null }),
}));

export function ImportTtfDialog({
  onImport,
}: {
  onImport: (file: File, pixelSize: number) => void;
}) {
  const {
    open,
    file,
    pixelSize,
    nativeSize,
    setOpen,
    setPixelSize,
    setNativeSize,
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
            Every character in the font is rasterized into a bitmap at the pixel
            size below.
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!file}
            onClick={() => {
              if (file) onImport(file, pixelSize);
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
