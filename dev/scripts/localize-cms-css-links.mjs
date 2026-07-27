import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const writeMode = process.argv.includes("--write");
const splitMode = process.argv.includes("--split");
const rootDir = "previews";
const vendoredCssPath = "dev/assets/css/vendor/cms-main-202106042.css";
const bootstrapVendoredCssPath = "dev/assets/css/vendor/bootstrap-4.6.0.css";
const customVendoredCssPath = "dev/assets/css/vendor/cms-main-custom-202106042.css";
const remotePatterns = [
  /([ \t]*)<link rel="stylesheet" href="https:\/\/info\.i-car\.com\/dist\/styles\/main\.css\?v=202106042"\s*\/?>/g,
  /([ \t]*)<link rel="stylesheet" href="\/dist\/styles\/main\.css\?v=202106042"\s*\/?>/g,
];

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function collectHtmlFiles(root) {
  const files = [];

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
      continue;
    }

    if (stats.isFile() && fullPath.endsWith(".html")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function buildRelativeHref(filePath) {
  const fromDir = filePath.slice(0, filePath.lastIndexOf("/"));
  return relative(fromDir, vendoredCssPath).replace(/\\/g, "/");
}

function buildRelativeSplitLinks(filePath) {
  const fromDir = filePath.slice(0, filePath.lastIndexOf("/"));
  const bootstrapHref = relative(fromDir, bootstrapVendoredCssPath).replace(/\\/g, "/");
  const customHref = relative(fromDir, customVendoredCssPath).replace(/\\/g, "/");
  return {
    bootstrapHref,
    customHref,
  };
}

let changedFiles = 0;

for (const filePath of collectHtmlFiles(rootDir)) {
  const source = readFileSync(filePath, "utf8");
  const localHref = buildRelativeHref(filePath);
  const { bootstrapHref, customHref } = buildRelativeSplitLinks(filePath);
  const splitPairPattern = new RegExp(
    `([ \\t]*)<link rel="stylesheet" href="${escapeForRegex(bootstrapHref)}">\\s*\\n([ \\t]*)<link rel="stylesheet" href="${escapeForRegex(customHref)}">`,
    "g",
  );
  let next = source;

  if (splitMode) {
    const splitReplacement = (indent) =>
      `${indent}<link rel="stylesheet" href="${bootstrapHref}">\n${indent}<link rel="stylesheet" href="${customHref}">`;

    for (const pattern of remotePatterns) {
      next = next.replace(pattern, (_, indent) => splitReplacement(indent));
    }
  } else {
    for (const pattern of remotePatterns) {
      next = next.replace(
        pattern,
        (_, indent) => `${indent}<link rel="stylesheet" href="${localHref}">`,
      );
    }

    next = next.replace(
      splitPairPattern,
      (_, indent) => `${indent}<link rel="stylesheet" href="${localHref}">`,
    );
  }

  // Repair malformed output from older split-link replacements.
  next = next.replace(/href="href="/g, 'href="');
  next = next.replace(/\.css""/g, '.css"');

  if (next === source) {
    continue;
  }

  changedFiles += 1;
  if (splitMode) {
    console.log(
      `${writeMode ? "updated" : "would update"} ${filePath} -> ${bootstrapHref} + ${customHref}`,
    );
  } else {
    console.log(`${writeMode ? "updated" : "would update"} ${filePath} -> ${localHref}`);
  }

  if (writeMode) {
    writeFileSync(filePath, next);
  }
}

if (changedFiles === 0) {
  console.log("No remote CMS stylesheet links found.");
}
