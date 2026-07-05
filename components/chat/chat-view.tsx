"use client";

import { useState } from "react";
import { PERSONAS, type PersonaId } from "@/lib/ai/personas";
import { MessageList, type UiMessage } from "./message-list";
import { ChatInput } from "./chat-input";

export function ChatView({
  conversationId,
  persona,
  initialMessages,
}: {
  conversationId: string;
  persona: PersonaId;
  initialMessages: UiMessage[];
}) {
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);

  async function send(text: string) {
    setSending(true);
    const optimistic: UiMessage = { id: `tmp-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        { id: data.userMessage.id, role: "user", content: data.userMessage.content },
        { id: data.assistantMessage.id, role: "assistant", content: data.assistantMessage.content },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-3 font-medium">
        {PERSONAS[persona].name}
        <span className="ml-2 text-sm text-muted-foreground">{PERSONAS[persona].tagline}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <MessageList messages={messages} />
        {sending && <p className="mt-4 text-sm text-muted-foreground">{PERSONAS[persona].name.split(" ")[0]} is typing…</p>}
      </div>
      <ChatInput onSend={send} disabled={sending} />
    </div>
  );
}
