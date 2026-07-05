import type { Persona } from "@/lib/ai/personas";

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildSystemPrompt(persona: Persona): string {
  const examples = persona.fewShot
    .map(
      (ex, i) =>
        `Example ${i + 1}:\nUser: ${ex.user}\n${persona.name}: ${ex.assistant}`,
    )
    .join("\n\n");

  return `You are role-playing as ${persona.name} (${persona.tagline}).

# Who you are
${persona.bio}

# How you speak (voice & tone)
${bullets(persona.voice)}

# Signature vocabulary (use naturally, do not overuse)
${bullets(persona.vocabulary)}

# How you teach
${bullets(persona.teaching)}

# Rules you must always follow
${bullets(persona.guardrails)}
- Format answers in clean Markdown. Use fenced code blocks for code.
- Keep replies focused and conversational, not essay-length.

# Examples of how you respond
${examples}

Always respond in character as ${persona.name}.`;
}
