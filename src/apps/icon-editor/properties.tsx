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
import { findIcon } from "./icon";
import { useIconStore } from "./icon-store";

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
  const project = useIconStore((state) => state.project);
  const updateProject = useIconStore((state) => state.updateProject);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 text-xs">
        Box size
        <Help title="Box size">
          One grid shared by every icon in the project. Resizing crops or pads
          every icon's pixels from the top-left corner.
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

function IconProperties() {
  const project = useIconStore((state) => state.project);
  const name = useIconStore((state) => state.name);
  const renameIcon = useIconStore((state) => state.renameIcon);
  const duplicateIcon = useIconStore((state) => state.duplicateIcon);
  const removeIcon = useIconStore((state) => state.removeIcon);
  const icon = findIcon(project, name);

  if (!icon) {
    return (
      <div className="text-xs text-muted-foreground/60">No icon selected</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Row
        label="Name"
        title="Icon name"
        help="Identifies the icon in the browser on the left and becomes its C array name in generated code."
      >
        <TextField
          className="h-7"
          value={icon.name}
          onChange={(value) => renameIcon(icon.name, value)}
        />
      </Row>
      <div className="mt-1 flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => duplicateIcon(icon.name)}
        >
          Duplicate Icon
        </Button>
        <Help title="Duplicate Icon">
          Adds a copy of this icon's pixels right after it, under a new numbered
          name, and selects it. Structural edits clear the undo stack.
        </Help>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            useConfirmDialog
              .getState()
              .show(
                "Delete Icon",
                `Delete "${icon.name}" from the project? This cannot be undone.`,
                () => removeIcon(icon.name),
              );
          }}
        >
          Delete Icon
        </Button>
        <Help title="Delete Icon">
          Removes the icon from the project. Structural edits clear the undo
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
      <div className="flex h-10 shrink-0 items-center px-4 text-sm">
        Project
      </div>
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div className="flex flex-col gap-3 px-4 pb-4">
            <ProjectProperties />
            <div className="mt-1 border-t-[1.5px] border-neutral-800 pt-3 text-sm">
              Icon
            </div>
            <IconProperties />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
