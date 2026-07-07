import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import postcss from "postcss";
import { compile } from "sass";
import { buildInlineStyle } from "./cms-inline-utils.mjs";

const output = "css/style.css";
const outputMap = `${output}.map`;
const watchMode = process.argv.includes("--watch");
const productionMode = process.argv.includes("--production");
const sourceRoot = "css/scss";
const entryFile = "style.scss";
const entryPath = join(sourceRoot, entryFile);
const dependencyCssPaths = [
  "node_modules/bootstrap/dist/css/bootstrap.css",
  "node_modules/swiper/swiper.css",
  "node_modules/swiper/modules/navigation.css",
  "node_modules/swiper/modules/pagination.css",
];
const legacySelectors = `
main:not(+.row--with-cols-padding) .ic-section:last-child {
  padding-bottom: clamp(calc(80rem / 16), 1.721rem + 9.697vw, calc(120rem / 16));
}

main:has(>section:last-child):has(:not(+.row.row--with-cols-padding:has(form))) {
  padding-bottom: clamp(var(--space-80), 3.361rem + 4.848vw, var(--space-120));
}

ul {}
`;

let buildQueued = false;
let buildRunning = false;
let queuedReason = null;
let watchDebounce = null;
let previousSnapshot = "";

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reportOutputSizes(css) {
  const rawBytes = Buffer.byteLength(css);
  const gzipBytes = gzipSync(css).byteLength;
  console.log(`[style] Size raw: ${formatBytes(rawBytes)} | gzip: ${formatBytes(gzipBytes)}`);
}

async function build(reason = "manual") {
  if (buildRunning) {
    buildQueued = true;
    queuedReason = reason;
    return;
  }

  buildRunning = true;

  try {
    const result = compile(entryPath, {
      style: productionMode ? "compressed" : "expanded",
      sourceMap: !productionMode,
      sourceMapIncludeSources: !productionMode,
    });

    mkdirSync(dirname(output), { recursive: true });

    const dependencyCss = dependencyCssPaths.map((filePath) => readFileSync(filePath, "utf8")).join("\n");
    let css = `${dependencyCss}\n${result.css}\n${legacySelectors}`;

    if (productionMode) {
      const processed = await postcss([
        autoprefixer(),
        cssnano({
          preset: [
            "default",
            {
              discardComments: {
                removeAll: true,
              },
            },
          ],
        }),
      ]).process(css, { from: entryPath, to: output, map: false });

      css = processed.css;
      rmSync(outputMap, { force: true });
    } else {
      css = `${css}\n/*# sourceMappingURL=${basename(outputMap)} */\n`;
      writeFileSync(outputMap, JSON.stringify(result.sourceMap, null, 2));
    }

    writeFileSync(output, css);
    buildInlineStyle();
    console.log(
      `[style] Built ${output}${productionMode ? " [production]" : ""}${watchMode ? ` (${reason})` : ""}`,
    );
    reportOutputSizes(css);
  } catch (error) {
    console.error(`[style] Build failed${watchMode ? ` (${reason})` : ""}`);
    console.error(error instanceof Error ? error.message : error);

    if (!watchMode) {
      process.exitCode = 1;
    }
  } finally {
    buildRunning = false;

    if (buildQueued) {
      buildQueued = false;
      const nextReason = queuedReason ?? "queued change";
      queuedReason = null;
      queueMicrotask(() => {
        void build(nextReason);
      });
    }
  }
}

function scheduleBuild(reason) {
  clearTimeout(watchDebounce);
  watchDebounce = setTimeout(() => build(reason), 75);
}

function collectScssFiles(root) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectScssFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".scss")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function createSnapshot() {
  return collectScssFiles(sourceRoot)
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");
}

await build();

if (watchMode) {
  console.log(`[style] Watching ${sourceRoot}/**/*.scss`);
  previousSnapshot = createSnapshot();

  setInterval(() => {
    const nextSnapshot = createSnapshot();

    if (nextSnapshot === previousSnapshot) {
      return;
    }

    previousSnapshot = nextSnapshot;
    scheduleBuild("polling change");
  }, 250);
}
