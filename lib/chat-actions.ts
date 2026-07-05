import type { PersonaId } from "@/lib/ai/personas";

export async function createConversationRequest(persona: PersonaId): Promise<string> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  if (!res.ok) throw new Error(`Failed to create conversation (${res.status})`);
  const conversation = await res.json();
  return conversation.id as string;
}
