import { useState } from "react";
import { CheckIcon, PenIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Read-only by default; clicking the name opens it via `onOpen`, the pencil
 * button enters editing (pencil becomes a checkmark), and the checkmark
 * commits the rename via `onSave`.
 */
export function EditableName({
  name,
  onSave,
  onOpen,
}: {
  name: string;
  onSave: (name: string) => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) onSave(trimmed);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 pr-2">
        <button
          type="button"
          onClick={onOpen}
          title="Open"
          className="flex-1 truncate text-left hover:underline"
        >
          {name}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Rename"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          <PenIcon className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 pr-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
        className="h-7"
      />
      <Button variant="ghost" size="icon-sm" title="Save" onClick={commit}>
        <CheckIcon className="size-3.5" />
      </Button>
    </div>
  );
}
