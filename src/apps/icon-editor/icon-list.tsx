import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Box, Icon } from "./icon";
import { useIconStore } from "./icon-store";
import { drawIcon, setupCanvas } from "./render";

const THUMB_SIZE = 26;

function matches(icon: Icon, filter: string): boolean {
  const value = filter.trim().toLowerCase();
  if (value.length === 0) return true;
  return icon.name.toLowerCase().includes(value);
}

function IconThumb({
  box,
  icon,
  color,
  size = THUMB_SIZE,
}: {
  box: Box;
  icon: Icon;
  color: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = Math.max(1, Math.floor(size / Math.max(box.w, box.h)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, box.w * scale, box.h * scale);
    if (!ctx) return;
    ctx.fillStyle = color;
    drawIcon(ctx, box, icon, 0, 0, scale);
  }, [box, icon, scale, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: box.w * scale, height: box.h * scale }}
    />
  );
}

interface IconListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function IconList({ className, ...others }: IconListProps) {
  const project = useIconStore((state) => state.project);
  const name = useIconStore((state) => state.name);
  const filter = useIconStore((state) => state.filter);
  const setFilter = useIconStore((state) => state.setFilter);
  const selectName = useIconStore((state) => state.selectName);
  const addIcon = useIconStore((state) => state.addIcon);
  const reorderIcon = useIconStore((state) => state.reorderIcon);

  const filtered = useMemo(
    () => project.icons.filter((icon) => matches(icon, filter)),
    [project.icons, filter],
  );

  const [dragName, setDragName] = useState<string | null>(null);
  const [overName, setOverName] = useState<string | null>(null);

  const handleAdd = () => {
    addIcon(filter.trim() || "icon");
    setFilter("");
  };

  return (
    <div
      className={cn("absolute inset-0 flex flex-col", className)}
      {...others}
    >
      <div className="flex h-10 shrink-0 items-center justify-between px-4 text-sm">
        <div>Icons</div>
        <div className="text-xs text-muted-foreground">
          {project.icons.length}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 px-4 pb-2">
        <Input
          value={filter}
          placeholder="search or new name"
          className="h-7"
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (filtered.length === 1) selectName(filtered[0].name);
              else handleAdd();
            }
          }}
        />
        <Button
          variant="outline"
          size="icon-sm"
          title="Add an icon"
          onClick={handleAdd}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div
            className="grid grid-cols-4 gap-2 px-3 pb-3"
            onDragOver={(event) => {
              if (dragName) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragName) reorderIcon(dragName, null);
              setDragName(null);
              setOverName(null);
            }}
          >
            {filtered.map((icon) => {
              const selected = icon.name === name;
              return (
                <button
                  key={icon.name}
                  title={icon.name}
                  draggable
                  className="flex min-w-0 cursor-pointer flex-col items-center gap-0.5"
                  onClick={() => selectName(icon.name)}
                  onDragStart={(event) => {
                    setDragName(icon.name);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragName(null);
                    setOverName(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragName || dragName === icon.name) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setOverName(icon.name);
                  }}
                  onDragLeave={() => {
                    setOverName((current) =>
                      current === icon.name ? null : current,
                    );
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (dragName && dragName !== icon.name) {
                      reorderIcon(dragName, icon.name);
                    }
                    setDragName(null);
                    setOverName(null);
                  }}
                >
                  <div
                    className={cn(
                      "flex aspect-square w-full items-center justify-center overflow-hidden border-[1.5px] border-neutral-800 hover:bg-neutral-800",
                      selected && "border-neutral-100 bg-neutral-100",
                      dragName === icon.name && "opacity-40",
                      overName === icon.name && "border-sky-400",
                    )}
                  >
                    <IconThumb
                      box={project.box}
                      icon={icon}
                      color={selected ? "#000000" : "#f5f5f5"}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-full truncate text-center font-mono text-xs leading-none",
                      selected ? "text-neutral-100" : "text-muted-foreground",
                    )}
                  >
                    {icon.name}
                  </span>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground/60">
              No icons
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
