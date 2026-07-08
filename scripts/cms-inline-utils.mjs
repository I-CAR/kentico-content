import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const outputDir = "cms";
const htmlSourceDir = "html";
const sharedOutputDir = join(outputDir, "_shared");
const sharedCssOutputDir = join(sharedOutputDir, "css");
const sharedJsOutputDir = join(sharedOutputDir, "js");
const legacyOutputDirs = ["pages", "content", "css", "js", "includes"].map((directory) =>
  join(outputDir, directory),
);
const htmlVoidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const defaultAttributePriority = [
  "id",
  "class",
  "href",
  "title",
  "src",
  "alt",
  "loading",
  "width",
  "height",
  "target",
  "rel",
  "type",
  "name",
  "value",
  "role",
];
const tagAttributePriority = {
  a: ["href", "title", "target", "rel", "class", "id"],
  button: ["class", "type", "aria-controls", "aria-expanded", "aria-label", "id"],
  div: ["id", "role", "class"],
  img: ["alt", "loading", "width", "height", "class", "src", "sizes", "srcset", "id"],
  input: ["type", "name", "value", "id", "class", "placeholder", "checked", "required"],
  link: ["href", "rel", "media", "type", "crossorigin", "as"],
  nav: ["id", "class", "aria-label", "role"],
  option: ["value", "selected"],
  script: ["src", "type", "async", "defer"],
  source: ["height", "media", "sizes", "srcset", "width", "type", "src"],
};

function normalizeAssetPath(htmlFile, assetPath) {
  return join(dirname(htmlFile), assetPath).replace(/\\/g, "/");
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/# sourceMappingURL=.*$/gm, "")
    .trim();
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(sharedCssOutputDir, { recursive: true });
  mkdirSync(sharedJsOutputDir, { recursive: true });
}

function collectFiles(root, extension) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") {
      continue;
    }

    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, extension));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function toCmsPageDirectory(sourceFile) {
  const relativePath = relative(htmlSourceDir, sourceFile).replace(/\\/g, "/");
  return join(outputDir, relativePath.replace(/\.html$/i, ""));
}

function toCmsOutputPath(sourceFile, extension) {
  return join(toCmsPageDirectory(sourceFile), `index.${extension}`);
}

function toCmsHtmlOutputPath(sourceFile) {
  return toCmsOutputPath(sourceFile, "html");
}

function toCmsCssOutputPath(sourceFile) {
  return toCmsOutputPath(sourceFile, "css");
}

function toCmsJsOutputPath(sourceFile) {
  return toCmsOutputPath(sourceFile, "js");
}

function toSharedCssOutputPath(assetPath) {
  return join(sharedCssOutputDir, assetPath.replace(/\\/g, "/"));
}

function toSharedJsOutputPath(assetPath) {
  return join(sharedJsOutputDir, assetPath.replace(/\\/g, "/"));
}

function removeEmptyDirectories(root) {
  if (!existsSync(root)) {
    return;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = join(root, entry.name);
    removeEmptyDirectories(fullPath);

    if (readdirSync(fullPath).length === 0) {
      rmSync(fullPath, { recursive: true, force: true });
    }
  }
}

