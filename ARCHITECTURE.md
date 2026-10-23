# Voluntrip AI — Architecture

Technical description of what the repository actually ships. For the product pitch, live demo, and how to run it, see [README.md](./README.md).

---

## What the system is

A Next.js 15 App Router PWA (React 19, TypeScript). The traveler’s trip, budget, Cultural DNA, and NAVI messages live in the browser (Zustand + IndexedDB). Qloo Taste API is called only from server routes. NAVI can run as local tool templates or, when configured, as Azure OpenAI with the same tools.

The product answers two questions in one place:

1. How much can I spend today without touching protected money?
2. Which places in *this* city fit my taste *and* that daily safe?

Question 2 is Qloo-powered. Without Insights, Tonight, Compare, Stretch, and Plan for today have no honest place list for an arbitrary city.

Travel Buddy / group ranking is not built.

---

## Layers

```
UI (App Router pages + components)
  → Zustand store (`src/store/appStore.ts`)
      → IndexedDB `voluntrip-ai` v2
      → Finance engine (`src/lib/finance/`) — no network
      → NAVI agent (`src/lib/agent/`)
          → local tools, or POST /api/navi → Azure
          → POST /api/qloo        → Qloo Insights (places)
          → POST /api/qloo/entities → Qloo Entity Search
```

| Layer | Role |
| --- | --- |
| UI | Onboarding, dashboard (Tonight, Stretch, Cultural DNA), NAVI, pockets, activity, goals, trip |
| Zustand | In-memory trip, pockets, transactions, cultural profile, pending Confirm/Cancel |
| IndexedDB | Persistence; works without an account |
| Finance | DRS, daily safe, runway, `simulatePurchase`, protected pockets |
| Experiences | Discover → filter → rank (Value Score) → Stretch / Compare / Why this? |
| Qloo client | Server-only Insights + Entity Search; never imported from `"use client"` modules |
| NAVI | Tools + replies. Money and places come from tools, not from invented prose |

---

## App routes

| Path | Screen |
| --- | --- |
| `/` | Redirects to `/onboarding` or `/app` after hydrate |
| `/onboarding` | 7 steps (0–6): language, destination, dates, budget, pockets, review. Demo shortcuts on step 0 |
| `/app` | Home dashboard |
| `/app/navi` | NAVI panel |
| `/app/pockets` | Pockets |
| `/app/activity` | Transactions |
| `/app/goals` | Goals |
| `/app/trip` | Trip + reset local data + optional cloud backup |
| `/auth/callback` | Supabase magic-link return |

Server routes (secrets stay here):

| Route | Input | Output |
| --- | --- | --- |
| `POST /api/qloo` | `{ city, tags?, take?, filterTags?, entities? }` | `{ source, places, reason? }` |
| `POST /api/qloo/entities` | `{ query, take? }` | `{ source, entities, reason? }` |
| `POST /api/navi` | `{ action: "ask" \| "process" \| "insight", … }` | `NaviResponse` (ask attaches Confirm/Cancel simulation when needed) |
| `POST /api/navi/speech` | multipart audio | `{ text }` or 503 if Azure Speech is not configured |
| `POST /api/navi/ocr` | `{ imageBase64 }` | `{ text }` or 503 if Azure Vision is not configured |

The browser talks to Qloo only through `/api/qloo` and `/api/qloo/entities` (`src/lib/qloo/apiFetch.ts`). It never sends an API key.

---

## IndexedDB

- Name: `voluntrip-ai`
- Version: **2** (`VOLUNTRIP_DB_VERSION` in `src/lib/db/indexeddb.ts`)
- Upgrades are additive. Stores are never deleted.

| Store | Key | Indexes | Added |
| --- | --- | --- | --- |
| `profile` | `id` | — | v1 |
| `trips` | `id` | — | v1 |
| `pockets` | `id` | `by-trip` (`tripId`) | v1 |
| `transactions` | `id` | `by-trip` (`tripId`) | v1 |
| `goals` | `id` | `by-trip` (`tripId`) | v1 |
| `insights` | `id` | `by-trip` (`tripId`) | v1 |
| `messages` | `id` | — | v1 |
| `meta` | `key` | — | v1 |
| `cultural_profile` | `id` | — | **v2** |

