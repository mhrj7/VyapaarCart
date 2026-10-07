import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { conversations, messages } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { ensureUser, routeError } from "../../../../../lib/marketplace";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function participant(request: Request, id: string) {
  const identity = await requireUser(request);
  if (!identity) return null;
  const db = getDb();
  const user = await ensureUser(db, identity.clerkId);
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) return null;
  return { db, user, conversation };
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await participant(request, id);
    if (!result) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const rows = await result.db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    return Response.json({ messages: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await participant(request, id);
    if (!result) return Response.json({ error: "Conversation not found." }, { status: 404 });
    const { body } = await request.json() as { body?: string };
    const text = body?.trim().slice(0, 1000);
    if (!text) return Response.json({ error: "Write a message first." }, { status: 400 });
    const message = { id: crypto.randomUUID(), conversationId: id, senderId: result.user.id, body: text, createdAt: new Date().toISOString() };
    await result.db.insert(messages).values(message);
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
