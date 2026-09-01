import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GLYPH_RANGES } from "@/lib/charsets";

export interface NewFontDialogState {
  open: boolean;
  selected: Set<string>;
  fillGlyphs: boolean;
  setOpen: (open: boolean) => void;
  toggleRange: (id: string, on: boolean) => void;
  setFillGlyphs: (fillGlyphs: boolean) => void;
  show: () => void;
}

export const useNewFontDialog = create<NewFontDialogState>()((set) => ({
  open: false,
  selected: new Set(),
  fillGlyphs: false,
  setOpen: (open) => set({ open }),
  toggleRange: (id, on) =>
    set((state) => {
      const selected = new Set(state.selected);
      if (on) selected.add(id);
      else selected.delete(id);
      return { selected };
    }),
  setFillGlyphs: (fillGlyphs) => set({ fillGlyphs }),
  show: () => set({ open: true, selected: new Set(), fillGlyphs: false }),
}));

export function NewFontDialog({
  onCreate,
}: {
  onCreate: (selected: Set<string>, fillGlyphs: boolean) => void;
}) {
  const { open, selected, fillGlyphs, setOpen, toggleRange, setFillGlyphs } =
    useNewFontDialog();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Font</DialogTitle>
          <DialogDescription>
            Discards the current font. Basic Latin is always included — add
            more glyph ranges as needed.
          </DialogDescription>
        </DialogHeader>
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
        <label className="group/field flex items-start gap-2 border-t border-neutral-700 pt-3">
          <Checkbox
            className="mt-0.5"
            checked={fillGlyphs}
            onCheckedChange={(value) => setFillGlyphs(value === true)}
          />
          <span className="flex flex-col">
            <span>Fill glyphs from the default font</span>
            <span className="text-muted-foreground">
              Pre-fill new glyphs with shapes from the built-in 6x13 font
              instead of leaving them blank.
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onCreate(selected, fillGlyphs);
              setOpen(false);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
