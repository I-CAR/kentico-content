import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compile } from "sass";

const output = "css/style-v3.css";
const tempRoot = mkdtempSync(join(tmpdir(), "icar-style-v3-"));
const tempScssRoot = join(tempRoot, "scss");
const tempEntry = join(tempScssRoot, "style-v3.scss");

cpSync("css/scss", tempScssRoot, { recursive: true });

const result = compile(tempEntry, {
  style: "expanded",
  sourceMap: false,
});

const legacySelectors = `
main:not(+.row--with-cols-padding) .ic-section:last-child {
  padding-bottom: clamp(calc(80rem / 16), 1.721rem + 9.697vw, calc(120rem / 16));
}

main:has(>section:last-child):has(:not(+.row.row--with-cols-padding:has(form))) {
  padding-bottom: clamp(var(--space-80), 3.361rem + 4.848vw, var(--space-120));
}

ul {}
`;

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${result.css}\n${legacySelectors}`);
