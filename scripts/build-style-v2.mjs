import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compile } from "sass";

const output = "css/style-v2.compiled.css";
const tempRoot = mkdtempSync(join(tmpdir(), "icar-style-v2-"));
const tempScssRoot = join(tempRoot, "scss");
const tempEntry = join(tempScssRoot, "style-v2.scss");
const tempSliders = join(tempScssRoot, "components", "_sliders.scss");

cpSync("css/scss", tempScssRoot, { recursive: true });

// Sass won't parse this legacy raw-CSS typo, so patch it only in the temp copy.
const slidersSource = readFileSync(tempSliders, "utf8").replace(
  "    color: var(--gray-900) display: flex;",
  "    color: var(--gray-900);\n    display: flex;",
);

writeFileSync(tempSliders, slidersSource);

const result = compile(tempEntry, {
  style: "expanded",
  sourceMap: false,
});

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, result.css);
