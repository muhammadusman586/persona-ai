import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConversation, touchConversation } from "@/lib/db/conversations";
import { listMessages, addMessage } from "@/lib/db/messages";
import { generateReply } from "@/lib/ai/generate-reply";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const conversation = await getConversation(userId, id);
  if (!conversation) return new NextResponse("Not found", { status: 404 });

  const messages = await listMessages(id);
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const conversation = await getConversation(userId, id);
  if (!conversation) return new NextResponse("Not found", { status: 404 });

  const body = await request.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const userMessage = await addMessage(id, "user", content);

  const history = await listMessages(id);
  const replyText = await generateReply({
    personaId: conversation.persona,
    history: history.map((m) => ({ role: m.role, content: m.content })),
  });

  const assistantMessage = await addMessage(id, "assistant", replyText);
  await touchConversation(userId, id);

  return NextResponse.json({ userMessage, assistantMessage });
}
