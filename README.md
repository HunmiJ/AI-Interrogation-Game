# AI Interrogation Game

An AI-native investigation game where expressive NPC conversations are governed by a deterministic evidence engine.

> V0.5 Release Candidate · Classic Case + validated Dynamic Cases · React/TypeScript/Express

## Project overview

AI Interrogation Game puts the player in a sealed investigation. Interview three suspects, compare testimony with evidence, expose contradictions, and submit a final accusation. The game supports a handcrafted Classic Case and AI-generated Dynamic Cases across theft, data leak, fraud, and item-swap scenarios.

This is AI-native because the model is part of the interaction and content pipeline—not a decorative chatbot. NPC replies adapt to free-form questions, while generated cases must pass deterministic validation before the player can enter them.

## Core features

- **Classic Case** — a reliable, fully playable investigation with offline preset questions.
- **Dynamic Case Generator** — builds new cases, then checks schema, quality, dependency cycles, and solvability.
- **AI NPC Interrogation** — independent conversation history and knowledge boundaries for each suspect.
- **Dynamic Fact Discovery** — natural-language replies can suggest facts from the active case catalog.
- **Evidence Unlock** — validated facts unlock related evidence through deterministic prerequisites.
- **Contradiction Detection** — contradictions require confirmed testimony and player-presented evidence.
- **Investigation Notebook** — one view for confirmed facts, evidence, and contradictions.
- **Server-side Resolution** — accusation, score, culprit, and explanation remain server-controlled.
- **Release-candidate resilience** — duplicate-request guards, cancellation on reset, timeouts, rate limits, safe fallbacks, responsive layouts, and an application error boundary.

## How the AI boundary works

```text
Player question
     │
     ▼
AI NPC: in-character reply + candidate fact IDs
     │
     ▼
Deterministic game engine
     ├─ validates candidate facts
     ├─ unlocks evidence
     ├─ evaluates contradictions
     ├─ updates server session
     └─ calculates final score and resolution
```

The model proposes; the game engine decides. Model output cannot directly add facts, unlock evidence, create contradictions, choose the culprit, or calculate a score. See [the architecture document](docs/ARCHITECTURE.md) for the full trust boundary.

## Case generation pipeline

```text
Case options
  → structured LLM draft
  → safe normalization
  → targeted repair when needed (maximum 3 total attempts)
  → schema and narrative-quality checks
  → dependency-cycle and solvability validation
  → private server session
  → reduced public case payload
```

Invalid or exhausted generations never enter the game. The failure screen offers an explicit retry, option change, or Classic Case path; it never disguises a fallback as a generated case.

## Tech stack

- React, TypeScript, Vite
- Tailwind CSS and Lucide React
- Node.js, Express, Zod
- DeepSeek by default, with an OpenAI provider adapter
- Node test runner and Supertest

## Local setup

Requirements: Node.js 18+ and npm.

```bash
npm install
copy .env.example .env
npm run dev
```

Open the Vite address printed in the terminal. The Classic Case works without an API key. To use free interrogation and Dynamic Cases, set a server-side provider key in `.env`:

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=your_provider_key
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=8787
LLM_TIMEOUT_MS=60000
DEBUG_AI_INVESTIGATION=false
DEBUG_DYNAMIC_CASE_INVESTIGATION=false
```

Use [.env.example](.env.example) as the source of truth. Never prefix the key with `VITE_`; client-prefixed variables are bundled into browser code.

To use OpenAI instead, change only the server environment:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
LLM_BASE_URL=https://api.openai.com/v1
```

## Commands

```bash
npm run dev                         # client + Express development servers
npm run typecheck                   # strict client/server TypeScript checks
npm test                            # deterministic automated test suite
npm run build                       # typecheck + production client bundle
npm run preview                     # preview a production build
npm run smoke:v03                   # real-provider investigation smoke test
npm run smoke:v04:generation        # real-provider generation smoke test
npm run smoke:v04:data-leak-final   # real-provider data-leak final smoke test
```

Smoke commands consume provider quota and are intentionally excluded from routine automated testing.

## Repository structure

```text
src/
├─ components/       UI flow, loading/error/empty states, Error Boundary
├─ data/             browser-safe Classic Case display data
├─ hooks/            game state and isolated NPC conversation sessions
├─ services/         bounded API clients
├─ types/            public client contracts
└─ utils/            deterministic browser session helpers

server/
├─ agents/           private Classic NPC profiles
├─ data/             classic truth, evidence rules, scoring
├─ dynamicCases/     generation, validation, sessions, resolution
├─ middleware/       security headers and cost-control rate limits
├─ prompts/          server-only interrogation instructions
├─ providers/        DeepSeek/OpenAI adapters and safe error handling
├─ services/         interrogation orchestration and validation
└─ scripts/          opt-in real-provider smoke tests

docs/
└─ ARCHITECTURE.md    public architecture and security boundaries
```

## Security and cost controls

- Provider credentials are read only by Express; `.env` is Git-ignored.
- Private profiles, full prompts, culprit IDs, and unrevealed solution nodes stay server-side.
- Public Dynamic Case payloads are allowlisted and regression-tested for leaks.
- Request schemas enforce strict length, array, and body-size bounds.
- Free interrogation is limited per client; expensive generation has a stricter time window.
- Generation performs at most three attempts and only one generation runs at a time.
- Client requests have timeouts; reset aborts in-flight interrogation responses.
- Provider logs redact credentials; verbose investigation traces default to off.
- Security headers restrict framing, referrers, browser permissions, and resource origins.

## Testing

The deterministic suite covers Classic, V0.3 investigation, V0.4 Dynamic Cases, semantic fact matching, evidence/contradiction graphs, session isolation/reset, generation retries, private-data exclusion, provider routing, credential redaction, request limits, and V0.5 reliability controls.

Release-candidate checks:

```bash
npm run typecheck
npm run build
npm test
git diff --check
git status --ignored --short
```

## Screenshots and demo

Final V1.0 media will be added after V0.5 manual browser acceptance:

- Home and case-mode selection
- Dynamic Case generation and validation
- Free AI interrogation with Fact/Evidence feedback
- Investigation Notebook
- Final accusation and result score
- Short end-to-end demo recording

## Version history

- **V0.1** — Offline playable prototype
- **V0.1.1** — UI/UX polish
- **V0.2** — Live AI NPC interrogation
- **V0.3** — AI-driven investigation system
- **V0.4** — Validated Dynamic Case system (`v0.4.0`)
- **V0.5 RC** — Portfolio documentation, resilience, safety, cost controls, and responsive polish (current branch)

## Known limitations

- Investigation progress is in memory and is lost on refresh or server restart.
- There is no account system, database, multi-device synchronization, or long-term NPC memory.
- LLM wording, latency, availability, and cost depend on the configured provider.
- Semantic matching is deliberately conservative, so indirect statements may require follow-up questions.
- Dynamic generation can reject a plausible story when its evidence graph is not reliably solvable.
- V0.5 still requires manual desktop/mobile browser acceptance before it is tagged or merged.

## Future work

V1.0 focuses on final browser acceptance, screenshots/demo media, repository presentation, and a public GitHub release. Possible work after V1.0 includes persistence, accessibility localization, additional authored cases, and evaluation tooling for generated-case quality.

## License

No license has been selected yet. Until one is added, the repository is source-available for portfolio review but does not grant reuse rights.
