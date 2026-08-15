import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

// better-auth's core schema (user/session/account/verification), hand-written
// because `better-auth/adapters/drizzle` generation needs to import the real
// auth config, which pulls in `cloudflare:workers` — unavailable outside
// workerd. Field names match better-auth's default camelCase mapping.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  idToken: text("idToken"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// A font saved from the font editor (BDF source), owned by a user and
// managed from the dashboard.
export const font = sqliteTable("font", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // BDF source, pako-deflated — see compressFontData/decompressFontData in
  // ./fonts.ts.
  data: blob("data", { mode: "buffer" }).notNull(),
  glyphCount: integer("glyphCount").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// A scene saved from the scene editor (Editor#saveToJSON, serialized),
// owned by a user and managed from the dashboard.
export const scene = sqliteTable("scene", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // JSON scene data, pako-deflated — see compressSceneData/decompressSceneData
  // in ./scenes.ts.
  data: blob("data", { mode: "buffer" }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  shapeCount: integer("shapeCount").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// An icon set saved from the icon editor (IconSet, serialized as JSON — see
// icon-editor/icon.ts), owned by a user and managed from the dashboard.
// Every icon in the set shares one box, mirrored below as width/height for
// listing.
export const iconSet = sqliteTable("icon_set", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // JSON icon set data, pako-deflated — see
  // compressIconSetData/decompressIconSetData in ./icon-sets.ts.
  data: blob("data", { mode: "buffer" }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  iconCount: integer("iconCount").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// A sprite set saved from the sprite editor (SpriteSet, serialized as JSON —
// see sprite-editor/sprite.ts), owned by a user and managed from the
// dashboard. Every sprite in the set shares one box (16-color palette-index
// pixels, not 1-bit like icon/scene/font), mirrored below as width/height
// for listing.
export const spriteSet = sqliteTable("sprite_set", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // JSON sprite set data, pako-deflated — see
  // compressSpriteSetData/decompressSpriteSetData in ./sprite-sets.ts.
  data: blob("data", { mode: "buffer" }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  spriteCount: integer("spriteCount").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});
