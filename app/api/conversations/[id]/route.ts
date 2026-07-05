import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteConversation } from "@/lib/db/conversations";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  await deleteConversation(userId, id);
  return NextResponse.json({ ok: true });
}
