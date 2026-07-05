import { PERSONAS } from "@/lib/ai/personas";

export default function ChatIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Start a conversation</h1>
      <p className="max-w-md text-muted-foreground">
        Pick a mentor from the sidebar to begin. Each chat stays in that persona.
      </p>
      <div className="flex gap-6">
        {Object.values(PERSONAS).map((p) => (
          <div key={p.id} className="w-56 rounded-lg border p-4 text-left">
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.tagline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
