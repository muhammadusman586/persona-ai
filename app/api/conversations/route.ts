import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isPersonaId } from "@/lib/ai/personas";
import { listConversations, createConversation } from "@/lib/db/conversations";

export async function GET() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const conversations = await listConversations(userId);
  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => ({}));
  const persona = body?.persona;
  if (!isPersonaId(persona)) {
    return NextResponse.json({ error: "Invalid persona" }, { status: 400 });
  }

  const conversation = await createConversation(userId, persona, "New chat");
  return NextResponse.json(conversation, { status: 201 });
}
