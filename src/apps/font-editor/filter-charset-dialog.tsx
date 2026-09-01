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
import { GLYPH_RANGES, codepointsForRanges } from "@/lib/charsets";
import { useFontStore } from "./font-store";

export interface FilterCharsetDialogState {
  open: boolean;
  selected: Set<string>;
  setOpen: (open: boolean) => void;
  toggleRange: (id: string, on: boolean) => void;
  show: () => void;
}

export const useFilterCharsetDialog = create<FilterCharsetDialogState>()(
  (set) => ({
    open: false,
    selected: new Set(),
    setOpen: (open) => set({ open }),
    toggleRange: (id, on) =>
      set((state) => {
        const selected = new Set(state.selected);
        if (on) selected.add(id);
        else selected.delete(id);
        return { selected };
      }),
    // Only the core (Basic Latin) range starts checked, even if the font
    // already has glyphs in other ranges — unchecked must mean deleted.
    show: () => set({ open: true, selected: new Set() }),
  }),
);

export function FilterCharsetDialog() {
  const { open, selected, setOpen, toggleRange } = useFilterCharsetDialog();
  const font = useFontStore((state) => state.font);
  const setFont = useFontStore((state) => state.setFont);

  const keep = new Set(codepointsForRanges(selected));
  const removedCount = font.glyphs.filter(
    (glyph) => !keep.has(glyph.code),
  ).length;

  const handleApply = () => {
    const glyphs = font.glyphs.filter((glyph) => keep.has(glyph.code));
    setFont({ ...font, glyphs });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filter Charset</DialogTitle>
          <DialogDescription>
            Keep only the glyphs in the selected ranges and delete the rest.
            Useful after importing a BDF font with far more glyphs than you
            need, to shrink it down.
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
                onCheckedChange={(value) =>
                  toggleRange(range.id, value === true)
                }
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
        <p className="text-xs text-muted-foreground">
          {removedCount > 0
            ? `${removedCount} glyph${removedCount === 1 ? "" : "s"} outside the selected ranges will be deleted.`
            : "No glyphs fall outside the selected ranges."}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={removedCount === 0}
            onClick={handleApply}
          >
            Delete {removedCount > 0 ? removedCount : ""} Glyph
            {removedCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
