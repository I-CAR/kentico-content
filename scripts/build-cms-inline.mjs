import { buildCmsAssets, createHtmlSnapshot } from "./cms-inline-utils.mjs";

const watchMode = process.argv.includes("--watch");
const productionMode = process.argv.includes("--production");

let buildQueued = false;
let buildRunning = false;
let queuedReason = null;
let watchDebounce = null;
let previousSnapshot = "";

async function build(reason = "manual") {
  if (buildRunning) {
    buildQueued = true;
    queuedReason = reason;
    return;
  }

  buildRunning = true;

  try {
    await buildCmsAssets({ minify: productionMode });

    if (watchMode) {
      console.log(`[cms] Build complete (${reason})`);
    }
  } catch (error) {
    console.error(`[cms] Build failed${watchMode ? ` (${reason})` : ""}`);
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
  watchDebounce = setTimeout(() => {
    void build(reason);
  }, 75);
}

await build();

if (watchMode) {
  console.log("[cms] Watching html/**/*.html");
  previousSnapshot = createHtmlSnapshot();

  setInterval(() => {
    const nextSnapshot = createHtmlSnapshot();

    if (nextSnapshot === previousSnapshot) {
      return;
    }

    previousSnapshot = nextSnapshot;
    scheduleBuild("polling change");
  }, 250);
}
