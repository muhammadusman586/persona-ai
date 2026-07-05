"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PERSONAS, type PersonaId } from "@/lib/ai/personas";
import { Button } from "@/components/ui/button";
import { createConversationRequest } from "@/lib/chat-actions";
import type { Conversation } from "@/lib/db/types";

export function Sidebar({ conversations }: { conversations: Conversation[] }) {
  const router = useRouter();

  async function newChat(persona: PersonaId) {
    const id = await createConversationRequest(persona);
    router.push(`/chat/${id}`);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => newChat("hitesh")}>
          + Hitesh
        </Button>
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => newChat("piyush")}>
          + Piyush
        </Button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="truncate rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <span className="text-muted-foreground">{PERSONAS[c.persona].name.split(" ")[0]}:</span>{" "}
            {c.title ?? "New chat"}
          </Link>
        ))}
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">No chats yet.</p>
        )}
      </nav>
    </div>
  );
}
