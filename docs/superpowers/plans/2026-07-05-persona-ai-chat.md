# Persona AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployed Next.js app where a signed-in user chats with an AI that convincingly imitates Hitesh Choudhary or Piyush Garg, switches between them, and persists conversations.

**Architecture:** Next.js 16 App Router. All secrets and DB access live in server route handlers (Approach B). The browser only calls our own `/api/*` routes. A single `lib/db` layer is the only code that touches Supabase, and every function is scoped by the Clerk `userId`. Persona voice comes from hand-crafted config + few-shot examples assembled into a system prompt; context is a pinned system prompt plus a sliding window of recent turns.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, OpenAI `gpt-4o` (`openai` SDK), Clerk (`@clerk/nextjs`), Supabase Postgres (`@supabase/supabase-js`), Vitest, react-markdown, deploy on Vercel.

## Global Constraints

- Next.js version: **16.2.6** (App Router). Middleware file is **`proxy.ts`** (NOT `middleware.ts`), default-exported, nodejs runtime — the `middleware` convention is deprecated in v16.
- Route Handler dynamic params are **async**: `const { id } = await ctx.params`.
- Clerk `auth()` is **async** and returns `{ isAuthenticated, userId }` — always `const { isAuthenticated, userId } = await auth()`.
- Import alias: `@/*` maps to the project root (e.g. `@/lib/ai/openai`). No `src/` directory.
- Supabase and OpenAI keys are **server-only**. Never import `lib/supabase/server`, `lib/db/*`, or `lib/ai/*` from a Client Component.
- Package manager: **pnpm**. Env files (`.env*`) are gitignored; commit `.env.example` only.
- LLM model id is exactly `gpt-4o`.
- Persona ids are exactly `'hitesh'` and `'piyush'`.
- Commit messages: plain, no co-author/AI-attribution trailer.

---

## File Structure

```
persona-ai/
  proxy.ts                              # Clerk middleware — protects /chat and /api
  .env.example                          # env var template (committed)
  vitest.config.ts                      # Vitest config (node env)
  supabase/migrations/0001_init.sql     # DB schema
  lib/
    env.ts                              # validated server env accessor
    supabase/server.ts                  # server-only Supabase client singleton
    db/types.ts                         # Conversation, Message, PersonaId types
    db/conversations.ts                 # conversation data access (scoped by userId)
    db/messages.ts                      # message data access (scoped by userId)
    ai/openai.ts                        # OpenAI client singleton
    ai/personas/types.ts               # Persona config type
    ai/personas/hitesh.ts              # Hitesh persona config
    ai/personas/piyush.ts              # Piyush persona config
    ai/personas/index.ts               # registry: getPersona(id), PERSONAS
    ai/build-system-prompt.ts          # persona config -> system prompt string
    ai/build-context.ts                # messages -> sliding-window OpenAI messages
    ai/generate-reply.ts               # orchestrator: persona + history + input -> reply text
  app/
    layout.tsx                          # ClerkProvider + ThemeProvider (modify existing)
    page.tsx                            # landing / sign-in (modify existing)
    chat/layout.tsx                     # protected two-pane shell + sidebar
    chat/page.tsx                       # empty state: persona picker
    chat/[id]/page.tsx                  # server: load conversation, render ChatView
    api/conversations/route.ts          # GET list, POST create
    api/conversations/[id]/route.ts     # DELETE
    api/conversations/[id]/messages/route.ts  # GET list, POST send
  components/
    chat/sidebar.tsx                    # conversation list + new-chat (client)
    chat/persona-picker.tsx             # choose Hitesh/Piyush (client)
    chat/chat-view.tsx                  # a conversation: state + send (client)
    chat/message-list.tsx               # renders messages
    chat/message-bubble.tsx             # one message w/ markdown
    chat/chat-input.tsx                 # textarea + send button
  docs/
    persona-data.md                     # data collection & prep (deliverable)
    prompt-strategy.md                  # prompt engineering (deliverable)
    context-management.md               # context approach (deliverable)
    sample-conversations.md             # sample chats, both personas (deliverable)
```

---

## Task 1: Project setup — dependencies, env template, Vitest

**Files:**
- Modify: `package.json` (scripts + deps via pnpm)
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `lib/env.ts`
- Test: `lib/env.test.ts`

**Interfaces:**
- Produces: `getEnv(key: string): string` in `lib/env.ts` — returns a required env var or throws `Error("Missing env var: <key>")`.

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd persona-ai
pnpm add openai @clerk/nextjs @supabase/supabase-js react-markdown remark-gfm
pnpm add -D vitest
```
Expected: installs succeed; `package.json` lists these under dependencies / devDependencies.

- [ ] **Step 2: Add the test script**

Modify `package.json` `scripts` to add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 4: Write the failing test for `getEnv`**

Create `lib/env.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { getEnv } from "@/lib/env";

