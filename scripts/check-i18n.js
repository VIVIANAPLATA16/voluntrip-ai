#!/usr/bin/env node
/**
 * Warns about likely hardcoded English UI strings in TSX files.
 * Run: npm run check:i18n
 *
 * Exit 1 when likely UI strings are found, 0 when none are found.
 * node scripts/check-i18n.js --self-test  checks the scanner on fixtures
 * (exit 1 if a fixture fails).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = [
  path.join(ROOT, "src/components"),
  path.join(ROOT, "src/app"),
];

const SKIP_ATTR_NAMES = new Set([
  "className",
  "style",
  "href",
  "src",
  "type",
  "id",
  "key",
  "role",
  "viewBox",
  "fill",
  "stroke",
  "strokeWidth",
  "opacity",
  "inputMode",
  "variant",
  "size",
  "name",
  "value",
  "htmlFor",
  "for",
  "target",
  "rel",
  "d",
  "cx",
  "cy",
  "r",
  "x",
  "y",
  "width",
  "height",
  "tabIndex",
  "autoComplete",
  "pattern",
  "min",
  "max",
  "step",
  "accept",
  "loading",
  "decoding",
  "fetchPriority",
  "aria-hidden",
]);

function skipAttr(name) {
  return SKIP_ATTR_NAMES.has(name) || name.startsWith("data-");
}

const ALLOWED_SINGLE = new Set([
  "NAVI",
  "AI",
  "DRS",
  "THB",
  "USD",
  "EUR",
  "COP",
  "BRL",
  "V",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function stripComments(text) {
  return text
    .replace(/{\/\*[\s\S]*?\*\/}/g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function isLikelyEnglish(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 4) return false;
  if (/^[\d\s./:+\-≈—–·,!?%$€£¥₿]+$/.test(trimmed)) return false;
  if (/^[A-Z]{2,5}$/.test(trimmed)) return false;
  if (ALLOWED_SINGLE.has(trimmed)) return false;
  if (/^[\u{1F300}-\u{1FAFF}]/u.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const englishish = /[a-zA-Z]/.test(trimmed);
  const hasCommonEnglish =
    /\b(the|and|your|you|for|with|this|that|from|are|can|not|all|any|new|add|see|no|yet|day|week|trip|money|ask|confirm|cancel|save|delete|install|search|language|destination|host|budget|start|end|local|base|food|fun|transport|general|locked|open|protect|unlock|goal|pocket|activity|movements|register|expense|voice|receipt|preview|simulation|available|after|daily|weekly|safe|spend|runway|track|careful|risk|loading|listening|thinking|dismiss|custom|duration|amount|currency|category|concept|name|target|current|benefits|selected|reset|data|countries|region|city|cities|matches|anywhere|market|dinner|lunch|breakfast|accommodation|laundry|tours|emergency|flight|return|companion|compass|offline|sync|ready|convert|quick|progress|countdown|left|tip|screen|native|feel|home|optional|placeholder|optional)\b/i.test(
      trimmed
    );
  return englishish && (words.length >= 3 || hasCommonEnglish);
}

/** True when `>` at index closes a JSX tag, not `=>`, `>=`, a generic, or a comparison. */
function isJsxTagClose(content, gtIndex) {
  if (gtIndex < 0 || content[gtIndex] !== ">") return false;
  const prev = gtIndex > 0 ? content[gtIndex - 1] : "";
  if (prev === "=" || prev === "-") return false;
  const after = content.slice(gtIndex + 1);
  if (/^\s*[\(,;|&>=]/.test(after)) return false;
  if (/^\s*\d/.test(after)) return false;
  if (/^\s*[a-zA-Z_$][\w.]*\s*[?:=+\-*/(%[&|]/.test(after)) return false;
  return true;
}

/** True when index sits inside an opening JSX tag (`<Tag ... >`). */
function isInsideJsxOpenTag(content, index) {
  let quote = null;
  for (let i = index - 1; i >= 0; i--) {
    const ch = content[i];
    if (quote) {
      if (ch === quote && content[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") {
      if (content[i - 1] === "=" || content[i - 1] === "-") continue;
      return false;
    }
    if (ch === "<") return /<[A-Za-z/]/.test(content.slice(i, i + 3));
  }
  return false;
}

function scanContent(content) {
  const findings = [];

  const tCallPattern = /t\s*\(\s*locale\s*,\s*["'`][^"'`]+["'`]/g;
  const inTCall = (index) => {
    for (const m of content.matchAll(tCallPattern)) {
      if (index >= m.index && index <= m.index + m[0].length + 80) return true;
    }
    return false;
  };

  const jsxTextPattern = />([^<>{}]+)</g;
  let match;
  while ((match = jsxTextPattern.exec(content)) !== null) {
    if (!isJsxTagClose(content, match.index)) continue;
    const text = match[1];
    if (!text || !text.trim()) continue;
    if (/^\s*\{/.test(text) || /\}\s*$/.test(text)) continue;
    if (isLikelyEnglish(text) && !inTCall(match.index)) {
      findings.push({
        line: content.slice(0, match.index).split("\n").length,
        text: text.trim(),
      });
    }
  }

  const attrPattern = /(\w[\w-]*)\s*=\s*["']([^"']{12,})["']/g;
  while ((match = attrPattern.exec(content)) !== null) {
    const [, attr, value] = match;
    if (!isInsideJsxOpenTag(content, match.index)) continue;
    if (skipAttr(attr)) continue;
    if (attr.startsWith("aria-") && attr !== "aria-label") continue;
    if (/\{/.test(value)) continue;
    if (isLikelyEnglish(value)) {
      findings.push({
        line: content.slice(0, match.index).split("\n").length,
        text: `${attr}="${value}"`,
      });
    }
  }

  return findings;
}

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const content = stripComments(fs.readFileSync(filePath, "utf8"));
  return scanContent(content).map((f) => ({ ...f, file: rel }));
}

function runSelfTest() {
  const cases = [
    {
      name: "arrow store selector is not JSX text",
      src: 'const locale = useAppStore((s) => s.locale);\nreturn <p>{locale}</p>;',
      expect: 0,
    },
    {
      name: "useState/useRef generics are not JSX text",
      src:
        'const [user, setUser] = useState<User | null>(null);\n' +
        'const bottomRef = useRef<HTMLDivElement>(null);\n' +
        "const [state, setState] = useState<NaviState>(\"idle\");\n" +
        "return <div />;",
      expect: 0,
    },
    {
      name: "visible English JSX children are reported",
      src: "return (\n  <div>No trip yet. Complete onboarding or load the demo.</div>\n);",
      expect: 1,
    },
    {
      name: "English placeholder on a JSX tag is reported",
      src: 'return <input placeholder="Search the destination list" />;',
      expect: 1,
    },
    {
      name: "translated JSX children are ignored",
      src: 'return <p>{t(locale, "home.offline")}</p>;',
      expect: 0,
    },
    {
      name: "plain TypeScript string assignment is not a UI attribute",
      src: 'const label = "Search the destination list";\nreturn <div />;',
      expect: 0,
    },
    {
      name: "numeric comparison is not JSX text",
      src:
        "goals.map((g) => {\n" +
        "  const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;\n" +
        "  return (\n    <Card>{g.name}</Card>\n  );\n});",
      expect: 0,
    },
  ];

  let failed = 0;
  for (const item of cases) {
    const found = scanContent(item.src);
    const ok = found.length === item.expect;
    if (!ok) {
      failed += 1;
      console.log(
        `self-test FAIL: ${item.name} (expected ${item.expect}, got ${found.length})`
      );
      for (const hit of found) console.log(`  ${hit.text}`);
    }
  }
  if (failed === 0) {
    console.log(`check:i18n — self-test passed (${cases.length} cases).`);
    process.exit(0);
  }
  console.log(`check:i18n — self-test failed (${failed}/${cases.length}).`);
  process.exit(1);
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
}

const files = SCAN_DIRS.flatMap((d) => walk(d));
const all = files.flatMap(scanFile);

if (all.length === 0) {
  console.log("check:i18n — no likely hardcoded English UI strings found.");
  process.exit(0);
}

console.log(`check:i18n — ${all.length} warning(s):\n`);
for (const w of all) {
  console.log(`  ${w.file}:${w.line}  ${w.text}`);
}
console.log("\nTip: use t(locale, \"key\") from src/lib/i18n/dictionaries.ts");
process.exit(1);
