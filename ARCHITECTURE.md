# Voluntrip AI — Arquitectura y Documentación Técnica del Sistema

> **Versión del documento:** 0.1.0  
> **Repositorio:** `voluntrip-ai`  
> **Última actualización:** Agosto 2025

---

## Tabla de contenidos

1. [Visión General del Producto](#1-visión-general-del-producto)
2. [Stack Tecnológico Completo](#2-stack-tecnológico-completo)
3. [Arquitectura de Alto Nivel](#3-arquitectura-de-alto-nivel)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Pipeline de Datos Geográficos (Destinos)](#5-pipeline-de-datos-geográficos-destinos)
6. [Componentes Clave y Flujos de UI](#6-componentes-clave-y-flujos-de-ui)
7. [PWA y Estado Offline](#7-pwa-y-estado-offline)
8. [Motor Financiero (DRS)](#8-motor-financiero-drs)
9. [NAVI — Agente de IA Financiera](#9-navi--agente-de-ia-financiera)
10. [Modelos de Datos y Tipado TypeScript](#10-modelos-de-datos-y-tipado-typescript)
11. [Persistencia: IndexedDB y Sync Cloud](#11-persistencia-indexeddb-y-sync-cloud)
12. [Internacionalización (i18n)](#12-internacionalización-i18n)
13. [Guía de Comandos y Variables de Entorno](#13-guía-de-comandos-y-variables-de-entorno)
14. [Decisiones Arquitectónicas y Notas Operativas](#14-decisiones-arquitectónicas-y-notas-operativas)

---

## 1. Visión General del Producto

### Nombre y eslogan

| Campo | Valor |
|-------|-------|
| **Nombre** | Voluntrip AI |
| **Eslogan principal** | *"Your money needs a compass."* |
| **Tagline extendido** | *"Volunteer anywhere. Budget smart. Travel forever."* |
| **Descripción corta** | Your AI Financial Travel Companion |

El eslogan aparece en el paso de bienvenida del onboarding (`onboarding.welcome_sub` en `src/lib/i18n/dictionaries.ts`). NAVI se describe internamente como *"Your AI financial compass"*.

### Propósito del software

Voluntrip AI es una **PWA SaaS mobile-first y local-first** diseñada para:

- Voluntarios internacionales (Worldpackers, Workaway, etc.)
- Mochileros y viajeros de larga estancia
- Nómadas digitales con presupuesto ajustado

Responde a una pregunta central del viajero:

> **¿Cuánto puedo gastar hoy sin arruinar el resto del viaje?**

### Propuesta de valor

| Problema del viajero | Solución Voluntrip AI |
|----------------------|------------------------|
| No sabe cuánto puede gastar hoy | **DRS** (Daily/Weekly Safe Spend) calculado en tiempo real |
| Mezcla dinero protegido con gasto libre | **Pockets** con bloqueo (`protected: true`) |
| Gastos en múltiples monedas | Transacciones con `amountOriginal` + `amountBase` + `exchangeRate` |
| Decisiones impulsivas de compra | **NAVI** simula compras antes de confirmarlas |
| Sin conexión en ruta | **IndexedDB** + Service Worker offline-first |
| Sin cuenta ni servidor | Funciona 100 % local; sync cloud opcional (Supabase stub) |

### Flujo principal del usuario

```
Landing (/) → Onboarding (7 pasos) → Dashboard (/app)
                    ↓
              Demo trip (Chiang Mai) — atajo opcional
```

---

## 2. Stack Tecnológico Completo

### Frontend

| Capa | Tecnología | Versión / Notas |
|------|------------|-----------------|
| Framework | **Next.js** (App Router) | 15.x |
| Lenguaje | **TypeScript** | 5.x |
| UI Runtime | **React** | 19.x |
| Estilos | **Tailwind CSS** | 3.4.x — dark mode nativo (`bg-bg`, `text-ink`, `accent`) |
| Animaciones | **Framer Motion** | 12.x — acordeones, transiciones onboarding |
| Iconos | **Lucide React** | 0.475.x |
| Estado cliente | **Zustand** | 5.x — `src/store/appStore.ts` |
| Fuentes | **Google Fonts** — Sora (display) + Outfit (body) | via `next/font` |
| Build dev | Turbopack | `npm run dev --turbopack` |

### Backend y API

| Capa | Tecnología | Estado |
|------|------------|--------|
| API Routes | Next.js Route Handlers | `/api/navi` — proxy seguro para Azure OpenAI |
| Autenticación | **No implementada aún** | Local-first sin login obligatorio |
| Cloud DB | **Supabase** (preparado) | Stub en `src/lib/sync/supabaseSync.ts` |
| IA | **Azure OpenAI** (preparado) | Mock por defecto (`MOCK_AI=true`) |

> **Importante:** No hay backend propio persistente hoy. La app corre como SPA/PWA con persistencia en el navegador.

### Base de datos local

| Componente | Tecnología |
|------------|------------|
| Client DB | **IndexedDB** via librería `idb` |
| Nombre DB | `voluntrip-ai` |
| Stores | `profile`, `trips`, `pockets`, `transactions`, `goals`, `insights`, `messages`, `meta` |

### PWA

| Asset | Ubicación |
|-------|-----------|
| Manifest | `public/manifest.webmanifest` |
| Service Worker | `public/sw.js` |
| Fallback offline | `public/offline.html` |
| Iconos | `public/icons/` (generados con `npm run icons`) |

### Scripts de automatización y datos geográficos

| Script | Comando | Propósito |
|--------|---------|-----------|
| `scripts/build-destinations.js` | `npm run destinations:build` | Genera dataset de 250 países |
| `scripts/volunteer-hubs.json` | (input manual/curado) | Ciudades hub de voluntariado |
| `scripts/generate-icons.js` | `npm run icons` | PNG PWA 192/512 |

**Dependencias de generación (devDependencies):**

- `country-state-city` — biblioteca global de países/estados/ciudades
- `countries-list` — metadatos ISO (continente, moneda)

### Testing

| Herramienta | Alcance |
|-------------|---------|
| **Vitest** | Motor financiero (`src/lib/finance/finance.test.ts`) |
| **ESLint** | `next lint` en build |

### Integraciones preparadas (no conectadas por defecto)

- Supabase (sync cloud)
- Azure OpenAI (NAVI conversacional)
- Azure AI Vision (OCR recibos — interfaz stub)
- Exchange Rate API (tipos de cambio en vivo)

---

## 3. Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer (React / Next.js)               │
│  Onboarding │ Dashboard │ Pockets │ NAVI │ Activity │ Trip  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Zustand Store (src/store/appStore.ts)          │
│  profile │ trip │ pockets │ transactions │ goals │ messages   │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
┌──────────────▼──────────────┐  ┌─────────▼───────────────────┐
│   Financial Engine (pure TS)  │  │   NAVI Agent (src/lib/agent)│
│   DRS │ Runway │ Simulation  │  │   Tools │ Memory │ Prompts │
└──────────────┬──────────────┘  └─────────┬───────────────────┘
               │                           │
┌──────────────▼───────────────────────────▼──────────────────┐
│              IndexedDB (idb) — local-first                    │
│              Database: voluntrip-ai                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ (stub)
┌──────────────────────────▼──────────────────────────────────┐
│              Supabase Sync (src/lib/sync/supabaseSync.ts)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Static Data: destinations-countries.json (build-time)      │
│  Generated by: scripts/build-destinations.js                │
└─────────────────────────────────────────────────────────────┘
```

### Principios arquitectónicos

1. **Local-first:** La fuente de verdad es IndexedDB; la nube es opcional.
2. **Motor financiero puro:** Toda la lógica DRS/runway vive en `src/lib/finance/` sin dependencias de React.
3. **Agente desacoplado:** NAVI (`src/lib/agent/`) no importa componentes UI.
4. **Datos geográficos en build-time:** El JSON de destinos se genera en CI/prebuild, no en runtime.
5. **Secrets en servidor:** Azure keys solo en Route Handlers, nunca en el cliente.

---

## 4. Estructura del Proyecto

```
voluntrip-ai/
├── ARCHITECTURE.md              # Este documento
├── README.md                    # Quick start y overview
├── package.json                 # Scripts y dependencias
├── next.config.js               # Config Next.js (reactStrictMode)
├── tailwind.config.js           # Design tokens (colores, fuentes)
├── tsconfig.json                # Path alias @/* → src/*
├── vitest.config.ts               # Tests del motor financiero
├── .env.example                 # Plantilla de variables de entorno
│
├── public/
│   ├── manifest.webmanifest     # PWA manifest
│   ├── sw.js                    # Service Worker offline-first
│   ├── offline.html             # Página fallback sin red
│   └── icons/                   # icon-192.png, icon-512.png, apple-touch
│
├── scripts/
│   ├── build-destinations.js    # Generador del dataset geográfico
│   ├── volunteer-hubs.json      # Hubs curados (~150 países)
│   └── generate-icons.js        # Generador de iconos PWA
│
└── src/
    ├── app/                     # Next.js App Router
    │   ├── layout.tsx           # Root layout, fonts, PWA meta
    │   ├── page.tsx             # Redirect: /onboarding o /app
    │   ├── globals.css          # Tailwind + CSS variables
    │   ├── onboarding/
    │   │   └── page.tsx         # Flujo de onboarding
    │   ├── app/                 # App autenticada (post-onboarding)
    │   │   ├── layout.tsx       # AppShell wrapper
    │   │   ├── page.tsx         # Dashboard principal
    │   │   ├── pockets/         # Gestión de bolsillos
    │   │   ├── activity/        # Historial de transacciones
    │   │   ├── trip/            # Detalle del viaje
    │   │   ├── goals/           # Metas de ahorro
    │   │   └── navi/            # Panel NAVI fullscreen
    │   └── api/
    │       └── navi/route.ts    # POST — proxy Azure OpenAI
    │
    ├── components/
    │   ├── ui/                  # Design system (Button, Card, Input…)
    │   ├── finance/             # HeroFinancialCard, MoneyRunwayCard…
    │   ├── home/                # HomeDashboard
    │   ├── layout/              # AppShell, DesktopSidebar
    │   ├── navi/                # NaviPanel
    │   ├── onboarding/          # OnboardingFlow, DestinationPicker
    │   └── pwa/                 # InstallPrompt
    │
    ├── lib/
    │   ├── agent/               # NAVI: agent.ts, tools.ts, memory.ts
    │   ├── ai/                  # azureOpenAI.ts (mock + real interface)
    │   ├── constants.ts         # CURRENCIES + re-exports destinos
    │   ├── data/
    │   │   └── destinations-countries.json  # 250 países (generado)
    │   ├── db/                  # indexeddb.ts
    │   ├── demo/                # sampleData.ts (Chiang Mai)
    │   ├── destination-regions.ts  # Tabs, búsqueda, alias ES/PT
    │   ├── destinations.ts      # Loader + interfaces destino
    │   ├── finance/             # Motor DRS (pure functions + tests)
    │   ├── i18n/                # dictionaries.ts (en/es/pt)
    │   ├── sync/                # supabaseSync.ts (stub)
    │   ├── id.ts                # createId() — UUID con fallback HTTP
    │   └── utils.ts             # cn() — clsx helper
    │
    ├── store/
    │   └── appStore.ts          # Zustand — estado global
    │
    └── types/
        └── index.ts             # Interfaces de dominio
```

### Responsabilidad de módulos clave

| Módulo | Responsabilidad |
|--------|-----------------|
| `src/app/` | Routing, layouts, API routes |
| `src/components/ui/` | Componentes reutilizables del design system |
| `src/lib/finance/` | Cálculos DRS, runway, simulación — **sin side effects** |
| `src/lib/agent/` | Orquestación NAVI + tool calling |
| `src/lib/db/` | CRUD IndexedDB |
| `src/lib/destinations.ts` | Carga del JSON + tipos `DestinationCountry` |
| `src/lib/destination-regions.ts` | Tabs continentales + búsqueda global + alias |
| `src/store/appStore.ts` | Estado React + persistencia + NAVI |
| `scripts/` | Build-time automation |

---

## 5. Pipeline de Datos Geográficos (Destinos)

### Resumen del dataset

| Métrica | Valor |
|---------|-------|
| Países | **250** |
| Ciudades totales | **3,862** |
| Promedio ciudades/país | ~15.4 |
| Ciudades máx por país | 20 |
| Ciudades mín por país | 8 (cuando hay datos) |
| Países populares | 197 |
| Tamaño JSON | ~75 KB |
| Archivo generado | `src/lib/data/destinations-countries.json` |

**Distribución por región (campo `region`):**

| Región (`region`) | Países | Tab UI |
|-------------------|--------|--------|
| `americas` | 55 | 🌎 América |
| `europe` | 52 | 🇪🇺 Europa |
| `asia-oceania` | 67 | 🌏 Asia & Oceanía |
| `africa-me` | 76 | 🌍 África & Medio Oriente |

### Diagrama del pipeline

```
┌─────────────────────┐     ┌──────────────────────┐
│ country-state-city  │     │   countries-list     │
│ (Country, City,     │     │   (continente,       │
│  State libraries)   │     │    moneda ISO)       │
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          └────────────┬───────────────┘
                       │
          ┌────────────▼────────────┐
          │  volunteer-hubs.json    │
          │  (ciudades curadas      │
          │   Worldpackers-style)   │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │ build-destinations.js │
          │  npm run destinations │
          │  :build               │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────────────────┐
          │ destinations-countries.json         │
          │  [{ country, code, flag,            │
          │     localCurrency, cities[],        │
          │     popular, region }]              │
          └────────────┬────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │  destinations.ts        │
          │  (import estático JSON) │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │ destination-regions.ts  │
          │  tabs + búsqueda + alias│
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  DestinationPicker.tsx  │
          └─────────────────────────┘
```

### `scripts/volunteer-hubs.json`

Archivo JSON curado manualmente con **~150 países**. Cada clave es un código ISO de 2 letras; el valor es un array de nombres de ciudades hub prioritarias para voluntariado y turismo mochilero.

Ejemplo (Colombia):

```json
"CO": [
  "Bogotá", "Medellín", "Cali", "Cartagena", "Santa Marta",
  "San Andrés", "Barranquilla", "Bucaramanga", "Pereira",
  "Manizales", "Villa de Leyva", "Salento", "Guatapé",
  "Popayán", "Leticia", "San Gil", "Tayrona", "Coffee Region",
  "Pasto", "Armenia"
]
```

Estas ciudades tienen **prioridad máxima** al construir la lista final de cada país.

### `scripts/build-destinations.js`

#### Entrada

- `Country.getAllCountries()` — todos los países ISO
- `City.getCitiesOfCountry(code)` — ciudades por país
- `State.getStatesOfCountry(code)` — estados/provincias
- `volunteer-hubs.json` — hubs curados
- `countries-list` — continente y moneda

#### Algoritmo `pickCities()` (por país)

1. **Hubs curados** — ciudades de `volunteer-hubs.json` (match fuzzy contra biblioteca)
2. **Capitales regionales** — match estado ↔ ciudad
3. **Scoring** — ciudades con nombre corto, sin prefijos administrativos (`SKIP_NAME` regex)
4. **Mínimo 8 ciudades** — relleno con cualquier ciudad válida si faltan

Límites: `MAX_CITIES = 20`, `MIN_CITIES = 8`.

#### Función `regionFor(code)`

Mapea continente ISO → región UI:

```javascript
// NA, SA → "americas"
// EU → "europe"
// OC → "asia-oceania"
// AF → "africa-me"
// AS → "asia-oceania" EXCEPTO Middle East codes → "africa-me"
```

Middle East codes: `IL, PS, JO, LB, SY, IQ, IR, SA, AE, QA, KW, BH, OM, YE, TR, AM, AZ, GE, CY`.

#### Salida por país

```javascript
{
  country: "Colombia",       // nombre en inglés (country-state-city)
  code: "CO",
  flag: "🇨🇴",               // emoji desde ISO code
  localCurrency: "COP",      // primera moneda de countries-list
  cities: ["Bogotá", "Medellín", ...],  // max 20
  popular: true,             // POPULAR_CODES ∪ tiene volunteer hub
  region: "americas"
}
```

#### Orden final

Popular primero, luego alfabético por nombre de país.

### Comandos de automatización

```bash
# Regenerar dataset manualmente
npm run destinations:build

# Se ejecuta automáticamente antes de cada build de producción
npm run build   # → prebuild hook → destinations:build
```

### Capa de runtime: `src/lib/destinations.ts`

Importa el JSON estáticamente (tree-shaken en build):

```typescript
import rawCountries from "./data/destinations-countries.json";

export const DESTINATION_COUNTRIES: DestinationCountry[] =
  rawCountries as DestinationCountry[];

export const COUNTRY_COUNT = DESTINATION_COUNTRIES.length; // 250
```

También expone `DESTINATIONS` — lista plana legacy de `{ city, country, ... }` para consumidores antiguos.

### Sistema de tabs y búsqueda: `src/lib/destination-regions.ts`

#### Tabs (pestañas)

```typescript
export const DESTINATION_TABS = [
  { id: "popular",       label: "🔥 Populares" },
  { id: "americas",      label: "🌎 América" },
  { id: "europe",        label: "🇪🇺 Europa" },
  { id: "asia-oceania",  label: "🌏 Asia & Oceanía" },
  { id: "africa-me",     label: "🌍 África & Medio Oriente" },
];
```

**Tab Populares** — 12 países top de voluntariado (orden fijo):

```typescript
export const TOP_VOLUNTEER_COUNTRY_CODES = [
  "CO", "BR", "MX", "TH", "CR", "PT", "ID", "AR", "PE", "ZA", "VN", "ES",
];
```

#### Búsqueda global: `searchAllDestinationCountries()`

- Busca en **todos los 250 países** y **3,862 ciudades** sin límite `.slice()`
- Normaliza acentos (`normalizeSearch()` — NFD + strip diacritics)
- **Alias multilenguaje ES/PT** → código ISO (`francia` → `FR`, `tailandia` → `TH`)
- Auto-expande el acordeón del primer país coincidente
- Reordena ciudades: matches primero dentro del acordeón

> **Bug histórico corregido:** Anteriormente `searchDestinationCountries()` aplicaba `.slice(0, 50)` sobre países populares alfabéticos, truncando la lista en **Ecuador**. Eliminado.

---

## 6. Componentes Clave y Flujos de UI

### Onboarding — 7 pasos (`OnboardingFlow.tsx`)

| Step | Pantalla | Componente clave |
|------|----------|------------------|
| 0 | Bienvenida + eslogan | Logo, botones Start / Demo |
| 1 | Destino | **`DestinationPicker`** |
| 2 | Fechas | Date inputs + contador de días |
| 3 | Moneda base | Grid de `CURRENCIES` |
| 4 | Setup voluntario | Host name + benefits chips |
| 5 | Presupuesto inicial | Input numérico |
| 6 | Pockets protegidos | Emergency + return flight |

Al completar: `completeOnboarding()` → persiste en IndexedDB → redirect `/app`.

**Demo trip:** `loadDemo()` carga datos de Chiang Mai desde `src/lib/demo/sampleData.ts`.

### `DestinationPicker.tsx` — Arquitectura del componente

```
┌─────────────────────────────────────────┐
│  🔍 Search input                        │
├─────────────────────────────────────────┤
│  [🔥 Populares] [🌎 América] [🇪🇺 …]    │  ← oculto si hay búsqueda
├─────────────────────────────────────────┤
│  Selected location badge (si hay value) │
├─────────────────────────────────────────┤
│  ┌─ 🇨🇴 Colombia ────────── ▼ ─┐       │
│  │  📍 Anywhere in Colombia      │       │
│  │     Medellín                  │       │
│  │     Bogotá                    │       │
│  │     Cali                      │       │
│  └───────────────────────────────┘       │
│  ┌─ 🇧🇷 Brazil ───────────── ▼ ─┐       │
│  └───────────────────────────────┘       │
└─────────────────────────────────────────┘
```

#### Estado local

```typescript
const [query, setQuery] = useState("");
const [activeTab, setActiveTab] = useState<DestinationTab>("popular");
const [expandedCountryId, setExpandedCountryId] = useState<string | null>(null);
```

#### Lógica de filtrado

```typescript
const isSearching = query.trim().length > 0;

const { countries, autoExpandCode } = useMemo(() => {
  if (isSearching) {
    return searchAllDestinationCountries(query, DESTINATION_COUNTRIES);
  }
  return {
    countries: getCountriesByTab(activeTab, DESTINATION_COUNTRIES),
    autoExpandCode: null,
  };
}, [query, activeTab, isSearching]);
```

| Modo | Tabs visibles | Fuente de datos |
|------|---------------|-----------------|
| Sin búsqueda | ✅ Sí | `getCountriesByTab(activeTab)` — subset regional |
| Con búsqueda | ❌ No | `searchAllDestinationCountries()` — dataset completo |

#### Selección de destino

```typescript
export type SelectedLocation = {
  country: string;
  countryCode: string;
  flag: string;
  localCurrency: CurrencyCode;
  city: string | null;  // null = "Anywhere in {country}"
};
```

#### Acordeón por país

- **Framer Motion** `AnimatePresence` + `height: auto` para expand/collapse
- Opción general: *"Anywhere in {country}"* con icono `MapPin`
- Ciudades resaltadas cuando coinciden con la búsqueda
- Check mark en selección activa

### Dashboard y navegación

**Mobile:** Bottom navigation (`NavigationBar`) con NAVI como acción central.

**Desktop:** Sidebar (`DesktopSidebar`) + panel NAVI lateral (xl+).

**Rutas post-onboarding:**

| Ruta | Pantalla |
|------|----------|
| `/app` | Dashboard — DRS, runway, actividad reciente |
| `/app/pockets` | Bolsillos protegidos y abiertos |
| `/app/activity` | Historial de transacciones |
| `/app/trip` | Detalle del viaje + reset local data |
| `/app/goals` | Metas de ahorro |
| `/app/navi` | Panel NAVI fullscreen |

---

## 7. PWA y Estado Offline

### Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "Voluntrip AI",
  "short_name": "Voluntrip",
  "start_url": "/app",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#070b12",
  "theme_color": "#070b12"
}
```

### Service Worker (`public/sw.js`)

Estrategia **network-first con fallback a cache**:

1. **Install:** precache de `/`, `/offline.html`, `/manifest.webmanifest`, `/icons/icon-192.png`
2. **Fetch GET:** intenta red → cachea respuesta 200 → fallback cache → `/offline.html` en navigate
3. **Activate:** limpia caches antiguas (`voluntrip-v1`)

Registro en `AppShell.tsx`:

```typescript
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}
```

### Detección offline en store

```typescript
// AppShell.tsx
window.addEventListener("online", () => setOffline(false));
window.addEventListener("offline", () => setOffline(true));
```

El flag `offline` en Zustand alimenta badges UI (*"Offline"* / *"Sync ready"*).

### Install prompt

`InstallPrompt.tsx` — captura `beforeinstallprompt` para "Add to Home Screen".

### Consideraciones mobile

- Viewport: `viewportFit: cover`, `100dvh`
- Safe areas: `env(safe-area-inset-bottom)` en padding de nav y onboarding
- Apple web app meta en `layout.tsx`

---

## 8. Motor Financiero (DRS)

Ubicación: `src/lib/finance/` — funciones puras, testeadas con Vitest.

### Fórmulas core

```
Balance actual    = initialBudget − Σ transacciones (en moneda base)
Dinero protegido  = Σ pockets donde protected === true
Disponible real   = Balance actual − Dinero protegido

DRS semanal       = Disponible real / Semanas restantes
DRS diario        = Disponible real / Días restantes
```

Implementación en `budget.ts`:

```typescript
export function calculateDRS(realAvailable: number, weeksRemaining: number): number {
  if (weeksRemaining <= 0) return 0;
  return realAvailable / weeksRemaining;
}

export function calculateDailyBudget(realAvailable: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return realAvailable / daysRemaining;
}
```

### Money Runway (`runway.ts`)

Proyecta cuándo se acabará el dinero vs. fecha fin del viaje:

- `on_track` — runway ≥ trip end
- `careful` — runway ligeramente antes
- `at_risk` — runway significativamente antes

### Simulación de compra (`simulation.ts`)

NAVI usa `simulatePurchase()` antes de confirmar gastos — retorna `PurchaseSimulation` con impacto en DRS diario/semanal.

### Multi-moneda (`currency.ts`)

Cada transacción preserva:

```typescript
amountOriginal   // nunca se sobrescribe
currencyOriginal
exchangeRate
amountBase       // convertido a moneda base del viaje
currencyBase
```

---

## 9. NAVI — Agente de IA Financiera

### Arquitectura

```
Usuario → NaviPanel → appStore.askNavi()
                           │
                    naviAgent.handle()  (client-side mock)
                           │
                    executeTool() × N
                           │
                    IndexedDB persist
```

**Server route alternativo:** `POST /api/navi` — para Azure OpenAI real (action: `ask` | `process` | `insight`).

### Tools disponibles (`src/lib/agent/tools.ts`)

| Tool | Descripción |
|------|-------------|
| `getTripContext` | Detalle del viaje activo |
| `getCurrentBalance` | Balance total |
| `getProtectedMoney` | Suma de pockets protegidos |
| `getWeeklyBudget` | DRS semanal |
| `getDailyBudget` | DRS diario |
| `getMoneyRunway` | Proyección de agotamiento |
| `getSpendingAnalysis` | Análisis de gastos |
| `simulatePurchase` | Simular compra antes de gastar |
| `createTransaction` | Registrar gasto |
| `protectMoney` | Bloquear dinero en pocket |
| `createGoal` | Crear meta de ahorro |
| `convertCurrency` | Conversión de moneda |

### Modo Mock vs. Azure

```typescript
// src/lib/ai/azureOpenAI.ts
const isMock = () =>
  process.env.MOCK_AI !== "false" && process.env.NEXT_PUBLIC_MOCK_AI !== "false";
```

Con `MOCK_AI=true` (default): heurísticas locales + tools del motor financiero.  
Con `MOCK_AI=false`: requiere `AZURE_OPENAI_*` en servidor.

### Regla de negocio NAVI

> **"Can I afford this?"** siempre ejecuta `simulatePurchase` antes de crear transacción.

---

## 10. Modelos de Datos y Tipado TypeScript

Fuente canónica: `src/types/index.ts`

### Tipos primitivos y enums

```typescript
/** ISO 4217 currency code — open set for global travel */
export type CurrencyCode = string;

export type LocaleCode = "en" | "es" | "pt";

export type HostBenefit =
  | "accommodation"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "laundry"
  | "transport"
  | "tours";

export type TransactionSource = "text" | "voice" | "receipt" | "manual";

export type PocketCategory =
  | "emergency"
  | "food"
  | "transport"
  | "fun"
  | "return_flight"
  | "debt"
  | "savings"
  | "custom";

export type SpendingStatus = "on_track" | "careful" | "at_risk";

export type NaviState = "idle" | "listening" | "thinking" | "success" | "error";
```

### Profile (equivalente a "User" — no hay interface `User`)

```typescript
export interface Profile {
  id: string;
  displayName: string;
  locale: LocaleCode;
  preferredCurrency: CurrencyCode;
  onboardingComplete: boolean;
  avatarHue?: number;
  createdAt: string;
  updatedAt: string;
}
```

### Trip

```typescript
export interface Trip {
  id: string;
  destination: string;
  city: string;
  country: string;
  countryCode: string;
  flag: string;
  baseCurrency: CurrencyCode;
  localCurrency: CurrencyCode;
  startDate: string;
  endDate: string;
  initialBudget: number;
  hostName?: string;
  includedBenefits: HostBenefit[];
  createdAt: string;
  updatedAt: string;
}
```

### Pocket

```typescript
export interface Pocket {
  id: string;
  tripId: string;
  name: string;
  category: PocketCategory;
  balance: number;
  allocated: number;
  protected: boolean;
  icon: string;
  createdAt: string;
  updatedAt: string;
}
```

### Transaction

```typescript
export interface Transaction {
  id: string;
  tripId: string;
  pocketId?: string;
  amountOriginal: number;
  currencyOriginal: CurrencyCode;
  exchangeRate: number;
  amountBase: number;
  currencyBase: CurrencyCode;
  concept: string;
  category: string;
  source: TransactionSource;
  createdAt: string;
  note?: string;
}
```

### Goal

```typescript
export interface Goal {
  id: string;
  tripId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
  protected: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### DestinationCountry (dominio geográfico)

```typescript
// src/lib/destinations.ts
export interface DestinationCountry {
  country: string;
  code: string;
  flag: string;
  localCurrency: CurrencyCode;
  cities: string[];
  popular: boolean;
  region: "americas" | "europe" | "asia-oceania" | "africa-me";
}
```

### Tipos financieros derivados

```typescript
export interface BudgetSnapshot {
  totalBalance: number;
  protectedMoney: number;
  realAvailable: number;
  daysRemaining: number;
  weeksRemaining: number;
  dailySafeSpend: number;
  weeklySafeSpend: number;
  status: SpendingStatus;
  spentTotal: number;
  averageDailySpend: number;
}

export interface MoneyRunwayResult {
  runwayDate: string;
  daysRemaining: number;
  tripEndDate: string;
  daysEarly: number;
  status: SpendingStatus;
  message: string;
}

export interface PurchaseSimulation {
  purchaseAmount: number;
  purchaseCurrency: CurrencyCode;
  purchaseAmountBase: number;
  availableBefore: number;
  availableAfter: number;
  dailyBudgetBefore: number;
  dailyBudgetAfter: number;
  weeklyBudgetBefore: number;
  weeklyBudgetAfter: number;
  affordable: boolean;
  impactMessage: string;
  daysImpacted: number;
}
```

### AgentMessage

```typescript
export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  toolCalls?: AgentToolCall[];
  locale?: LocaleCode;
}
```

### AppState (Zustand)

```typescript
export interface AppState {
  profile: Profile | null;
  trip: Trip | null;
  pockets: Pocket[];
  transactions: Transaction[];
  goals: Goal[];
  insights: AIInsight[];
  hydrated: boolean;
  offline: boolean;
}
```

---

## 11. Persistencia: IndexedDB y Sync Cloud

### Schema IndexedDB

Database: `voluntrip-ai` (version 1)

| Store | Key | Índices |
|-------|-----|---------|
| `profile` | `id` | — |
| `trips` | `id` | — |
| `pockets` | `id` | `by-trip` → `tripId` |
| `transactions` | `id` | `by-trip` → `tripId` |
| `goals` | `id` | `by-trip` → `tripId` |
| `insights` | `id` | `by-trip` → `tripId` |
| `messages` | `id` | — |
| `meta` | `key` | — |

### Ciclo de hidratación

```typescript
// appStore.hydrate()
profile  ← getProfile()
trip     ← getActiveTrip()  // más reciente por updatedAt
pockets, transactions, goals, insights ← by tripId
messages ← getMessages() → naviAgent.memory.load()
```

### Reset de datos

`clearAllData()` — disponible desde **My Trip → Reset local data**.

### Sync cloud (stub)

```typescript
// src/lib/sync/supabaseSync.ts
export function isCloudConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function pushLocalChanges() {
  // Future: map IndexedDB stores → Supabase tables
  return { ok: false, message: "Supabase sync adapter not connected yet." };
}
```

---

## 12. Internacionalización (i18n)

Archivo: `src/lib/i18n/dictionaries.ts`

| Locale | Estado |
|--------|--------|
| `en` | Completo |
| `es` | Completo |
| `pt` | Completo |

Función helper:

```typescript
t(locale, "onboarding.welcome_sub") // → "Your money needs a compass."
```

Preparado para extensión: FR, DE, IT, NL, JA, ZH.

La búsqueda de destinos incluye alias ES/PT independientes del locale UI (`destination-regions.ts`).

---

## 13. Guía de Comandos y Variables de Entorno

### Scripts npm

| Comando | Descripción |
|---------|-------------|
| `npm install` | Instalar dependencias |
| `npm run dev` | Servidor desarrollo con Turbopack (`localhost:3000`) |
| `npm run build` | Build producción (+ `prebuild` → `destinations:build`) |
| `npm run start` | Servidor producción post-build |
| `npm run lint` | ESLint (Next.js) |
| `npm test` | Vitest — tests motor financiero |
| `npm run test:watch` | Vitest en modo watch |
| `npm run icons` | Generar iconos PWA PNG |
| `npm run destinations:build` | Regenerar `destinations-countries.json` |

### Quick start

```bash
npm install
npm run icons          # primera vez — genera iconos PWA
npm run destinations:build  # opcional — ya corre en prebuild
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Variables de entorno (`.env.local`)

Copiar desde `.env.example`:

```bash
cp .env.example .env.local
```

| Variable | Requerida | Propósito |
|----------|-----------|-----------|
| `MOCK_AI` | No (default `true`) | `true` = NAVI mock local; `false` = Azure OpenAI |
| `AZURE_OPENAI_ENDPOINT` | Solo si `MOCK_AI=false` | Endpoint Azure OpenAI |
| `AZURE_OPENAI_API_KEY` | Solo si `MOCK_AI=false` | **Solo servidor** — nunca en cliente |
| `AZURE_OPENAI_DEPLOYMENT` | Solo si `MOCK_AI=false` | Nombre del deployment |
| `NEXT_PUBLIC_SUPABASE_URL` | Opcional | URL proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Opcional | Clave anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional | **Solo servidor** |
| `EXCHANGE_RATE_API_KEY` | Opcional | Tipos de cambio en vivo |
| `NEXT_PUBLIC_APP_URL` | Opcional | URL pública (default `http://localhost:3000`) |

> **Seguridad:** Nunca commitear `.env.local`. Nunca exponer `AZURE_OPENAI_API_KEY` ni `SUPABASE_SERVICE_ROLE_KEY` en código cliente.

---

## 14. Decisiones Arquitectónicas y Notas Operativas

### ¿Por qué JSON estático para destinos?

- **Performance:** Import estático, sin fetch en runtime
- **Offline:** Dataset disponible sin red desde el bundle
- **Control:** Hubs curados priorizan ciudades relevantes para voluntarios
- **Reproducibilidad:** `npm run destinations:build` regenera dataset idéntico

### ¿Por qué IndexedDB y no Supabase directo?

- Funciona sin cuenta ni internet inicial
- Latencia cero para cálculos DRS
- Supabase se añade como capa de backup/sync sin romper local-first

### ¿Por qué Zustand y no Redux?

- API mínima para estado global moderado
- Sin boilerplate; integración directa con IndexedDB en actions

### `createId()` — compatibilidad HTTP

`crypto.randomUUID()` falla en contextos no seguros (ej. `192.168.x.x`).  
Solución: `src/lib/id.ts` con fallback basado en timestamp + random.

### Extensión futura recomendada

1. Conectar Supabase sync (`pushLocalChanges` / `pullRemoteChanges`)
2. Activar Azure OpenAI con Route Handler ya existente
3. Añadir auth opcional (Supabase Auth)
4. Expandir alias de búsqueda a más idiomas
5. Service Worker: cachear `destinations-countries.json` explícitamente

---

## Referencias rápidas de archivos

| Concepto | Archivo |
|----------|---------|
| Tipos de dominio | `src/types/index.ts` |
| Estado global | `src/store/appStore.ts` |
| Persistencia local | `src/lib/db/indexeddb.ts` |
| Motor DRS | `src/lib/finance/budget.ts` |
| Agente NAVI | `src/lib/agent/agent.ts` |
| Destinos (loader) | `src/lib/destinations.ts` |
| Tabs + búsqueda | `src/lib/destination-regions.ts` |
| Dataset generado | `src/lib/data/destinations-countries.json` |
| Generador dataset | `scripts/build-destinations.js` |
| Hubs curados | `scripts/volunteer-hubs.json` |
| Picker UI | `src/components/onboarding/DestinationPicker.tsx` |
| Onboarding | `src/components/onboarding/OnboardingFlow.tsx` |
| PWA SW | `public/sw.js` |
| API NAVI | `src/app/api/navi/route.ts` |
| Sync stub | `src/lib/sync/supabaseSync.ts` |
| i18n | `src/lib/i18n/dictionaries.ts` |

---

*Documento generado a partir del análisis del código fuente de Voluntrip AI v0.1.0.*
