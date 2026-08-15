import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Box, Sprite } from "./sprite";
import { useSpriteStore } from "./sprite-store";
import { drawSprite, setupCanvas } from "./render";

const THUMB_SIZE = 26;

function matches(sprite: Sprite, filter: string): boolean {
  const value = filter.trim().toLowerCase();
  if (value.length === 0) return true;
  return sprite.name.toLowerCase().includes(value);
}

function SpriteThumb({
  box,
  sprite,
  size = THUMB_SIZE,
}: {
  box: Box;
  sprite: Sprite;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = Math.max(1, Math.floor(size / Math.max(box.w, box.h)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, box.w * scale, box.h * scale);
    if (!ctx) return;
    drawSprite(ctx, box, sprite, 0, 0, scale);
  }, [box, sprite, scale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: box.w * scale, height: box.h * scale }}
    />
  );
}

interface SpriteListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SpriteList({ className, ...others }: SpriteListProps) {
  const project = useSpriteStore((state) => state.project);
  const name = useSpriteStore((state) => state.name);
  const filter = useSpriteStore((state) => state.filter);
  const setFilter = useSpriteStore((state) => state.setFilter);
  const selectName = useSpriteStore((state) => state.selectName);
  const addSprite = useSpriteStore((state) => state.addSprite);
  const reorderSprite = useSpriteStore((state) => state.reorderSprite);

  const filtered = useMemo(
    () => project.sprites.filter((sprite) => matches(sprite, filter)),
    [project.sprites, filter],
  );

  const [dragName, setDragName] = useState<string | null>(null);
  const [overName, setOverName] = useState<string | null>(null);

  const handleAdd = () => {
    addSprite(filter.trim() || "sprite");
    setFilter("");
  };

  return (
    <div
      className={cn("absolute inset-0 flex flex-col", className)}
      {...others}
    >
      <div className="flex h-10 shrink-0 items-center justify-between px-4 text-sm">
        <div>Sprites</div>
        <div className="text-xs text-muted-foreground">
          {project.sprites.length}
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
          title="Add a sprite"
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
              if (dragName) reorderSprite(dragName, null);
              setDragName(null);
              setOverName(null);
            }}
          >
            {filtered.map((sprite) => {
              const selected = sprite.name === name;
              return (
                <button
                  key={sprite.name}
                  title={sprite.name}
                  draggable
                  className="flex min-w-0 cursor-pointer flex-col items-center gap-0.5"
                  onClick={() => selectName(sprite.name)}
                  onDragStart={(event) => {
                    setDragName(sprite.name);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragName(null);
                    setOverName(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragName || dragName === sprite.name) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setOverName(sprite.name);
                  }}
                  onDragLeave={() => {
                    setOverName((current) =>
                      current === sprite.name ? null : current,
                    );
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (dragName && dragName !== sprite.name) {
                      reorderSprite(dragName, sprite.name);
                    }
                    setDragName(null);
                    setOverName(null);
                  }}
                >
                  <div
                    className={cn(
                      "flex aspect-square w-full items-center justify-center overflow-hidden border-[1.5px] border-neutral-800 hover:border-neutral-600",
                      selected && "border-neutral-100",
                      dragName === sprite.name && "opacity-40",
                      overName === sprite.name && "border-sky-400",
                    )}
                  >
                    <SpriteThumb box={project.box} sprite={sprite} />
                  </div>
                  <span
                    className={cn(
                      "w-full truncate text-center font-mono text-xs leading-none",
                      selected ? "text-neutral-100" : "text-muted-foreground",
                    )}
                  >
                    {sprite.name}
                  </span>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground/60">
              No sprites
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
