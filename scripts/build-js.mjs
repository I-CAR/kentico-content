import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";
import { buildInlineScript } from "./cms-inline-utils.mjs";

const entry = "js/src/index.js";
const output = "js/script-v2.js";
const outputMap = `${output}.map`;
const legacyOutputFiles = ["js/script.js", "js/script.js.map"];
const watchMode = process.argv.includes("--watch");
const productionMode = process.argv.includes("--production");

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reportOutputSizes(js) {
  const rawBytes = Buffer.byteLength(js);
  const gzipBytes = gzipSync(js).byteLength;
  console.log(`[script] Size raw: ${formatBytes(rawBytes)} | gzip: ${formatBytes(gzipBytes)}`);
}

function logBuildSuccess(reason = "manual") {
  const details = [
    `[script] Built ${output}`,
    productionMode ? "[production]" : "[development]",
  ];

  if (watchMode) {
    details.push(`(${reason})`);
  }

  console.log(details.join(" "));
}

function logBuildFailure(error, reason = "manual") {
  console.error(`[script] Build failed${watchMode ? ` (${reason})` : ""}`);

  if (error instanceof Error) {
    console.error(error.message);
    return;
  }

  console.error(error);
}

async function build(reason = "manual") {
  try {
    mkdirSync(dirname(output), { recursive: true });
    legacyOutputFiles.forEach((file) => {
      rmSync(file, { force: true });
    });

    const result = await esbuild.build({
      entryPoints: [entry],
      outfile: output,
      bundle: true,
      format: "iife",
      minify: productionMode,
      sourcemap: productionMode ? false : "linked",
      metafile: true,
      write: false,
      logLevel: "silent",
    });

    const outputFile = result.outputFiles.find((file) => file.path.endsWith(output));
    const outputSourceMap = result.outputFiles.find((file) => file.path.endsWith(outputMap));

    if (!outputFile) {
      throw new Error(`Missing bundled output for ${output}`);
    }

    writeFileSync(output, outputFile.contents);
    buildInlineScript();

    if (productionMode) {
      rmSync(outputMap, { force: true });
    } else if (outputSourceMap) {
      writeFileSync(outputMap, outputSourceMap.contents);
    }

    logBuildSuccess(reason);
    reportOutputSizes(outputFile.text);
  } catch (error) {
    logBuildFailure(error, reason);

    if (!watchMode) {
      process.exitCode = 1;
    }
  }
}

if (!watchMode) {
  await build();
}

if (watchMode) {
  let isInitialWatchBuild = true;
  const context = await esbuild.context({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    format: "iife",
    minify: productionMode,
    sourcemap: productionMode ? false : "linked",
    logLevel: "silent",
    plugins: [
      {
        name: "script-build-logger",
        setup(buildContext) {
          buildContext.onEnd(async (result) => {
            if (result.errors.length > 0) {
              logBuildFailure(result.errors[0], "watch change");
              return;
            }

            if (!existsSync(output)) {
              return;
            }

            const source = readFileSync(output, "utf8");
            buildInlineScript();
            logBuildSuccess(isInitialWatchBuild ? "initial watch build" : "watch change");
            reportOutputSizes(source);
            isInitialWatchBuild = false;
          });
        },
      },
    ],
  });

  console.log(`[script] Watching ${entry}`);
  await context.watch();
}
