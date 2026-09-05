import { HelpIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextField } from "@/components/ui/text-field";
import { useConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { findGlyph, formatCode } from "./bdf";
import { useFontStore } from "./font-store";

/** A `?` button explaining the field it sits next to. */
const Help: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Popover>
    <PopoverTrigger
      aria-label={`What is ${title}?`}
      className="cursor-pointer text-muted-foreground/60 outline-none hover:text-foreground data-popup-open:text-foreground"
    >
      <HelpIcon size={13} />
    </PopoverTrigger>
    <PopoverContent align="end" side="left" className="w-60">
      <PopoverTitle>{title}</PopoverTitle>
      <PopoverDescription>{children}</PopoverDescription>
    </PopoverContent>
  </Popover>
);

const Row: React.FC<{
  label: string;
  title?: string;
  /** Text shown by the `?` button; omitted for self-explanatory fields. */
  help?: React.ReactNode;
  /** Narrow label column, for fields sitting two to a line. */
  compact?: boolean;
  children: React.ReactNode;
}> = ({ label, title, help, compact, children }) => (
  <div className="flex w-full items-center gap-2">
    <div
      className={cn(
        "flex shrink-0 items-center gap-1",
        compact ? "w-9" : "w-20",
      )}
    >
      <Label className="text-xs" title={title ?? label}>
        {label}
      </Label>
      {help && <Help title={label}>{help}</Help>}
    </div>
    {children}
  </div>
);

function FontProperties() {
  const font = useFontStore((state) => state.font);
  const updateFont = useFontStore((state) => state.updateFont);

  return (
    <div className="flex flex-col gap-2">
      <Row
        label="Name"
        title="BDF FONT name"
        help="Font name written to BDF FONT. Code generation picks the u8g2 font by this name."
      >
        <TextField
          className="h-7"
          value={font.name}
          onChange={(value) => updateFont({ name: value })}
        />
      </Row>
      <Row
        label="Size"
        title="Point size"
        help="Nominal point size (BDF SIZE). Descriptive only — it does not resize the grid."
      >
        <NumberField
          className="h-7"
          value={font.pointSize}
          onChange={(value) => updateFont({ pointSize: value })}
        />
      </Row>
      <Row
        label="Ascent"
        title="FONT_ASCENT — pixels above the baseline"
        help="Pixels above the baseline, the top of a capital letter (BDF FONT_ASCENT). Drawn as a guide line on the editing grid."
      >
        <NumberField
          className="h-7"
          value={font.ascent}
          onChange={(value) => updateFont({ ascent: value })}
        />
      </Row>
      <Row
        label="Descent"
        title="FONT_DESCENT — pixels below the baseline"
        help="Pixels below the baseline, the room for descenders like g and p (BDF FONT_DESCENT)."
      >
        <NumberField
          className="h-7"
          value={font.descent}
          onChange={(value) => updateFont({ descent: value })}
        />
      </Row>
      <div className="mt-2 flex items-center gap-1 text-xs">
        Bounding box
        <Help title="Bounding box">
          One grid shared by every glyph (BDF FONTBOUNDINGBOX). W and H are its
          size in pixels — the columns and rows you can draw in. X off and Y off
          place it relative to the origin (baseline, left edge); Y off is
          normally negative, which puts that many rows below the baseline.
          Resizing re-maps every glyph around the origin, and pixels left
          outside are dropped.
        </Help>
      </div>
      <div className="flex w-full gap-2">
        <Row label="W" title="Bounding box width" compact>
          <NumberField
            className="h-7"
            value={font.box.w}
            onChange={(value) => updateFont({ box: { w: Math.max(1, value) } })}
          />
        </Row>
        <Row label="H" title="Bounding box height" compact>
          <NumberField
            className="h-7"
            value={font.box.h}
            onChange={(value) => updateFont({ box: { h: Math.max(1, value) } })}
          />
        </Row>
      </div>
      <div className="flex w-full gap-2">
        <Row label="X off" title="Bounding box x offset" compact>
          <NumberField
            className="h-7"
            value={font.box.ox}
            onChange={(value) => updateFont({ box: { ox: value } })}
          />
        </Row>
        <Row label="Y off" title="Bounding box y offset" compact>
          <NumberField
            className="h-7"
            value={font.box.oy}
            onChange={(value) => updateFont({ box: { oy: value } })}
          />
        </Row>
      </div>
    </div>
  );
}

function GlyphProperties() {
  const font = useFontStore((state) => state.font);
  const code = useFontStore((state) => state.code);
  const updateGlyph = useFontStore((state) => state.updateGlyph);
  const removeGlyph = useFontStore((state) => state.removeGlyph);
  const glyph = findGlyph(font, code);

  if (!glyph) {
    return (
      <div className="text-xs text-muted-foreground/60">No glyph selected</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Row
        label="Code"
        title="Codepoint"
        help="Unicode codepoint of the selected glyph (BDF ENCODING). Read-only — pick another glyph in the browser on the left."
      >
        <div className="flex h-7 w-full items-center px-1 font-mono text-xs">
          {formatCode(glyph.code)}
          <span className="ml-2 text-muted-foreground">
            {String.fromCodePoint(glyph.code)}
          </span>
        </div>
      </Row>
      <Row
        label="Name"
        title="Glyph name (STARTCHAR)"
        help="Glyph name in the BDF file (BDF STARTCHAR), by convention uniXXXX. Cosmetic — it does not affect rendering."
      >
        <TextField
          className="h-7"
          value={glyph.name}
          onChange={(value) => updateGlyph(glyph.code, { name: value })}
        />
      </Row>
      <Row
        label="Advance"
        title="DWIDTH — advance width in pixels"
        help="How far the cursor moves after this glyph (BDF DWIDTH) — the drawn width plus its spacing to the next character."
      >
        <NumberField
          className="h-7"
          value={glyph.dwidth}
          onChange={(value) =>
            updateGlyph(glyph.code, { dwidth: Math.max(0, value) })
          }
        />
      </Row>
      <div className="mt-1 flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            useConfirmDialog
              .getState()
              .show(
                "Delete Glyph",
                `Delete ${formatCode(glyph.code)} from the font? This cannot be undone.`,
                () => removeGlyph(glyph.code),
              );
          }}
        >
          Delete Glyph
        </Button>
        <Help title="Delete Glyph">
          Removes the glyph from the font. Structural edits clear the undo
          stack, so this cannot be undone.
        </Help>
      </div>
    </div>
  );
}

interface PropertiesPanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PropertiesPanel({
  className,
  ...others
}: PropertiesPanelProps) {
  return (
    <div
      className={cn("absolute inset-0 flex flex-col", className)}
      {...others}
    >
      <div className="flex h-10 shrink-0 items-center px-4 text-sm">Font</div>
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div className="flex flex-col gap-3 px-4 pb-4">
            <FontProperties />
            <div className="mt-1 border-t-[1.5px] border-neutral-800 pt-3 text-sm">
              Glyph
            </div>
            <GlyphProperties />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
