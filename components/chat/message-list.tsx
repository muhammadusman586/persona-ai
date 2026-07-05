import { MessageBubble } from "./message-bubble";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function MessageList({ messages }: { messages: UiMessage[] }) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} role={m.role} content={m.content} />
      ))}
    </div>
  );
}