function cleanupRemovedCmsPages(sourceFiles) {
  if (!existsSync(outputDir)) {
    return;
  }

  const expectedOutputs = new Set(sourceFiles.map((sourceFile) => toCmsHtmlOutputPath(sourceFile)));
  const expectedCssOutputs = new Set(sourceFiles.map((sourceFile) => toCmsCssOutputPath(sourceFile)));
  const expectedJsOutputs = new Set(sourceFiles.map((sourceFile) => toCmsJsOutputPath(sourceFile)));
  const existingOutputs = collectFiles(outputDir, ".html");
  const existingJsonOutputs = collectFiles(outputDir, ".json");
  const existingCssOutputs = collectFiles(outputDir, ".css");
  const existingJsOutputs = collectFiles(outputDir, ".js");

  for (const filePath of existingOutputs) {
    if (!expectedOutputs.has(filePath)) {
      rmSync(filePath, { force: true });
    }
  }

  for (const filePath of existingCssOutputs) {
    if (filePath.startsWith(`${sharedCssOutputDir}/`) || filePath === sharedCssOutputDir) {
      continue;
    }

    if (!expectedCssOutputs.has(filePath)) {
      rmSync(filePath, { force: true });
    }
  }

  for (const filePath of existingJsonOutputs) {
    rmSync(filePath, { force: true });
  }

  for (const filePath of existingJsOutputs) {
    if (filePath.startsWith(`${sharedJsOutputDir}/`) || filePath === sharedJsOutputDir) {
      continue;
    }

    if (!expectedJsOutputs.has(filePath)) {
      rmSync(filePath, { force: true });
    }
  }

  legacyOutputDirs.forEach((directory) => {
    rmSync(directory, { force: true, recursive: true });
  });
  removeEmptyDirectories(outputDir);
}

function escapeAttribute(value) {
  return value.replaceAll('"', "&quot;");
}

function normalizeTextValue(value) {
  const collapsed = value.replace(/\s+/g, " ");

  if (collapsed.trim() === "") {
    return "";
  }

  let normalized = collapsed.trim();

  if (/^\s/.test(collapsed)) {
    normalized = ` ${normalized}`;
  }

  if (/\s$/.test(collapsed)) {
    normalized = `${normalized} `;
  }

  return normalized;
}

function getTagBoundary(source, startIndex) {
  let quote = null;

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === ">") {
      return index;
    }
  }

  return -1;
}

