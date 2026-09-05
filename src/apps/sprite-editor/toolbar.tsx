import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn, detectPlatform } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  EraserIcon,
  FlipHorzIcon,
  FlipVertIcon,
  LineIcon,
  MinusIcon,
  PaintBucketIcon,
  PenIcon,
  PipetteIcon,
  PlusIcon,
  RectangleIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  XIcon,
} from "@/components/icons";
import { toHex, fromHex } from "./palette";
import { findSprite } from "./sprite";
import { clear, flipHorizontal, flipVertical, shift, type Tool } from "./draw";
import { useSpriteStore } from "./sprite-store";

/** An icon component, narrowed to the props the toolbar passes. */
type IconComponent = React.ComponentType<{ className?: string }>;

/**
 * Icon size, as a class rather than the `size` prop: `buttonVariants` styles
 * `svg:not([class*='size-'])` and that CSS wins over the icon's width/height.
 */
const ICON = "size-3.5";

const TOOLS: {
  id: Tool;
  label: string;
  key: string;
  icon: IconComponent;
  /** Extra icon classes — the filled rect reuses the outlined square. */
  iconClassName?: string;
}[] = [
  { id: "pen", label: "Pen", key: "P", icon: PenIcon },
  { id: "eraser", label: "Eraser", key: "E", icon: EraserIcon },
  { id: "line", label: "Line", key: "L", icon: LineIcon },
  { id: "rect", label: "Rect", key: "R", icon: RectangleIcon },
  {
    id: "rect-fill",
    label: "Rect filled",
    key: "Shift+R",
    icon: RectangleIcon,
    iconClassName: "fill-current",
  },
  { id: "fill", label: "Fill", key: "F", icon: PaintBucketIcon },
  { id: "eyedropper", label: "Eyedropper", key: "I", icon: PipetteIcon },
];

const SHIFTS: {
  label: string;
  icon: IconComponent;
  dcol: number;
  drow: number;
}[] = [
  { label: "up", icon: ArrowUpIcon, dcol: 0, drow: -1 },
  { label: "down", icon: ArrowDownIcon, dcol: 0, drow: 1 },
  { label: "left", icon: ArrowLeftIcon, dcol: -1, drow: 0 },
  { label: "right", icon: ArrowRightIcon, dcol: 1, drow: 0 },
];

const isMac = detectPlatform() === "darwin";
const ZOOM_IN_HINT = isMac ? "⌘+" : "Ctrl++";
const ZOOM_OUT_HINT = isMac ? "⌘-" : "Ctrl+-";

