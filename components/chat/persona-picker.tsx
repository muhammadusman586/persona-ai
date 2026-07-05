"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONAS, type PersonaId } from "@/lib/ai/personas";
import { createConversationRequest } from "@/lib/chat-actions";

export function PersonaPicker() {
  const router = useRouter();
  const [pending, setPending] = useState<PersonaId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(persona: PersonaId) {
    if (pending) return;
    setError(null);
    setPending(persona);
    try {
      const id = await createConversationRequest(persona);
      router.push(`/chat/${id}`);
      router.refresh();
    } catch {
      setError(
        "Couldn't start a chat. The server failed to create the conversation — check that the database is set up and reachable.",
      );
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-6">
        {Object.values(PERSONAS).map((p) => (
          <button
            key={p.id}
            onClick={() => start(p.id)}
            disabled={pending !== null}
            className="w-56 rounded-lg border p-4 text-left transition hover:border-primary hover:bg-muted disabled:opacity-60"
          >
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.tagline}</p>
            <p className="mt-2 text-xs font-medium text-primary">
              {pending === p.id ? "Starting…" : "Start chat →"}
            </p>
          </button>
        ))}
      </div>
      {error && (
        <p className="max-w-md text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
