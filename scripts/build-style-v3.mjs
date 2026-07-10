import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import postcss from "postcss";
import { compile } from "sass";

const watchMode = process.argv.includes("--watch");
const productionMode = process.argv.includes("--production");
const sourceRoot = "css/scss";
const legacySelectors = `
main:not(+.row--with-cols-padding) .ic-section:last-of-type,
main:not(+.row--with-cols-padding) .section:last-of-type,
main .ic-section.mb-0,
main .section.mb-0 {
  padding-bottom: clamp(calc(80rem / 16), 1.721rem + 9.697vw, calc(120rem / 16));
}

main:has(>section:last-child):has(:not(+.row.row--with-cols-padding:has(form))) {
  padding-bottom: clamp(var(--space-80), 3.361rem + 4.848vw, var(--space-120));
}

ul {}
`;
const buildTargets = [
  {
    entryPath: join(sourceRoot, "vendor", "bootstrap-subset.scss"),
    output: "css/bootstrap-subset.css",
    sourceMap: false,
  },
  {
    entryPath: join(sourceRoot, "vendor", "bootstrap-cms-compat.scss"),
    output: "css/bootstrap-cms-compat.css",
    sourceMap: false,
  },
  {
    entryPath: join(sourceRoot, "style.scss"),
    output: "css/style.css",
    appendCss: legacySelectors,
    sourceMap: true,
  },
  {
    entryPath: join(sourceRoot, "style-cms.scss"),
    output: "css/style-cms.css",
    sourceMap: false,
  },
  {
    entryPath: join(sourceRoot, "style-cms-swiper.scss"),
    output: "css/style-cms-swiper.css",
    sourceMap: false,
  },
];
const sassDeprecationsToSilence = [
  "import",
  "global-builtin",
  "color-functions",
  "if-function",
];

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

async function buildTarget({ entryPath, output, appendCss = "", sourceMap = true }, reason = "manual") {
  const outputMap = `${output}.map`;
  const shouldWriteSourceMap = !productionMode && sourceMap;

  const result = compile(entryPath, {
    loadPaths: ["node_modules"],
    quietDeps: true,
    silenceDeprecations: sassDeprecationsToSilence,
    style: productionMode ? "compressed" : "expanded",
    sourceMap: shouldWriteSourceMap,
    sourceMapIncludeSources: shouldWriteSourceMap,
  });

  mkdirSync(dirname(output), { recursive: true });
  let css = `${result.css}${appendCss ? `\n${appendCss}` : ""}`;

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
  } else if (shouldWriteSourceMap) {
    css = `${css}\n/*# sourceMappingURL=${basename(outputMap)} */\n`;
    writeFileSync(outputMap, JSON.stringify(result.sourceMap, null, 2));
  } else {
    rmSync(outputMap, { force: true });
  }

  writeFileSync(output, css);
  console.log(`[style] Built ${output}${productionMode ? " [production]" : ""}${watchMode ? ` (${reason})` : ""}`);
  reportOutputSizes(css);
}

async function build(reason = "manual") {
  if (buildRunning) {
    buildQueued = true;
    queuedReason = reason;
    return;
  }

  buildRunning = true;

  try {
    for (const target of buildTargets) {
      await buildTarget(target, reason);
    }
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