Cultural DNA (consent, likes, one filter, loved entities) is the v2 store. Reset local data clears the database from My Trip.

---

## Zustand

`useAppStore` hydrates from IndexedDB and holds:

- `profile`, `trip`, `pockets`, `transactions`, `goals`, `insights`, `messages`
- `culturalProfile`
- `locale` (`en` \| `es` \| `pt`)
- `pendingSimulation` / `pendingTransaction` (Confirm/Cancel; nothing is recorded until Confirm)
- Demo loaders: `loadMedellinDemo`, `loadSingaporeDemo`, `loadDemo` (Chiang Mai)

Ask-NAVI writes the assistant message and, when present, `pendingSimulation`.

---

## Modules

### `src/lib/qloo`

| File | Job |
| --- | --- |
| `client.ts` | Server-only. Insights `GET /v2/insights` (`filter.type=urn:entity:place`, `filter.location.query`, optional `signal.interests.tags`, `filter.tags`, `signal.interests.entities`). Entity Search `GET /search`. Tags `GET /v2/tags`. Key from the environment; never logged |
| `request.ts` | Place body may only contain `city`, `tags`, `take`, `filterTags`, `entities`. Extra fields (including email) are rejected. At most 5 entity UUIDs, 1 filter tag |
| `normalize.ts` | Maps Insights/Search payloads. Drops entities missing name or UUID |
| `apiFetch.ts` | Browser → `/api/qloo` and `/api/qloo/entities` |
| `demo.ts` | Labeled fixture when the key is empty (`source: "demo"`, `reason: "NO_KEY"`) |
| `types.ts` | `QlooResult` = `qloo` \| `demo` \| `unavailable` |

### `src/lib/culture`

Consent is the gate. `getConsentedQlooTagIds`, `getConsentedLovedEntities`, and the filter helper return empty without `consent.granted`. Up to 8 verified likes (`CULTURAL_DNA_MAX_SIGNALS`). One hard filter. Up to 5 loved entities from Entity Search (UI: **Tell me what you love** / **Dime qué amas**).

### `src/lib/experiences`

| File | Job |
| --- | --- |
| `discovery.ts` | One Insights call. Strip hotels / non-tourist category-genre tags. Dedupe by folded name. If loved entities were sent and fewer than 3 places remain, return an empty candidate list |
| `rank.ts` | Value Score sort |
| `evaluate.ts` | `valueScore = 0.40 cultural + 0.35 financial + 0.25 context` (Voluntrip’s formula, not Qloo’s) |
| `costEstimate.ts` | USD bands from `priceLevel` or category. Always an estimate; not a Qloo price |
| `compareTaste.ts` | Two Insights queries: city-only vs city + consented tags/entities |
| `stretchPlan.ts` | Multi-night plan from the same ranked list |
| `baseline.ts` | Medellín generic list, labeled **generic, not from Qloo**. Not used for Plan for today |
| `whyQlooEvidence.ts` / `whyThisDetails.ts` | Honest Why this? copy (names, not UUIDs) |

### `src/lib/agent`

NAVI. `tools.ts` is the finance + cultural catalog. `experienceTools.ts` runs Tonight, Why this?, Better?, Stretch, Plan for today. `localAsk.ts` is the heuristic path. `agent.ts` uses local ask unless `NEXT_PUBLIC_MOCK_AI=false`, then `POST /api/navi`. Azure still must copy totals from tool results (`attachAffordSimulation`, stretch/day-plan overwrite).

Finance tools include `getTripContext`, `getCurrentBalance`, `getProtectedMoney`, `getDailyBudget`, `getWeeklyBudget`, `getMoneyRunway`, `getSpendingAnalysis`, `simulatePurchase`, `convertCurrency`, `protectMoney`, `createGoal`, and transaction/pocket helpers.

Cultural tools: `recommendExperience`, `explainRecommendation`, `findBetterOption`, `planMyDay`, `planStretch`.

### `src/lib/finance`

Pure TypeScript. No Qloo imports.

