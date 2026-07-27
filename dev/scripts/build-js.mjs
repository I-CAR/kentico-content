import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";

const buildTargets = [
  {
    entry: "dev/assets/js/src/index.js",
    output: "dev/assets/js/script.js",
    sourceMap: true,
  },
  {
    entry: "dev/assets/js/src/index-cms.js",
    output: "dev/assets/js/script-cms.js",
    sourceMap: false,
  },
  {
    entry: "dev/assets/js/src/index-cms-bootstrap.js",
    output: "dev/assets/js/script-cms-bootstrap.js",
    sourceMap: false,
  },
  {
    entry: "dev/assets/js/src/index-cms-swiper.js",
    output: "dev/assets/js/script-cms-swiper.js",
    sourceMap: false,
  },
];
const legacyOutputFiles = ["dev/assets/js/script-v1.js", "dev/assets/js/script-v2.js", "dev/assets/js/script-v2.js.map"];
const watchMode = process.argv.includes("--watch");
const productionMode = process.argv.includes("--production");

function getEsbuildOptions(entry, output, sourceMap = true) {
  return {
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    format: "iife",
    legalComments: "none",
    minifyWhitespace: productionMode,
    minifyIdentifiers: productionMode,
    minifySyntax: productionMode,
    sourcemap: !productionMode && sourceMap ? "external" : false,
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
  logTargetBuildSuccess("dev/assets/js/script.js", reason);
}

function logTargetBuildSuccess(output, reason = "manual") {
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

async function buildTarget({ entry, output, sourceMap = true }) {
  const outputMap = `${output}.map`;

  mkdirSync(dirname(output), { recursive: true });
  rmSync(outputMap, { force: true });

  const result = await esbuild.build({
    ...getEsbuildOptions(entry, output, sourceMap),
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

  if (productionMode) {
    rmSync(outputMap, { force: true });
  } else if (sourceMap && outputSourceMap) {
    writeFileSync(outputMap, outputSourceMap.contents);
  }

  logTargetBuildSuccess(output);
  reportOutputSizes(bundledSource);
}

async function build(reason = "manual") {
  try {
    legacyOutputFiles.forEach((file) => {
      rmSync(file, { force: true });
    });

    for (const target of buildTargets) {
      await buildTarget(target, reason);
    }
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
  const contexts = [];

  for (const target of buildTargets) {
    const context = await esbuild.context({
      ...getEsbuildOptions(target.entry, target.output, target.sourceMap),
      plugins: [
        {
          name: `script-build-logger:${target.output}`,
          setup(buildContext) {
            buildContext.onEnd(async (result) => {
              if (result.errors.length > 0) {
                logBuildFailure(result.errors[0], "watch change");
                return;
              }

              if (!existsSync(target.output)) {
                return;
              }

              const source = readFileSync(target.output, "utf8");
              const normalizedSource = stripSourceMapComment(source);
              if (normalizedSource !== source) {
                writeFileSync(target.output, `${normalizedSource}\n`);
              }
              logTargetBuildSuccess(
                target.output,
                isInitialWatchBuild ? "initial watch build" : "watch change",
              );
              reportOutputSizes(normalizedSource);
              isInitialWatchBuild = false;
            });
          },
        },
      ],
    });

    contexts.push(context);
  }

  console.log("[script] Watching dev/assets/js/src/**/*.js");
  for (const context of contexts) {
    await context.watch();
  }
}
