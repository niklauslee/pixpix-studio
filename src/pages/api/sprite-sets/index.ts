import type { APIRoute } from "astro";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { spriteSet } from "@/lib/db/schema";
import { compressSpriteSetData, parseSpriteSetData } from "@/lib/db/sprite-sets";

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await getDb()
    .select({
      id: spriteSet.id,
      name: spriteSet.name,
      width: spriteSet.width,
      height: spriteSet.height,
      spriteCount: spriteSet.spriteCount,
      createdAt: spriteSet.createdAt,
      updatedAt: spriteSet.updatedAt,
    })
    .from(spriteSet)
    .where(eq(spriteSet.userId, user.id))
    .orderBy(desc(spriteSet.updatedAt));

  return Response.json(rows);
};

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as { name?: unknown; data?: unknown };
  const data = typeof body.data === "string" ? body.data : "";
  const meta = parseSpriteSetData(data);
  if (!meta) return new Response("Not a valid sprite set file", { status: 400 });
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : "untitled";

  const now = new Date();
  const row = {
    id: crypto.randomUUID(),
    userId: user.id,
    name,
    data: compressSpriteSetData(data),
    ...meta,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(spriteSet).values(row);

  return Response.json({ ...row, data }, { status: 201 });
};
