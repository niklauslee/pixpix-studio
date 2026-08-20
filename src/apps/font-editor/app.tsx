import { useEffect, useRef, useState } from "react";
import { SaveIcon } from "lucide-react";
import { Appbar } from "@/components/appbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { FontCodeDialog, showFontCodeDialog } from "./code-dialog";
import { findGlyph, formatCode, parseBDF, serializeBDF } from "./bdf";
import {
  clear,
  flipHorizontal,
  flipVertical,
  invert,
  shift,
  type Tool,
} from "./draw";
import { useFontStore } from "./font-store";
import { GlyphCanvas } from "./glyph-canvas";
import { GlyphList } from "./glyph-list";
import { PropertiesPanel } from "./properties";
import { Preview } from "./preview";
import { Toolbar } from "./toolbar";

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

interface FontEditorUser {
  name: string;
  image?: string | null;
}

interface InitialFont {
  id: string;
  name: string;
  data: string;
}

function App({
  user,
  initialFont,
}: {
  user: FontEditorUser | null;
  initialFont: InitialFont | null;
}) {
  const font = useFontStore((state) => state.font);
  const code = useFontStore((state) => state.code);
  const tool = useFontStore((state) => state.tool);
  const hover = useFontStore((state) => state.hover);
  const setFont = useFontStore((state) => state.setFont);
  const [notice, setNotice] = useState("");
  const [savedId, setSavedId] = useState<string | null>(
    initialFont?.id ?? null,
  );
  const [savedName, setSavedName] = useState(initialFont?.name ?? "");
  const [saving, setSaving] = useState(false);
  // font object as of the last load/save, to detect unsaved edits
  const savedFontRef = useRef(font);
  const dirty = font !== savedFontRef.current;

  const glyph = findGlyph(font, code);
  const onPixels = glyph?.pixels.filter((on) => on).length ?? 0;

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  // load the font passed down from the dashboard (`/font?id=...`), once
  useEffect(() => {
    if (!initialFont) return;
    try {
      const loaded = parseBDF(initialFont.data);
      setFont(loaded);
      savedFontRef.current = loaded;
    } catch (error) {
      console.error("Failed to load the saved font:", error);
      flash("Failed to load the saved font");
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
      ? `Pixpix Font Editor — ${savedName}`
      : "Pixpix Font Editor";
  }, [savedName]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = serializeBDF(font);
      if (savedId) {
        await api(`/api/fonts/${savedId}`, {
          method: "PATCH",
          body: JSON.stringify({ data }),
        });
      } else {
        const response = await api("/api/fonts", {
          method: "POST",
          body: JSON.stringify({ name: font.name || "untitled", data }),
        });
        const created: { id: string; name: string } = await response.json();
        setSavedId(created.id);
        setSavedName(created.name);
        history.replaceState(null, "", `/font?id=${created.id}`);
      }
      savedFontRef.current = font;
      flash("Saved to your account");
    } catch (error) {
      console.error("Failed to save the font:", error);
      flash("Save failed");
    } finally {
      setSaving(false);
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
  }, [user, dirty, saving, font]);

  // keyboard shortcuts — bitmap operations act on the selected glyph
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const store = useFontStore.getState();
      const box = store.font.box;
      const current = findGlyph(store.font, store.code);
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (user && store.font !== savedFontRef.current)
          handleSaveRef.current();
        return;
      }
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
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
        <Appbar active="font">
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
            title="Generate u8g2 / Adafruit GFX font code"
            onClick={showFontCodeDialog}
          >
            Code
          </Button>
          {user ? (
            <Button
              variant="outline"
              size="sm"
              title={
                savedId
                  ? "Save changes to your account"
                  : "Save this font to your account"
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
              title="Sign in to save fonts to your account"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Sign in to Save
            </a>
          )}
        </Appbar>

        <section className="flex min-h-0 flex-1">
          <aside className="relative w-84 shrink-0 border-r-[1.5px] border-neutral-700">
            <GlyphList />
          </aside>
          <article className="flex min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b-[1.5px] border-neutral-700">
              <Toolbar />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="flex min-h-full min-w-full items-center justify-center p-6">
                {glyph ? (
                  <GlyphCanvas glyph={glyph} />
                ) : (
                  <div className="text-xs text-muted-foreground/60">
                    No glyph selected — add one from the glyph browser
                  </div>
                )}
              </div>
            </div>
            <Preview className="shrink-0 border-t-[1.5px] border-neutral-700" />
          </article>
          <aside className="relative w-64 shrink-0 border-l-[1.5px] border-neutral-700">
            <PropertiesPanel />
          </aside>
        </section>

        <footer className="flex h-8 shrink-0 items-center justify-between border-t-[1.5px] border-neutral-700 px-4 font-mono text-xs text-muted-foreground">
          <div className="flex gap-4">
            {glyph && (
              <span>
                {formatCode(glyph.code)} "{String.fromCodePoint(glyph.code)}"
              </span>
            )}
            <span>{tool}</span>
            {notice && <span className="text-neutral-300">{notice}</span>}
          </div>
          <div className="flex gap-4">
            <span>{hover ? `${hover.col}, ${hover.row}` : "-, -"}</span>
            <span>{onPixels} px</span>
            <span>
              {font.box.w}x{font.box.h}
            </span>
          </div>
        </footer>
      </main>

      <ConfirmDialog />
      <FontCodeDialog />
    </>
  );
}

export default App;
