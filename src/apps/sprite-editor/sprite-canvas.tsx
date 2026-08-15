import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toHex } from "./palette";
import { getPixel, type Box, type Sprite } from "./sprite";
import {
  drawLine,
  drawRect,
  floodFill,
  setPixel,
  type Point,
  type Tool,
} from "./draw";
import { useSpriteStore } from "./sprite-store";
import { setupCanvas } from "./render";

/** Space reserved for the column / row rulers. */
const MARGIN = 18;

const COLOR = {
  grid: "#262626",
  gridMajor: "#3f3f46",
  border: "#52525b",
  ruler: "#71717a",
  center: "#3f3f46",
};

interface Stroke {
  start: Point;
  last: Point;
  color: number;
  /** Bitmap the stroke started from, so previews can be recomputed. */
  base: number[];
}

/** Apply a tool to `base`, from the stroke start to `point`. */
function applyTool(
  tool: Tool,
  box: Box,
  stroke: Stroke,
  point: Point,
): number[] {
  switch (tool) {
    case "pen":
    case "eraser":
      return drawLine(box, stroke.base, stroke.last, point, stroke.color);
    case "line":
      return drawLine(box, stroke.base, stroke.start, point, stroke.color);
    case "rect":
      return drawRect(box, stroke.base, stroke.start, point, stroke.color, false);
    case "rect-fill":
      return drawRect(box, stroke.base, stroke.start, point, stroke.color, true);
    case "fill":
      return floodFill(box, stroke.base, point, stroke.color);
    default:
      return stroke.base;
  }
}

function dashed(
  ctx: CanvasRenderingContext2D,
  color: string,
  draw: () => void,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

interface SpriteCanvasProps extends React.HTMLAttributes<HTMLDivElement> {
  sprite: Sprite;
}

export function SpriteCanvas({ sprite, className, ...others }: SpriteCanvasProps) {
  const project = useSpriteStore((state) => state.project);
  const tool = useSpriteStore((state) => state.tool);
  const color = useSpriteStore((state) => state.color);
  const cellSize = useSpriteStore((state) => state.cellSize);
  const showGuides = useSpriteStore((state) => state.showGuides);
  const commitPixels = useSpriteStore((state) => state.commitPixels);
  const setColor = useSpriteStore((state) => state.setColor);
  const setHover = useSpriteStore((state) => state.setHover);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<Stroke | null>(null);
  /** Set while dragging with the eyedropper, so pointermove keeps sampling. */
  const pickingRef = useRef(false);
  /** Bitmap of the in-progress stroke, or null when not drawing. */
  const [draft, setDraft] = useState<number[] | null>(null);
  const draftRef = useRef<number[] | null>(null);

  const putDraft = (pixels: number[] | null) => {
    draftRef.current = pixels;
    setDraft(pixels);
  };

  const box = project.box;
  const width = MARGIN + box.w * cellSize + 1;
  const height = MARGIN + box.h * cellSize + 1;
  const pixels = draft ?? sprite.pixels;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, width, height);
    if (!ctx) return;

    const gridWidth = box.w * cellSize;
    const gridHeight = box.h * cellSize;

    ctx.translate(MARGIN + 0.5, MARGIN + 0.5);

    // pixels
    for (let row = 0; row < box.h; row++) {
      for (let col = 0; col < box.w; col++) {
        ctx.fillStyle = toHex(pixels[row * box.w + col] ?? 0);
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    // grid, every 4th line emphasized
    ctx.lineWidth = 1;
    for (let col = 0; col <= box.w; col++) {
      ctx.strokeStyle = col % 4 === 0 ? COLOR.gridMajor : COLOR.grid;
      ctx.beginPath();
      ctx.moveTo(col * cellSize, 0);
      ctx.lineTo(col * cellSize, gridHeight);
      ctx.stroke();
    }
    for (let row = 0; row <= box.h; row++) {
      ctx.strokeStyle = row % 4 === 0 ? COLOR.gridMajor : COLOR.grid;
      ctx.beginPath();
      ctx.moveTo(0, row * cellSize);
      ctx.lineTo(gridWidth, row * cellSize);
      ctx.stroke();
    }
    ctx.strokeStyle = COLOR.border;
    ctx.strokeRect(0, 0, gridWidth, gridHeight);

    // rulers
    ctx.fillStyle = COLOR.ruler;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let col = 0; col < box.w; col++) {
      ctx.fillText(String(col), col * cellSize + cellSize / 2, -MARGIN / 2);
    }
    ctx.textAlign = "right";
    for (let row = 0; row < box.h; row++) {
      ctx.fillText(String(row), -4, row * cellSize + cellSize / 2);
    }

    if (showGuides) {
      const centerX = (box.w / 2) * cellSize;
      const centerY = (box.h / 2) * cellSize;
      dashed(ctx, COLOR.center, () => {
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, gridHeight);
      });
      dashed(ctx, COLOR.center, () => {
        ctx.moveTo(0, centerY);
        ctx.lineTo(gridWidth, centerY);
      });
    }
  }, [box, sprite, pixels, cellSize, showGuides, width, height]);

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      col: Math.floor((event.clientX - rect.left - MARGIN) / cellSize),
      row: Math.floor((event.clientY - rect.top - MARGIN) / cellSize),
    };
  };

  const inside = (point: Point) =>
    point.col >= 0 && point.col < box.w && point.row >= 0 && point.row < box.h;

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointAt(event);
    if (!inside(point)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "eyedropper") {
      pickingRef.current = true;
      setColor(getPixel(box, sprite.pixels, point.col, point.row));
      return;
    }
    // eraser / alt / right button always paints black (0x000000)
    const erase =
      tool === "eraser" ||
      event.altKey ||
      event.buttons === 2 ||
      event.button === 2;
    const strokeColor = erase ? 0 : color;
    const stroke: Stroke = {
      start: point,
      last: point,
      color: strokeColor,
      base: sprite.pixels,
    };
    strokeRef.current = stroke;
    if (tool === "fill") {
      putDraft(floodFill(box, sprite.pixels, point, strokeColor));
      return;
    }
    putDraft(setPixel(box, sprite.pixels, point, strokeColor));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointAt(event);
    setHover(inside(point) ? point : null);
    if (pickingRef.current) {
      if (inside(point)) setColor(getPixel(box, sprite.pixels, point.col, point.row));
      return;
    }
    const stroke = strokeRef.current;
    if (!stroke) return;
    if (point.col === stroke.last.col && point.row === stroke.last.row) return;
    const next = applyTool(tool, box, stroke, point);
    if (tool === "pen" || tool === "eraser") {
      stroke.base = next;
      stroke.last = point;
    }
    putDraft(next);
  };

  const endStroke = () => {
    pickingRef.current = false;
    if (!strokeRef.current) return;
    strokeRef.current = null;
    const pixels = draftRef.current;
    putDraft(null);
    if (pixels) commitPixels(pixels);
  };

  return (
    <div
      className={cn("flex flex-col items-center gap-3", className)}
      {...others}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "touch-none",
          tool === "eyedropper" ? "cursor-copy" : "cursor-crosshair",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}
