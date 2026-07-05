import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getConversation } from "@/lib/db/conversations";
import { listMessages } from "@/lib/db/messages";
import { ChatView } from "@/components/chat/chat-view";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) notFound();

  const conversation = await getConversation(userId, id);
  if (!conversation) notFound();

  const messages = await listMessages(id);

  return (
    <ChatView
      conversationId={conversation.id}
      persona={conversation.persona}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
    />
  );
}
