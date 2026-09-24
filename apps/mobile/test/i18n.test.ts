import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { en, zh } from "../src/i18n.tsx";

/**
 * The interface shipped for a while with a Chinese dictionary covering only the
 * navigation, so choosing Chinese left most of the screen in English. Nothing
 * caught it because a missing key silently falls back to English by design.
 *
 * These tests hold the two dictionaries to the same key set and make sure every
 * key the interface actually asks for exists in both, so that class of gap
 * fails here instead of in front of a user.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function interfaceFiles(): string[] {
  const files = [join(root, "App.tsx")];
  for (const entry of readdirSync(join(root, "src"), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(join(root, "src", entry.name));
  }
  return files;
}

/** Keys asked for with a literal, e.g. t("nav.apps"). Interpolated keys are skipped. */
function usedKeys(): Map<string, string> {
  const found = new Map<string, string>();
  const call = /\bt\(\s*["'`]([A-Za-z0-9_.]+)["'`]/g;
  for (const file of interfaceFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(call)) {
      if (!found.has(match[1])) found.set(match[1], file.slice(root.length + 1));
    }
  }
  return found;
}

test("both languages define exactly the same keys", () => {
  const english = Object.keys(en).sort();
  const chinese = Object.keys(zh).sort();
  const missingFromChinese = english.filter((key) => !(key in zh));
  const missingFromEnglish = chinese.filter((key) => !(key in en));
  assert.deepEqual(
    { missingFromChinese, missingFromEnglish },
    { missingFromChinese: [], missingFromEnglish: [] },
    "a key present in one dictionary and not the other renders as the wrong language",
  );
});

test("every key the interface asks for is defined in both languages", () => {
  const missing = [...usedKeys()]
    .filter(([key]) => !(key in en) || !(key in zh))
    .map(([key, file]) => `${key} (${file})`);
  assert.deepEqual(missing, [], "these keys would render as their raw identifier");
});

test("no translation is empty", () => {
  const blank = [
    ...Object.entries(en).map(([key, value]) => ["en", key, value] as const),
    ...Object.entries(zh).map(([key, value]) => ["zh", key, value] as const),
  ]
    .filter(([, , value]) => value.trim() === "")
    .map(([language, key]) => `${language}:${key}`);
  assert.deepEqual(blank, []);
});
