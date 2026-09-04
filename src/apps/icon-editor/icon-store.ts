/**
 * Icon editor state.
 */

import { create } from "zustand";
import {
  createIcon,
  createIconSet,
  findIcon,
  resizeBox,
  uniqueName,
  type Box,
  type Icon,
  type IconSet,
} from "./icon";
import type { Point, Tool } from "./draw";

const MAX_UNDO = 100;

const CELL_SIZE_KEY = "icon-editor-cell-size";
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
 * (import, add/remove/duplicate icon, box resize) clear the stacks instead.
 */
interface Patch {
  name: string;
  before: boolean[];
  after: boolean[];
}

export interface IconEditorState {
  project: IconSet;
  /** Name of the icon being edited, `""` when the project has no icons. */
  name: string;
  tool: Tool;
  /** Editing grid zoom, in screen pixels per icon pixel. */
  cellSize: number;
  showGuides: boolean;
  /** Icon browser search term. */
  filter: string;
  /** Grid cell under the pointer, shown in the status bar. */
  hover: Point | null;
  undoStack: Patch[];
  redoStack: Patch[];

  icon: () => Icon | null;
  setProject: (project: IconSet) => void;
  selectName: (name: string) => void;
  selectAdjacent: (delta: number) => void;
  setTool: (tool: Tool) => void;
  setCellSize: (cellSize: number) => void;
  setShowGuides: (showGuides: boolean) => void;
  setFilter: (filter: string) => void;
  setHover: (hover: Point | null) => void;
  /** Replace the selected icon's bitmap, recording it for undo. */
  commitPixels: (pixels: boolean[]) => void;
  updateProject: (box: Partial<Box>) => void;
  renameIcon: (name: string, next: string) => void;
  addIcon: (name: string) => void;
  /** Copy `name`'s bitmap into a new icon inserted right after it. */
  duplicateIcon: (name: string) => void;
  removeIcon: (name: string) => void;
  /** Move `name` to just before `beforeName`, or to the end if `beforeName` is null. */
  reorderIcon: (name: string, beforeName: string | null) => void;
  undo: () => void;
  redo: () => void;
}

function firstName(project: IconSet): string {
  return project.icons[0]?.name ?? "";
}

/** Replace a single icon in place. */
function withIcon(project: IconSet, icon: Icon): IconSet {
  const icons = project.icons.map((item) =>
    item.name === icon.name ? icon : item,
  );
  return { ...project, icons };
}

const project = createIconSet();

export const useIconStore = create<IconEditorState>()((set, get) => ({
  project,
  name: firstName(project),
  tool: "pen",
  cellSize: loadCellSize(),
  showGuides: true,
  filter: "",
  hover: null,
  undoStack: [],
  redoStack: [],

  icon: () => findIcon(get().project, get().name),

  setProject: (project) =>
    set({ project, name: firstName(project), undoStack: [], redoStack: [] }),

  selectName: (name) => set({ name }),

  selectAdjacent: (delta) => {
    const { project, name } = get();
    const index = project.icons.findIndex((icon) => icon.name === name);
    const next = project.icons[index + delta];
    if (next) set({ name: next.name });
  },

  setTool: (tool) => set({ tool }),
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
    const icon = findIcon(project, name);
    if (!icon || icon.pixels === pixels) return;
    const patch: Patch = { name, before: icon.pixels, after: pixels };
    set({
      project: withIcon(project, { ...icon, pixels }),
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

  renameIcon: (name, next) => {
    const { project } = get();
    const icon = findIcon(project, name);
    if (!icon) return;
    const trimmed = next.trim();
    if (!trimmed || findIcon(project, trimmed)) return;
    const icons = project.icons.map((item) =>
      item.name === name ? { ...item, name: trimmed } : item,
    );
    set({ project: { ...project, icons }, name: trimmed });
  },

  addIcon: (name) => {
    const { project } = get();
    const unique = uniqueName(project, name || "icon");
    const icons = [...project.icons, createIcon(project.box, unique)];
    set({
      project: { ...project, icons },
      name: unique,
      undoStack: [],
      redoStack: [],
    });
  },

  duplicateIcon: (name) => {
    const { project } = get();
    const index = project.icons.findIndex((icon) => icon.name === name);
    if (index < 0) return;
    // drop a trailing `_<n>` so duplicating `icon_1` yields `icon_2`
    // instead of chaining into `icon_1_1`
    const unique = uniqueName(project, name.replace(/_\d+$/, "") || name);
    const copy: Icon = {
      name: unique,
      pixels: [...project.icons[index].pixels],
    };
    const icons = [...project.icons];
    icons.splice(index + 1, 0, copy);
    set({
      project: { ...project, icons },
      name: unique,
      undoStack: [],
      redoStack: [],
    });
  },

  removeIcon: (name) => {
    const { project } = get();
    const index = project.icons.findIndex((icon) => icon.name === name);
    if (index < 0) return;
    const icons = project.icons.filter((icon) => icon.name !== name);
    const neighbor = icons[Math.min(index, icons.length - 1)];
    set({
      project: { ...project, icons },
      name: neighbor?.name ?? "",
      undoStack: [],
      redoStack: [],
    });
  },

  reorderIcon: (name, beforeName) => {
    const { project } = get();
    if (name === beforeName) return;
    const icons = [...project.icons];
    const fromIndex = icons.findIndex((icon) => icon.name === name);
    if (fromIndex < 0) return;
    const [moved] = icons.splice(fromIndex, 1);
    const toIndex =
      beforeName === null
        ? icons.length
        : icons.findIndex((icon) => icon.name === beforeName);
    icons.splice(toIndex < 0 ? icons.length : toIndex, 0, moved);
    set({ project: { ...project, icons } });
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    const patch = undoStack.at(-1);
    if (!patch) return;
    const icon = findIcon(project, patch.name);
    if (!icon) return;
    set({
      project: withIcon(project, { ...icon, pixels: patch.before }),
      name: patch.name,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, patch],
    });
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    const patch = redoStack.at(-1);
    if (!patch) return;
    const icon = findIcon(project, patch.name);
    if (!icon) return;
    set({
      project: withIcon(project, { ...icon, pixels: patch.after }),
      name: patch.name,
      undoStack: [...undoStack, patch].slice(-MAX_UNDO),
      redoStack: redoStack.slice(0, -1),
    });
  },
}));
