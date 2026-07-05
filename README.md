# Persona AI

Chat with AI versions of two well-known Indian coding educators — **Hitesh Choudhary** and **Piyush Garg**. Each persona replies in its own voice, teaching style, and personality, and every conversation is saved to your account.

> **Live demo:** _add your Vercel URL here after deploying_

## Features

- 🎭 **Two personas** — Hitesh (warm, Hinglish, "chai aur code") and Piyush (direct, project-first, system-design focused)
- 🔀 **Easy switching** — each conversation is tied to one persona; start a new chat to switch
- 💬 **Context-aware chat** — persona stays consistent across long conversations via a pinned system prompt + sliding-window history
- 🔐 **Auth + persistence** — sign in with Clerk; conversations are stored per-user in Supabase and survive refreshes
- 🧠 **OpenAI `gpt-4o`** with a hand-crafted persona system (no fine-tuning)

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · OpenAI `gpt-4o` · Clerk (auth) · Supabase (Postgres) · deploy on Vercel.

## Architecture (Approach B)

All secrets and database access live in **server-side route handlers**. The browser only ever calls the app's own `/api/*` routes — it never touches Supabase or OpenAI directly. `lib/db/*` is the single module that talks to Supabase, and every query is scoped by the authenticated Clerk `userId`.

```
Browser (client components) ──fetch──▶ /api/* route handlers ──▶ lib/db (Supabase), lib/ai (OpenAI)
        Clerk session                     auth() → userId              server-only, keys never exposed
```

See the docs for details:

- [Persona data collection & prep](docs/persona-data.md)
- [Prompt engineering strategy](docs/prompt-strategy.md)
- [Context management approach](docs/context-management.md)
- [Sample conversations](docs/sample-conversations.md)

## Prerequisites

- Node.js 20+ and **pnpm**
- An **OpenAI** API key
- A **Clerk** application (publishable + secret keys)
- A **Supabase** project (URL + service-role key)

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in real values (see below)
```

Fill `.env.local`:

```bash
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/chat
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Apply the database schema — open the Supabase dashboard → **SQL Editor**, paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it. This creates the `conversations` and `messages` tables.

## Run

```bash
pnpm dev        # start the dev server at http://localhost:3000
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm build      # production build
```

Sign in on the landing page, then pick **Hitesh** or **Piyush** from the sidebar to start chatting.

## Project structure

```
app/
  page.tsx                     landing / sign-in (server component)
  layout.tsx                   ClerkProvider + ThemeProvider
  chat/                        protected chat UI (sidebar + conversation view)
  api/conversations/…          route handlers (list/create/delete + messages)
proxy.ts                       Clerk middleware (Next.js 16 convention)
lib/
  ai/personas/                 Hitesh & Piyush configs + registry
  ai/build-system-prompt.ts    persona → system prompt
  ai/build-context.ts          sliding-window context builder
  ai/generate-reply.ts         orchestrates persona + history → OpenAI reply
  db/                          userId-scoped Supabase data access
  supabase/server.ts           server-only Supabase client
components/chat/               sidebar, chat view, message list, input
supabase/migrations/           SQL schema
docs/                          assignment documentation
```

## Deployment (Vercel)

1. Push to a public GitHub repo.
2. Import the repo into Vercel.
3. Add all the env vars from `.env.example` (with real values) in the Vercel project settings.
4. Add your Vercel domain to the Clerk dashboard (allowed origins / production instance).
5. Deploy, then put the live URL at the top of this README.

## Notes

- **Row-Level Security** is not enabled in v1; access is enforced in the server data-access layer (Approach B). Enabling RLS with Clerk-issued JWTs is a documented future hardening step.
- Responses are non-streaming — the full reply is returned once and then persisted.
