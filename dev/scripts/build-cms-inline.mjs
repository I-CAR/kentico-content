import { buildCmsAssets, createHtmlSnapshot } from "./cms-inline-utils.mjs";
import { spawn } from "node:child_process";

const watchMode = process.argv.includes("--watch");
const productionMode = process.argv.includes("--production");

let buildQueued = false;
let buildRunning = false;
let queuedReason = null;
let watchDebounce = null;
let previousSnapshot = "";

function runFreshBuildProcess() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.argv[1]], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Fresh CMS build failed${signal ? ` (${signal})` : code != null ? ` (code ${code})` : ""}`));
    });
  });
}

async function build(reason = "manual") {
  if (buildRunning) {
    buildQueued = true;
    queuedReason = reason;
    return;
  }

  buildRunning = true;

  try {
    if (watchMode) {
      await runFreshBuildProcess();
    } else {
      await buildCmsAssets({ minify: productionMode, minifyHtml: true });
    }

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
  console.log("[cms] Watching content/pages/**/*, dev/scripts/**/*.mjs, package.json, css outputs, and js outputs");
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
