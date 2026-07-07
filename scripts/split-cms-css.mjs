import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [, , inputPath, bootstrapOutPath, customOutPath] = process.argv;

if (!inputPath || !bootstrapOutPath || !customOutPath) {
  console.error(
    "Usage: node scripts/split-cms-css.mjs <input.css> <bootstrap-out.css> <custom-out.css>",
  );
  process.exit(1);
}

const source = readFileSync(inputPath, "utf8");
const splitMarker = "/* From Old BlueModus CSS */";
const markerIndex = source.indexOf(splitMarker);

if (markerIndex === -1) {
  console.error(`Split marker not found: ${splitMarker}`);
  process.exit(1);
}

const bootstrapCss = source.slice(0, markerIndex).trimEnd();
const customCss = source.slice(markerIndex + splitMarker.length).trimStart();

mkdirSync(dirname(bootstrapOutPath), { recursive: true });
mkdirSync(dirname(customOutPath), { recursive: true });

writeFileSync(bootstrapOutPath, `${bootstrapCss}\n`);
writeFileSync(customOutPath, `/* ${splitMarker.replace(/^\/\* |\*\/$/g, "")} */\n${customCss}`);

console.log(`Wrote ${bootstrapOutPath}`);
console.log(`Wrote ${customOutPath}`);
