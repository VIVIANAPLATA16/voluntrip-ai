#!/usr/bin/env node
/**
 * Warns about likely hardcoded English UI strings in TSX files.
 * Run: npm run check:i18n
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = [
  path.join(ROOT, "src/components"),
  path.join(ROOT, "src/app"),
];

const SKIP_ATTRS =
  /(?:className|style|href|src|type|id|key|role|viewBox|fill|stroke|strokeWidth|opacity|inputMode|variant|size|name|value|htmlFor|for|target|rel|d|cx|cy|r|x|y|width|height|tabIndex|autoComplete|pattern|min|max|step|accept|loading|decoding|fetchPriority|data-[\w-]+|aria-hidden)\s*=/;

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

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const content = stripComments(raw);
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
    const text = match[1];
    if (!text || !text.trim()) continue;
    if (/^\s*\{/.test(text) || /\}\s*$/.test(text)) continue;
    if (isLikelyEnglish(text) && !inTCall(match.index)) {
      findings.push({ line: content.slice(0, match.index).split("\n").length, text: text.trim() });
    }
  }

  const attrPattern = /(\w[\w-]*)\s*=\s*["']([^"']{12,})["']/g;
  while ((match = attrPattern.exec(content)) !== null) {
    const [, attr, value] = match;
    if (SKIP_ATTRS.test(`${attr}=`)) continue;
    if (attr.startsWith("aria-") && attr !== "aria-label") continue;
    if (/\{/.test(value)) continue;
    if (isLikelyEnglish(value)) {
      findings.push({
        line: content.slice(0, match.index).split("\n").length,
        text: `${attr}="${value}"`,
      });
    }
  }

  return findings.map((f) => ({ ...f, file: rel }));
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
process.exit(0);