function getClosingTagEnd(source, tagName, startIndex) {
  const lowerSource = source.toLowerCase();
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}`;
  let depth = 0;
  let index = startIndex;

  while (index < source.length) {
    const nextOpen = lowerSource.indexOf(openNeedle, index);
    const nextClose = lowerSource.indexOf(closeNeedle, index);

    if (nextClose === -1) {
      return -1;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const openEnd = getTagBoundary(source, nextOpen);

      if (openEnd === -1) {
        return -1;
      }

      const openTag = source.slice(nextOpen, openEnd + 1);
      const selfClosing = /\/\s*>$/.test(openTag) || htmlVoidElements.has(tagName);

      if (!selfClosing) {
        depth += 1;
      }

      index = openEnd + 1;
      continue;
    }

    const closeEnd = getTagBoundary(source, nextClose);

    if (closeEnd === -1) {
      return -1;
    }

    depth -= 1;
    index = closeEnd + 1;

    if (depth === 0) {
      return closeEnd + 1;
    }
  }

  return -1;
}

function extractSection(source, tagName) {
  const pattern = new RegExp(`<${tagName}\\b`, "i");
  const match = pattern.exec(source);

  if (!match) {
    return "";
  }

  const startIndex = match.index;
  const endIndex = getClosingTagEnd(source, tagName.toLowerCase(), startIndex);

  if (endIndex === -1) {
    throw new Error(`Missing closing </${tagName}> tag`);
  }

  return source.slice(startIndex, endIndex);
}

function extractLinkTags(source) {
  return Array.from(source.matchAll(/<link\b[\s\S]*?>/gi), (match) => match[0]);
}

function extractLocalAssetPaths(sourceFile, source, { tagName, extension }) {
  const pattern =
    tagName === "link"
      ? /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi
      : /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  const assets = [];
  const seen = new Set();

  for (const match of source.matchAll(pattern)) {
    const assetPath = match[1];

    if (!assetPath.endsWith(extension) || /^[a-z]+:/i.test(assetPath) || assetPath.startsWith("//")) {
      continue;
    }

    const normalizedPath = normalizeAssetPath(sourceFile, assetPath);

    if (seen.has(normalizedPath) || !existsSync(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    assets.push(normalizedPath);
  }

  return assets;
}

function extractHeadFontLinks(source) {
  const headMatch = source.match(/<head\b[\s\S]*?<\/head>/i);

  if (!headMatch) {
    return [];
  }

  return extractLinkTags(headMatch[0]).filter((link) =>
    /href=["']https:\/\/fonts\.googleapis\.com\//i.test(link),
  );
}

function extractCmsFragment(source) {
  const bodyMatch = source.match(/<body\b[\s\S]*?<\/body>/i);

  if (!bodyMatch) {
    throw new Error("Missing <body> in HTML source");
  }

  const body = bodyMatch[0];
  const links = extractHeadFontLinks(source);
  const main = extractSection(body, "main");

  return [...links, main].join("\n\n").trim();
}

function extractCmsCss(sourceFile, source) {
  const cssPaths = extractLocalAssetPaths(sourceFile, source, { tagName: "link", extension: ".css" });
  return cssPaths;
}

function extractCmsJs(sourceFile, source) {
  const jsPaths = extractLocalAssetPaths(sourceFile, source, { tagName: "script", extension: ".js" });
  return jsPaths;
}

function sortAttributes(tagName, attributes) {
  const priorities = new Map();
  const orderedAttributes = [...(tagAttributePriority[tagName] ?? []), ...defaultAttributePriority];

  orderedAttributes.forEach((attributeName, index) => {
    if (!priorities.has(attributeName)) {
      priorities.set(attributeName, index);
    }
  });

  const attributeRank = (attributeName) => {
    if (priorities.has(attributeName)) {
      return priorities.get(attributeName);
    }

    if (attributeName.startsWith("aria-")) {
      return 100;
    }

    if (attributeName.startsWith("data-")) {
      return 200;
    }

    return 300;
  };

  return [...attributes].sort((left, right) => {
    const leftRank = attributeRank(left.name);
    const rightRank = attributeRank(right.name);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.name.localeCompare(right.name);
  });
}

function parseAttributes(source) {
  const attributes = [];
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match = pattern.exec(source);

  while (match) {
    attributes.push({
      name: match[1],
      value: match[2] ?? match[3] ?? match[4] ?? null,
    });
    match = pattern.exec(source);
  }

  return attributes;
}

function normalizeAttributeValue(value) {
  return value.replace(/\s+/g, " ").trim();
}

function rebuildTag(tagSource) {
  if (!tagSource.startsWith("<") || tagSource.startsWith("</") || tagSource.startsWith("<!")) {
    return tagSource;
  }

  const selfClosing = /\/\s*>$/.test(tagSource);
  const inner = tagSource.slice(1, tagSource.length - 1).replace(/\/\s*$/, "").trim();
  const tagNameMatch = inner.match(/^([^\s/>]+)/);

  if (!tagNameMatch) {
    return tagSource;
  }

  const tagName = tagNameMatch[1];
  const attributeSource = inner.slice(tagName.length).trim();
  const attributes = parseAttributes(attributeSource);
  const sortedAttributes = sortAttributes(tagName.toLowerCase(), attributes)
    .map((attribute) => {
      if (attribute.value === null) {
        return attribute.name;
      }

      return `${attribute.name}="${escapeAttribute(normalizeAttributeValue(attribute.value))}"`;
    })
    .join(" ");

  const attributeSuffix = sortedAttributes ? ` ${sortedAttributes}` : "";
  return `<${tagName}${attributeSuffix}${selfClosing ? " />" : ">"}`;
}

function transformFragment(fragment, transformText) {
  let output = "";

  for (let index = 0; index < fragment.length; ) {
    if (fragment.startsWith("<!--", index)) {
      const commentEnd = fragment.indexOf("-->", index + 4);
      index = commentEnd === -1 ? fragment.length : commentEnd + 3;
      continue;
    }

    if (fragment[index] === "<") {
      const tagEnd = getTagBoundary(fragment, index);

      if (tagEnd === -1) {
        output += fragment.slice(index);
        break;
      }

      output += rebuildTag(fragment.slice(index, tagEnd + 1));
      index = tagEnd + 1;
      continue;
    }

    const nextTag = fragment.indexOf("<", index);
    const text = fragment.slice(index, nextTag === -1 ? fragment.length : nextTag);
    output += transformText(text);
    index = nextTag === -1 ? fragment.length : nextTag;
  }

  return output.trim();
}

function preserveText(text) {
  return text;
}

function minifyText(text) {
  return normalizeTextValue(text);
}

function removeCommentsAndSortAttributes(fragment) {
  return transformFragment(fragment, preserveText);
}

function minifyFragment(fragment) {
  return transformFragment(fragment, minifyText);
}

export function buildCmsPageStyles() {
  if (!existsSync(htmlSourceDir)) {
    return false;
  }

  ensureOutputDir();
  const htmlFiles = collectFiles(htmlSourceDir, ".html");
  const pageCssAssets = new Map();
  const assetUsageCounts = new Map();

  rmSync(sharedCssOutputDir, { recursive: true, force: true });
  mkdirSync(sharedCssOutputDir, { recursive: true });

  for (const sourceFile of htmlFiles) {
    const source = readFileSync(sourceFile, "utf8");
    const cssAssets = extractCmsCss(sourceFile, source);
    pageCssAssets.set(sourceFile, cssAssets);

    for (const assetPath of cssAssets) {
      assetUsageCounts.set(assetPath, (assetUsageCounts.get(assetPath) ?? 0) + 1);
    }
  }

  for (const [assetPath, count] of assetUsageCounts.entries()) {
    if (count < 2) {
      continue;
    }

    const sharedOutputFile = toSharedCssOutputPath(relative(".", assetPath));
    const css = stripCssComments(readFileSync(assetPath, "utf8"));
    mkdirSync(dirname(sharedOutputFile), { recursive: true });
    writeFileSync(sharedOutputFile, css ? `${css}\n` : "");
    console.log(`[cms] Built ${sharedOutputFile}`);
  }

  for (const sourceFile of htmlFiles) {
    const outputFile = toCmsCssOutputPath(sourceFile);
    const cssAssets = pageCssAssets.get(sourceFile) ?? [];
    const pageCssParts = [];

    for (const assetPath of cssAssets) {
      const usageCount = assetUsageCounts.get(assetPath) ?? 0;

      if (usageCount >= 2) {
        const sharedOutputFile = toSharedCssOutputPath(relative(".", assetPath));
        const relativeImportPath = relative(dirname(outputFile), sharedOutputFile).replace(/\\/g, "/");
        pageCssParts.push(`@import "${relativeImportPath}";`);
        continue;
      }

      const css = stripCssComments(readFileSync(assetPath, "utf8"));
      if (css) {
        pageCssParts.push(css);
      }
    }

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, pageCssParts.length > 0 ? `${pageCssParts.join("\n")}\n` : "");
    console.log(`[cms] Built ${outputFile}`);
  }

  return htmlFiles.length > 0;
}

export function buildCmsPageScripts() {
  if (!existsSync(htmlSourceDir)) {
    return false;
  }

  ensureOutputDir();
  const htmlFiles = collectFiles(htmlSourceDir, ".html");
  const pageJsAssets = new Map();
  const assetUsageCounts = new Map();

  rmSync(sharedJsOutputDir, { recursive: true, force: true });
  mkdirSync(sharedJsOutputDir, { recursive: true });

  for (const sourceFile of htmlFiles) {
    const source = readFileSync(sourceFile, "utf8");
    const jsAssets = extractCmsJs(sourceFile, source);
    pageJsAssets.set(sourceFile, jsAssets);

    for (const assetPath of jsAssets) {
      assetUsageCounts.set(assetPath, (assetUsageCounts.get(assetPath) ?? 0) + 1);
    }
  }

  for (const [assetPath, count] of assetUsageCounts.entries()) {
    if (count < 2) {
      continue;
    }

    const sharedOutputFile = toSharedJsOutputPath(relative(".", assetPath));
    const js = stripJsComments(readFileSync(assetPath, "utf8"));
    mkdirSync(dirname(sharedOutputFile), { recursive: true });
    writeFileSync(sharedOutputFile, js ? `${js}\n` : "");
    console.log(`[cms] Built ${sharedOutputFile}`);
  }

  for (const sourceFile of htmlFiles) {
    const outputFile = toCmsJsOutputPath(sourceFile);
    const jsAssets = pageJsAssets.get(sourceFile) ?? [];
    const sharedScriptPaths = [];
    const uniqueScriptBlocks = [];

    for (const assetPath of jsAssets) {
      const usageCount = assetUsageCounts.get(assetPath) ?? 0;

      if (usageCount >= 2) {
        const sharedOutputFile = toSharedJsOutputPath(relative(".", assetPath));
        const relativeScriptPath = relative(dirname(outputFile), sharedOutputFile).replace(/\\/g, "/");
        sharedScriptPaths.push(relativeScriptPath);
        continue;
      }

      const js = stripJsComments(readFileSync(assetPath, "utf8"));
      if (js) {
        uniqueScriptBlocks.push(js);
      }
    }

    let js = "";

    if (sharedScriptPaths.length > 0) {
      const sharedPathsLiteral = JSON.stringify(sharedScriptPaths);
      const inlineCode =
        uniqueScriptBlocks.length > 0
          ? `\n${uniqueScriptBlocks.join("\n")}\n`
          : "";

      js = [
        "(function(){",
        `  const scriptPaths = ${sharedPathsLiteral};`,
        "  const currentScript = document.currentScript;",
        "  const baseUrl = currentScript?.src ? new URL('.', currentScript.src) : new URL('.', window.location.href);",
        "  const runInline = function(){",
        inlineCode ? inlineCode.trimEnd() : "",
        "  };",
        "  const loadScript = function(index){",
        "    if (index >= scriptPaths.length) {",
        "      runInline();",
        "      return;",
        "    }",
        "    const script = document.createElement('script');",
        "    script.src = new URL(scriptPaths[index], baseUrl).href;",
        "    script.async = false;",
        "    script.onload = function(){ loadScript(index + 1); };",
        "    document.head.appendChild(script);",
        "  };",
        "  loadScript(0);",
        "})();",
      ]
        .filter(Boolean)
        .join("\n");
    } else if (uniqueScriptBlocks.length > 0) {
      js = uniqueScriptBlocks.join("\n");
    }

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, js ? `${js}\n` : "");
    console.log(`[cms] Built ${outputFile}`);
  }

  return htmlFiles.length > 0;
}

export async function buildCmsPages({ minify = false } = {}) {
  if (!existsSync(htmlSourceDir)) {
    return false;
  }

  ensureOutputDir();
  const htmlFiles = collectFiles(htmlSourceDir, ".html");
  cleanupRemovedCmsPages(htmlFiles);

  for (const sourceFile of htmlFiles) {
    const source = readFileSync(sourceFile, "utf8");
    const fragment = extractCmsFragment(source);
    const output = minify ? minifyFragment(fragment) : removeCommentsAndSortAttributes(fragment);
    const outputFile = toCmsHtmlOutputPath(sourceFile);

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, `${output}\n`);
    console.log(`[cms] Built ${outputFile}${minify ? " [minified]" : ""}`);
  }

  return htmlFiles.length > 0;
}

export async function buildCmsAssets({ minify = false } = {}) {
  const builtStyle = buildCmsPageStyles();
  const builtScript = buildCmsPageScripts();
  const builtPages = await buildCmsPages({ minify });
  return builtStyle || builtScript || builtPages;
}

export function createHtmlSnapshot() {
  if (!existsSync(htmlSourceDir)) {
    return "";
  }

  return collectFiles(htmlSourceDir, ".html")
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");
}
