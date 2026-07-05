import { PersonaPicker } from "@/components/chat/persona-picker";

export default function ChatIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Start a conversation</h1>
      <p className="max-w-md text-muted-foreground">
        Pick a mentor to begin. Each chat stays in that persona.
      </p>
      <PersonaPicker />
    </div>
  );
}
