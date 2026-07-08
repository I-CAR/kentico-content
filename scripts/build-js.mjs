import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";
import { buildCmsPageScripts } from "./cms-inline-utils.mjs";

const entry = "js/src/index.js";
const output = "js/script.js";
const outputMap = `${output}.map`;
const legacyOutputFiles = ["js/script-v1.js", "js/script-v2.js", "js/script-v2.js.map", "js/script.js.map"];
const watchMode = process.argv.includes("--watch");
const productionMode = process.argv.includes("--production");

function getEsbuildOptions() {
  return {
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    format: "iife",
    legalComments: "none",
    minifyWhitespace: true,
    minifyIdentifiers: productionMode,
    minifySyntax: productionMode,
    sourcemap: productionMode ? false : "external",
    logLevel: "silent",
  };
}

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

function stripSourceMapComment(source) {
  return source.replace(/\n?\/\/# sourceMappingURL=.*$/m, "");
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
      ...getEsbuildOptions(),
      metafile: true,
      write: false,
    });

    const outputFile = result.outputFiles.find((file) => file.path.endsWith(output));
    const outputSourceMap = result.outputFiles.find((file) => file.path.endsWith(outputMap));

    if (!outputFile) {
      throw new Error(`Missing bundled output for ${output}`);
    }

    const bundledSource = stripSourceMapComment(outputFile.text);
    writeFileSync(output, `${bundledSource}\n`);
    buildCmsPageScripts();

    if (productionMode) {
      rmSync(outputMap, { force: true });
    } else if (outputSourceMap) {
      writeFileSync(outputMap, outputSourceMap.contents);
    }

    logBuildSuccess(reason);
    reportOutputSizes(bundledSource);
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
    ...getEsbuildOptions(),
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
            const normalizedSource = stripSourceMapComment(source);
            if (normalizedSource !== source) {
              writeFileSync(output, `${normalizedSource}\n`);
            }
            buildCmsPageScripts();
            logBuildSuccess(isInitialWatchBuild ? "initial watch build" : "watch change");
            reportOutputSizes(normalizedSource);
            isInitialWatchBuild = false;
          });
        },
      },
    ],
  });

  console.log(`[script] Watching ${entry}`);
  await context.watch();
}
