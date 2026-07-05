# Persona AI Chat — Design Spec

**Date:** 2026-07-05
**Status:** Approved (brainstorming)
**Assignment:** Build an AI-powered website that simulates conversations with either
Hitesh Choudhary or Piyush Garg, matching each person's communication style,
teaching approach, and personality.

---

## 1. Goal & Success Criteria

Build a deployed web app where a signed-in user can hold a chat conversation with an
AI that convincingly imitates **Hitesh Choudhary** or **Piyush Garg**, switch between
the two, and have their conversations persist.

Graded on:

1. **Persona Accuracy (30)** — speaking style, vocabulary, teaching approach; authentic and consistent.
2. **Conversation Quality (25)** — context-aware, helpful, coherent; persona maintained across long chats.
3. **Technical Implementation (25)** — proper LLM integration, clean architecture, maintainable code.
4. **User Experience (20)** — clean UI, easy persona switching, good response formatting.

Required deliverables: live deployed site, public GitHub repo, working dual-persona chat,
persona switching, documentation (data collection, prompt strategy, context management,
sample conversations), and a README with setup/run instructions.

## 2. Stack & Key Decisions

| Concern | Decision |
|---|---|
| Framework | Next.js 16 (App Router) — already scaffolded |
| UI | shadcn/ui + Tailwind v4 + `next-themes` (dark mode already wired) |
| LLM | OpenAI `gpt-4o` via official SDK |
| Auth | Clerk (sign-in required) |
| Database | Supabase (Postgres) |
| Supabase access | **Approach B** — server-only, scoped in API routes (no RLS in v1) |
| Response delivery | Non-streaming: full reply returned as JSON |
| Persona method | Hand-crafted persona profiles + few-shot examples (no scraping/RAG) |
| Persona switching | Persona fixed per conversation |
| Context strategy | Pinned system prompt + sliding window of recent turns, persisted in Supabase |
| Deployment | Vercel |

Rationale for Approach B: for a deadline assignment it is the simplest reliable, secure
path — the Supabase service-role key and OpenAI key never leave the server, and every DB
query is explicitly scoped by the Clerk `userId` in one shared module. RLS (Approach A) is
documented as a future hardening step.

## 3. Architecture & Request Flow

```
Browser (React, shadcn/ui)
  │  signed in via Clerk
  ▼
Next.js App Router
  ├─ Middleware (Clerk)  → protects /chat and /api/*
  ├─ Server Components   → render shell, load sidebar conversation list
  └─ Route Handlers (/api)
        ├─ auth() → userId          (Clerk, server-side)
        ├─ lib/db  (Supabase service-role client, server-only)
        └─ lib/ai  → OpenAI gpt-4o  (server-only)
```

- All security-sensitive work (secret keys, user scoping) lives in server route handlers.
- The browser only ever calls our own `/api/*` routes; it never touches Supabase or OpenAI directly.
- **`lib/db` is the only module that touches Supabase.** Every function there takes `userId`
  as its first argument and filters on it, so cross-user access is prevented in one reviewable place.

## 4. Data Model (Supabase / Postgres)

```
conversations
  id           uuid  pk  default gen_random_uuid()
  user_id      text      not null      -- Clerk user id, e.g. "user_2ab..."
  persona      text      not null      -- 'hitesh' | 'piyush'
  title        text                    -- derived from first user message
  created_at   timestamptz default now()
  updated_at   timestamptz default now()

messages
  id               uuid  pk  default gen_random_uuid()
  conversation_id  uuid  fk → conversations.id  on delete cascade
  role             text  not null       -- 'user' | 'assistant'
  content          text  not null
  created_at       timestamptz default now()
```

- Indexes: `conversations.user_id`, `messages.conversation_id`.
- `persona` is fixed at conversation creation and never changes.
- Schema shipped as a committed SQL migration file.
- No RLS in v1; scoping enforced in `lib/db`. RLS documented as a hardening follow-up.

## 5. Persona System & Prompt Strategy