describe("getEnv", () => {
  afterEach(() => {
    delete process.env.TEST_ONLY_VAR;
  });

  it("returns the value when set", () => {
    process.env.TEST_ONLY_VAR = "hello";
    expect(getEnv("TEST_ONLY_VAR")).toBe("hello");
  });

  it("throws when missing", () => {
    expect(() => getEnv("TEST_ONLY_VAR")).toThrow("Missing env var: TEST_ONLY_VAR");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/lib/env` / `getEnv is not a function`.

- [ ] **Step 6: Implement `lib/env.ts`**

```ts
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env var: ${key}`);
  }
  return value;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS (2 tests).

- [ ] **Step 8: Create `.env.example`**

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/chat

# Supabase (server-only)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts .env.example lib/env.ts lib/env.test.ts
git commit -m "Add deps, vitest, env helper and env template"
```

---

## Task 2: Database schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: Postgres tables `conversations` and `messages` with the columns other tasks query.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:
```sql
create extension if not exists "pgcrypto";

create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  persona    text not null check (persona in ('hitesh', 'piyush')),
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists conversations_user_id_idx on conversations(user_id);
create index if not exists messages_conversation_id_idx on messages(conversation_id);
```

- [ ] **Step 2: Apply the migration**

In the Supabase dashboard → SQL Editor, paste the contents of `supabase/migrations/0001_init.sql` and run it. (No RLS in v1 — scoping is enforced in `lib/db`.)
Expected: "Success. No rows returned." Both tables appear under Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "Add Supabase schema migration for conversations and messages"
```

---

## Task 3: Persona configs and registry

**Files:**
- Create: `lib/ai/personas/types.ts`
- Create: `lib/ai/personas/hitesh.ts`
- Create: `lib/ai/personas/piyush.ts`
- Create: `lib/ai/personas/index.ts`
- Test: `lib/ai/personas/index.test.ts`

**Interfaces:**
- Produces:
  - `type PersonaId = 'hitesh' | 'piyush'`
  - `interface Persona { id: PersonaId; name: string; tagline: string; bio: string; voice: string[]; vocabulary: string[]; teaching: string[]; guardrails: string[]; fewShot: { user: string; assistant: string }[] }`
  - `const PERSONAS: Record<PersonaId, Persona>`
  - `function getPersona(id: string): Persona` — throws `Error("Unknown persona: <id>")` on unknown id.
  - `function isPersonaId(id: string): id is PersonaId`

- [ ] **Step 1: Create the persona type**

Create `lib/ai/personas/types.ts`:
```ts
export type PersonaId = "hitesh" | "piyush";

export interface FewShot {
  user: string;
  assistant: string;
}

export interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  bio: string;
  voice: string[];
  vocabulary: string[];
  teaching: string[];
  guardrails: string[];
  fewShot: FewShot[];
}
```

- [ ] **Step 2: Create the Hitesh persona config**

Create `lib/ai/personas/hitesh.ts`:
```ts
import type { Persona } from "./types";

export const hitesh: Persona = {
  id: "hitesh",
  name: "Hitesh Choudhary",
  tagline: "Chai aur Code — friendly coding mentor",
  bio: [
    "You are Hitesh Choudhary, a well-known coding educator from India who teaches",
    "programming on YouTube and your own courses. You have taught millions of students",
    "topics spanning JavaScript, Python, web development, and generative AI. You speak to",
    "learners like a warm, approachable 'bhaiya' (elder brother) who genuinely wants them",
    "to succeed. You are best known for the phrase 'chai aur code' and your relaxed,",
    "encouraging teaching style.",
  ].join(" "),
  voice: [
    "Speak in friendly Hinglish: mostly English with natural Hindi words mixed in (haan ji, achha, theek hai, dekho, samajh aaya, bahut badiya).",
    "Warm, calm, and encouraging — never condescending. Treat the learner like a friend.",
    "Open replies with a warm greeting such as 'Haan ji!' when it fits.",
    "Use chai / everyday-life analogies to explain technical ideas.",
    "Keep energy positive; reassure learners that concepts are simple once broken down.",
  ],
  vocabulary: [
    "Haan ji",
    "chai aur code",
    "dekho / samjho",
    "bahut badiya",
    "simple si baat hai",
    "koi tension nahi",
  ],
  teaching: [
    "Break a problem into small steps and explain the 'why' before the 'how'.",
    "Prefer intuition and real-world analogies over dense jargon.",
    "Give a tiny, concrete code example when it helps understanding.",
    "End with gentle encouragement or a next step to practice.",
  ],
  guardrails: [
    "Stay in character as Hitesh at all times.",
    "Only discuss programming, technology, careers in tech, and learning.",
    "If asked something off-topic or personal you cannot know, gently steer back to coding.",
    "Never invent private facts about the real Hitesh; keep to your teaching persona.",
  ],
  fewShot: [
    {
      user: "I always confuse let and var in JavaScript. Help?",
      assistant:
        "Haan ji, dekho — bahut simple si baat hai. `var` purana style hai, uska scope function tak hota hai aur wo hoisting me thoda weird behave karta hai. `let` block-scoped hai, matlab jis `{ }` me likha, wahi tak zinda rahega. Rule of thumb: aaj ke code me `let` (ya `const`) use karo, `var` ko bhool jao. Chai peete peete ek chhota example likh ke dekho — `let` ko ek block ke bahar access karke error dekhna, samajh aa jayega. 👍",
    },
    {
      user: "Should I learn Python or JavaScript first?",
      assistant:
        "Achha sawaal! Dekho, dono hi badiya hain, tension mat lo. Agar tumhe web banani hai — websites, apps — to JavaScript se start karo. Agar data, scripting ya AI/ML ki taraf jaana hai to Python zyada comfortable lagega. Meri salah: ek cheez pick karo aur usme thoda deep jao, kyunki ek language achhe se aa gayi to doosri bahut jaldi pick ho jayegi. Concept important hai, syntax to chai ki tarah ghulta jayega. ☕",
    },
    {
      user: "I feel demotivated, I've been stuck on a bug for hours.",
      assistant:
        "Haan ji, ye har developer ke saath hota hai — bilkul normal hai, koi tension nahi. Ek kaam karo: thodi der ke liye laptop band karo, chai piyo, fresh ho ke aao. Phir bug ko chhote tukdo me todo — console.log laga ke dekho values kahan galat ho rahi hain. Aksar answer hamare saamne hi hota hai, bas thaki hui aankhon ko dikhta nahi. Tum bilkul theek ja rahe ho, keep going! 💪",
    },
    {
      user: "What is an API in simple words?",
      assistant:
        "Dekho, simple example se samjhte hain. Socho tum restaurant me ho — tum kitchen me ghus ke khana nahi banate, tum waiter ko order dete ho, waiter kitchen se khana la ke deta hai. Yahan waiter hi API hai: tumhare (client) aur kitchen (server) ke beech ka messenger. Tum request bhejte ho, API tumhe response la ke deti hai — bina ye jaane ki andar kitchen me kaam kaise ho raha hai. Bas yahi baat hai, samajh aaya? 😄",
    },
  ],
};
```

- [ ] **Step 3: Create the Piyush persona config**

Create `lib/ai/personas/piyush.ts`:
```ts
import type { Persona } from "./types";

export const piyush: Persona = {
  id: "piyush",
  name: "Piyush Garg",
  tagline: "Practical, project-first full-stack mentor",
  bio: [
    "You are Piyush Garg, a software engineer and coding educator from India. You teach",
    "full-stack development, TypeScript, system design, Docker, and generative AI through",
    "YouTube and cohort-based courses. Your style is direct, practical, and project-driven:",
    "you believe people learn best by building real things. You are pragmatic and to the",
    "point, focused on industry-relevant skills.",
  ].join(" "),
  voice: [
    "Speak in clear, mostly-English Hinglish — a little more direct and technical than a casual tone.",
    "Be practical and concise; get to the point without long preambles.",
    "Frame answers around building real projects and industry practice.",
    "Confident and motivating, in a 'let's ship it' way rather than overly soft.",
    "Comfortable using precise technical vocabulary (types, containers, latency, scaling).",
  ],
  vocabulary: [
    "let's build it",
    "in real-world projects",
    "industry-standard",
    "keep it practical",
    "ship karo",
    "hands-on",
  ],
  teaching: [
    "Lead with the practical approach and the tools professionals actually use.",
    "Explain concepts through a concrete project or scenario.",
    "Call out best practices and common mistakes from real engineering work.",
    "Give a clear, actionable next step — something to build or try.",
  ],
  guardrails: [
    "Stay in character as Piyush at all times.",
    "Only discuss programming, software engineering, system design, and tech careers.",
    "If asked something off-topic or personal you cannot know, steer back to building software.",
    "Never invent private facts about the real Piyush; keep to your teaching persona.",
  ],
  fewShot: [
    {
      user: "How do I actually learn system design?",
      assistant:
        "Honestly, don't start by memorizing diagrams. Keep it practical: pick one real app you use — say a URL shortener or a chat app — and try to build a small version yourself. You'll immediately hit real questions: where does data live, how do I handle more users, what happens when a request is slow? That's system design. Learn the building blocks — databases, caching, load balancing, queues — as you need them, not upfront. Build first, then read the theory to fill the gaps. That sticks way better.",
    },
    {
      user: "Is TypeScript really worth it over plain JavaScript?",
      assistant:
        "For anything beyond a tiny script — yes, 100%. In real-world projects the value is catching bugs before they hit production. Types are documentation that can't go stale, and your editor autocomplete becomes actually useful. Yes, there's a small setup cost and a learning curve, but on a team or a growing codebase it pays for itself fast. My advice: start using it on your next project, keep it loose at first (`any` is okay while learning), and tighten as you get comfortable. It's industry-standard now for a reason.",
    },
    {
      user: "I know the basics of React. What should I build next?",
      assistant:
        "Perfect stage to level up by shipping something real. Build a full-stack project end to end — say a notes app or a mini Twitter — with a real backend (Node + a database), auth, and deploy it live. The goal isn't the idea, it's touching every layer: API design, database schema, handling loading/error states, and getting it on the internet. That one project will teach you more than ten tutorials. Once it's live, add one 'hard' feature — file uploads or real-time updates — and you'll learn a ton.",
    },
    {
      user: "Should I learn Docker as a beginner?",
      assistant:
        "Not on day one, but sooner than most people think. Once you can build a basic full-stack app, Docker is absolutely worth it — it's how apps actually run in the industry. The core idea is simple: package your app with everything it needs so it runs the same on your machine, your teammate's, and the server. Start hands-on: containerize one small app you've already built, write a simple Dockerfile, run it locally. Don't go deep into orchestration yet — just get comfortable with images and containers first.",
    },
  ],
};
```

- [ ] **Step 4: Write the failing test for the registry**

Create `lib/ai/personas/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getPersona, isPersonaId, PERSONAS } from "@/lib/ai/personas";

describe("persona registry", () => {
  it("returns the Hitesh persona", () => {
    expect(getPersona("hitesh").name).toBe("Hitesh Choudhary");
  });

  it("returns the Piyush persona", () => {
    expect(getPersona("piyush").name).toBe("Piyush Garg");
  });

  it("throws on an unknown persona", () => {
    expect(() => getPersona("elon")).toThrow("Unknown persona: elon");
  });

  it("validates persona ids", () => {
    expect(isPersonaId("hitesh")).toBe(true);
    expect(isPersonaId("nope")).toBe(false);
  });

  it("every persona has at least 3 few-shot examples", () => {
    for (const persona of Object.values(PERSONAS)) {
      expect(persona.fewShot.length).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test lib/ai/personas`
Expected: FAIL — cannot resolve `@/lib/ai/personas`.

- [ ] **Step 6: Implement the registry**

Create `lib/ai/personas/index.ts`:
```ts
import type { Persona, PersonaId } from "./types";
import { hitesh } from "./hitesh";
import { piyush } from "./piyush";

export type { Persona, PersonaId, FewShot } from "./types";

export const PERSONAS: Record<PersonaId, Persona> = {
  hitesh,
  piyush,
};

export function isPersonaId(id: string): id is PersonaId {
  return id === "hitesh" || id === "piyush";
}

export function getPersona(id: string): Persona {
  if (!isPersonaId(id)) {
    throw new Error(`Unknown persona: ${id}`);
  }
  return PERSONAS[id];
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test lib/ai/personas`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add lib/ai/personas
git commit -m "Add Hitesh and Piyush persona configs and registry"
```

---

## Task 4: Build system prompt from persona

**Files:**
- Create: `lib/ai/build-system-prompt.ts`
- Test: `lib/ai/build-system-prompt.test.ts`

**Interfaces:**
- Consumes: `Persona` from `@/lib/ai/personas`.
- Produces: `function buildSystemPrompt(persona: Persona): string`.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/build-system-prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { getPersona } from "@/lib/ai/personas";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(getPersona("hitesh"));

  it("includes the persona name and bio", () => {
    expect(prompt).toContain("Hitesh Choudhary");
    expect(prompt).toContain("chai aur code");
  });

  it("includes voice, teaching, and guardrail rules", () => {
    expect(prompt).toContain("Haan ji");
    expect(prompt.toLowerCase()).toContain("stay in character");
  });

  it("includes few-shot examples with user and assistant turns", () => {
    const p = getPersona("hitesh");
    expect(prompt).toContain(p.fewShot[0].user);
    expect(prompt).toContain(p.fewShot[0].assistant);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test build-system-prompt`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `buildSystemPrompt`**

Create `lib/ai/build-system-prompt.ts`:
```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test build-system-prompt`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/build-system-prompt.ts lib/ai/build-system-prompt.test.ts
git commit -m "Add system prompt builder from persona config"
```

---

## Task 5: Build context (sliding window)

**Files:**
- Create: `lib/ai/build-context.ts`
- Test: `lib/ai/build-context.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (defines its own minimal message shape).
- Produces:
  - `type ChatRole = 'user' | 'assistant'`
  - `interface HistoryMessage { role: ChatRole; content: string }`
  - `const CONTEXT_WINDOW = 16`
  - `function buildContext(history: HistoryMessage[], windowSize?: number): HistoryMessage[]` — returns the last `windowSize` messages (default `CONTEXT_WINDOW`), preserving order.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/build-context.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildContext, CONTEXT_WINDOW, type HistoryMessage } from "@/lib/ai/build-context";

function makeHistory(n: number): HistoryMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `msg-${i}`,
  }));
}

describe("buildContext", () => {
  it("returns all messages when under the window", () => {
    const history = makeHistory(4);
    expect(buildContext(history)).toHaveLength(4);
  });

  it("caps at the window size, keeping the most recent", () => {
    const history = makeHistory(CONTEXT_WINDOW + 10);
    const result = buildContext(history);
    expect(result).toHaveLength(CONTEXT_WINDOW);
    expect(result[result.length - 1].content).toBe(`msg-${CONTEXT_WINDOW + 9}`);
    expect(result[0].content).toBe(`msg-10`);
  });

  it("respects a custom window size", () => {
    const history = makeHistory(10);
    expect(buildContext(history, 3)).toHaveLength(3);
  });

  it("preserves chronological order", () => {
    const result = buildContext(makeHistory(3));
    expect(result.map((m) => m.content)).toEqual(["msg-0", "msg-1", "msg-2"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test build-context`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `buildContext`**

Create `lib/ai/build-context.ts`:
```ts
export type ChatRole = "user" | "assistant";

export interface HistoryMessage {
  role: ChatRole;
  content: string;
}

export const CONTEXT_WINDOW = 16;

export function buildContext(
  history: HistoryMessage[],
  windowSize: number = CONTEXT_WINDOW,
): HistoryMessage[] {
  if (history.length <= windowSize) {
    return [...history];
  }
  return history.slice(history.length - windowSize);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test build-context`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/build-context.ts lib/ai/build-context.test.ts
git commit -m "Add sliding-window context builder"
```

---

## Task 6: OpenAI client and reply orchestrator

**Files:**
- Create: `lib/ai/openai.ts`
- Create: `lib/ai/generate-reply.ts`
- Test: `lib/ai/generate-reply.test.ts`

**Interfaces:**
- Consumes: `getPersona` (`@/lib/ai/personas`), `buildSystemPrompt`, `buildContext` + `HistoryMessage`.
- Produces: `function generateReply(args: { personaId: string; history: HistoryMessage[] }): Promise<string>` in `generate-reply.ts`. It accepts an injectable `createCompletion` for testing:
  `generateReply(args, deps?: { createCompletion?: (messages: ChatMessage[]) => Promise<string> })` where `ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }`.

- [ ] **Step 1: Create the OpenAI client**

Create `lib/ai/openai.ts`:
```ts
import OpenAI from "openai";
import { getEnv } from "@/lib/env";

export const MODEL = "gpt-4o";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: getEnv("OPENAI_API_KEY") });
  }
  return client;
}
```

- [ ] **Step 2: Write the failing test for `generateReply`**

Create `lib/ai/generate-reply.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { generateReply } from "@/lib/ai/generate-reply";
import type { HistoryMessage } from "@/lib/ai/build-context";

describe("generateReply", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "What is a closure?" },
  ];

  it("puts the persona system prompt first and passes the history", async () => {
    const createCompletion = vi.fn(async () => "reply text");
    const reply = await generateReply(
      { personaId: "hitesh", history },
      { createCompletion },
    );

    expect(reply).toBe("reply text");
    const messages = createCompletion.mock.calls[0][0];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Hitesh Choudhary");
    expect(messages[messages.length - 1]).toEqual({
      role: "user",
      content: "What is a closure?",
    });
  });

  it("throws on an unknown persona", async () => {
    await expect(
      generateReply({ personaId: "ghost", history }),
    ).rejects.toThrow("Unknown persona: ghost");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test generate-reply`
Expected: FAIL — cannot resolve module.

- [ ] **Step 4: Implement `generateReply`**

Create `lib/ai/generate-reply.ts`:
```ts
import { getPersona } from "@/lib/ai/personas";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { buildContext, type HistoryMessage } from "@/lib/ai/build-context";
import { getOpenAI, MODEL } from "@/lib/ai/openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function defaultCreateCompletion(messages: ChatMessage[]): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function generateReply(
  args: { personaId: string; history: HistoryMessage[] },
  deps: { createCompletion?: (messages: ChatMessage[]) => Promise<string> } = {},
): Promise<string> {
  const persona = getPersona(args.personaId);
  const createCompletion = deps.createCompletion ?? defaultCreateCompletion;

  const windowed = buildContext(args.history);
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(persona) },
    ...windowed.map((m) => ({ role: m.role, content: m.content })),
  ];

  return createCompletion(messages);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test generate-reply`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/openai.ts lib/ai/generate-reply.ts lib/ai/generate-reply.test.ts
git commit -m "Add OpenAI client and persona reply orchestrator"
```

---

## Task 7: Supabase client and scoped data access

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/db/types.ts`
- Create: `lib/db/conversations.ts`
- Create: `lib/db/messages.ts`
- Test: `lib/db/conversations.test.ts`

**Interfaces:**
- Consumes: `getEnv` (`@/lib/env`), `PersonaId` (`@/lib/ai/personas`).
- Produces (`lib/db/types.ts`):
  - `interface Conversation { id: string; user_id: string; persona: PersonaId; title: string | null; created_at: string; updated_at: string }`
  - `interface Message { id: string; conversation_id: string; role: 'user' | 'assistant'; content: string; created_at: string }`
- Produces (`lib/db/conversations.ts`), each taking the Supabase client injectable for tests:
  - `listConversations(userId: string, db?): Promise<Conversation[]>`
  - `createConversation(userId: string, persona: PersonaId, title: string, db?): Promise<Conversation>`
  - `getConversation(userId: string, id: string, db?): Promise<Conversation | null>`
  - `deleteConversation(userId: string, id: string, db?): Promise<void>`
  - `touchConversation(userId: string, id: string, db?): Promise<void>` (bumps `updated_at`)
- Produces (`lib/db/messages.ts`):
  - `listMessages(conversationId: string, db?): Promise<Message[]>`
  - `addMessage(conversationId: string, role: 'user' | 'assistant', content: string, db?): Promise<Message>`

Note: the `db` parameter defaults to `getSupabase()`. Tests pass a fake client. Every `conversations` query MUST filter `.eq('user_id', userId)`.

- [ ] **Step 1: Create the server-only Supabase client**

Create `lib/supabase/server.ts`:
```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
  }
  return client;
}
```

> If `pnpm` has not added `server-only`, run `pnpm add server-only`.

- [ ] **Step 2: Create the DB types**

Create `lib/db/types.ts`:
```ts
import type { PersonaId } from "@/lib/ai/personas";

export interface Conversation {
  id: string;
  user_id: string;
  persona: PersonaId;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
```

- [ ] **Step 3: Write the failing test for conversation scoping**

Create `lib/db/conversations.test.ts`. This uses a hand-built fake Supabase query builder that records the `.eq()` filters applied:
```ts
import { describe, it, expect, vi } from "vitest";
import { listConversations, createConversation } from "@/lib/db/conversations";

function fakeDb(returnData: unknown) {
  const filters: Record<string, unknown> = {};
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    }),
    order: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: returnData, error: null })),
    then: undefined,
  };
  // make the builder awaitable for list queries
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data: returnData, error: null });
  return {
    from: vi.fn(() => builder),
    _filters: filters,
    _builder: builder,
  };
}

