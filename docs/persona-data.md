# Persona Data: Collection & Preparation

This document explains how the two personas — **Hitesh Choudhary** and **Piyush Garg** — were studied and turned into structured data the LLM uses to stay in character.

## Sources studied

Only publicly available material was used to study each creator's tone, vocabulary, and teaching approach:

- **Hitesh Choudhary** — his YouTube channels (Hindi "Chai aur Code" and English), his website [hitesh.ai](https://hitesh.ai/), and public social posts. Signature traits observed: warm mentor ("bhaiya") tone, heavy **Hinglish**, the catchphrase **"chai aur code"**, frequent **"Haan ji!"**, everyday analogies (chai, restaurants), and constant encouragement ("koi tension nahi").
- **Piyush Garg** — his YouTube channel, his website [piyushgarg.dev](https://www.piyushgarg.dev/), and public social posts. Signature traits observed: **direct, practical, project-first** teaching, a focus on **industry-standard** tools and **system design**, strong TypeScript/full-stack emphasis, and a motivating "let's build it / ship karo" energy.

No transcripts were scraped or stored, and no private data was used. The goal was to capture *how each person communicates*, not to reproduce any specific copyrighted content.

## From observation to structured data

Rather than a RAG pipeline over scraped transcripts, each persona is encoded as a **typed configuration object** (`lib/ai/personas/hitesh.ts`, `lib/ai/personas/piyush.ts`) conforming to the `Persona` interface (`lib/ai/personas/types.ts`):

| Field | Purpose |
|-------|---------|
| `name`, `tagline`, `bio` | Identity and background the model role-plays |
| `voice` | Explicit tone/style rules (e.g. "open with 'Haan ji!'", "use chai analogies") |
| `vocabulary` | Signature phrases to sprinkle in naturally |
| `teaching` | How they explain concepts (analogies, step-by-step, next steps) |
| `guardrails` | Stay in character, keep to tech/education, don't fabricate private facts |
| `fewShot` | 4 hand-written example Q&A pairs per persona in authentic voice |

This "curated config + few-shot" approach was chosen over scraping/embeddings because it is:

- **Faithful** — the few-shot examples directly anchor style and vocabulary.
- **Deployable anywhere** — no vector database or ingestion pipeline.
- **Maintainable** — one small, reviewable file per persona; easy to tune.

## Why few-shot examples matter most

The `fewShot` pairs are the highest-leverage part of the data. Each pair models a realistic learner question and an in-character answer, so the model imitates *cadence, code style, emoji use, and Hinglish balance* — not just topical knowledge. See `lib/ai/personas/hitesh.ts` and `lib/ai/personas/piyush.ts` for the full set.

## Extending the data

The design leaves a clean seam to later add a small curated knowledge file per persona (or a RAG layer) without changing the prompt-assembly code — `buildSystemPrompt` simply consumes whatever the `Persona` object contains.
