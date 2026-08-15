/**
 * Sprite editor state.
 */

import { create } from "zustand";
import {
  createSprite,
  createSpriteSet,
  findSprite,
  resizeBox,
  uniqueName,
  type Box,
  type Sprite,
  type SpriteSet,
} from "./sprite";
import type { Point, Tool } from "./draw";

const MAX_UNDO = 100;

const CELL_SIZE_KEY = "sprite-editor-cell-size";
const MIN_CELL_SIZE = 4;
const MAX_CELL_SIZE = 48;
const DEFAULT_CELL_SIZE = 22;

/** Editing grid zoom, unlike the project itself, is cheap to persist. */
function loadCellSize(): number {
  const stored = Number(localStorage.getItem(CELL_SIZE_KEY));
  if (Number.isFinite(stored) && stored > 0) {
    return Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, stored));
  }
  return DEFAULT_CELL_SIZE;
}

/**
 * An undoable bitmap edit. Only bitmap edits are undoable — structural changes
 * (import, add/remove sprite, box resize) clear the stacks instead.
 */
interface Patch {
  name: string;
  before: number[];
  after: number[];
}

export interface SpriteEditorState {
  project: SpriteSet;
  /** Name of the sprite being edited, `""` when the project has no sprites. */
  name: string;
  tool: Tool;
  /** Currently selected RGB color (`0xRRGGBB`) used by pen/line/rect/fill. */
  color: number;
  /** Editing grid zoom, in screen pixels per sprite pixel. */
  cellSize: number;
  showGuides: boolean;
  /** Sprite browser search term. */
  filter: string;
  /** Grid cell under the pointer, shown in the status bar. */
  hover: Point | null;
  undoStack: Patch[];
  redoStack: Patch[];

  sprite: () => Sprite | null;
  setProject: (project: SpriteSet) => void;
  selectName: (name: string) => void;
  selectAdjacent: (delta: number) => void;
  setTool: (tool: Tool) => void;
  setColor: (color: number) => void;
  /** Add a color to the project's palette swatch list, if not already present. */
  addPaletteColor: (color: number) => void;
  /** Remove a color from the project's palette swatch list. */
  removePaletteColor: (color: number) => void;
  setCellSize: (cellSize: number) => void;
  setShowGuides: (showGuides: boolean) => void;
  setFilter: (filter: string) => void;
  setHover: (hover: Point | null) => void;
  /** Replace the selected sprite's bitmap, recording it for undo. */
  commitPixels: (pixels: number[]) => void;
  updateProject: (box: Partial<Box>) => void;
  renameSprite: (name: string, next: string) => void;
  addSprite: (name: string) => void;
  /** Insert a copy of `name`'s sprite right after it, with a unique name, and select it. */
  duplicateSprite: (name: string) => void;
  removeSprite: (name: string) => void;
  /** Move `name` to just before `beforeName`, or to the end if `beforeName` is null. */
  reorderSprite: (name: string, beforeName: string | null) => void;
  undo: () => void;
  redo: () => void;
}

function firstName(project: SpriteSet): string {
  return project.sprites[0]?.name ?? "";
}

/** Replace a single sprite in place. */
function withSprite(project: SpriteSet, sprite: Sprite): SpriteSet {
  const sprites = project.sprites.map((item) =>
    item.name === sprite.name ? sprite : item,
  );
  return { ...project, sprites };
}

const project = createSpriteSet();

