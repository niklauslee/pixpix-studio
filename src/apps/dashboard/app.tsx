import { useEffect, useRef, useState } from "react";
import {
  DuplicateIcon,
  ExportIcon,
  LogoutIcon,
  PlusIcon,
  SquarePenIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";
import { Appbar } from "@/components/appbar";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  useConfirmDialog,
} from "@/components/dialogs/confirm-dialog";
import { authClient } from "@/lib/auth-client";
import {
  createFont,
  createGlyph,
  findGlyph,
  remapPixels,
  serializeBDF,
  type Font,
  type Glyph,
} from "@/apps/font-editor/bdf";
import { loadDefaultGlyphSource } from "@/apps/font-editor/font-store";
import { codepointsForRanges } from "@/lib/charsets";
import { EditableName } from "./editable-name";
import { NewFontDialog, useNewFontDialog } from "./new-font-dialog";
import { Sidebar, type DashboardView } from "./sidebar";

/**
 * A fresh font for the given ranges (see lib/charsets.ts). When `fillGlyphs` is
 * set, glyphs are pre-filled with shapes from the built-in default font
 * instead of being left blank.
 */
function blankFont(rangeIds: ReadonlySet<string>, fillGlyphs: boolean): Font {
  const font = createFont({
    name: "untitled",
    box: { w: 8, h: 13, ox: 0, oy: -2 },
    pointSize: 13,
    ascent: 11,
    descent: 2,
  });
  const source = fillGlyphs ? loadDefaultGlyphSource() : null;
  const glyphs: Glyph[] = codepointsForRanges(rangeIds).map((code) => {
    const glyph = createGlyph(font, code);
    const sourceGlyph = source && findGlyph(source, code);
    if (!sourceGlyph) return glyph;
    return {
      ...glyph,
      pixels: remapPixels(source.box, sourceGlyph.pixels, font.box),
    };
  });
  return { ...font, glyphs };
}