export function Toolbar() {
  const project = useSpriteStore((state) => state.project);
  const name = useSpriteStore((state) => state.name);
  const tool = useSpriteStore((state) => state.tool);
  const color = useSpriteStore((state) => state.color);
  const cellSize = useSpriteStore((state) => state.cellSize);
  const showGuides = useSpriteStore((state) => state.showGuides);
  const setTool = useSpriteStore((state) => state.setTool);
  const setColor = useSpriteStore((state) => state.setColor);
  const addPaletteColor = useSpriteStore((state) => state.addPaletteColor);
  const removePaletteColor = useSpriteStore(
    (state) => state.removePaletteColor,
  );
  const setCellSize = useSpriteStore((state) => state.setCellSize);
  const setShowGuides = useSpriteStore((state) => state.setShowGuides);
  const commitPixels = useSpriteStore((state) => state.commitPixels);
  const undo = useSpriteStore((state) => state.undo);
  const redo = useSpriteStore((state) => state.redo);
  const canUndo = useSpriteStore((state) => state.undoStack.length > 0);
  const canRedo = useSpriteStore((state) => state.redoStack.length > 0);

  const sprite = findSprite(project, name);
  const disabled = sprite === null;

  const apply = (transform: (pixels: number[]) => number[]) => {
    if (!sprite) return;
    commitPixels(transform(sprite.pixels));
  };

  return (
    <div className="flex w-full shrink-0 flex-col">
      {/* first row: tools, view controls */}
      <div className="flex min-h-10 w-full flex-wrap items-center gap-3 px-4 pt-2">
        <div className="flex items-center gap-1">
          {TOOLS.map((item) => (
            <Button
              key={item.id}
              size="icon-sm"
              title={`${item.label} ⎯ ${item.key}`}
              variant={tool === item.id ? "default" : "outline"}
              onClick={() => setTool(item.id)}
            >
              <item.icon className={cn(ICON, item.iconClassName)} />
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            title={`Zoom In ⎯ ${ZOOM_IN_HINT}`}
            onClick={() => setCellSize(cellSize + 2)}
          >
            <PlusIcon className={ICON} />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title={`Zoom Out ⎯ ${ZOOM_OUT_HINT}`}
            onClick={() => setCellSize(cellSize - 2)}
          >
            <MinusIcon className={ICON} />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Undo ⎯ Mod+Z"
            disabled={!canUndo}
            onClick={undo}
          >
            <UndoIcon className={ICON} />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Redo ⎯ Mod+Shift+Z"
            disabled={!canRedo}
            onClick={redo}
          >
            <RedoIcon className={ICON} />
          </Button>
        </div>
      </div>

      {/* second row: sprite operations, guides */}
      <div className="flex min-h-10 w-full flex-wrap items-center gap-3 px-4 pb-2">
        <div className="flex items-center gap-1">
          {SHIFTS.map((item) => (
            <Button
              key={item.label}
              size="icon-sm"
              variant="outline"
              title={`Shift the sprite ${item.label}`}
              disabled={disabled}
              onClick={() =>
                apply((pixels) =>
                  shift(project.box, pixels, item.dcol, item.drow),
                )
              }
            >
              <item.icon className={ICON} />
            </Button>
          ))}
        </div>
        <div className="h-6 w-px bg-neutral-700" />
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            title="Flip horizontally ⎯ Shift+H"
            disabled={disabled}
            onClick={() => apply((pixels) => flipHorizontal(project.box, pixels))}
          >
            <FlipHorzIcon className={ICON} />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Flip vertically ⎯ Shift+V"
            disabled={disabled}
            onClick={() => apply((pixels) => flipVertical(project.box, pixels))}
          >
            <FlipVertIcon className={ICON} />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Clear the sprite ⎯ Delete"
            disabled={disabled}
            onClick={() => apply(() => clear(project.box))}
          >
            <TrashIcon className={ICON} />
          </Button>
        </div>
        <Label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={showGuides}
            onCheckedChange={(checked) => setShowGuides(checked)}
          />
          Guides
        </Label>
      </div>

      {/* third row: a color picker plus the project's editable palette swatches */}
      <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 px-4 pb-2">
        <label
          className="relative size-6 shrink-0 cursor-pointer overflow-hidden border-[1.5px] border-neutral-700"
          title={`Custom color ⎯ ${toHex(color)}`}
          style={{ backgroundColor: toHex(color) }}
        >
          <input
            type="color"
            value={toHex(color)}
            onChange={(event) => setColor(fromHex(event.target.value))}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <Button
          size="icon-sm"
          variant="outline"
          title="Add current color to the palette"
          onClick={() => addPaletteColor(color)}
        >
          <PlusIcon className={ICON} />
        </Button>
        <div className="h-6 w-px bg-neutral-700" />
        {project.palette.map((paletteColor) => {
          const hex = toHex(paletteColor);
          return (
            <div key={paletteColor} className="group relative">
              <button
                type="button"
                title={hex}
                className={cn(
                  "size-6 shrink-0 cursor-pointer border-[1.5px]",
                  color === paletteColor
                    ? "border-neutral-100 ring-1 ring-neutral-100"
                    : "border-neutral-700",
                )}
                style={{ backgroundColor: hex }}
                onClick={() => setColor(paletteColor)}
              />
              <button
                type="button"
                title="Remove from palette"
                className="absolute -top-1 -right-1 hidden size-3 cursor-pointer items-center justify-center rounded-full bg-neutral-800 text-neutral-300 group-hover:flex hover:bg-neutral-700 hover:text-neutral-100"
                onClick={(event) => {
                  event.stopPropagation();
                  removePaletteColor(paletteColor);
                }}
              >
                <XIcon className="size-2" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