Each persona is a structured config in `lib/personas/` (`hitesh.ts`, `piyush.ts`) containing:

- **Identity & bio** — who they are, what they teach, notable projects.
- **Voice rules** — Hitesh: warm, Hinglish, "Haanji!", "chai aur code", analogies, encouraging.
  Piyush: direct, practical, project- and system-design focused, TypeScript-heavy.
- **Vocabulary & catchphrases** — signature greetings, phrases, sign-offs.
- **Teaching approach** — how they explain, use of examples/analogies, pacing.
- **Guardrails** — stay in character; keep to tech/education; redirect off-topic gracefully;
  do not fabricate personal facts.
- **Few-shot examples** — 4–6 hand-written Q&A pairs per persona in authentic style.

`lib/ai/buildSystemPrompt(persona)` assembles these into the system prompt. Persona content is
researched from public sources (YouTube, hitesh.ai, piyushgarg.dev, X/social); sources recorded
in the docs deliverable.

## 6. Context Management

On each user turn, the API route builds the OpenAI `messages` array as:

1. **Pinned system prompt** for the conversation's persona (always first, never dropped).
2. **Sliding window** — the most recent N messages (start N ≈ 16, ~8 exchanges) from Supabase.
3. The new user message.

This anchors the persona regardless of chat length while bounding tokens/cost. A clean seam is
left to add **summarization of older turns** later. This strategy is the "Context management
approach" documentation section.

## 7. UX & Screens

- **Landing / sign-in (`/`)** — brief pitch + Clerk sign-in; redirect to `/chat` when authed.
- **Chat (`/chat`)** — two-pane, ChatGPT-style:
  - Left **sidebar**: New Chat + persona picker; list of past conversations labeled with persona name/avatar.
  - Right **chat pane**: message bubbles, persona header, input box, "thinking…" indicator while awaiting reply.
- **New conversation** — pick Hitesh or Piyush, then chat.
- Markdown rendering (code blocks, formatting) for replies.
- Dark mode via `next-themes` (already wired). Responsive; shadcn components throughout.

## 8. API Surface (route handlers)

- `GET  /api/conversations` — list current user's conversations.
- `POST /api/conversations` — create a conversation `{ persona }`, returns id.
- `GET  /api/conversations/:id/messages` — list messages (scoped to user).
- `POST /api/conversations/:id/messages` — append user message, call OpenAI with
  system prompt + sliding window, persist assistant reply, return it.
- `DELETE /api/conversations/:id` — delete a conversation (optional, nice-to-have).

All routes: `auth()` → `userId`, then `lib/db` scoped by `userId`.

## 9. Testing & Deployment

- **Unit**: `buildSystemPrompt`, context-window builder, `lib/db` scoping (mocked Supabase).
- **Manual smoke**: sign in → new Hitesh chat → send → reply persists → refresh keeps it →
  new Piyush chat → switch between conversations.
- **Deploy**: Vercel. Env vars: `OPENAI_API_KEY`, Clerk publishable + secret keys,
  `NEXT_PUBLIC_SUPABASE_URL`, Supabase service-role key. Schema via committed SQL migration.
- **Docs deliverables**: persona data collection & prep; prompt strategy; context management;
  sample conversations (both personas); README setup/run instructions.

## 10. Out of Scope (v1)

- RAG / vector search over transcripts.
- Streaming responses.
- Row-Level Security (documented as hardening follow-up).
- Guest chat / anonymous sessions.
- Mid-conversation persona switching.
- Summarization of old turns (seam left for later).

## 11. Risks & Notes

- **Next.js 16 breaking changes** — verify App Router / route-handler / middleware APIs against
  `node_modules/next/dist/docs/` and current docs before coding; do not trust training data.
- **Clerk + Next 16 and Supabase integration** — verify current SDK APIs during implementation.
- **Persona authenticity** is the highest-value, highest-effort area — invest research time in
  the persona configs and few-shot examples.
- **Scoping discipline** — every `lib/db` function must filter by `userId`; keep it the single
  Supabase entry point.
