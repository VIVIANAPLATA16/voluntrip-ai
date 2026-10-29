# Voluntrip AI

**Spend today without breaking the rest of the trip — with places ranked by your taste.**

Live demo: [https://voluntrip-ai.vercel.app](https://voluntrip-ai.vercel.app)

Repository: [https://github.com/VIVIANAPLATA16/voluntrip-ai](https://github.com/VIVIANAPLATA16/voluntrip-ai)

Voluntrip AI is a local-first PWA for volunteers and long-stay travelers on a fixed budget. It computes daily safe spend, keeps protected money locked, and asks NAVI to simulate a purchase before anything is recorded. Place recommendations come from Qloo Insights for the active trip city, not from a generic LLM inventing venues. Groups can share Cultural DNA tags on an invite-code group. NAVI Travel Buddy then looks only at that current group — never a global traveler directory.

---

## How to try it in 2 minutes

1. Open the [live demo](https://voluntrip-ai.vercel.app) (or run it locally — see below).
2. On onboarding, tap **Try Medellín demo** or **Try Singapore demo**. (A Chiang Mai sample trip is still there as a third option.)
3. On the home dashboard, open the **Taste** card and go to **Cultural DNA** (`/app/profile`). Turn **Consent** on.
4. Pick at least one like (for example salsa or live music). Optionally use **Tell me what you love** to search Qloo Entity Search and save an artist, film, or place.
5. Use **Tonight** on the dashboard, or open NAVI and tap **Plan for today**.

Without consent, the app will not query Qloo. Tonight in Medellín may still show a labeled generic baseline. That path is not claimed as Qloo.

### Try Groups and Travel Buddy

1. Open **Groups** in the sidebar (`/app/groups`). Cloud backup must be configured (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`); otherwise Groups shows a cloud-needed state.
2. Create a group or join with an 8-character invite code. Sharing Cultural DNA with the group is **off by default**.
3. Turn on **Share my tastes with the group**. That sends tagMap likes only (at most 8 IDs). It does not send loved entities and it is **not** Qloo consent.
4. Ask NAVI: **Find me a travel buddy**, **Busca un compañero de viaje**, or **Encontre alguém para viajar comigo**.

A match needs **another member** who also shared tags that overlap yours. If you are the only one sharing, NAVI says so and does not invent people. There is no “available today” check.

---

## The problem and who it is for

Volunteers and long-stay travelers on a fixed budget mix “money I can spend” with “money I must not touch.” A generic chatbot can suggest a bar. It cannot say whether that bar fits today’s daily safe, or whether it matches the traveler’s taste in this city.

Voluntrip AI launched for volunteers. The same daily safe, protected pockets, and Qloo taste list work for any traveler with a fixed budget — backpackers and digital nomads included. They need both a hard budget rule and a taste-aware place list for the city they are actually in. When they travel with others, they also need an honest way to see who in **this** invite group already chose to share tastes — not a public people search.

---

## Vision and business potential

Voluntrip AI starts with volunteers and grows to every long-stay traveler on a fixed budget. Industry blogs estimate 40–45 million digital nomads in 2026 ([Nomada, 2026](https://nomada.tools/blog/state-of-digital-nomadism-2026)); published figures vary by source. Volunteer-stay networks such as Worldpackers and Workaway already connect travelers with hosts around the world, and every one of those travelers has a budget to protect.

**Where we are going.** Voluntrip becomes the layer between a traveler's taste and their wallet. In any city Qloo covers, every recommendation answers two questions at once: can I afford it, and is it worth it for me?

**Roadmap (planned, not built yet):**
- A freemium PWA. Daily safe spend, protected pockets and NAVI stay free; an annual plan unlocks Stretch plans, group planning and saved city guides.
- Distribution through volunteer-stay and digital-nomad communities.
- Partnerships with host and hostel networks. Rankings will always come from Qloo taste signals, never from paid placement.
- Live exchange rates and more cities.

---

## What makes it Qloo-powered

A generic LLM would invent place names and costs. This product does not. Places enter the app only through the Qloo client (`src/lib/qloo/`), via server routes `/api/qloo` and `/api/qloo/entities`. The key stays on the server.

| Qloo surface | What the app sends | What the traveler sees |
| --- | --- | --- |
| Insights (`/v2/insights`, `filter.type=urn:entity:place`) | City, optional taste tag URNs, optional one hard filter tag, optional loved-entity UUIDs | Ranked places for that city |
| Entity Search (`/search`) | A short search string | Loved entities saved as `{ id, name, type }` |
| Taste tags | Consented Cultural DNA signal likes (request validator allows at most 10) as `signal.interests.tags` | Signals shown by name, not URN |

Loved entities are sent as `signal.interests.entities` (at most five UUIDs). The UI copy is **Tell me what you love** / **Dime qué amas**.

After Insights returns, Voluntrip:

- drops lodging and non-tourist category/genre tags (hotels, hospitals, campuses, and similar)
- deduplicates by folded place name
- requires at least three remaining places when loved entities were sent (otherwise the list is empty — no filler)
- ranks with the Voluntrip Value Score (below)

**Compare with and without your taste** (Tonight card) runs two Insights queries: city-only vs city + consented tags/entities. The two columns are the same ranking code. The difference is the Qloo signal.

That is why the product would not work the same without Qloo. Remove Insights and there is no honest Tonight, Compare, Stretch, or Plan for today list for an arbitrary city.

Travel Buddy does **not** call Qloo. It only reads aliases and tagMap IDs that members already opted to share in the current group.

---

## Qloo ON vs OFF: a real example

**Without your taste** is still Qloo (default city ranking), not an invented list and not an LLM.

How to reproduce it:

1. Load the Medellín or Singapore demo.
2. Open Cultural DNA (`/app/profile`), turn **Consent** on, and pick two likes (salsa + live music, or street food + coffee).
3. On the Tonight card, tap **Compare with and without your taste**.

Observed on Oct 21, 2026. Qloo results can change over time; the comparison is live in the app.

**Medellín**, signals salsa + live music:

| Ranking | Places |
| --- | --- |
| Without your taste (Qloo default ranking) | Parque Norte, Parques del Río, Florida Parque Comercial |
| With your taste | Son Havana Bar, DANCEFREE, Café Zorba |

Result: **3 of 3 places changed**.

**Singapore**, signals street food + coffee:

| Ranking | Places |
| --- | --- |
| Without your taste (Qloo default ranking) | Starbucks Gardens by the Bay, Gardens by the Bay, Jewel Changi Airport |
| With your taste | Hello Arigato, Tamako Meal, The Landing Point |

Result: **3 of 3 places changed**.

---

## Honest provenance

Every place result is tagged `source: "qloo" | "demo" | "unavailable"`.

- **`qloo`** — live Insights or Entity Search succeeded. NAVI and Why this? may say `Source: qloo` (English) or `Fuente: qloo` / `Fonte: qloo`. The field value stays `"qloo"`.
- **`demo`** — `QLOO_API_KEY` is empty (`reason: NO_KEY`). Labeled demo places. Never presented as Qloo.
- **`unavailable`** — network, timeout, or bad payload. The UI says Qloo is down. It does not invent a live list.

Consent is the gate for Qloo. With consent off, tag IDs and loved entities are not sent. No Qloo HTTP call is made.

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
| `findBetterOption` | Cheaper **place** with cultural fit ≥ 60, or an honest “none” — not a travel companion |
| `planMyDay` | **Plan for today**: 2–3 distinct Qloo stops that fit today’s daily safe |
| `planStretch` | Multi-night stretch plan from the same Qloo list |

**Travel Buddy** is not an Azure or Qloo tool. `NaviAgent.ask` detects buddy phrasing (`detectLocalAskIntent` in `src/lib/agent/localAsk.ts`) **before** the mock/Azure fork and runs a read-only group search (`findGroupTravelBuddies` in `src/lib/groups/buddy.ts`). “Find me a better option” stays a place search.

**Nothing is spent until Confirm.** `simulatePurchase` builds the before → after card. Confirm records one transaction. Cancel drops it. Protected pockets stay out of available money.

Local NAVI (default) uses templates plus those tools. Conversational Azure NAVI needs `NEXT_PUBLIC_MOCK_AI=false` and the Azure OpenAI variables. In both modes, money figures and place lists still come from tools — the model is not allowed to invent totals. Buddy answers come from the current group, not from Azure inventing people.

The nine NAVI chips are Tonight, Plan for today, Why this?, Better?, Stretch, Buddy, Afford?, Expense, and Budget?. Buddy sends the localized “Find me a travel buddy” phrasing through the same intercept as typing it — it does not call Qloo or Azure.

---

## Groups and Travel Buddy

Groups live at `/app/groups` (sidebar + dashboard card). Members join with an invite code (max 6 people). The session (`memberId` + secret) stays on-device in IndexedDB. RPCs are create, join, read, update, and leave — there is no global member search.

**Sharing tastes with a group is not Qloo consent.** The group toggle sends verified Cultural DNA tagMap IDs only. Loved artists/films and Qloo consent stay on the device. Empty tags mean that member is treated as not sharing.

Travel Buddy (`src/lib/groups/buddy.ts`) reads the **current** group only. It excludes the asking member from the companion list. It never returns secrets, `memberId`, private (empty) tags, or other groups. It does not claim someone is free today or agreed to go.

| Result | Meaning |
| --- | --- |
| `no_group` | Create or join a group first |
| `unavailable` | The group could not be read (expired, offline, or cloud error) |
| `none_sharing` | Nobody is sharing tags, including you |
| `only_self` | Your tags are shared; no other member is sharing yet |
| `no_match` | Others are sharing, but no overlapping tags with you |
| `matches` | Other members who share at least one tag with you — alias + overlapping labels only |

There is **no** global traveler directory, availability calendar, or in-app chat.

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
  → Zustand + IndexedDB (trip, pockets, Cultural DNA, group session, messages)
  → NAVI (buddy intercept → group read; or local tools; or POST /api/navi → Azure OpenAI)
  → POST /api/qloo        → Qloo Insights (places)
  → POST /api/qloo/entities → Qloo Entity Search
  → POST /api/groups*     → Supabase RPCs (invite groups; optional cloud)
  → Finance engine (DRS, simulatePurchase) — no Qloo calls
```

| Layer | What we ship |
| --- | --- |
| App | Next.js 15 App Router, React 19, TypeScript, Tailwind, Framer Motion |
| State | Zustand + IndexedDB (`idb`). Works without an account |
| Taste | Qloo Insights + Entity Search, server-only key |
| Agent | NAVI tools in `src/lib/agent/`; Travel Buddy intercept in `NaviAgent.ask` |
| Groups | Invite-code RPCs in `src/lib/groups/`; taste overlap + buddy search |
| Finance | Pure TypeScript in `src/lib/finance/` |
| i18n | `en` / `es` / `pt` |
| Optional cloud | Supabase sync + Groups RPCs (anon key; tables are RPC-only) |
| Optional voice/OCR | Azure Speech (`/api/navi/speech`), Azure Vision (`/api/navi/ocr`) |

The full technical description is in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Optional: `npm run icons` regenerates PWA PNGs. `npm run destinations:build` rebuilds the onboarding destination list (also runs as `prebuild`).

Copy `.env.example` to `.env.local` and fill only what you need. **Do not commit `.env.local`.**

| Variable | Used for |
| --- | --- |
| `QLOO_API_KEY` | Live Qloo Insights and Entity Search (server only) |
| `QLOO_API_BASE_URL` | Qloo host (server only) |
| `MOCK_AI` | Server NAVI: local/mock unless set to `false` |
| `NEXT_PUBLIC_MOCK_AI` | Client: `false` routes non-buddy NAVI through `/api/navi` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI (when mock is off) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI (server only) |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name |
| `AZURE_SPEECH_KEY` | NAVI voice (`/api/navi/speech`) |
| `AZURE_SPEECH_REGION` | Azure Speech region |
| `AZURE_VISION_ENDPOINT` | Receipt OCR (`/api/navi/ocr`) |
| `AZURE_VISION_KEY` | Azure Vision (server only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional cloud backup and Groups |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional cloud backup and Groups |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server (if used) |
| `EXCHANGE_RATE_API_KEY` | Listed for a live FX client — not wired in `src/` today |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

### What works without keys

Finance, onboarding, demo trips, pockets, Cultural DNA on-device, and local NAVI finance/place tools run with an empty `.env.local`.

Empty `QLOO_API_KEY` → Qloo client returns `source: "demo"`, `reason: "NO_KEY"`. The UI says demo/generic, not Qloo.

Groups and Travel Buddy need the Supabase public URL and anon key (and the Groups RPCs deployed). Without them, `/app/groups` stays in the cloud-needed state.

### What needs a Qloo key

Live places for the trip city, Entity Search for **Tell me what you love**, Compare, Stretch, and Plan for today with `source: "qloo"`.

Conversational Azure NAVI, voice, and OCR need the matching Azure variables. Travel Buddy still uses the group search when Azure is enabled; it does not send the buddy question to the model.

---

## Tests

```bash
npm test          # vitest run
npm run test:watch
npm run check:i18n
```

**326 tests passed** on this revision (`vitest run`, 41 files), including Qloo request shaping, Insights/Entity Search normalization, consent, ranking, Compare, Stretch, NAVI Tonight / Why this? / Plan for today, finance, Groups share/privacy/overlap, Travel Buddy states, and the NAVI buddy intercept (mock and Azure-flag paths, without calling live Azure).

`npm run check:i18n` currently reports **0 warnings** and exits 0. The script exits 1 if it finds leftover English UI. It is not part of `npm test` or `npm run build`.

---

## Languages, PWA, privacy

- UI: English, Spanish, Portuguese (`src/lib/i18n/dictionaries.ts`).
- PWA: `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, installable standalone shell.
- Local-first: IndexedDB database `voluntrip-ai`. Reset from **My Trip → Reset local data**. Cloud backup is optional.
- Groups share tagMap IDs only, after an explicit group toggle. Qloo consent is a separate flag. Buddy replies never include member secrets or `memberId`.

---

## Limitations and next steps

- **Travel Buddy is the current invite group only.** There is no global traveler directory, availability, or chat. A match requires another member who opted to share overlapping tagMap likes.
- **FX uses a built-in mock table** (`MOCK_RATES_USD`). `EXCHANGE_RATE_API_KEY` is in `.env.example` but is not read in `src/` yet.
- **Prices are estimates**, from `priceLevel` bands or category fallbacks — not verified menus and not Qloo prices.
- **Local NAVI is heuristic** for finance and places. Full conversation needs Azure OpenAI. Buddy is a structured group read in both modes.
- **Chiang Mai remains a sample trip**, not the only demo. Medellín and Singapore are the intended hackathon entries.
- Qloo demo-without-key places are a small labeled set, not a city-wide catalog.
- Groups need cloud configuration and expire (SQL default is seven days from create).

---

## License

[MIT](./LICENSE) — Copyright (c) 2026 Voluntrip AI team.
