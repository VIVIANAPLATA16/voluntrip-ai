import type { DestinationCountry } from "./destinations";

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** ES/PT search aliases → ISO code (common volunteer-traveler queries) */
const COUNTRY_SEARCH_ALIASES: Record<string, string> = {
  francia: "FR",
  alemania: "DE",
  espana: "ES",
  italia: "IT",
  reino: "GB",
  "reino unido": "GB",
  inglaterra: "GB",
  estados: "US",
  "estados unidos": "US",
  brasil: "BR",
  japon: "JP",
  corea: "KR",
  "corea del sur": "KR",
  tailandia: "TH",
  vietnam: "VN",
  indonesia: "ID",
  india: "IN",
  australia: "AU",
  nueva: "NZ",
  "nueva zelanda": "NZ",
  suiza: "CH",
  holanda: "NL",
  "paises bajos": "NL",
  belgica: "BE",
  austria: "AT",
  suecia: "SE",
  noruega: "NO",
  dinamarca: "DK",
  finlandia: "FI",
  irlanda: "IE",
  portugal: "PT",
  mexico: "MX",
  colombia: "CO",
  argentina: "AR",
  chile: "CL",
  peru: "PE",
  ecuador: "EC",
  bolivia: "BO",
  paraguay: "PY",
  uruguay: "UY",
  venezuela: "VE",
  "costa rica": "CR",
  panama: "PA",
  guatemala: "GT",
  honduras: "HN",
  nicaragua: "NI",
  "el salvador": "SV",
  cuba: "CU",
  "republica dominicana": "DO",
  "sudafrica": "ZA",
  marruecos: "MA",
  egipto: "EG",
  turquia: "TR",
  israel: "IL",
  emiratos: "AE",
  "emiratos arabes": "AE",
  china: "CN",
  filipinas: "PH",
  malasia: "MY",
  singapur: "SG",
  camboya: "KH",
  laos: "LA",
  nepal: "NP",
  "sri lanka": "LK",
};

function countryMatchesQuery(c: DestinationCountry, q: string): boolean {
  const nq = normalizeSearch(q);
  if (c.country.toLowerCase().includes(q) || c.code.toLowerCase() === q) {
    return true;
  }
  if (normalizeSearch(c.country).includes(nq)) {
    return true;
  }
  const aliasCode = COUNTRY_SEARCH_ALIASES[nq];
  if (aliasCode && c.code === aliasCode) {
    return true;
  }
  return false;
}

function cityMatchesQuery(city: string, q: string): boolean {
  const nq = normalizeSearch(q);
  return (
    city.toLowerCase().includes(q) || normalizeSearch(city).includes(nq)
  );
}

/** Top volunteer / Worldpackers destinations (shown in 🔥 Populares tab) */
export const TOP_VOLUNTEER_COUNTRY_CODES = [
  "CO",
  "BR",
  "MX",
  "TH",
  "CR",
  "PT",
  "ID",
  "AR",
  "PE",
  "ZA",
  "VN",
  "ES",
] as const;

export type DestinationTab =
  | "popular"
  | "americas"
  | "europe"
  | "asia-oceania"
  | "africa-me";

export type DestinationRegion = Exclude<DestinationTab, "popular">;

export const DESTINATION_TABS: Array<{
  id: DestinationTab;
  label: string;
}> = [
  { id: "popular", label: "🔥 Populares" },
  { id: "americas", label: "🌎 América" },
  { id: "europe", label: "🇪🇺 Europa" },
  { id: "asia-oceania", label: "🌏 Asia & Oceanía" },
  { id: "africa-me", label: "🌍 África & Medio Oriente" },
];

export function getPopularCountries(
  all: DestinationCountry[]
): DestinationCountry[] {
  const byCode = new Map(all.map((c) => [c.code, c]));
  return TOP_VOLUNTEER_COUNTRY_CODES.map((code) => byCode.get(code)).filter(
    (c): c is DestinationCountry => Boolean(c)
  );
}

export function getCountriesByTab(
  tab: DestinationTab,
  all: DestinationCountry[]
): DestinationCountry[] {
  if (tab === "popular") {
    return getPopularCountries(all);
  }

  return all.filter((c) => c.region === tab);
}

export function searchAllDestinationCountries(
  query: string,
  all: DestinationCountry[]
): {
  countries: DestinationCountry[];
  autoExpandCode: string | null;
  matchedCity: string | null;
} {
  const q = query.toLowerCase().trim();
  const nq = normalizeSearch(query);
  if (!q) {
    return { countries: [], autoExpandCode: null, matchedCity: null };
  }

  const aliasCode = COUNTRY_SEARCH_ALIASES[nq];

  const byCountryName = all.filter(
    (c) =>
      countryMatchesQuery(c, q) ||
      (aliasCode !== undefined && c.code === aliasCode)
  );

  const byCity = all.filter((c) =>
    c.cities.some((city) => cityMatchesQuery(city, q))
  );

  const exactCountry = byCountryName.find(
    (c) =>
      normalizeSearch(c.country) === nq ||
      c.code.toLowerCase() === q ||
      (aliasCode !== undefined && c.code === aliasCode)
  );

  if (exactCountry || (byCountryName.length > 0 && byCity.length === 0)) {
    const countries = exactCountry ? [exactCountry] : byCountryName;
    return {
      countries,
      autoExpandCode: countries[0]?.code ?? null,
      matchedCity: null,
    };
  }

  const codes = new Set<string>();
  const countries: DestinationCountry[] = [];

  for (const c of [...byCity, ...byCountryName]) {
    if (codes.has(c.code)) continue;
    codes.add(c.code);
    const matched = c.cities.filter((city) => cityMatchesQuery(city, q));
    const rest = c.cities.filter((city) => !cityMatchesQuery(city, q));
    countries.push({
      ...c,
      cities: matched.length > 0 ? [...matched, ...rest] : c.cities,
    });
  }

  const matchedCity =
    countries[0]?.cities.find((city) => cityMatchesQuery(city, q)) ?? null;

  return {
    countries,
    autoExpandCode: countries[0]?.code ?? null,
    matchedCity,
  };
}
