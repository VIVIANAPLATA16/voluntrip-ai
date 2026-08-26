/**
 * Builds src/lib/data/destinations-countries.json from country-state-city
 * + curated volunteer/tourism hubs (Worldpackers-style coverage).
 *
 * Run: npm run destinations:build
 */
const fs = require("fs");
const path = require("path");
const { Country, City, State } = require("country-state-city");
const { countries: countriesList } = require("countries-list");
const volunteerHubs = require("./volunteer-hubs.json");

const OUT = path.join(__dirname, "../src/lib/data/destinations-countries.json");
const MAX_CITIES = 20;
const MIN_CITIES = 8;

/** Worldpackers-style popular destinations (shown first when no search) */
const POPULAR_CODES = new Set([
  "BR", "MX", "CO", "AR", "CL", "PE", "EC", "CR", "GT", "PA", "UY", "PY", "BO", "DO", "CU", "PR",
  "TH", "ID", "VN", "KH", "LA", "MM", "NP", "IN", "LK", "PH", "MY", "SG", "JP", "KR", "TW",
  "AU", "NZ", "PT", "ES", "IT", "GR", "FR", "DE", "NL", "IE", "GB", "CH", "AT", "PL", "CZ", "HU",
  "HR", "RS", "TR", "IL", "MA", "EG", "KE", "TZ", "ZA", "GH", "NG", "SN", "UG", "RW", "ET",
  "US", "CA", "IS", "NO", "SE", "DK", "FI", "GE", "AM", "AZ", "KZ", "UZ", "MN", "AE", "JO",
  "BZ", "HN", "NI", "SV", "JM", "FJ", "PG", "MV", "CN", "HK", "MO", "RU", "UA", "RO", "BG",
]);

const SKIP_NAME =
  /^(Amphoe|Mueang|Municipality|District|County|Regierungsbezirk|Arrondissement|Canton|Parish of|Town of|City of|Village of|Comune di)/i;

/** Middle East → grouped with Africa tab in UI */
const MIDDLE_EAST = new Set([
  "IL", "PS", "JO", "LB", "SY", "IQ", "IR", "SA", "AE", "QA", "KW", "BH", "OM", "YE", "TR",
  "AM", "AZ", "GE", "CY",
]);

function regionFor(code) {
  const cont = countriesList[code]?.continent;
  if (cont === "NA" || cont === "SA") return "americas";
  if (cont === "EU") return "europe";
  if (cont === "OC") return "asia-oceania";
  if (cont === "AF") return "africa-me";
  if (cont === "AS") {
    return MIDDLE_EAST.has(code) ? "africa-me" : "asia-oceania";
  }
  return "asia-oceania";
}

function flagFromCode(code) {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

function currencyFor(code) {
  const meta = countriesList[code];
  if (meta?.currency?.length) return meta.currency[0];
  const csc = Country.getCountryByCode(code);
  if (csc?.currency) return csc.currency.split(",")[0].trim();
  return "USD";
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findInLibrary(all, name) {
  const n = normalize(name);
  return all.find(
    (c) =>
      normalize(c.name) === n ||
      normalize(c.name).startsWith(n) ||
      n.startsWith(normalize(c.name))
  );
}

function scoreCity(name) {
  if (SKIP_NAME.test(name)) return -100;
  if (name.length > 28) return -50;
  if (name.length < 3) return -20;
  let score = 0;
  if (name.split(/\s+/).length === 1) score += 8;
  if (name.length >= 4 && name.length <= 16) score += 10;
  if (/^[A-ZÁÉÍÓÚÑÜ]/.test(name)) score += 2;
  if (/\d/.test(name)) score -= 15;
  if (name.includes("-") && name.split("-").length > 2) score -= 5;
  return score;
}

function pickCities(countryCode, allCities, states) {
  const hubs = volunteerHubs[countryCode] || [];
  const selected = [];
  const seen = new Set();

  const add = (name) => {
    const key = normalize(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    selected.push(name);
  };

  // 1. Curated volunteer / tourism hubs (priority order)
  for (const hub of hubs) {
    if (selected.length >= MAX_CITIES) break;
    const match = findInLibrary(allCities, hub);
    add(match ? match.name : hub);
  }

  // 2. State / region name matches (often capitals)
  for (const state of states) {
    if (selected.length >= MAX_CITIES) break;
    const stateCities = allCities.filter((c) => c.stateCode === state.isoCode);
    const capital = stateCities.find((c) => {
      const cn = normalize(c.name);
      const sn = normalize(state.name);
      return cn === sn || sn.includes(cn) || cn.includes(sn.split(" ")[0]);
    });
    if (capital) add(capital.name);
  }

  // 3. Top-scored cities from library
  const ranked = allCities
    .map((c) => ({ name: c.name, score: scoreCity(c.name) }))
    .filter((c) => c.score > 0 && !seen.has(normalize(c.name)))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  for (const { name } of ranked) {
    if (selected.length >= MAX_CITIES) break;
    add(name);
  }

  // 4. Ensure minimum coverage with any remaining valid names
  if (selected.length < MIN_CITIES) {
    for (const c of allCities) {
      if (selected.length >= MIN_CITIES) break;
      if (c.name.length >= 3 && c.name.length <= 30 && !SKIP_NAME.test(c.name)) {
        add(c.name);
      }
    }
  }

  return selected.slice(0, MAX_CITIES);
}

function build() {
  const allCountries = Country.getAllCountries();
  const output = [];

  for (const country of allCountries) {
    const code = country.isoCode;
    const allCities = City.getCitiesOfCountry(code) || [];
    const states = State.getStatesOfCountry(code) || [];
    let cities = pickCities(code, allCities, states);

    if (cities.length === 0) {
      const hubOnly = volunteerHubs[code] || [];
      if (hubOnly.length) {
        cities = hubOnly.slice(0, MAX_CITIES);
      } else {
        cities = [country.name];
      }
    }

    if (cities.length === 0) continue;

    output.push({
      country: country.name,
      code,
      flag: flagFromCode(code),
      localCurrency: currencyFor(code),
      cities,
      popular: POPULAR_CODES.has(code) || Boolean(volunteerHubs[code]),
      region: regionFor(code),
    });
  }

  output.sort((a, b) => {
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return a.country.localeCompare(b.country);
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 0));

  const stats = {
    countries: output.length,
    totalCities: output.reduce((s, c) => s + c.cities.length, 0),
    avgCities: (output.reduce((s, c) => s + c.cities.length, 0) / output.length).toFixed(1),
    colombia: output.find((c) => c.code === "CO")?.cities,
    chile: output.find((c) => c.code === "CL")?.cities,
    popular: output.filter((c) => c.popular).length,
  };

  console.log("✓ destinations-countries.json");
  console.log(JSON.stringify(stats, null, 2));
}

build();
