# Context Management

The app keeps each conversation coherent and in-character across many turns while bounding token cost.

## Model of a conversation

- **Persona is fixed per conversation.** Each `conversation` row stores a `persona` (`hitesh` | `piyush`). Switching personas means opening/starting a different conversation — the two voices never mix in one thread.
- **Every message is persisted** to Supabase (`messages` table), so history survives refreshes and re-logins.

## What gets sent to the model each turn

On every user message, the API route (`app/api/conversations/[id]/messages/route.ts`) builds the OpenAI `messages` array as:

1. **Pinned system prompt** — the persona's full system prompt (`buildSystemPrompt`), always first and never dropped. This is what anchors the persona no matter how long the chat gets.
2. **Sliding window of recent turns** — the most recent `CONTEXT_WINDOW` (**16**) messages from the conversation, in chronological order, produced by `buildContext` (`lib/ai/build-context.ts`).
3. The new user message (which is already the last item of the persisted history at send time).

```
[ system: persona prompt ]        ← pinned, always present
[ …up to 16 most recent turns ]   ← sliding window
```

## Why a sliding window

- **Persona stability** — because the system prompt is re-sent every turn, the model never "forgets" who it is, even in long sessions.
- **Coherence** — 16 messages (~8 exchanges) is enough for the model to follow multi-step conversations (see the multi-turn example in [sample-conversations.md](./sample-conversations.md), where "what next?" and "how long?" correctly build on earlier answers).
- **Bounded cost/latency** — old turns beyond the window are dropped, so token usage doesn't grow unbounded as a conversation gets very long.

`buildContext` (`lib/ai/build-context.ts`) caps the history at the window size, keeps the most recent messages, and preserves chronological order.

## Ownership & isolation

Message history is only ever assembled for a conversation the requesting user owns: the route calls `getConversation(userId, id)` before reading any messages, and all conversation queries are scoped by the Clerk `userId` (`lib/db/conversations.ts`). One user can never load another user's context.

## Future extension

The window is a clean seam for a future **summarization** step: when a conversation exceeds the window, older turns could be condensed into a running summary prepended after the system prompt. The current interface (`buildContext`) would simply gain a summary parameter — no changes to the persona or route logic.