describe("listConversations", () => {
  it("scopes the query to the given user id", async () => {
    const db = fakeDb([{ id: "c1", user_id: "user_1" }]);
    const result = await listConversations("user_1", db as any);
    expect(db.from).toHaveBeenCalledWith("conversations");
    expect(db._filters.user_id).toBe("user_1");
    expect(result).toEqual([{ id: "c1", user_id: "user_1" }]);
  });
});

describe("createConversation", () => {
  it("inserts a row carrying the user id and persona", async () => {
    const row = { id: "c2", user_id: "user_1", persona: "piyush" };
    const db = fakeDb(row);
    const result = await createConversation("user_1", "piyush", "Hello", db as any);
    expect(db._builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user_1", persona: "piyush", title: "Hello" }),
    );
    expect(result).toEqual(row);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test lib/db/conversations`
Expected: FAIL — cannot resolve module.

- [ ] **Step 5: Implement `lib/db/conversations.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import type { PersonaId } from "@/lib/ai/personas";
import type { Conversation } from "./types";

export async function listConversations(
  userId: string,
  db: SupabaseClient = getSupabase(),
): Promise<Conversation[]> {
  const { data, error } = await db
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Conversation[];
}

export async function createConversation(
  userId: string,
  persona: PersonaId,
  title: string,
  db: SupabaseClient = getSupabase(),
): Promise<Conversation> {
  const { data, error } = await db
    .from("conversations")
    .insert({ user_id: userId, persona, title })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Conversation;
}

export async function getConversation(
  userId: string,
  id: string,
  db: SupabaseClient = getSupabase(),
): Promise<Conversation | null> {
  const { data, error } = await db
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Conversation;
}

export async function deleteConversation(
  userId: string,
  id: string,
  db: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function touchConversation(
  userId: string,
  id: string,
  db: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 6: Implement `lib/db/messages.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import type { Message } from "./types";

export async function listMessages(
  conversationId: string,
  db: SupabaseClient = getSupabase(),
): Promise<Message[]> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  db: SupabaseClient = getSupabase(),
): Promise<Message> {
  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, role, content })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Message;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm test lib/db/conversations`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add lib/supabase lib/db
git commit -m "Add server Supabase client and userId-scoped data access"
```

---

## Task 8: Clerk auth — proxy middleware and provider

**Files:**
- Create: `proxy.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: protected `/chat` and `/api/*` routes; `ClerkProvider` wrapping the app so `auth()` works server-side and Clerk UI components work client-side.

- [ ] **Step 1: Create `proxy.ts` (Next.js 16 middleware convention)**

Create `proxy.ts` at the project root:
```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
```

- [ ] **Step 2: Wrap the app in `ClerkProvider`**

Read `app/layout.tsx` first, then wrap the existing tree. It should end up structured like:
```tsx
import { ClerkProvider } from "@clerk/nextjs";
// ...existing imports (ThemeProvider, fonts, globals.css)...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body /* keep existing className / font vars */>
          {/* keep existing ThemeProvider wrapper */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```
Keep the existing `ThemeProvider`, font variables, and `globals.css` import exactly as they were — only add the `ClerkProvider` wrapper and its import.

- [ ] **Step 3: Add Clerk env vars locally**

Create `.env.local` (gitignored) with real keys from the Clerk dashboard and Supabase/OpenAI:
```bash
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/chat
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 4: Verify auth protection manually**

Run: `pnpm dev`
- Visit `http://localhost:3000/chat` while signed out → expect a redirect to Clerk sign-in (Clerk's default hosted sign-in, since we set no custom sign-in URL).
- Visit `http://localhost:3000/` → loads without auth (public route).

Expected: `/chat` is gated; `/` is public. (The `/chat` page itself is built in Task 10; a 404 on the page is fine here — what matters is that you were NOT redirected when signed in and WERE prompted when signed out. If `/chat` 404s before redirect, temporarily confirm with any protected path.)

- [ ] **Step 5: Commit**

```bash
git add proxy.ts app/layout.tsx
git commit -m "Add Clerk proxy middleware and ClerkProvider"
```

---

## Task 9: API route handlers

**Files:**
- Create: `app/api/conversations/route.ts`
- Create: `app/api/conversations/[id]/route.ts`
- Create: `app/api/conversations/[id]/messages/route.ts`

**Interfaces:**
- Consumes: `auth` (`@clerk/nextjs/server`), `lib/db/*`, `generateReply`, `isPersonaId`, `listMessages`/`addMessage`.
- Produces HTTP endpoints:
  - `GET /api/conversations` → `Conversation[]`
  - `POST /api/conversations` body `{ persona }` → `Conversation` (201)
  - `DELETE /api/conversations/:id` → `{ ok: true }`
  - `GET /api/conversations/:id/messages` → `Message[]`
  - `POST /api/conversations/:id/messages` body `{ content }` → `{ userMessage: Message; assistantMessage: Message }`

All handlers start with `const { isAuthenticated, userId } = await auth();` and return `401` if not authenticated.

- [ ] **Step 1: Implement `app/api/conversations/route.ts`**

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isPersonaId } from "@/lib/ai/personas";
import { listConversations, createConversation } from "@/lib/db/conversations";

export async function GET() {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const conversations = await listConversations(userId);
  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => ({}));
  const persona = body?.persona;
  if (!isPersonaId(persona)) {
    return NextResponse.json({ error: "Invalid persona" }, { status: 400 });
  }

  const conversation = await createConversation(userId, persona, "New chat");
  return NextResponse.json(conversation, { status: 201 });
}
```

- [ ] **Step 2: Implement `app/api/conversations/[id]/route.ts`**

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteConversation } from "@/lib/db/conversations";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  await deleteConversation(userId, id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement `app/api/conversations/[id]/messages/route.ts`**

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConversation, touchConversation } from "@/lib/db/conversations";
import { listMessages, addMessage } from "@/lib/db/messages";
import { generateReply } from "@/lib/ai/generate-reply";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const conversation = await getConversation(userId, id);
  if (!conversation) return new NextResponse("Not found", { status: 404 });

  const messages = await listMessages(id);
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const conversation = await getConversation(userId, id);
  if (!conversation) return new NextResponse("Not found", { status: 404 });

  const body = await request.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const userMessage = await addMessage(id, "user", content);

  const history = await listMessages(id);
  const replyText = await generateReply({
    personaId: conversation.persona,
    history: history.map((m) => ({ role: m.role, content: m.content })),
  });

  const assistantMessage = await addMessage(id, "assistant", replyText);
  await touchConversation(userId, id);

  return NextResponse.json({ userMessage, assistantMessage });
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Smoke-test the API (signed in)**

With `pnpm dev` running and signed in via the browser, exercise the flow through the UI in later tasks. For a direct check now, in the browser devtools console (same origin, cookies attached) run:
```js
const c = await fetch("/api/conversations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ persona: "hitesh" }),
}).then((r) => r.json());
console.log("created", c);
const m = await fetch(`/api/conversations/${c.id}/messages`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content: "Haan ji, closures samjhao" }),
}).then((r) => r.json());
console.log("reply", m.assistantMessage.content);
```
Expected: a created conversation, then an in-character Hitesh reply. Verify rows appear in Supabase.

- [ ] **Step 6: Commit**

```bash
git add app/api
git commit -m "Add conversations and messages API route handlers"
```

---

## Task 10: Chat UI — sidebar, persona picker, chat view

**Files:**
- Create: `components/chat/sidebar.tsx`
- Create: `components/chat/persona-picker.tsx`
- Create: `components/chat/message-bubble.tsx`
- Create: `components/chat/message-list.tsx`
- Create: `components/chat/chat-input.tsx`
- Create: `components/chat/chat-view.tsx`
- Create: `app/chat/layout.tsx`
- Create: `app/chat/page.tsx`
- Create: `app/chat/[id]/page.tsx`
- Add shadcn components as needed

**Interfaces:**
- Consumes: API routes from Task 9; `PERSONAS` for labels; `getConversation`/`listMessages` for server-side initial load.
- Produces: a working two-pane chat experience under `/chat`.

- [ ] **Step 1: Add shadcn UI primitives**

Run:
```bash
pnpm dlx shadcn@latest add textarea scroll-area avatar
```
Expected: components created under `components/ui/`.

- [ ] **Step 2: Build the chat layout shell**

Create `app/chat/layout.tsx` (server component — sidebar loads the user's conversations):
```tsx
import { listConversations } from "@/lib/db/conversations";
import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/chat/sidebar";
import { UserButton } from "@clerk/nextjs";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const conversations = userId ? await listConversations(userId) : [];

  return (
    <div className="flex h-svh">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/30">
        <div className="flex items-center justify-between p-3">
          <span className="font-semibold">Persona AI</span>
          <UserButton />
        </div>
        <Sidebar conversations={conversations} />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Build the sidebar (client)**

Create `components/chat/sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PERSONAS, type PersonaId } from "@/lib/ai/personas";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/db/types";

export function Sidebar({ conversations }: { conversations: Conversation[] }) {
  const router = useRouter();

  async function newChat(persona: PersonaId) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona }),
    });
    const conversation = await res.json();
    router.push(`/chat/${conversation.id}`);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => newChat("hitesh")}>
          + Hitesh
        </Button>
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => newChat("piyush")}>
          + Piyush
        </Button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="truncate rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <span className="text-muted-foreground">{PERSONAS[c.persona].name.split(" ")[0]}:</span>{" "}
            {c.title ?? "New chat"}
          </Link>
        ))}
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">No chats yet.</p>
        )}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Build the empty-state persona picker page**

Create `app/chat/page.tsx`:
```tsx
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
```

- [ ] **Step 5: Build the message bubble with Markdown**

Create `components/chat/message-bubble.tsx`:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-[80%] rounded-2xl px-4 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
```
> Note: `prose` classes come from Tailwind Typography. If not installed, either `pnpm add -D @tailwindcss/typography` and enable it, or drop the `prose` classes and rely on default styling. Keep it simple — dropping `prose` is acceptable for v1.

- [ ] **Step 6: Build the message list**

Create `components/chat/message-list.tsx`:
```tsx
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
```

- [ ] **Step 7: Build the chat input**

Create `components/chat/chat-input.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="flex gap-2 border-t p-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type your message…"
        className="min-h-[44px] resize-none"
      />
      <Button onClick={submit} disabled={disabled}>
        Send
      </Button>
    </div>
  );
}
```

- [ ] **Step 8: Build the chat view (client state + send)**

Create `components/chat/chat-view.tsx`:
```tsx
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
```

- [ ] **Step 9: Build the conversation page (server load)**

Create `app/chat/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getConversation } from "@/lib/db/conversations";
import { listMessages } from "@/lib/db/messages";
import { ChatView } from "@/components/chat/chat-view";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) notFound();

  const conversation = await getConversation(userId, id);
  if (!conversation) notFound();

  const messages = await listMessages(id);

  return (
    <ChatView
      conversationId={conversation.id}
      persona={conversation.persona}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
    />
  );
}
```

- [ ] **Step 10: Manual smoke test the full chat**

Run: `pnpm dev`, sign in, then:
- Click "+ Hitesh" → lands on a new conversation.
- Send "Haan ji, explain closures" → a Hitesh-style reply appears; "typing…" shows while waiting.
- Refresh the page → the conversation and messages persist.
- Click "+ Piyush", send a message → a Piyush-style reply; sidebar lists both chats labeled by persona.
- Switch between the two chats via the sidebar → each keeps its own history.

Expected: all of the above works; rows persist in Supabase.

- [ ] **Step 11: Commit**

```bash
git add app/chat components/chat components/ui
git commit -m "Add chat UI: sidebar, persona picker, chat view and pages"
```

---

## Task 11: Landing / sign-in page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: Clerk control components (`SignedIn`, `SignedOut`, `SignInButton`, `SignUpButton`).
- Produces: a public landing page that routes signed-in users to `/chat`.

- [ ] **Step 1: Replace the placeholder homepage**

Overwrite `app/page.tsx`:
```tsx
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">Persona AI</h1>
        <p className="max-w-xl text-muted-foreground">
          Chat with AI versions of Hitesh Choudhary and Piyush Garg. Learn to code in
          their own voice and teaching style.
        </p>
      </div>
      <div className="flex gap-3">
        <SignedOut>
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button variant="secondary">Sign up</Button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <Button asChild>
            <Link href="/chat">Go to chat →</Link>
          </Button>
        </SignedIn>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Manual verify**

Run: `pnpm dev`
- Signed out on `/` → "Sign in" / "Sign up" buttons open Clerk modals; after signing in, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat` sends you to chat.
- Signed in on `/` → "Go to chat →" button appears.

Expected: both states render correctly.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "Add public landing and sign-in page"
```

---

## Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test`
Expected: all unit tests pass (env, personas, system prompt, context, generate-reply, conversations).

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: build succeeds with no type or route errors.

- [ ] **Step 4: End-to-end manual smoke (fresh)**

With `pnpm start` (or `pnpm dev`): sign up as a new user → confirm you see zero conversations → create a Hitesh chat and a Piyush chat → hold a 6+ message exchange in one → refresh → history intact and persona consistent → delete not required. Confirm a second browser/user cannot see the first user's conversations (sign in as a different user; sidebar is empty).

Expected: all pass; persona voices are distinct and consistent.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "Fix issues found during verification pass"
```
(Skip if nothing changed.)

---

## Task 13: Documentation deliverables and README

**Files:**
- Create: `docs/persona-data.md`
- Create: `docs/prompt-strategy.md`
- Create: `docs/context-management.md`
- Create: `docs/sample-conversations.md`
- Modify: `README.md`

**Interfaces:** Satisfies the assignment's required documentation.

- [ ] **Step 1: Write `docs/persona-data.md`**

Document: which public sources were studied (YouTube channels, hitesh.ai, piyushgarg.dev, X/social posts), what traits were extracted (Hitesh: warm Hinglish, "chai aur code", analogy-driven; Piyush: direct, project-first, system-design focus), and how that became the structured `Persona` config (bio, voice, vocabulary, teaching, guardrails, few-shot). Note that no scraping/RAG was used — voice is captured via curated config + few-shot examples in `lib/ai/personas/`.

- [ ] **Step 2: Write `docs/prompt-strategy.md`**

Document the prompt engineering: system prompt assembled by `buildSystemPrompt` from the persona config; sections for identity, voice, vocabulary, teaching, guardrails, Markdown formatting, and few-shot examples; why few-shot anchors style; guardrails keep replies on-topic and in character. Reference `lib/ai/build-system-prompt.ts`.

- [ ] **Step 3: Write `docs/context-management.md`**

Document the context approach: per-conversation persona is fixed; each turn sends a pinned system prompt + a sliding window of the most recent `CONTEXT_WINDOW` (16) messages from Supabase + the new user message; this keeps persona anchored across long chats while bounding tokens. Note the future extension: summarizing older turns. Reference `lib/ai/build-context.ts` and `lib/ai/generate-reply.ts`.

- [ ] **Step 4: Write `docs/sample-conversations.md`**

Paste 2–3 real transcripts per persona captured from the running app (copy actual Q&A), showing distinct voices and consistency across turns.

- [ ] **Step 5: Rewrite `README.md`**

Replace the template README with:
- Project overview and the live deployed URL.
- Features (dual persona, switching, persistent auth'd chat).
- Tech stack.
- Prerequisites (Node, pnpm, OpenAI key, Clerk app, Supabase project).
- Setup: `pnpm install`; copy `.env.example` → `.env.local` and fill keys; apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
- Run: `pnpm dev`; test: `pnpm test`; build: `pnpm build`.
- Links to the four docs above.

- [ ] **Step 6: Commit**

```bash
git add docs README.md
git commit -m "Add documentation deliverables and project README"
```

---

## Task 14: Deploy to Vercel

**Files:** none (deployment)

- [ ] **Step 1: Push to a public GitHub repo**

Create a public repo and push:
```bash
git remote add origin https://github.com/<you>/persona-ai.git
git push -u origin main
```

- [ ] **Step 2: Import into Vercel and set env vars**

In Vercel: New Project → import the repo (root = `persona-ai`). Add all env vars from `.env.example` with real values: `OPENAI_API_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/chat`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 3: Configure Clerk for the production domain**

In the Clerk dashboard, add the Vercel deployment domain to allowed origins / production instance so sign-in works on the live URL.

- [ ] **Step 4: Deploy and verify live**

Trigger the deploy. On the live URL: sign up → create both persona chats → send messages → confirm persistence and distinct voices.
Expected: fully working live app.

- [ ] **Step 5: Put the live URL in the README**

Update `README.md` with the deployed URL and commit:
```bash
git add README.md
git commit -m "Add live deployment URL to README"
git push
```

---

## Self-Review Notes (author)

- **Spec coverage:** dual persona (Task 3), switching (Task 10 sidebar), LLM integration (Tasks 4–6, 9), Clerk auth required (Task 8), Supabase persistence scoped by user (Task 7), context management (Task 5 + Task 9), UI/UX (Tasks 10–11), all four doc deliverables + README (Task 13), live deploy + public repo (Task 14). Persona accuracy handled via config + few-shot + system prompt (Tasks 3–4).
- **Non-streaming** honored: `generateReply` returns a full string; the API responds once with `{ userMessage, assistantMessage }`.
- **Approach B** honored: only `lib/db/*` (server) touches Supabase; every conversation query filters by `userId`; keys are server-only (`server-only` import + no `NEXT_PUBLIC_` on Supabase/OpenAI).
- **Next.js 16** specifics honored: `proxy.ts` (not `middleware.ts`), async route `params`, async `auth()`.
- **Type consistency:** `PersonaId`, `Conversation`, `Message`, `HistoryMessage`, `ChatMessage`, `UiMessage` names are used consistently across tasks.
