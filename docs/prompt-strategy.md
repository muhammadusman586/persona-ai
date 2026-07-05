# Prompt Engineering Strategy

The persona voice is driven entirely by a **structured system prompt** assembled at request time, plus **few-shot examples**. There is no fine-tuning.

## System prompt assembly

`buildSystemPrompt(persona)` (`lib/ai/build-system-prompt.ts`) turns a persona config into a single system message with clearly delimited sections:

```
You are role-playing as <Name> (<tagline>).

# Who you are            → bio
# How you speak          → voice rules (bulleted)
# Signature vocabulary   → catchphrases (bulleted)
# How you teach          → teaching approach (bulleted)
# Rules you must always follow → guardrails (bulleted)
                          + "Format answers in clean Markdown…"
                          + "Keep replies focused and conversational…"
# Examples of how you respond → few-shot User/Assistant pairs

Always respond in character as <Name>.
```

### Why this structure

- **Sectioned headers** give the model an unambiguous, scannable spec of the persona rather than one long paragraph.
- **Voice + vocabulary as explicit rules** ("open with 'Haan ji!'", "use chai analogies") reliably reproduce style markers.
- **Guardrails** keep the model on-topic (coding/education), in character, and prevent it from inventing private facts about the real person.
- **Markdown instruction** ensures code blocks and lists render cleanly in the chat UI.
- **Few-shot examples last** — the model imitates the most recent, concrete demonstrations of tone, so placing them just before the live conversation is most effective.

## Few-shot prompting

Each persona ships 4 hand-written Q&A pairs (`persona.fewShot`). They are embedded in the system prompt as labeled `User:` / `<Name>:` turns. This anchors:

- Hinglish balance (Hitesh) vs. crisp technical English (Piyush)
- Signature phrases ("chai aur code", "koi tension nahi" / "industry-standard", "ship karo")
- Answer shape: analogy → steps → encouragement (Hitesh); practical approach → build-this-next (Piyush)

## Per-persona contrast

| | Hitesh Choudhary | Piyush Garg |
|---|---|---|
| Register | Warm, mentor, Hinglish | Direct, pragmatic |
| Devices | Chai/real-life analogies, emoji | Real-world projects, best practices |
| Close | Encouragement + practice nudge | "Build this next" call to action |

## Validation

`buildSystemPrompt` is unit-tested (`lib/ai/build-system-prompt.test.ts`) to confirm the assembled prompt contains the persona's identity, voice rules, guardrails, and few-shot turns. The real-world output fidelity is shown in [sample-conversations.md](./sample-conversations.md).
