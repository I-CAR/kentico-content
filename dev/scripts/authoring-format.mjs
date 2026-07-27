import { readFileSync } from "node:fs";
import { extname } from "node:path";
import yaml from "js-yaml";

export const authoringFileExtensions = [".yaml", ".yml", ".json"];

function normalizeExtension(extension) {
  return typeof extension === "string" ? extension.trim().toLowerCase() : "";
}

export function getAuthoringFileExtension(filePath) {
  return normalizeExtension(extname(filePath));
}

export function isAuthoringFile(filePath) {
  return authoringFileExtensions.includes(getAuthoringFileExtension(filePath));
}

export function stripAuthoringFileExtension(filePath) {
  return filePath.replace(/\.(json|ya?ml)$/i, "");
}

export function authoringSourcesMatch(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    return false;
  }

  return stripAuthoringFileExtension(left) === stripAuthoringFileExtension(right);
}

export function assertUniqueAuthoringBasenames(files, label = "authoring files") {
  const byBaseName = new Map();

  for (const file of files) {
    const baseName = stripAuthoringFileExtension(file);
    const existing = byBaseName.get(baseName);

    if (existing) {
      throw new Error(`Duplicate ${label} detected for "${baseName}": ${existing} and ${file}`);
    }

    byBaseName.set(baseName, file);
  }

  return files;
}

export function parseStructuredAuthoringFile(sourceFile) {
  const extension = getAuthoringFileExtension(sourceFile);
  const contents = readFileSync(sourceFile, "utf8");

  if (extension === ".yaml" || extension === ".yml") {
    return yaml.load(contents);
  }

  return JSON.parse(contents);
}

export function serializeStructuredAuthoringFile(sourceFile, value) {
  const extension = getAuthoringFileExtension(sourceFile);

  if (extension === ".yaml" || extension === ".yml") {
    return yaml.dump(value, {
      lineWidth: 120,
      noRefs: true,
      quotingType: "\"",
      forceQuotes: false,
    });
  }

  return JSON.stringify(value, null, 2);
}
