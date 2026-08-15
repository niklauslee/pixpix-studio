# Empix Studio

Four browser-based editors, three for embedded devices with monochrome
displays plus one general-purpose RGB sprite editor:

- **Scene editor** (`/scene`) — draws into a packed 1-bpp pixel buffer (like a
  real display framebuffer) and generates
  [u8g2](https://github.com/olikraus/u8g2) C/C++ or XBM code from the scene.
- **Font editor** (`/font`) — a BDF glyph editor.
- **Icon editor** (`/icon`) — edits many named icon bitmaps that share one
  fixed size (an icon set) and generates u8g2-ready XBM C byte arrays.
- **Sprite editor** (`/sprite`) — edits many named sprites that share one
  fixed size (a sprite set), with a full RGB color per pixel instead of the
  1-bit pixels the other three editors use. No code generation (u8g2 is
  1bpp-only and has no natural RGB target).

Editing works anonymously with no account, but nothing persists until you
sign in: the scene, the font, the icon set and the sprite set all stay in
memory only (import/export). Signing in with GitHub adds a **dashboard**
(`/dashboard`) that saves scenes, fonts, icon sets and sprite sets per-user to
a Cloudflare D1 database, so they can be reopened from any browser.

Astro, server-rendered, + React islands, deployed to Cloudflare Workers
(`@astrojs/cloudflare`) with a D1 binding — not a static-assets-only site.

> `CLAUDE.md` is a symlink to this file. Edit `AGENTS.md`.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Other commands:

- `npm run build` / `npm run preview` — production build and local preview
- `npm run generate-types` — `wrangler types` (Cloudflare Worker bindings)
- `node tools/generate-fonts.js` — regenerate `src/font-data.ts` from `res/bdf/`

Database (D1 via Drizzle, no npm script wraps these yet — run directly):

- `npx drizzle-kit generate` — add a migration under `drizzle/migrations` after
  editing `src/lib/db/schema.ts`
- `npx wrangler d1 migrations apply DB --local` / `--remote` — apply pending
  migrations to the local dev DB or the remote D1 database

Local dev needs a `.dev.vars` (gitignored, see `.dev.vars.example`) with
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (GitHub OAuth app) and
`BETTER_AUTH_SECRET`.

There is no test framework. Verify changes by running the dev server and
exercising the editor.

## Layout of the source tree

```
src/
  pages/
    index.astro     landing page; redirects to /dashboard if signed in
    login.astro     GitHub sign-in (better-auth), redirects to /dashboard if signed in
    dashboard.astro auth-required; redirects to /login if not signed in
    scene.astro     scene editor; ?id= loads a saved scene (auth-required only then)
    font.astro      font editor; ?id= loads a saved font (auth-required only then)
    icon.astro      icon editor; ?id= loads a saved icon set (auth-required only then)
    sprite.astro    sprite editor; ?id= loads a saved sprite set (auth-required only then)
    api/
      auth/[...all].ts    better-auth catch-all handler
      scenes/index.ts, scenes/[id].ts             CRUD for the signed-in user's scenes
      fonts/index.ts, fonts/[id].ts               CRUD for the signed-in user's fonts
      icon-sets/index.ts, icon-sets/[id].ts       CRUD for the signed-in user's icon sets
      sprite-sets/index.ts, sprite-sets/[id].ts   CRUD for the signed-in user's sprite sets
  apps/
    scene-editor/  the u8g2 scene editor app (AppContext, engine, UI, commands)
    font-editor/    the BDF glyph editor app (self-contained)
    icon-editor/    the icon set editor app (self-contained)
    sprite-editor/  the sprite set editor app (self-contained, RGB pixels)
    dashboard/      lists/manages a signed-in user's saved scenes, fonts, icon sets and sprite sets
  components/
    editor/         reusable editor core — canvas, shapes, tools, undo/redo
    ui/             shadcn components
    icons/          hand-written SVG icons
    dialogs/        confirm + code dialogs (each owns a small zustand store)
    astro/head.astro, logo.tsx, appbar.tsx
  lib/
    utils.ts        cn, detectPlatform, generateNewName, odd
    auth.ts         getAuth() — lazy better-auth singleton (GitHub OAuth + D1)
    auth-client.ts  authClient — better-auth browser client (signIn/signOut)
    db/             schema.ts (Drizzle), index.ts (getDb()), fonts.ts, scenes.ts, icon-sets.ts, sprite-sets.ts
  middleware.ts     resolves the session on every request into Astro.locals
  font-data.ts      generated — embedded BDF fonts (deflate + base64)
  styles/           global.css (Tailwind v4 + theme), fonts.css (@font-face)
```

All pages render their app's `<App client:only="react" />` inside
`<body class="dark">` (there is no light theme) with the shared
`components/astro/head.astro`, which takes an optional `title` and includes
the Google Analytics tag. `scene.astro`/`font.astro`/`icon.astro`/
`sprite.astro`/`dashboard.astro` share `components/appbar.tsx` for their
header (logo, current-page label, a "Dashboard" back-link, and app-specific
actions on the right).

The apps share `components/editor/`, `ui/`, `icons/`, `dialogs/`, `logo.tsx`,
`appbar.tsx`, `lib/utils.ts` and `font-data.ts` — nothing else. In particular
the font editor, the icon editor and the sprite editor don't touch the editor
core, `AppContext` or the engine, and none of the three share code with each
other (`icon-editor/draw.ts` is a deliberate near-duplicate of
`font-editor/draw.ts`, and `sprite-editor/draw.ts` a further near-duplicate
adapted for palette-index pixels instead of booleans — none are imports, all
three apps stay independent).

## Scene editor

Three layers, from inside out:

1. **`src/components/editor/`** — the editor core. Plain TypeScript, no React
   (except `editor-component.tsx`), no app knowledge. Renders to a canvas.
2. **`src/apps/scene-editor/engine/`** — app services: commands, keymap, code
   generation.
3. **`src/apps/scene-editor/*.tsx`, `src/apps/scene-editor/store/`** — React UI
   (shadcn + Tailwind v4) that observes the editor through zustand stores.

`src/apps/scene-editor/app-context.ts` glues them: `AppContext` is a singleton
exposed as `window.app`, and holds `editor`, `commands`, `keymap`,
`codeGenerator`. Its `wiring()` subscribes to editor events and pushes state
into `useEditorStore`. `initialize(editor, initialData?)` additionally loads
the keymap, the embedded BDF fonts, and registers commands; when
`initialData` is given (a scene loaded server-side from D1 via `?id=`, see
`scene.astro`) it is loaded via `loadFromJSON`, otherwise the editor starts
blank. It is called from `app.tsx`'s `onMount` handler on `EditorComponent`.

Cloud save only exists when signed in: `app.tsx` shows a **Save** button
(only when signed in — otherwise a "Sign in to Save" link to `/login`) that
`POST`s `/api/scenes` the first time and `PATCH`s `/api/scenes/:id`
afterward, then updates the URL to `/scene?id=...` via
`history.replaceState`; edits also auto-save 10s after the last change while
signed in. Anonymous edits aren't persisted anywhere and are lost on reload
(a `beforeunload` warning fires if there are unsaved changes).

### Editor core (`src/components/editor/`)

- `editor.ts` — `Editor` plus the interaction framework: `Handler` /
  `HandlerManager` (active tool), `Manipulator` / `ManipulatorManager` /
  `Controller` (per-shape-type selection handles), `SelectionManager`.
  Owns canvas creation, pointer/keyboard wiring, `repaint()`, grid/border
  drawing, and `loadFromJSON` / `saveToJSON`.
- `graphics.ts` — `GraphicContext`: a packed `Uint8Array` buffer sized
  `ceil(width * bpp / 8) * height`, with `putPixel`/`getPixel`, Bresenham line
  and ellipse, BDF text rendering (4 directions), XBM bitmap blitting, and
  `renderBuffer()` which paints the buffer onto the canvas as scaled rects.
  `toPixelCoord` / `toCanvasCoord` convert between canvas and pixel space.
- `shapes.ts` — shapes are **plain serializable objects** (`Shape` and its
  variants: Rectangle, Ellipse, Line, Text, Pen, Bitmap), never classes.
  Behavior lives in free functions: `render`, `renderOutline`, `getOutline`,
  `getBoundingRect`, `containsPoint`, `overlapRect`, `move`. `ShapeFactory`
  creates defaults and emits `onCreate`.
- `store.ts` — the shape list (`Store.shapes`), JSON in/out.
- `transform.ts` — the only sanctioned way to mutate shapes. Mutations
  (`assign`, `insert`, `delete`, `reorder`) are recorded into an action between
  `begin()` and `end()`, which is what makes undo/redo work (`Stack`, max 100
  actions).
- `handlers.ts` — tools: `SelectHandler` plus one factory handler per shape type.
- `manipulators.ts` / `controllers.ts` — move/resize/point-edit controllers.
- `actions.ts` — `PredefinedActions`: undo, redo, copy/cut/paste, delete,
  duplicate, move, z-order, update props. UI and commands call these.
- `editor-component.tsx` — the React wrapper. Its `basicSetup()` declares the
  handler and manipulator registry plus canvas defaults (128×64, bpp 1,
  margin 32, scale 5), and exposes `window.editor` for debugging.
- `geometry.ts`, `utils.ts`, `consts.ts` (`Color`, `Cursor`, `Mouse`),
  `std.ts` (`TypedEvent`, `Stack`), `clipboard.ts`, `font.ts`.

### Engine (`src/apps/scene-editor/engine/`)

- `command-manager.ts` — `app.commands.register(id, description, zodShape, handler)`
  and `execute(id, args)` with Zod validation. Command ids are namespaced:
  `edit:`, `shape:`, `align:`, `tool:`, `view:`. All registered in
  `../commands.ts`.
- `keymap-manager.ts` — binds `../keymap.json` to command ids. `mod-` means
  Cmd on macOS, Ctrl elsewhere. Formatted key labels are mirrored into
  `useKeymapStore` for display in the UI (button tooltips).
- `code-generator.ts` — `generateU8g2(editor, {lang: "c" | "cpp", useProgmem})`
  walks the shapes emitting u8g2 calls, tracking draw color / font / font
  direction so redundant setters are skipped; Pen shapes become XBM byte arrays.
  `generateXBM(editor)` dumps the whole framebuffer instead.

### UI (`src/apps/scene-editor/`)

- `app.tsx` — composes `layout.tsx` (appbar / left sidebar / right sidebar /
  content) with `LayersPanel`, `Toolbar`, `PropertiesPanel`, `EditorComponent`
  and the dialogs. Uses the shared `components/appbar.tsx` for Clear, Code,
  Import / Export of `.empix` files (JSON via the File System Access API —
  Chromium only, marked `FIXME`) and the Save / "Sign in to Save" cloud-save
  action (see above).
- `store/editor-store.ts` — read-only mirror of editor state for React
  (`shapes`, `selection`, `width`, `height`, `scale`, `activeHandler`,
  `activeHandlerLock`, and an `actionSequence` counter bumped on every action to
  force re-render). `store/keymap-store.ts` holds the formatted key labels.
- `toolbar.tsx` — canvas size fields, tool buttons, zoom/undo/redo/z-order
  actions. The Bitmap tool is registered in the core but its toolbar button is
  commented out.
- `properties.tsx`, `layers.tsx` — right and left panels.
- Dialogs live in `src/components/dialogs/` and each own a small zustand store,
  so any code can open them via `useConfirmDialog.getState().show(...)` /
  `useCodeDialog.getState().setOpen(true)`. `code-dialog.tsx` picks the target
  (u8g2 / XBM), the language (`cpp` = Arduino, `c` = Zephyr) and PROGMEM, then
  calls the code generator on open.
- `src/components/ui/` is shadcn (style `base-lyra`, built on Base UI) — see
  `components.json`. Icons: hand-written SVGs in `src/components/icons/`, plus
  `@phosphor-icons/react`.

## Font editor (`src/apps/font-editor/`)

A self-contained BDF glyph editor at `/font`. No editor core, no `AppContext`,
no engine, no command manager — keyboard shortcuts are a single `keydown`
listener in `app.tsx`.

- `bdf.ts` — the `Font` / `Glyph` model plus `parseBDF` / `serializeBDF`. Every
  glyph bitmap is stored in the **font bounding box frame** (one fixed grid for
  the whole font); per-glyph `BBX` is recomputed tightly on serialization. BDF y
  points up from the baseline, grid rows go down:
  `y = box.oy + box.h - 1 - row`. Also `createFont` / `createGlyph` /
  `resizeBox` / `findGlyph` / `formatCode`.
- `draw.ts` — pixel operations (pen, eraser, line, rect, flood fill, shift,
  flip, invert, clear) and the `Tool` union. They take and return `boolean[]`,
  never mutate.
- `font-store.ts` — zustand store: font, selected codepoint, tool, cell size,
  guides, glyph filter, preview text, hover cell, and an undo stack of bitmap
  patches (structural edits — import, add/remove glyph, box resize — clear it).
  The font is **not** persisted locally — it starts from a seed font (`6x13`,
  trimmed to printable ASCII) and is kept in memory only, because serializing
  thousands of glyphs to BDF on every edit made `localStorage` writes stall
  the browser. Import / Export or cloud Save (below) are the ways in and out;
  only the cell-size (zoom) preference lives in `localStorage`.
- `render.ts` — canvas helpers (`setupCanvas`, `drawGlyph`, `measureText`,
  `drawText`) used by the glyph browser, the editing grid and the preview.
- `app.tsx` — layout (appbar / glyph list / grid + preview / properties /
  status bar), import/export, New font, keyboard shortcuts; with
  `glyph-list.tsx`, `toolbar.tsx`, `glyph-canvas.tsx`, `properties.tsx`,
  `preview.tsx`, `embedded-font-menu.tsx` (open one of the embedded fonts).
  When opened via `/font?id=`, `initialFont.data` is parsed with `parseBDF()`
  into the store on mount. Same Save / "Sign in to Save" pattern as the scene
  editor (`POST`/`PATCH` `/api/fonts`), independent of the in-memory-only
  default.

## Icon editor (`src/apps/icon-editor/`)

A self-contained icon set editor at `/icon`, modeled closely on the font
editor: one fixed `Box` (width/height, no baseline/origin) shared by every
icon in the set, icons keyed by name instead of Unicode codepoint. No editor
core, no `AppContext`, no engine, no command manager — keyboard shortcuts are
a single `keydown` listener in `app.tsx`, same as the font editor.

- `icon.ts` — the `IconSet` / `Icon` / `Box` model: `createIconSet`,
  `createIcon`, `findIcon`, `uniqueName`, `remapPixels` / `resizeBox` (crops
  or pads every icon top-left anchored when the box changes — no baseline to
  keep pixels relative to, unlike the font editor's `resizeBox`),
  `sanitizeIdentifier` (for codegen), `serializeIconSet` / `parseIconSet`
  (plain JSON — there's no BDF-equivalent interchange format for icon sets).
- `draw.ts` — pixel operations (pen, eraser, line, rect, flood fill, shift,
  flip, invert, clear) and the `Tool` union, operating on `boolean[]` +
  `Box`. A deliberate near-duplicate of `font-editor/draw.ts` rather than a
  shared import (see above).
- `icon-store.ts` — zustand store: the `IconSet`, selected icon name, tool,
  cell size, guides, filter, hover cell, and an undo stack of bitmap patches
  keyed by icon name (structural edits — add/remove icon, box resize — clear
  it). Like the font, the set is **not** persisted locally: it starts as a
  blank 16×16 set and is kept in memory only. Only the cell-size (zoom)
  preference lives in `localStorage` (`icon-editor-cell-size`).
- `render.ts` — `setupCanvas` plus `drawIcon` (plain top-left pixel blit — no
  baseline math, unlike the font editor's `drawGlyph`).
- `app.tsx` — layout (appbar / icon list / grid + toolbar / properties /
  status bar), keyboard shortcuts. When opened via `/icon?id=`,
  `initialIconSet.data` is parsed with `parseIconSet()` into the store on
  mount. Same Save / "Sign in to Save" pattern as the other editors
  (`POST`/`PATCH` `/api/icon-sets`); with `icon-list.tsx`, `icon-canvas.tsx`,
  `toolbar.tsx`, `properties.tsx`.
- `code-generator.ts` — `generateXBM(box, icons, {lang, useProgmem})` packs
  each icon LSB-first per row (true XBM bit order, matching u8g2's
  `drawXBM`/`drawXBMP`, unlike the scene editor's whole-framebuffer
  `generateXBM` which reuses the MSB-first `GraphicContext` packing) and
  emits one `#define`/byte-array block per icon. `code-dialog.tsx`
  (`IconCodeDialog` / `showIconCodeDialog`) picks the language, PROGMEM, and
  whether to export all icons or just the selected one.

## Sprite editor (`src/apps/sprite-editor/`)

A self-contained sprite set editor at `/sprite`, modeled closely on the icon
editor: one fixed `Box` shared by every sprite in the set, sprites keyed by
name. The one structural difference from every other editor in the app: each
pixel is a **packed 24-bit RGB color (`0xRRGGBB`)**, not a boolean — any RGB
color can be painted, opaque only (no alpha channel/transparency). Each
sprite set also carries its own editable `palette: number[]` swatch list
(seeded from `palette.ts`'s `DEFAULT_PALETTE`, the old fixed 16-color
CGA/EGA palette) shown as quick-pick swatches in the toolbar — it's just a
suggestion list, not a constraint on pixel values. No editor core, no
`AppContext`, no engine, no command manager, and **no code generation** —
u8g2 is 1bpp-only and has no natural RGB target, so unlike the other three
editors there's no Code button/dialog here.

- `palette.ts` — RGB helpers (`packRGB`, `toHex`, `fromHex`) plus
  `DEFAULT_PALETTE`, the 16-color CGA/EGA starter swatch list seeded into
  every new `SpriteSet.palette`.
- `sprite.ts` — the `SpriteSet` / `Sprite` / `Box` model: `createSpriteSet`,
  `createSprite`, `findSprite`, `uniqueName`, `remapPixels` / `resizeBox`
  (top-left anchored, same shape as the icon editor's), `serializeSpriteSet`
  / `parseSpriteSet`. `packPixels`/`unpackPixels` pack 3 bytes/pixel (RGB) —
  not 1 bit/pixel like `icon-editor/icon.ts`, and no migration from the old
  4-bit-index format (dropped when RGB replaced the fixed palette).
- `draw.ts` — pixel operations (pen, eraser, line, rect, flood fill, shift,
  flip, clear) and the `Tool` union, operating on `number[]` (packed RGB) +
  `Box` instead of `boolean[]`. No `invert` — not meaningful for arbitrary
  RGB. The union also has `eyedropper`, but it's UI-only: `sprite-canvas.tsx`
  intercepts it before any bitmap operation runs and reads the clicked
  pixel's color into the store's `color` instead of painting. A
  near-duplicate of `icon-editor/draw.ts`, not a shared import (see above).
- `sprite-store.ts` — zustand store: the `SpriteSet`, selected sprite name,
  tool, **selected draw `color` (packed RGB)**, cell size, guides, filter,
  hover cell, and an undo stack of bitmap patches keyed by sprite name
  (structural edits — add/remove sprite, box resize — clear it); also
  `addPaletteColor`/`removePaletteColor` for the project's swatch list
  (metadata only, doesn't touch the undo stack). Like the icon set, not
  persisted locally: starts as a blank 16×16 set, kept in memory only. Only
  cell-size (zoom) lives in `localStorage` (`sprite-editor-cell-size`).
- `render.ts` — `setupCanvas` plus `drawSprite`, which paints each pixel with
  `toHex(color)` (unlike the icon editor's `drawIcon`, which uses one
  caller-supplied fill color for every "on" pixel).
- `app.tsx` — layout (appbar / sprite list / grid + toolbar / properties /
  status bar), keyboard shortcuts (same as the icon editor's, minus the
  invert shortcut). When opened via `/sprite?id=`, `initialSpriteSet.data` is
  parsed with `parseSpriteSet()` into the store on mount. Same Save / "Sign
  in to Save" pattern as the other editors (`POST`/`PATCH`
  `/api/sprite-sets`); with `sprite-list.tsx`, `sprite-canvas.tsx`,
  `toolbar.tsx` (its third row is a native color picker plus the project's
  editable palette swatches — click a swatch to select its color, hover to
  reveal a remove button, or add the current picker color to the palette —
  that sets `sprite-store.ts`'s `color`), `properties.tsx`.

## Dashboard, auth & cloud persistence

- **Auth**: `src/lib/auth.ts` — `getAuth()`, a lazily-constructed `betterAuth()`
  singleton (GitHub OAuth only, via `socialProviders.github`, backed by
  `drizzleAdapter`). Lazy because `env` (bindings/secrets) comes from
  `cloudflare:workers` and is only readable while handling a request; the
  instance is memoized after that. `src/lib/auth-client.ts` exports
  `authClient` (better-auth's browser client — `authClient.signIn.social(...)`,
  `authClient.signOut()`), calling same-origin `/api/auth/*`.
- **Session middleware**: `src/middleware.ts` runs on every request, calls
  `getAuth().api.getSession(...)` and sets `Astro.locals.user` /
  `Astro.locals.session` (or `null`). Pages and API routes read
  `Astro.locals.user` / `locals.user` directly — there's no separate
  "requireAuth" helper, each route checks and redirects/401s itself.
- **Database**: `src/lib/db/schema.ts` (Drizzle, SQLite dialect, D1 binding
  `DB`) has better-auth's core tables (`user`, `session`, `account`,
  `verification` — hand-written, not generated, because generation needs
  `better-auth`'s config which pulls in `cloudflare:workers`) plus four app
  tables: `scene` (`data` = `Editor#saveToJSON` output, `width`/`height`/
  `shapeCount` mirrored for listing), `font` (`data` = raw BDF text,
  `glyphCount` mirrored), `iconSet` — SQL table name `icon_set`, the one
  place a table's SQL name and its Drizzle export diverge, since `icon_set`
  is the conventional snake_case SQLite name while every other identifier in
  the codebase stays camelCase (`data` = `IconSet` JSON, `width`/`height`/
  `iconCount` mirrored) — and `spriteSet` — SQL table name `sprite_set`,
  created directly with that name rather than diverging after the fact like
  `iconSet` did (`data` = `SpriteSet` JSON, `width`/`height`/`spriteCount`
  mirrored). All four are `userId`-scoped with `onDelete: "cascade"`.
  `src/lib/db/index.ts` — `getDb()`, same lazy-singleton pattern as
  `getAuth()`. `db/fonts.ts` (`countGlyphs`), `db/scenes.ts`
  (`parseSceneData`), `db/icon-sets.ts` (`parseIconSetData`) and
  `db/sprite-sets.ts` (`parseSpriteSetData`) derive the mirrored metadata
  without importing the editor/font-editor/icon-editor/sprite-editor code.
- **API routes** (`src/pages/api/`): `scenes/index.ts` (`GET` list metadata
  only, `POST` create) and `scenes/[id].ts` (`GET`/`PATCH`/`DELETE`), mirrored
  by `fonts/index.ts` / `fonts/[id].ts`, `icon-sets/index.ts` /
  `icon-sets/[id].ts` and `sprite-sets/index.ts` / `sprite-sets/[id].ts`.
  Every query is scoped with `eq(<table>.userId, user.id)`, so another user's
  row 404s rather than 403s. `auth/[...all].ts` just forwards to
  `getAuth().handler(request)`.
- **Dashboard app** (`src/apps/dashboard/`, route `/dashboard`, redirects to
  `/login` if signed out): `app.tsx` fetches `/api/scenes`, `/api/fonts`,
  `/api/icon-sets` and `/api/sprite-sets` on mount and renders a four-tab
  (Scenes/Fonts/Icon Sets/Sprite Sets) table via `sidebar.tsx` — create,
  inline rename (optimistic, rolls back on failure), delete (via the shared
  `ConfirmDialog`), download (blobs the full row to
  `.empix`/`.bdf`/`.eicon`/`.esprite`), and upload. "New Scene" / "New Font" /
  "New Icon Set" / "New Sprite Set" create a blank row then navigate to
  `/scene?id=…` / `/font?id=…` / `/icon?id=…` / `/sprite?id=…` (icon sets and
  sprite sets both default to a blank 16×16 box, no creation-time dialog).
  `new-font-dialog.tsx` + `charsets.ts` pick Unicode glyph ranges (optionally
  pre-filled from the embedded 6x13 font) when creating a font.
- `scene.astro` / `font.astro` / `icon.astro` / `sprite.astro` stay usable
  **anonymously** — auth is only enforced when the URL carries `?id=`: signed
  out → redirect to `/login`; signed in but the row doesn't belong to you →
  redirect back to the id-less URL. When it resolves, the row is fetched
  server-side via Drizzle and passed as
  `initialScene`/`initialFont`/`initialIconSet`/`initialSpriteSet` (plus
  `user: {name, image} | null`) props to the React app.

## Fonts

Two unrelated font pipelines:

- **BDF fonts**: `res/bdf/*.bdf` → `node tools/generate-fonts.js` →
  `src/font-data.ts` (generated; deflate + base64 — do not edit by hand),
  exposing `availableFonts` and `getEmbeddedFontBDF(name)`. The scene editor's
  `AppContext.loadFonts()` inflates each and registers it with `bdfparser`
  through `editor/font.ts`; the font editor uses the same data as seeds. Font
  names must match the u8g2 map in `engine/code-generator.ts` for codegen to
  pick the right u8g2 font.
- **UI fonts (TTF)**: `public/fonts/*.ttf` declared in `src/styles/fonts.css`.

## Conventions

- Never mutate a shape directly. Go through `editor.actions.*`, or wrap
  `editor.transform.assign/insert/delete/reorder` in
  `transform.begin()` … `transform.end()`. Direct mutation silently breaks
  undo/redo, the React mirror, and persistence.
- Color is a number: `0` = off, `1` = on, `-1` = XOR (emitted as u8g2 draw color
  `2`). All coordinates are integer device pixels.
- Adding a shape type touches, in order: `components/editor/shapes.ts`
  (interface, factory case, `render`/`getOutline`/`containsPoint`/`move`) →
  `handlers.ts` → `manipulators.ts` + `controllers.ts` → `basicSetup()` in
  `editor-component.tsx` → `apps/scene-editor/properties.tsx` →
  `apps/scene-editor/engine/code-generator.ts`.
- Adding a command: register it in `src/apps/scene-editor/commands.ts` and bind
  a key in `src/apps/scene-editor/keymap.json`; invoke with
  `window.app.commands.execute(id)`.
- Code shared across apps belongs in `src/components/` or `src/lib/`;
  app-specific code stays under its `src/apps/<app>/` directory. The font
  editor, icon editor and sprite editor deliberately don't share code with
  each other even though they're structurally similar — see the note above
  `draw.ts`.
- Import alias `@/*` → `src/*`. TypeScript is `astro/tsconfigs/strict`.
- Debugging: `window.app` (app context) and `window.editor` (editor instance) —
  scene editor only.

## Deployment

Server-rendered: `astro.config.mjs` sets `output: "server"` with the
`@astrojs/cloudflare` adapter, so `astro build` emits a Worker (not just
static assets). `wrangler.jsonc` sets `main` to the adapter's server
entrypoint, an `assets` binding for `./dist`, and a `d1_databases` binding
(`DB`, database `empix`, migrations in `drizzle/migrations`). Secrets
(`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `BETTER_AUTH_SECRET`) come from
`.dev.vars` locally and Worker secrets in production. Live at
<https://empix.niklauslee.workers.dev/>

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
