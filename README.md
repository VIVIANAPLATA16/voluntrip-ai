# Voluntrip AI

**Your AI Financial Travel Companion**

> Volunteer anywhere. Budget smart. Travel forever.  
> Know what you can spend today without ruining tomorrow.

Voluntrip AI is a mobile-first SaaS/PWA for volunteers, backpackers, long-stay travelers, and digital nomads. It tracks real available money, daily/weekly safe spend (DRS), protected pockets, multi-currency expenses, and trip runway — with **NAVI**, an AI agent that simulates purchases before you spend.

---

## Technical Documentation

For the complete system architecture, data pipeline, TypeScript models, and operational guide, see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

Topics covered:

- Product vision and value proposition
- Full tech stack (frontend, PWA, IndexedDB, Supabase/Azure stubs)
- Directory structure and module responsibilities
- Geographic destinations pipeline (250 countries, 3,800+ cities)
- `DestinationPicker`, onboarding flows, and offline behavior
- Domain types, npm scripts, and environment variables

---

## Architecture

```
UI (Next.js App Router)
  ↓
Zustand store (client state)
  ↓
Financial engine (pure TS) + NAVI agent
  ↓
IndexedDB (local-first)
  ↓
Sync layer stub → Supabase (cloud-ready)
```

- **Local-first**: works without an account; data lives in IndexedDB.
- **Cloud-ready**: sync stub prepared for Supabase.
- **AI**: mock mode by default; Azure OpenAI interface ready when `MOCK_AI=false`.

---

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + Framer Motion + Lucide Icons
- IndexedDB (`idb`) + Zustand
- Vitest (financial engine tests)
- PWA (manifest + service worker)

Prepared for: Supabase, PostgreSQL, Azure OpenAI, Azure AI Vision, Exchange Rate API, Speech-to-Text, OCR.

---

## Quick start

```bash
npm install
npm run icons    # generate PWA icons
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On onboarding you can **Start my journey** or **Try with demo trip** (Chiang Mai sample data).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Vitest (finance engine) |
| `npm run icons` | Generate PWA PNG icons |

---

## Environment variables

Copy `.env.example` → `.env.local`:

| Variable | Purpose |
|----------|---------|
| `MOCK_AI` | `true` = local mock NAVI (default) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Server-side only — never expose to client |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `EXCHANGE_RATE_API_KEY` | Live FX rates |

**Never put Azure/Supabase service keys in client code.**

---

## Mock mode

With `MOCK_AI=true` (default):

- NAVI answers with intelligent local heuristics + finance tools
- Receipt scanner returns mock OCR
- Voice expense uses a mock confirmation flow
- Exchange rates use built-in mock table

Set `MOCK_AI=false` and fill Azure vars to connect real models (via server routes — do not call Azure from the browser with secrets).

---

## PWA

- `public/manifest.webmanifest`
- `public/sw.js` — offline shell cache
- `public/offline.html`
- Icons in `public/icons/`
- Standalone display, theme color, Apple web app meta
- Uses `100dvh` and `safe-area-inset` for iOS

Install from browser “Add to Home Screen”.

---

## IndexedDB

Database: `voluntrip-ai`

Stores: `profile`, `trips`, `pockets`, `transactions`, `goals`, `insights`, `messages`, `meta`

Reset from **My Trip → Reset local data**.

---

## NAVI

NAVI is not a generic chatbot. It has trip context and tools:

`getTripContext`, `getCurrentBalance`, `getProtectedMoney`, `getWeeklyBudget`, `getDailyBudget`, `getMoneyRunway`, `getSpendingAnalysis`, `createTransaction`, `simulatePurchase`, `convertCurrency`, `protectMoney`, `createGoal`, …

**Can I afford this?** always simulates first; confirmation creates the transaction.

Agent code lives under `src/lib/agent/` — separate from React UI.

---

## Financial engine (DRS)

```
DRS (weekly) = (Current balance − Protected pockets) / Weeks remaining
Daily safe   = (Current balance − Protected pockets) / Days remaining
```

Protected pockets never count as free-to-spend. All math is in `src/lib/finance/` and covered by tests.

---

## Multi-currency

Every transaction stores:

- `amountOriginal` / `currencyOriginal` (never overwritten)
- `exchangeRate`
- `amountBase` / `currencyBase`
- `createdAt`

---

## Azure / Supabase integration

- Azure interface: `src/lib/ai/azureOpenAI.ts`
- Sync stub: `syncToCloud()` in `src/lib/db/indexeddb.ts`
- Wire server Route Handlers when credentials are available

---

## Folder structure

```
src/
  app/                 # App Router pages (onboarding + /app/*)
  components/
    ui/                # Design system
    finance/           # Hero card, runway, converter
    navi/              # NAVI panel
    onboarding/
    home/
    layout/
  lib/
    agent/             # NAVI agent + tools
    ai/                # Azure OpenAI interface
    db/                # IndexedDB
    finance/           # Pure financial math + tests
    i18n/              # en / es / pt
    demo/              # Sample Chiang Mai trip
  store/               # Zustand
  types/
public/                # PWA assets
```

---

## Languages

First version: **English, Spanish, Portuguese** (`src/lib/i18n/dictionaries.ts`).  
Prepared for FR, DE, IT, NL, JA, ZH.

---

## Mobile-first

Designed for 320–430px phones first, then tablet/desktop (sidebar + wider dashboard). Bottom nav on mobile with NAVI as the center action.

---

## License

Private / proprietary — all rights reserved unless otherwise stated.
