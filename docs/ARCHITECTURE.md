# Architecture

## Runtime flow

```text
Player
  │
  ▼
React + Vite client
  │  public case data, questions, discovered IDs
  ▼
Express API
  ├─ request schemas, size limits, rate limits, timeouts
  ├─ classic investigation engine
  └─ dynamic case session engine
       │
       ├─ deterministic validator and solvability graph
       └─ server-only LLM provider adapter
             └─ DeepSeek or OpenAI
```

The browser never receives an API key, system prompt, private NPC profile, culprit ID, hidden resolution, or unrevealed facts. Dynamic generation returns a deliberately reduced public case representation after validation succeeds.

## AI and deterministic responsibilities

The LLM is responsible for narrative generation, in-character language, emotional tone, and suggesting fact candidates. It is not trusted to mutate investigation state.

Server rules own all state-changing decisions:

- Generated cases must pass schema, quality, dependency-cycle, and solvability validation.
- Suggested fact IDs must exist in the active case and satisfy NPC and evidence prerequisites.
- Evidence unlocks and contradictions are derived from validated state.
- Scoring and final resolution are calculated server-side.
- Unknown, repeated, or forged IDs are rejected.

This boundary preserves expressive AI interaction without allowing model output to become game authority.

## Reliability boundaries

- The client suppresses duplicate generation and duplicate per-NPC interrogation requests.
- Resetting or starting a new case aborts in-flight interrogation work and ignores stale responses.
- Network calls use bounded timeouts and structured error payloads.
- The server limits JSON bodies, question/history lengths, generation attempts, and request frequency.
- Classic Case remains an explicit offline-capable path; a failed Dynamic Case is never presented as a successful generation.
- A top-level React error boundary replaces unexpected render failures with a reload screen.

## Public and private data

| Browser-safe | Server-only |
| --- | --- |
| Case briefing and public timeline | API keys and provider configuration |
| Suspect public profiles | NPC private information and truth strategy |
| Discovered facts and evidence | System and generation prompts |
| Validated progress IDs | Culprit ID and hidden resolution until conclusion |
| Final resolution after accusation | Unrevealed fact/evidence graph |

## Main modules

- `src/hooks/useGameState.ts`: browser investigation state and complete session reset.
- `src/hooks/useNpcConversations.ts`: isolated NPC histories, request cancellation, retry UX.
- `server/services/interrogationService.ts`: classic NPC orchestration and deterministic validation.
- `server/dynamicCases/generator.ts`: bounded generate/repair/validate pipeline.
- `server/dynamicCases/sessionStore.ts`: server-side dynamic case truth and progress.
- `server/dynamicCases/validator.ts`: structure, graph, and solvability rules.
- `server/providers/`: provider abstraction and credential-safe errors.