- Daily safe = (balance − protected pockets) / remaining days
- Weekly DRS = (balance − protected pockets) / remaining weeks
- `simulatePurchase` — before/after available, daily, weekly; does not write a transaction
- Protected pockets never count as free-to-spend
- FX uses `MOCK_RATES_USD` (no live rate client in `src/` yet)

### Other

- `src/lib/demo/` — Medellín, Singapore, Chiang Mai sample trips
- `src/lib/ai/` — Azure OpenAI / Speech / Vision **server** modules
- `src/lib/i18n/` — `en` / `es` / `pt`
- `src/lib/sync/` — optional Supabase push/pull after auth

---

## Recommendation data flow

```
Consent off ──► no Qloo HTTP call
                 Tonight in Medellín may show labeled baseline
                 Other cities / Plan for today stay empty (honest)

Consent on
  → Cultural DNA tags (≤8) + optional 1 filter + loved entity UUIDs (≤5)
  → POST /api/qloo  →  Insights for the active trip city
  → strip lodging + non-tourist tags
  → dedupe folded names
  → if entities sent and < 3 places left → empty
  → rankExperiences (Value Score)
  → simulatePurchase on the chosen cost (or the Plan for today sum)
  → NAVI / dashboard shows estimates + Qloo cite
  → Confirm records one transaction; Cancel records none
```

Compare runs the Insights step twice (with and without taste). Stretch and Plan for today reuse the same discover + rank path. Plan for today picks 2–3 distinct names whose estimated costs fit today’s daily safe, then simulates the **sum** as one purchase.

---

## Provenance

`source` is a discriminated union. `"qloo"` is only set after a successful, normalized live response.

| `source` | When | What the UI may say |
| --- | --- | --- |
| `qloo` | Live Insights or Entity Search | `Source: qloo` / `Fuente: qloo` / `Fonte: qloo`. The field value stays `"qloo"` |
| `demo` | Empty API key (`NO_KEY`) | Generic / demo. Never claimed as Qloo |
| `unavailable` | Auth, rate limit, timeout, bad payload, network | Qloo is down. No invented live list |

Unavailable reasons: `NO_KEY`, `QLOO_AUTH`, `QLOO_RATE_LIMIT`, `QLOO_TIMEOUT`, `QLOO_BAD_RESPONSE`, `QLOO_NETWORK`.

---

## What is sent to Qloo

Place Insights (server):

- `filter.type` = `urn:entity:place`
- `filter.location.query` = trip city
- `signal.interests.tags` = consented tag URNs (optional)
- `filter.tags` = at most one consented filter URN (optional)
- `signal.interests.entities` = consented loved-entity UUIDs (optional)
- `take`

Entity Search: `query` + `take` only. Response kept as `{ id, name, type }`.

Not sent: traveler name, email, budget, messages, pocket balances.

---

## Security

- `QLOO_API_KEY` is read only in `src/lib/qloo/client.ts` (server). The client proxy does not echo it.
- Azure keys stay in `/api/navi`, `/api/navi/speech`, `/api/navi/ocr`.
- Confirm/Cancel is the only path from a recommendation to a stored expense.
- Protected pockets stay locked through `simulatePurchase` and Confirm.

---

## Demos

Onboarding step 0:

| Button | Trip id | Notes |
| --- | --- | --- |
| Try Medellín demo | `demo-trip-medellin` | Canned remaining days: 12 |
| Try Singapore demo | `demo-trip-singapore` | Canned remaining days: 9 |
| Try Chiang Mai demo | sample Chiang Mai | Still shipped; not the only entry |

Any other destination from the picker is a real trip. Qloo is queried for that city when consent is on.

---

## i18n and PWA

- Locales: `en`, `es`, `pt` (`src/lib/i18n/dictionaries.ts`).
- PWA: `public/manifest.webmanifest` (standalone, start `/app`), `public/sw.js`, `public/offline.html`, icons under `public/icons/`.

---

## What is not built

- Travel Buddy / group mode
- Live FX (`EXCHANGE_RATE_API_KEY` is listed for later; rates today are the mock table)
- Verified menu prices
- Conversational NAVI without Azure OpenAI (local mode is heuristic + tools)
