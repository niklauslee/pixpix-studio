import { useEffect, useRef, useState } from "react";
import { ExportIcon, SaveIcon } from "@/components/icons";
import { Appbar } from "@/components/appbar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createZip } from "@/lib/zip";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { IconCodeDialog, showIconCodeDialog } from "./code-dialog";
import { defaultIdentifier, generateIconSetJSON } from "./code-generator";
import { findIcon, parseIconSet, serializeIconSet } from "./icon";
import {
  clear,
  flipHorizontal,
  flipVertical,
  invert,
  shift,
  type Tool,
} from "./draw";
import { generateIconSVG, generateReactBundle } from "./svg-generator";
import { useIconStore } from "./icon-store";
import { IconCanvas } from "./icon-canvas";
import { IconList } from "./icon-list";
import { PropertiesPanel } from "./properties";
import { Toolbar } from "./toolbar";

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  // deferred: revoking synchronously can cut off larger blobs (the React zip)
  // before the browser has started reading them
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const TOOL_KEYS: Record<string, Tool> = {
  p: "pen",
  e: "eraser",
  l: "line",
  r: "rect",
  R: "rect-fill",
  f: "fill",
};

const SHIFT_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

interface IconEditorUser {
  name: string;
  image?: string | null;
}

interface InitialIconSet {
  id: string;
  name: string;
  data: string;
}