interface FontRow {
  id: string;
  name: string;
  glyphCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SceneRow {
  id: string;
  name: string;
  width: number;
  height: number;
  shapeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface IconSetRow {
  id: string;
  name: string;
  width: number;
  height: number;
  iconCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SpriteSetRow {
  id: string;
  name: string;
  width: number;
  height: number;
  spriteCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A blank scene, same defaults as `editor-component.tsx`'s `basicSetup()`. */
function blankScene() {
  return JSON.stringify({
    width: 128,
    height: 64,
    bpp: 1,
    scale: 5,
    shapes: [],
  });
}

/** A blank icon set, same default box as `icon-store.ts`'s `createIconSet()`. */
function blankIconSet() {
  return JSON.stringify({ box: { w: 16, h: 16 }, icons: [] });
}

/** A blank sprite set, same default box as `sprite-store.ts`'s `createSpriteSet()`. */
function blankSpriteSet() {
  return JSON.stringify({ box: { w: 16, h: 16 }, sprites: [] });
}

interface DashboardUser {
  name: string;
  image?: string | null;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

function App({ user }: { user: DashboardUser }) {
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [fonts, setFonts] = useState<FontRow[] | null>(null);
  const [iconSets, setIconSets] = useState<IconSetRow[] | null>(null);
  const [spriteSets, setSpriteSets] = useState<SpriteSetRow[] | null>(null);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<DashboardView>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return requested === "fonts" ||
      requested === "icons" ||
      requested === "sprites"
      ? requested
      : "scenes";
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const sceneFileRef = useRef<HTMLInputElement>(null);
  const iconSetFileRef = useRef<HTMLInputElement>(null);
  const spriteSetFileRef = useRef<HTMLInputElement>(null);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  const changeView = (next: DashboardView) => {
    setView(next);
    history.replaceState(null, "", `/dashboard?view=${next}`);
  };

  useEffect(() => {
    if (view !== "scenes" || scenes !== null) return;
    api("/api/scenes")
      .then((response) => response.json() as Promise<SceneRow[]>)
      .then(setScenes)
      .catch((error) => {
        console.error("Failed to load scenes:", error);
        flash("Failed to load your scenes");
      });
  }, [view, scenes]);

  useEffect(() => {
    if (view !== "fonts" || fonts !== null) return;
    api("/api/fonts")
      .then((response) => response.json() as Promise<FontRow[]>)
      .then(setFonts)
      .catch((error) => {
        console.error("Failed to load fonts:", error);
        flash("Failed to load your fonts");
      });
  }, [view, fonts]);

  useEffect(() => {
    if (view !== "icons" || iconSets !== null) return;
    api("/api/icon-sets")
      .then((response) => response.json() as Promise<IconSetRow[]>)
      .then(setIconSets)
      .catch((error) => {
        console.error("Failed to load icon sets:", error);
        flash("Failed to load your icon sets");
      });
  }, [view, iconSets]);

  useEffect(() => {
    if (view !== "sprites" || spriteSets !== null) return;
    api("/api/sprite-sets")
      .then((response) => response.json() as Promise<SpriteSetRow[]>)
      .then(setSpriteSets)
      .catch((error) => {
        console.error("Failed to load sprite sets:", error);
        flash("Failed to load your sprite sets");
      });
  }, [view, spriteSets]);

  const handleUploadScene = async (file: File) => {
    try {
      const data = await file.text();
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed.shapes)) throw new Error("not a scene file");
      const name = file.name.replace(/\.pixpix$/i, "");
      const response = await api("/api/scenes", {
        method: "POST",
        body: JSON.stringify({ name, data }),
      });
      const created: SceneRow = await response.json();
      setScenes((current) => [created, ...(current ?? [])]);
      flash(`Uploaded ${file.name}`);
    } catch (error) {
      console.error("Failed to upload the scene:", error);
      flash("Upload failed — not a valid .pixpix file");
    }
  };

  const handleCreateScene = async () => {
    try {
      const response = await api("/api/scenes", {
        method: "POST",
        body: JSON.stringify({ name: "untitled", data: blankScene() }),
      });
      const created: SceneRow = await response.json();
      location.href = `/scene?id=${created.id}`;
    } catch (error) {
      console.error("Failed to create the scene:", error);
      flash("Failed to create the scene");
    }
  };

  const handleRenameScene = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const previous = scenes;
    setScenes(
      (current) =>
        current?.map((s) => (s.id === id ? { ...s, name: trimmed } : s)) ??
        current,
    );
    try {
      await api(`/api/scenes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (error) {
      console.error("Failed to rename the scene:", error);
      flash("Rename failed");
      setScenes(previous);
    }
  };

  const handleDeleteScene = (row: SceneRow) => {
    useConfirmDialog
      .getState()
      .show(
        "Delete Scene",
        `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
        async () => {
          const previous = scenes;
          setScenes(
            (current) => current?.filter((s) => s.id !== row.id) ?? current,
          );
          try {
            await api(`/api/scenes/${row.id}`, { method: "DELETE" });
          } catch (error) {
            console.error("Failed to delete the scene:", error);
            flash("Delete failed");
            setScenes(previous);
          }
        },
      );
  };

  const handleDownloadScene = async (row: SceneRow) => {
    try {
      const response = await api(`/api/scenes/${row.id}`);
      const full: SceneRow & { data: string } = await response.json();
      download(`${full.name}.pixpix`, full.data);
    } catch (error) {
      console.error("Failed to download the scene:", error);
      flash("Download failed");
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const data = await file.text();
      if (!data.includes("STARTFONT")) throw new Error("not a valid BDF file");
      const name = file.name.replace(/\.bdf$/i, "");
      const response = await api("/api/fonts", {
        method: "POST",
        body: JSON.stringify({ name, data }),
      });
      const created: FontRow = await response.json();
      setFonts((current) => [created, ...(current ?? [])]);
      flash(`Uploaded ${file.name}`);
    } catch (error) {
      console.error("Failed to upload the font:", error);
      flash("Upload failed — not a valid BDF file");
    }
  };

  const handleCreate = async (selected: Set<string>, fillGlyphs: boolean) => {
    try {
      const data = serializeBDF(blankFont(selected, fillGlyphs));
      const response = await api("/api/fonts", {
        method: "POST",
        body: JSON.stringify({ name: "untitled", data }),
      });
      const created: FontRow = await response.json();
      location.href = `/font?id=${created.id}`;
    } catch (error) {
      console.error("Failed to create the font:", error);
      flash("Failed to create the font");
    }
  };

  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const previous = fonts;
    setFonts(
      (current) =>
        current?.map((f) => (f.id === id ? { ...f, name: trimmed } : f)) ??
        current,
    );
    try {
      await api(`/api/fonts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (error) {
      console.error("Failed to rename the font:", error);
      flash("Rename failed");
      setFonts(previous);
    }
  };

  const handleDelete = (row: FontRow) => {
    useConfirmDialog
      .getState()
      .show(
        "Delete Font",
        `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
        async () => {
          const previous = fonts;
          setFonts(
            (current) => current?.filter((f) => f.id !== row.id) ?? current,
          );
          try {
            await api(`/api/fonts/${row.id}`, { method: "DELETE" });
          } catch (error) {
            console.error("Failed to delete the font:", error);
            flash("Delete failed");
            setFonts(previous);
          }
        },
      );
  };

  const handleDownload = async (row: FontRow) => {
    try {
      const response = await api(`/api/fonts/${row.id}`);
      const full: FontRow & { data: string } = await response.json();
      download(`${full.name}.bdf`, full.data);
    } catch (error) {
      console.error("Failed to download the font:", error);
      flash("Download failed");
    }
  };

  const handleDuplicate = async (row: FontRow) => {
    try {
      const response = await api(`/api/fonts/${row.id}`);
      const full: FontRow & { data: string } = await response.json();
      const createResponse = await api("/api/fonts", {
        method: "POST",
        body: JSON.stringify({ name: `${full.name} copy`, data: full.data }),
      });
      const created: FontRow = await createResponse.json();
      setFonts((current) => [created, ...(current ?? [])]);
      flash(`Duplicated ${full.name}`);
    } catch (error) {
      console.error("Failed to duplicate the font:", error);
      flash("Duplicate failed");
    }
  };

  const handleUploadIconSet = async (file: File) => {
    try {
      const data = await file.text();
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed.icons) || typeof parsed.box !== "object") {
        throw new Error("not an icon set file");
      }
      const name = file.name.replace(/\.eicon$/i, "");
      const response = await api("/api/icon-sets", {
        method: "POST",
        body: JSON.stringify({ name, data }),
      });
      const created: IconSetRow = await response.json();
      setIconSets((current) => [created, ...(current ?? [])]);
      flash(`Uploaded ${file.name}`);
    } catch (error) {
      console.error("Failed to upload the icon set:", error);
      flash("Upload failed — not a valid .eicon file");
    }
  };

  const handleCreateIconSet = async () => {
    try {
      const response = await api("/api/icon-sets", {
        method: "POST",
        body: JSON.stringify({ name: "untitled", data: blankIconSet() }),
      });
      const created: IconSetRow = await response.json();
      location.href = `/icon?id=${created.id}`;
    } catch (error) {
      console.error("Failed to create the icon set:", error);
      flash("Failed to create the icon set");
    }
  };

  const handleRenameIconSet = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const previous = iconSets;
    setIconSets(
      (current) =>
        current?.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) ??
        current,
    );
    try {
      await api(`/api/icon-sets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (error) {
      console.error("Failed to rename the icon set:", error);
      flash("Rename failed");
      setIconSets(previous);
    }
  };

  const handleDeleteIconSet = (row: IconSetRow) => {
    useConfirmDialog
      .getState()
      .show(
        "Delete Icon Set",
        `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
        async () => {
          const previous = iconSets;
          setIconSets(
            (current) => current?.filter((p) => p.id !== row.id) ?? current,
          );
          try {
            await api(`/api/icon-sets/${row.id}`, { method: "DELETE" });
          } catch (error) {
            console.error("Failed to delete the icon set:", error);
            flash("Delete failed");
            setIconSets(previous);
          }
        },
      );
  };