export const useSpriteStore = create<SpriteEditorState>()((set, get) => ({
  project,
  name: firstName(project),
  tool: "pen",
  color: 0x0000aa,
  cellSize: loadCellSize(),
  showGuides: true,
  filter: "",
  hover: null,
  undoStack: [],
  redoStack: [],

  sprite: () => findSprite(get().project, get().name),

  setProject: (project) =>
    set({ project, name: firstName(project), undoStack: [], redoStack: [] }),

  selectName: (name) => set({ name }),

  selectAdjacent: (delta) => {
    const { project, name } = get();
    const index = project.sprites.findIndex((sprite) => sprite.name === name);
    const next = project.sprites[index + delta];
    if (next) set({ name: next.name });
  },

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color: color & 0xffffff }),
  addPaletteColor: (color) => {
    const { project } = get();
    const next = color & 0xffffff;
    if (project.palette.includes(next)) return;
    set({ project: { ...project, palette: [...project.palette, next] } });
  },
  removePaletteColor: (color) => {
    const { project } = get();
    set({
      project: {
        ...project,
        palette: project.palette.filter((item) => item !== color),
      },
    });
  },
  setCellSize: (cellSize) => {
    const clamped = Math.max(
      MIN_CELL_SIZE,
      Math.min(MAX_CELL_SIZE, Math.round(cellSize)),
    );
    localStorage.setItem(CELL_SIZE_KEY, String(clamped));
    set({ cellSize: clamped });
  },
  setShowGuides: (showGuides) => set({ showGuides }),
  setFilter: (filter) => set({ filter }),
  setHover: (hover) => set({ hover }),

  commitPixels: (pixels) => {
    const { project, name, undoStack } = get();
    const sprite = findSprite(project, name);
    if (!sprite || sprite.pixels === pixels) return;
    const patch: Patch = { name, before: sprite.pixels, after: pixels };
    set({
      project: withSprite(project, { ...sprite, pixels }),
      undoStack: [...undoStack, patch].slice(-MAX_UNDO),
      redoStack: [],
    });
  },

  updateProject: (changes) => {
    const { project } = get();
    const box: Box = { ...project.box, ...changes };
    const resized = resizeBox(project, box);
    const structural = resized !== project;
    set({
      project: resized,
      ...(structural ? { undoStack: [], redoStack: [] } : {}),
    });
  },

  renameSprite: (name, next) => {
    const { project } = get();
    const sprite = findSprite(project, name);
    if (!sprite) return;
    const trimmed = next.trim();
    if (!trimmed || findSprite(project, trimmed)) return;
    const sprites = project.sprites.map((item) =>
      item.name === name ? { ...item, name: trimmed } : item,
    );
    set({ project: { ...project, sprites }, name: trimmed });
  },

  addSprite: (name) => {
    const { project } = get();
    const unique = uniqueName(project, name || "sprite");
    const sprites = [...project.sprites, createSprite(project.box, unique)];
    set({
      project: { ...project, sprites },
      name: unique,
      undoStack: [],
      redoStack: [],
    });
  },

  duplicateSprite: (name) => {
    const { project } = get();
    const index = project.sprites.findIndex((sprite) => sprite.name === name);
    if (index < 0) return;
    const source = project.sprites[index];
    const unique = uniqueName(project, source.name);
    const copy: Sprite = { name: unique, pixels: [...source.pixels] };
    const sprites = [...project.sprites];
    sprites.splice(index + 1, 0, copy);
    set({
      project: { ...project, sprites },
      name: unique,
      undoStack: [],
      redoStack: [],
    });
  },

  removeSprite: (name) => {
    const { project } = get();
    const index = project.sprites.findIndex((sprite) => sprite.name === name);
    if (index < 0) return;
    const sprites = project.sprites.filter((sprite) => sprite.name !== name);
    const neighbor = sprites[Math.min(index, sprites.length - 1)];
    set({
      project: { ...project, sprites },
      name: neighbor?.name ?? "",
      undoStack: [],
      redoStack: [],
    });
  },

  reorderSprite: (name, beforeName) => {
    const { project } = get();
    if (name === beforeName) return;
    const sprites = [...project.sprites];
    const fromIndex = sprites.findIndex((sprite) => sprite.name === name);
    if (fromIndex < 0) return;
    const [moved] = sprites.splice(fromIndex, 1);
    const toIndex =
      beforeName === null
        ? sprites.length
        : sprites.findIndex((sprite) => sprite.name === beforeName);
    sprites.splice(toIndex < 0 ? sprites.length : toIndex, 0, moved);
    set({ project: { ...project, sprites } });
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    const patch = undoStack.at(-1);
    if (!patch) return;
    const sprite = findSprite(project, patch.name);
    if (!sprite) return;
    set({
      project: withSprite(project, { ...sprite, pixels: patch.before }),
      name: patch.name,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, patch],
    });
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    const patch = redoStack.at(-1);
    if (!patch) return;
    const sprite = findSprite(project, patch.name);
    if (!sprite) return;
    set({
      project: withSprite(project, { ...sprite, pixels: patch.after }),
      name: patch.name,
      undoStack: [...undoStack, patch].slice(-MAX_UNDO),
      redoStack: redoStack.slice(0, -1),
    });
  },
}));