function App({
  user,
  initialIconSet,
}: {
  user: IconEditorUser | null;
  initialIconSet: InitialIconSet | null;
}) {
  const project = useIconStore((state) => state.project);
  const name = useIconStore((state) => state.name);
  const tool = useIconStore((state) => state.tool);
  const hover = useIconStore((state) => state.hover);
  const setProject = useIconStore((state) => state.setProject);
  const [notice, setNotice] = useState("");
  const [savedId, setSavedId] = useState<string | null>(
    initialIconSet?.id ?? null,
  );
  const [savedName, setSavedName] = useState(initialIconSet?.name ?? "");
  const [saving, setSaving] = useState(false);
  // project object as of the last load/save, to detect unsaved edits
  const savedProjectRef = useRef(project);
  const dirty = project !== savedProjectRef.current;

  const icon = findIcon(project, name);
  const onPixels = icon?.pixels.filter((on) => on).length ?? 0;

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  // load the project passed down from the dashboard (`/icon?id=...`), once
  useEffect(() => {
    if (!initialIconSet) return;
    try {
      const loaded = parseIconSet(initialIconSet.data);
      setProject(loaded);
      savedProjectRef.current = loaded;
    } catch (error) {
      console.error("Failed to load the saved icon set:", error);
      flash("Failed to load the saved icon set");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // warn before leaving the page (closing the tab or navigating to another
  // URL) while there are edits that haven't been saved
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    document.title = savedName
      ? `Pixpix Icon Editor — ${savedName}`
      : "Pixpix Icon Editor";
  }, [savedName]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = serializeIconSet(project);
      if (savedId) {
        await api(`/api/icon-sets/${savedId}`, {
          method: "PATCH",
          body: JSON.stringify({ data }),
        });
      } else {
        const response = await api("/api/icon-sets", {
          method: "POST",
          body: JSON.stringify({ name: savedName || "untitled", data }),
        });
        const created: { id: string; name: string } = await response.json();
        setSavedId(created.id);
        setSavedName(created.name);
        history.replaceState(null, "", `/icon?id=${created.id}`);
      }
      savedProjectRef.current = project;
      flash("Saved to your account");
    } catch (error) {
      console.error("Failed to save the icon set:", error);
      flash("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleExportSVG = () => {
    if (!icon) return;
    try {
      const svg = generateIconSVG(project.box, icon);
      downloadBlob(
        `${defaultIdentifier(icon)}.svg`,
        new Blob([svg], { type: "image/svg+xml" }),
      );
    } catch (error) {
      console.error("Failed to export SVG:", error);
      flash("Export failed");
    }
  };

  const handleExportReact = () => {
    try {
      const files = generateReactBundle(project.box, project.icons);
      downloadBlob(`${savedName || "icons"}-react.zip`, createZip(files));
    } catch (error) {
      console.error("Failed to export React components:", error);
      flash("Export failed");
    }
  };

  const handleExportJSON = () => {
    try {
      const json = generateIconSetJSON(project.box, project.icons);
      downloadBlob(
        `${savedName || "icons"}.json`,
        new Blob([json], { type: "application/json" }),
      );
    } catch (error) {
      console.error("Failed to export JSON:", error);
      flash("Export failed");
    }
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // auto-save 10s after the last edit, once signed in
  useEffect(() => {
    if (!user || !dirty || saving) return;
    const timer = setTimeout(() => {
      handleSaveRef.current();
    }, 10000);
    return () => clearTimeout(timer);
  }, [user, dirty, saving, project]);

  // keyboard shortcuts — bitmap operations act on the selected icon
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const store = useIconStore.getState();
      const box = store.project.box;
      const current = findIcon(store.project, store.name);
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (user && store.project !== savedProjectRef.current)
          handleSaveRef.current();
        return;
      }
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (current) store.duplicateIcon(current.name);
        return;
      }
      if (mod && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        store.setCellSize(store.cellSize + 2);
        return;
      }
      if (mod && event.key === "-") {
        event.preventDefault();
        store.setCellSize(store.cellSize - 2);
        return;
      }
      if (mod || event.altKey) return;

      const nextTool = TOOL_KEYS[event.key];
      if (nextTool) {
        store.setTool(nextTool);
        return;
      }

      const delta = SHIFT_KEYS[event.key];
      if (delta) {
        event.preventDefault();
        if (current) store.commitPixels(shift(box, current.pixels, ...delta));
        return;
      }

      switch (event.key) {
        case "[":
          store.selectAdjacent(-1);
          break;
        case "]":
          store.selectAdjacent(1);
          break;
        case "i":
          if (current) store.commitPixels(invert(current.pixels));
          break;
        case "H":
          if (current) store.commitPixels(flipHorizontal(box, current.pixels));
          break;
        case "V":
          if (current) store.commitPixels(flipVertical(box, current.pixels));
          break;
        case "Delete":
        case "Backspace":
          event.preventDefault();
          if (current) store.commitPixels(clear(box));
          break;
        case "+":
        case "=":
          store.setCellSize(store.cellSize + 2);
          break;
        case "-":
          store.setCellSize(store.cellSize - 2);
          break;
        case "g":
          store.setShowGuides(!store.showGuides);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <main className="absolute inset-0 flex select-none flex-col bg-background text-foreground">
        <Appbar active="icon">
          {savedName && (
            <span
              className="max-w-48 truncate pr-2 text-xs text-muted-foreground"
              title={savedName}
            >
              {savedName}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            title="Generate u8g2 XBM code"
            onClick={showIconCodeDialog}
          >
            Code
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={project.icons.length === 0}
                  title="Export icons"
                />
              }
            >
              <ExportIcon className="size-3.5" />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!icon} onClick={handleExportSVG}>
                Export as SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportReact}>
                Export as React Components
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {user ? (
            <Button
              variant="outline"
              size="sm"
              title={
                savedId
                  ? "Save changes to your account"
                  : "Save this icon set to your account"
              }
              disabled={saving || !dirty}
              onClick={handleSave}
            >
              <SaveIcon className="size-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : (
            <a
              href="/login"
              title="Sign in to save icon sets to your account"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Sign in to Save
            </a>
          )}
        </Appbar>

        <section className="flex min-h-0 flex-1">
          <aside className="relative w-84 shrink-0 border-r-[1.5px] border-neutral-700">
            <IconList />
          </aside>
          <article className="flex min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b-[1.5px] border-neutral-700">
              <Toolbar />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="flex min-h-full min-w-full items-center justify-center p-6">
                {icon ? (
                  <IconCanvas icon={icon} />
                ) : (
                  <div className="text-xs text-muted-foreground/60">
                    No icon selected — add one from the icon browser
                  </div>
                )}
              </div>
            </div>
          </article>
          <aside className="relative w-64 shrink-0 border-l-[1.5px] border-neutral-700">
            <PropertiesPanel />
          </aside>
        </section>

        <footer className="flex h-8 shrink-0 items-center justify-between border-t-[1.5px] border-neutral-700 px-4 font-mono text-xs text-muted-foreground">
          <div className="flex gap-4">
            {icon && <span>{icon.name}</span>}
            <span>{tool}</span>
            {notice && <span className="text-neutral-300">{notice}</span>}
          </div>
          <div className="flex gap-4">
            <span>{hover ? `${hover.col}, ${hover.row}` : "-, -"}</span>
            <span>{onPixels} px</span>
            <span>
              {project.box.w}x{project.box.h}
            </span>
          </div>
        </footer>
      </main>

      <ConfirmDialog />
      <IconCodeDialog />
    </>
  );
}

export default App;
