import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn, detectPlatform } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ContrastIcon,
  EraserIcon,
  FlipHorzIcon,
  FlipVertIcon,
  LineIcon,
  MinusIcon,
  PaintBucketIcon,
  PenIcon,
  PlusIcon,
  RectangleIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
} from "@/components/icons";
import { findIcon } from "./icon";
import {
  clear,
  flipHorizontal,
  flipVertical,
  invert,
  shift,
  type Tool,
} from "./draw";
import { useIconStore } from "./icon-store";

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
  const project = useIconStore((state) => state.project);
  const name = useIconStore((state) => state.name);
  const tool = useIconStore((state) => state.tool);
  const cellSize = useIconStore((state) => state.cellSize);
  const showGuides = useIconStore((state) => state.showGuides);
  const setTool = useIconStore((state) => state.setTool);
  const setCellSize = useIconStore((state) => state.setCellSize);
  const setShowGuides = useIconStore((state) => state.setShowGuides);
  const commitPixels = useIconStore((state) => state.commitPixels);
  const undo = useIconStore((state) => state.undo);
  const redo = useIconStore((state) => state.redo);
  const canUndo = useIconStore((state) => state.undoStack.length > 0);
  const canRedo = useIconStore((state) => state.redoStack.length > 0);

  const icon = findIcon(project, name);
  const disabled = icon === null;

  const apply = (transform: (pixels: boolean[]) => boolean[]) => {
    if (!icon) return;
    commitPixels(transform(icon.pixels));
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

      {/* second row: icon operations, guides */}
      <div className="flex min-h-10 w-full flex-wrap items-center gap-3 px-4 pb-2">
        <div className="flex items-center gap-1">
          {SHIFTS.map((item) => (
            <Button
              key={item.label}
              size="icon-sm"
              variant="outline"
              title={`Shift the icon ${item.label}`}
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
            title="Invert ⎯ I"
            disabled={disabled}
            onClick={() => apply(invert)}
          >
            <ContrastIcon className={ICON} />
          </Button>
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
            title="Clear the icon ⎯ Delete"
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
    </div>
  );
}