  const handleDownloadIconSet = async (row: IconSetRow) => {
    try {
      const response = await api(`/api/icon-sets/${row.id}`);
      const full: IconSetRow & { data: string } = await response.json();
      download(`${full.name}.eicon`, full.data);
    } catch (error) {
      console.error("Failed to download the icon set:", error);
      flash("Download failed");
    }
  };

  const handleUploadSpriteSet = async (file: File) => {
    try {
      const data = await file.text();
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed.sprites) || typeof parsed.box !== "object") {
        throw new Error("not a sprite set file");
      }
      const name = file.name.replace(/\.esprite$/i, "");
      const response = await api("/api/sprite-sets", {
        method: "POST",
        body: JSON.stringify({ name, data }),
      });
      const created: SpriteSetRow = await response.json();
      setSpriteSets((current) => [created, ...(current ?? [])]);
      flash(`Uploaded ${file.name}`);
    } catch (error) {
      console.error("Failed to upload the sprite set:", error);
      flash("Upload failed — not a valid .esprite file");
    }
  };

  const handleCreateSpriteSet = async () => {
    try {
      const response = await api("/api/sprite-sets", {
        method: "POST",
        body: JSON.stringify({ name: "untitled", data: blankSpriteSet() }),
      });
      const created: SpriteSetRow = await response.json();
      location.href = `/sprite?id=${created.id}`;
    } catch (error) {
      console.error("Failed to create the sprite set:", error);
      flash("Failed to create the sprite set");
    }
  };

  const handleRenameSpriteSet = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const previous = spriteSets;
    setSpriteSets(
      (current) =>
        current?.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) ??
        current,
    );
    try {
      await api(`/api/sprite-sets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (error) {
      console.error("Failed to rename the sprite set:", error);
      flash("Rename failed");
      setSpriteSets(previous);
    }
  };

  const handleDeleteSpriteSet = (row: SpriteSetRow) => {
    useConfirmDialog
      .getState()
      .show(
        "Delete Sprite Set",
        `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
        async () => {
          const previous = spriteSets;
          setSpriteSets(
            (current) => current?.filter((p) => p.id !== row.id) ?? current,
          );
          try {
            await api(`/api/sprite-sets/${row.id}`, { method: "DELETE" });
          } catch (error) {
            console.error("Failed to delete the sprite set:", error);
            flash("Delete failed");
            setSpriteSets(previous);
          }
        },
      );
  };

  const handleDownloadSpriteSet = async (row: SpriteSetRow) => {
    try {
      const response = await api(`/api/sprite-sets/${row.id}`);
      const full: SpriteSetRow & { data: string } = await response.json();
      download(`${full.name}.esprite`, full.data);
    } catch (error) {
      console.error("Failed to download the sprite set:", error);
      flash("Download failed");
    }
  };

  return (
    <>
      <main className="absolute inset-0 flex select-none flex-col bg-background text-foreground">
        <Appbar active="dashboard">
          <div className="flex items-center gap-2 pl-2">
            {user.image && (
              <img src={user.image} alt="" className="size-6 rounded-full" />
            )}
            <span className="text-xs text-muted-foreground">{user.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Sign out"
              onClick={async () => {
                await authClient.signOut();
                location.href = "/login";
              }}
            >
              <LogoutIcon className="size-3.5" />
            </Button>
          </div>
        </Appbar>

        <div className="flex min-h-0 flex-1">
          <Sidebar active={view} onChange={changeView} />

          <div className="min-h-0 flex-1 overflow-auto">
            <div className="mx-auto max-w-3xl px-6 py-8">
              {notice && (
                <div className="mb-3 text-xs text-neutral-300">{notice}</div>
              )}

              {view === "scenes" && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h1 className="text-sm font-medium">Scenes</h1>
                      {scenes && (
                        <span className="text-xs text-muted-foreground">
                          {scenes.length} scene{scenes.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        title="Start a new scene"
                        onClick={handleCreateScene}
                      >
                        <PlusIcon className="size-3.5" />
                        New Scene
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Upload an .pixpix file"
                        onClick={() => sceneFileRef.current?.click()}
                      >
                        <UploadIcon className="size-3.5" />
                        Upload Scene
                      </Button>
                    </div>
                  </div>

                  <div className="mb-8 border-[1.5px] border-neutral-800">
                    <div className="grid grid-cols-[1fr_80px_70px_180px_116px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs text-muted-foreground">
                      <div>Name</div>
                      <div>Shapes</div>
                      <div>Size</div>
                      <div>Updated</div>
                      <div className="text-right">Actions</div>
                    </div>

                    {scenes === null && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        Loading…
                      </div>
                    )}

                    {scenes !== null && scenes.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        No scenes yet — start one from the scene editor and save
                        it to your account.
                      </div>
                    )}

                    {scenes?.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1fr_80px_70px_180px_116px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs last:border-b-0"
                      >
                        <EditableName
                          name={row.name}
                          onSave={(name) => handleRenameScene(row.id, name)}
                          onOpen={() => (location.href = `/scene?id=${row.id}`)}
                        />
                        <div className="text-muted-foreground">
                          {row.shapeCount}
                        </div>
                        <div className="text-muted-foreground">
                          {row.width}x{row.height}
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(row.updatedAt).toLocaleString()}
                        </div>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Open in Scene Editor"
                            onClick={() =>
                              (location.href = `/scene?id=${row.id}`)
                            }
                          >
                            <SquarePenIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Download as .pixpix"
                            onClick={() => handleDownloadScene(row)}
                          >
                            <ExportIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            onClick={() => handleDeleteScene(row)}
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {view === "fonts" && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h1 className="text-sm font-medium">Fonts</h1>
                      {fonts && (
                        <span className="text-xs text-muted-foreground">
                          {fonts.length} font{fonts.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        title="Start a new font"
                        onClick={() => useNewFontDialog.getState().show()}
                      >
                        <PlusIcon className="size-3.5" />
                        New Font
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Upload a BDF file"
                        onClick={() => fileRef.current?.click()}
                      >
                        <UploadIcon className="size-3.5" />
                        Upload Font
                      </Button>
                    </div>
                  </div>

                  <div className="border-[1.5px] border-neutral-800">
                    <div className="grid grid-cols-[1fr_80px_180px_146px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs text-muted-foreground">
                      <div>Name</div>
                      <div>Glyphs</div>
                      <div>Updated</div>
                      <div className="text-right">Actions</div>
                    </div>

                    {fonts === null && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        Loading…
                      </div>
                    )}

                    {fonts !== null && fonts.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        No fonts yet — export one from the font editor and
                        upload it here.
                      </div>
                    )}

                    {fonts?.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1fr_80px_180px_146px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs last:border-b-0"
                      >
                        <EditableName
                          name={row.name}
                          onSave={(name) => handleRename(row.id, name)}
                          onOpen={() => (location.href = `/font?id=${row.id}`)}
                        />
                        <div className="text-muted-foreground">
                          {row.glyphCount}
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(row.updatedAt).toLocaleString()}
                        </div>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Open in Font Editor"
                            onClick={() =>
                              (location.href = `/font?id=${row.id}`)
                            }
                          >
                            <SquarePenIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Duplicate"
                            onClick={() => handleDuplicate(row)}
                          >
                            <DuplicateIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Download as BDF"
                            onClick={() => handleDownload(row)}
                          >
                            <ExportIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            onClick={() => handleDelete(row)}
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {view === "icons" && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h1 className="text-sm font-medium">Icon Sets</h1>
                      {iconSets && (
                        <span className="text-xs text-muted-foreground">
                          {iconSets.length} set
                          {iconSets.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        title="Start a new icon set"
                        onClick={handleCreateIconSet}
                      >
                        <PlusIcon className="size-3.5" />
                        New Icon Set
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Upload an .eicon file"
                        onClick={() => iconSetFileRef.current?.click()}
                      >
                        <UploadIcon className="size-3.5" />
                        Upload Icons
                      </Button>
                    </div>
                  </div>

                  <div className="mb-8 border-[1.5px] border-neutral-800">
                    <div className="grid grid-cols-[1fr_60px_70px_180px_116px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs text-muted-foreground">
                      <div>Name</div>
                      <div>Icons</div>
                      <div>Size</div>
                      <div>Updated</div>
                      <div className="text-right">Actions</div>
                    </div>

                    {iconSets === null && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        Loading…
                      </div>
                    )}

                    {iconSets !== null && iconSets.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        No icon sets yet — start one from the icon editor and
                        save it to your account.
                      </div>
                    )}

                    {iconSets?.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1fr_60px_70px_180px_116px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs last:border-b-0"
                      >
                        <EditableName
                          name={row.name}
                          onSave={(name) => handleRenameIconSet(row.id, name)}
                          onOpen={() => (location.href = `/icon?id=${row.id}`)}
                        />
                        <div className="text-muted-foreground">
                          {row.iconCount}
                        </div>
                        <div className="text-muted-foreground">
                          {row.width}x{row.height}
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(row.updatedAt).toLocaleString()}
                        </div>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Open in Icon Editor"
                            onClick={() =>
                              (location.href = `/icon?id=${row.id}`)
                            }
                          >
                            <SquarePenIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Download as .eicon"
                            onClick={() => handleDownloadIconSet(row)}
                          >
                            <ExportIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            onClick={() => handleDeleteIconSet(row)}
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {view === "sprites" && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h1 className="text-sm font-medium">Sprite Sets</h1>
                      {spriteSets && (
                        <span className="text-xs text-muted-foreground">
                          {spriteSets.length} set
                          {spriteSets.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        title="Start a new sprite set"
                        onClick={handleCreateSpriteSet}
                      >
                        <PlusIcon className="size-3.5" />
                        New Sprite Set
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Upload an .esprite file"
                        onClick={() => spriteSetFileRef.current?.click()}
                      >
                        <UploadIcon className="size-3.5" />
                        Upload Sprites
                      </Button>
                    </div>
                  </div>

                  <div className="mb-8 border-[1.5px] border-neutral-800">
                    <div className="grid grid-cols-[1fr_60px_70px_180px_116px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs text-muted-foreground">
                      <div>Name</div>
                      <div>Sprites</div>
                      <div>Size</div>
                      <div>Updated</div>
                      <div className="text-right">Actions</div>
                    </div>

                    {spriteSets === null && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        Loading…
                      </div>
                    )}

                    {spriteSets !== null && spriteSets.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">
                        No sprite sets yet — start one from the sprite editor
                        and save it to your account.
                      </div>
                    )}

                    {spriteSets?.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1fr_60px_70px_180px_116px] items-center gap-2 border-b-[1.5px] border-neutral-800 px-4 py-2 text-xs last:border-b-0"
                      >
                        <EditableName
                          name={row.name}
                          onSave={(name) => handleRenameSpriteSet(row.id, name)}
                          onOpen={() =>
                            (location.href = `/sprite?id=${row.id}`)
                          }
                        />
                        <div className="text-muted-foreground">
                          {row.spriteCount}
                        </div>
                        <div className="text-muted-foreground">
                          {row.width}x{row.height}
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(row.updatedAt).toLocaleString()}
                        </div>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Open in Sprite Editor"
                            onClick={() =>
                              (location.href = `/sprite?id=${row.id}`)
                            }
                          >
                            <SquarePenIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Download as .esprite"
                            onClick={() => handleDownloadSpriteSet(row)}
                          >
                            <ExportIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            onClick={() => handleDeleteSpriteSet(row)}
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <input
        ref={iconSetFileRef}
        type="file"
        accept=".eicon,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleUploadIconSet(file);
        }}
      />
      <input
        ref={spriteSetFileRef}
        type="file"
        accept=".esprite,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleUploadSpriteSet(file);
        }}
      />
      <input
        ref={sceneFileRef}
        type="file"
        accept=".pixpix,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleUploadScene(file);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".bdf,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleUpload(file);
        }}
      />
      <ConfirmDialog />
      <NewFontDialog onCreate={handleCreate} />
    </>
  );
}

export default App;
