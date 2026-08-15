import { CircleQuestionMarkIcon } from "lucide-react";
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
import { findSprite } from "./sprite";
import { useSpriteStore } from "./sprite-store";

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
      <CircleQuestionMarkIcon size={13} />
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
  help?: React.ReactNode;
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

function ProjectProperties() {
  const project = useSpriteStore((state) => state.project);
  const updateProject = useSpriteStore((state) => state.updateProject);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 text-xs">
        Box size
        <Help title="Box size">
          One grid shared by every sprite in the project. Resizing crops or
          pads every sprite's pixels from the top-left corner.
        </Help>
      </div>
      <div className="flex w-full gap-2">
        <Row label="W" title="Box width" compact>
          <NumberField
            className="h-7"
            value={project.box.w}
            onChange={(value) => updateProject({ w: Math.max(1, value) })}
          />
        </Row>
        <Row label="H" title="Box height" compact>
          <NumberField
            className="h-7"
            value={project.box.h}
            onChange={(value) => updateProject({ h: Math.max(1, value) })}
          />
        </Row>
      </div>
    </div>
  );
}

function SpriteProperties() {
  const project = useSpriteStore((state) => state.project);
  const name = useSpriteStore((state) => state.name);
  const renameSprite = useSpriteStore((state) => state.renameSprite);
  const removeSprite = useSpriteStore((state) => state.removeSprite);
  const sprite = findSprite(project, name);

  if (!sprite) {
    return (
      <div className="text-xs text-muted-foreground/60">No sprite selected</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Row label="Name" title="Sprite name">
        <TextField
          className="h-7"
          value={sprite.name}
          onChange={(value) => renameSprite(sprite.name, value)}
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
                "Delete Sprite",
                `Delete "${sprite.name}" from the project? This cannot be undone.`,
                () => removeSprite(sprite.name),
              );
          }}
        >
          Delete Sprite
        </Button>
        <Help title="Delete Sprite">
          Removes the sprite from the project. Structural edits clear the
          undo stack, so this cannot be undone.
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
      <div className="flex h-10 shrink-0 items-center px-4 text-sm">
        Project
      </div>
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div className="flex flex-col gap-3 px-4 pb-4">
            <ProjectProperties />
            <div className="mt-1 border-t-[1.5px] border-neutral-800 pt-3 text-sm">
              Sprite
            </div>
            <SpriteProperties />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
