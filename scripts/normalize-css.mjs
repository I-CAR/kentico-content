import { readFileSync, writeFileSync } from "node:fs";

const [, , input, output] = process.argv;

if (!input || !output) {
  console.error("Usage: node scripts/normalize-css.mjs <input> <output>");
  process.exit(1);
}

const source = readFileSync(input, "utf8");

const normalized = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\r\n/g, "\n")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .join("\n");

writeFileSync(output, `${normalized}\n`);
