# Voluntrip AI

**Spend today without breaking the rest of the trip — with places ranked by your taste.**

Live demo: [https://voluntrip-ai.vercel.app](https://voluntrip-ai.vercel.app)

Voluntrip AI is a local-first PWA for volunteers and long-stay travelers. It computes daily safe spend, keeps protected money locked, and asks NAVI to simulate a purchase before anything is recorded. Recommendations come from Qloo place Insights for the active trip city, not from a generic LLM inventing venues.

---

## How to try it in 2 minutes

1. Open the [live demo](https://voluntrip-ai.vercel.app) (or run it locally — see below).
2. On onboarding, tap **Try Medellín demo** or **Try Singapore demo**. (A Chiang Mai sample trip is still there as a third option.)
3. On the home dashboard, open **Cultural DNA**. Turn **Consent** on.
4. Pick at least one like (for example salsa or live music). Optionally use **Tell me what you love** to search Qloo Entity Search and save an artist, film, or place.
5. Use **Tonight** on the dashboard, or open NAVI and tap **Plan for today**.

Without consent, the app will not query Qloo. Tonight in Medellín may still show a labeled generic baseline. That path is not claimed as Qloo.

---

## The problem and who it is for

Travelers on a fixed volunteer or backpacker budget mix “money I can spend” with “money I must not touch.” A generic chatbot can suggest a bar. It cannot say whether that bar fits today’s daily safe, or whether it matches the traveler’s taste in this city.

Voluntrip AI is for volunteers, backpackers, and long-stay travelers who need both: a hard budget rule and a taste-aware place list for the city they are actually in.

---

## What makes it Qloo-powered

A generic LLM would invent place names and costs. This product does not. Places enter the app only through the Qloo client (`src/lib/qloo/`), via server routes `/api/qloo` and `/api/qloo/entities`. The key stays on the server.

| Qloo surface | What the app sends | What the traveler sees |
| --- | --- | --- |
| Insights (`/v2/insights`, `filter.type=urn:entity:place`) | City, optional taste tag URNs, optional one hard filter tag, optional loved-entity UUIDs | Ranked places for that city |
| Entity Search (`/search`) | A short search string | Loved entities saved as `{ id, name, type }` |
| Taste tags | Verified Cultural DNA likes (up to 8) as `signal.interests.tags` | Signals shown by name, not URN |

Loved entities are sent as `signal.interests.entities` (at most five UUIDs). The UI copy is **Tell me what you love** / **Dime qué amas**.

After Insights returns, Voluntrip:

- drops lodging and non-tourist category/genre tags (hotels, hospitals, campuses, and similar)
- deduplicates by folded place name
- requires at least three remaining places when loved entities were sent (otherwise the list is empty — no filler)
- ranks with the Voluntrip Value Score (below)

**Compare with and without your taste** (Tonight card) runs two Insights queries: city-only vs city + consented tags/entities. The two columns are the same ranking code. The difference is the Qloo signal.

That is why the product would not work the same without Qloo. Remove Insights and there is no honest Tonight, Compare, Stretch, or Plan for today list for an arbitrary city.

---

## Honest provenance

Every place result is tagged `source: "qloo" | "demo" | "unavailable"`.

- **`qloo`** — live Insights or Entity Search succeeded. NAVI and Why this? may say `Source: qloo` (English) or `Fuente: qloo` / `Fonte: qloo`. The field value stays `"qloo"`.
- **`demo`** — `QLOO_API_KEY` is empty (`reason: NO_KEY`). Labeled demo places. Never presented as Qloo.
- **`unavailable`** — network, timeout, or bad payload. The UI says Qloo is down. It does not invent a live list.

Consent is the gate. With consent off, tag IDs and loved entities are not sent. No Qloo HTTP call is made.

The place request validator only allows `city`, `tags`, `take`, `filterTags`, and `entities`. Extra fields (including email) are rejected. Qloo never receives the traveler’s name, budget, or messages.

**Prices are not from Qloo.** Estimated USD bands come from Qloo `priceLevel` or a category fallback in `src/lib/experiences/costEstimate.ts`. The UI always labels them as estimates, not verified menu prices.

Medellín has a **generic, not from Qloo** baseline used when Tonight has no live list. Other cities stay empty rather than reuse Medellín names. Plan for today never uses that baseline.

---

## NAVI

NAVI is the in-app agent (`src/lib/agent/`). It has trip context and tools. It is not a generic chatbot.

Finance tools include `getTripContext`, `getCurrentBalance`, `getProtectedMoney`, `getDailyBudget`, `getWeeklyBudget`, `getMoneyRunway`, `getSpendingAnalysis`, `simulatePurchase`, `convertCurrency`, `protectMoney`, `createGoal`, and transaction/pocket helpers.

Cultural tools:

| Tool | What it does |
| --- | --- |
| `recommendExperience` | Tonight: best + cheaper alternative from ranked Qloo places |
| `explainRecommendation` | Why this? — Qloo rank, named signals/entities, Voluntrip budget effect |
| `findBetterOption` | Cheaper option with cultural fit ≥ 60, or an honest “none” |
| `planMyDay` | **Plan for today**: 2–3 distinct Qloo stops that fit today’s daily safe |
| `planStretch` | Multi-night stretch plan from the same Qloo list |

**Nothing is spent until Confirm.** `simulatePurchase` builds the before → after card. Confirm records one transaction. Cancel drops it. Protected pockets stay out of available money.

Local NAVI (default) uses templates plus those tools. Conversational Azure NAVI needs `NEXT_PUBLIC_MOCK_AI=false` and the Azure OpenAI variables. In both modes, money figures and place lists still come from tools — the model is not allowed to invent totals.

---

## Voluntrip Value Score

Owned by Voluntrip. Not a Qloo score.

```
valueScore = 0.40 × culturalFit
           + 0.35 × financialFit
           + 0.25 × contextFit
```

Qloo supplies the place list, tags, rank, and therefore the cultural side. Daily safe, protected money, and runway are Voluntrip finance. Context is intent (for example tonight vs general). Defined in `src/lib/experiences/evaluate.ts`.

---

## Architecture and stack

```
Browser (Next.js App Router PWA)
  → Zustand + IndexedDB (trip, pockets, Cultural DNA, messages)
  → NAVI (local tools, or POST /api/navi → Azure OpenAI)
  → POST /api/qloo        → Qloo Insights (places)
  → POST /api/qloo/entities → Qloo Entity Search
  → Finance engine (DRS, simulatePurchase) — no Qloo calls
```

| Layer | What we ship |
| --- | --- |
| App | Next.js 15 App Router, React 19, TypeScript, Tailwind, Framer Motion |
| State | Zustand + IndexedDB (`idb`). Works without an account |
| Taste | Qloo Insights + Entity Search, server-only key |
| Agent | NAVI tools in `src/lib/agent/` |
| Finance | Pure TypeScript in `src/lib/finance/` |
| i18n | `en` / `es` / `pt` |
| Optional cloud | Supabase sync stub + email backup card |
| Optional voice/OCR | Azure Speech (`/api/navi/speech`), Azure Vision (`/api/navi/ocr`) |

Older finance/PWA notes live in [ARCHITECTURE.md](./ARCHITECTURE.md) (dated August 2025). That file still describes Chiang Mai as the main demo shortcut and does not document Qloo, Cultural DNA, or the current Medellín/Singapore demos. Prefer this README for the hackathon surface.

---

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Optional: `npm run icons` regenerates PWA PNGs.

Copy `.env.example` to `.env.local` and fill only what you need. **Do not commit `.env.local`.**

| Variable | Used for |
| --- | --- |
| `QLOO_API_KEY` | Live Qloo Insights and Entity Search (server only) |
| `QLOO_API_BASE_URL` | Qloo host (server only) |
| `MOCK_AI` | Server NAVI: local/mock unless set to use Azure |
| `NEXT_PUBLIC_MOCK_AI` | Client: `false` routes NAVI through `/api/navi` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI (when mock is off) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI (server only) |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name |
| `AZURE_SPEECH_KEY` | NAVI voice (`/api/navi/speech`) |
| `AZURE_SPEECH_REGION` | Azure Speech region |
| `AZURE_VISION_ENDPOINT` | Receipt OCR (`/api/navi/ocr`) |
| `AZURE_VISION_KEY` | Azure Vision (server only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional cloud backup |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional cloud backup |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server (if used) |
| `EXCHANGE_RATE_API_KEY` | Listed for a live FX client — not wired in `src/` today |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

### What works without keys

Finance, onboarding, demo trips, pockets, and local NAVI tools run with an empty `.env.local`.

Empty `QLOO_API_KEY` → Qloo client returns `source: "demo"`, `reason: "NO_KEY"`. The UI says demo/generic, not Qloo.

### What needs a Qloo key

Live places for the trip city, Entity Search for **Tell me what you love**, Compare, Stretch, and Plan for today with `source: "qloo"`.

Conversational Azure NAVI, voice, and OCR need the matching Azure variables.

---

## Tests

```bash
npm test          # Vitest, one-shot
npm run test:watch
npm run check:i18n
```

**234 tests passed** on this revision (`vitest run`, 26 files), covering Qloo request shaping, Insights/Entity Search normalization, consent, ranking, Compare, Stretch, NAVI Tonight / Why this? / Plan for today, and finance.

---

## Languages, PWA, privacy

- UI: English, Spanish, Portuguese (`src/lib/i18n/dictionaries.ts`).
- PWA: `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, installable standalone shell.
- Local-first: IndexedDB database `voluntrip-ai`. Reset from **My Trip → Reset local data**. Cloud backup is optional.

---

## Limitations and next steps

- **Travel Buddy / group mode is not built.** Ranking is individual.
- **FX uses a built-in mock table** (`MOCK_RATES_USD`). `EXCHANGE_RATE_API_KEY` is in `.env.example` but is not read in `src/` yet.
- **Prices are estimates**, from `priceLevel` bands or category fallbacks — not verified menus and not Qloo prices.
- **Local NAVI is heuristic.** Full conversation needs Azure OpenAI.
- **Chiang Mai remains a sample trip**, not the only demo. Medellín and Singapore are the intended hackathon entries.
- Qloo demo-without-key places are a small labeled set, not a city-wide catalog.

Next: live FX if a rate API is wired; richer Azure NAVI; group ranking only if a real group model ships.

---

## License

[MIT](./LICENSE) — Copyright (c) 2026 Voluntrip AI team.
