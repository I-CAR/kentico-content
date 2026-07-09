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
import * as esbuild from "esbuild";
import { collectRenderableContentFiles, collectRenderedPageDocuments, createContentSnapshot } from "./build-pages.mjs";
import { pageUsesBootstrap, pageUsesJquery, pageUsesSwiper } from "./page-dependencies.mjs";

const outputDir = "cms";
const contentSourceDir = join("content", "pages");
const legacyOutputDirs = ["pages", "content", "css", "js", "includes", "_shared", "generated"].map((directory) =>
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

function isBootstrapAsset(assetPath) {
  return /(^|\/)node_modules\/bootstrap\//i.test(assetPath.replace(/\\/g, "/"));
}

function isSwiperAsset(assetPath) {
  return /(^|\/)node_modules\/swiper\//i.test(assetPath.replace(/\\/g, "/"));
}

function isJqueryAsset(assetPath) {
  return /(^|\/)node_modules\/jquery\//i.test(assetPath.replace(/\\/g, "/"));
}

function isCmsMainScriptAsset(assetPath) {
  return /(^|\/)js\/script\.js$/i.test(assetPath.replace(/\\/g, "/"));
}

function isCmsVendorStylesheet(assetPath) {
  return /(^|\/)css\/vendor\/cms-main-202106042\.css$/i.test(assetPath.replace(/\\/g, "/"));
}

function isSharedSiteStylesheet(assetPath) {
  return /(^|\/)css\/style(?:-cms(?:-swiper)?)?\.css$/i.test(assetPath.replace(/\\/g, "/"));
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function stripCssSourceMapComment(source) {
  return source.replace(/\n?\/\*# sourceMappingURL=.*?\*\/\s*$/m, "").trim();
}

function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/# sourceMappingURL=.*$/gm, "")
    .trim();
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
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

function toCmsHtmlOutputPath(sourceFile) {
  return join(outputDir, sourceFile);
}

function toSourceRelativeHtmlPath(sourceFile) {
  return sourceFile.replace(/\\/g, "/");
}

function toCmsScriptHtmlOutputPath(sourceFile) {
  return toCmsHtmlOutputPath(sourceFile).replace(/\.html$/i, ".scripts.html");
}

function toCompanionScriptSourcePath(sourceFile) {
  return sourceFile.replace(/\.html$/i, ".scripts.html");
}

function toContentHtmlRelativePath(sourceFile, page) {
  const sourceRelativePath = relative(contentSourceDir, sourceFile).replace(/\\/g, "/");
  const sourceDirectory = dirname(sourceRelativePath).replace(/\\/g, "/");
  const fallbackName = sourceRelativePath.split("/").pop().replace(/\.json$/i, "");
  const outputBaseName = page.slug || fallbackName;
  return join(sourceDirectory, `${outputBaseName}.html`).replace(/\\/g, "/");
}

function loadCmsScriptSplitPaths() {
  if (!existsSync(contentSourceDir)) {
    return new Set();
  }

  const splitPaths = new Set();

  for (const sourceFile of collectRenderableContentFiles()) {
    const page = JSON.parse(readFileSync(sourceFile, "utf8"));

    if (page?.cms?.scriptOutput === "separateHtmlFile") {
      splitPaths.add(toContentHtmlRelativePath(sourceFile, page));
    }
  }

  return splitPaths;
}

function shouldSplitCmsScripts(sourceFile, splitPaths = loadCmsScriptSplitPaths()) {
  return splitPaths.has(toSourceRelativeHtmlPath(sourceFile));
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

function cleanupRemovedCmsPages(sourceFiles, splitPaths = loadCmsScriptSplitPaths()) {
  if (!existsSync(outputDir)) {
    return;
  }

  const expectedOutputs = new Set(
    sourceFiles.flatMap((sourceFile) =>
      shouldSplitCmsScripts(sourceFile, splitPaths)
        ? [toCmsHtmlOutputPath(sourceFile), toCmsScriptHtmlOutputPath(sourceFile)]
        : [toCmsHtmlOutputPath(sourceFile)],
    ),
  );
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
    rmSync(filePath, { force: true });
  }

  for (const filePath of existingJsonOutputs) {
    rmSync(filePath, { force: true });
  }

  for (const filePath of existingJsOutputs) {
    rmSync(filePath, { force: true });
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

function toOutputAssetPath(sourceFile, outputFile, assetPath) {
  if (
    !assetPath ||
    /^[a-z]+:/i.test(assetPath) ||
    assetPath.startsWith("//") ||
    assetPath.startsWith("/") ||
    assetPath.startsWith("#")
  ) {
    return assetPath;
  }

  return relative(dirname(outputFile), normalizeAssetPath(sourceFile, assetPath)).replace(/\\/g, "/");
}

function rewriteSrcsetValue(sourceFile, outputFile, srcsetValue) {
  return srcsetValue
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();

      if (!trimmed) {
        return trimmed;
      }

      const [url, ...descriptorParts] = trimmed.split(/\s+/);
      const rewrittenUrl = toOutputAssetPath(sourceFile, outputFile, url);
      return [rewrittenUrl, ...descriptorParts].filter(Boolean).join(" ");
    })
    .join(", ");
}

function rewriteLocalAssetPaths(sourceFile, outputFile, source) {
  return source
    .replace(/\b(href|src)=["']([^"']+)["']/gi, (match, attributeName, assetPath) => {
      const rewrittenPath = toOutputAssetPath(sourceFile, outputFile, assetPath);
      return `${attributeName}="${escapeAttribute(rewrittenPath)}"`;
    })
    .replace(/\bsrcset=["']([^"']+)["']/gi, (match, srcsetValue) => {
      const rewrittenValue = rewriteSrcsetValue(sourceFile, outputFile, srcsetValue);
      return `srcset="${escapeAttribute(rewrittenValue)}"`;
    });
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

function extractHeadExternalLinks(source) {
  const headMatch = source.match(/<head\b[\s\S]*?<\/head>/i);

  if (!headMatch) {
    return [];
  }

  return extractLinkTags(headMatch[0]).filter((link) => /href=["'](?:[a-z]+:)?\/\//i.test(link));
}

function extractCmsMain(source) {
  const bodyMatch = source.match(/<body\b[\s\S]*?<\/body>/i);

  if (!bodyMatch) {
    throw new Error("Missing <body> in HTML source");
  }

  const body = bodyMatch[0];
  const main = extractSection(body, "main");
  return main;
}

function extractInlineScriptSource(source) {
  return Array.from(
    source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
    (match) => {
      const attributeSource = match[1] ?? "";

      if (/\bsrc=["']/i.test(attributeSource)) {
        return "";
      }

      return stripJsComments(match[2] ?? "");
    },
  )
    .filter(Boolean)
    .join("\n");
}

function detectPageDependencies(source) {
  const dependencySource = [extractCmsMain(source), extractInlineScriptSource(source)].filter(Boolean).join("\n");

  return {
    bootstrap: pageUsesBootstrap(dependencySource),
    jquery: pageUsesJquery(dependencySource),
    swiper: pageUsesSwiper(dependencySource),
  };
}

function pageUsesBootstrapJs(source) {
  return /\bdata-bs-(?:toggle|target|parent|ride|slide|dismiss)\s*=/i.test(source);
}

function pageUsesCmsBaseJs(source) {
  return (
    /\bjs-ic-dropdown-container\b/.test(source) ||
    /\bjs-ic-btn-dropdown\b/.test(source) ||
    /\bjs-ic-dropdown\b/.test(source) ||
    /\bg-recaptcha\b/.test(source) ||
    /\bcaptcha_settings\b/.test(source) ||
    /\bg-recaptcha-response\b/.test(source) ||
    /\bjs-ic-swatch\b/.test(source)
  );
}

function detectPageScriptDependencies(source) {
  const dependencySource = [extractCmsMain(source), extractInlineScriptSource(source)].filter(Boolean).join("\n");

  return {
    base: pageUsesCmsBaseJs(dependencySource),
    bootstrap: pageUsesBootstrapJs(dependencySource),
    jquery: pageUsesJquery(dependencySource),
    swiper: pageUsesSwiper(dependencySource),
  };
}

function getCmsBundleScriptPaths(source) {
  const dependencies = detectPageScriptDependencies(source);
  const assetPaths = [];

  if (dependencies.jquery) {
    assetPaths.push(join("node_modules", "jquery", "dist", "jquery.min.js"));
  }

  if (dependencies.base) {
    assetPaths.push(join("js", "script-cms.js"));
  }

  if (dependencies.bootstrap) {
    assetPaths.push(join("js", "script-cms-bootstrap.js"));
  }

  if (dependencies.swiper) {
    assetPaths.push(join("js", "script-cms-swiper.js"));
  }

  return [...new Set(assetPaths)];
}

function filterCmsAssetPaths(assetPaths, dependencies) {
  return assetPaths.filter((assetPath) => {
    if (isBootstrapAsset(assetPath)) {
      return dependencies.bootstrap;
    }

    if (isSwiperAsset(assetPath)) {
      return dependencies.swiper;
    }

    if (isJqueryAsset(assetPath)) {
      return dependencies.jquery;
    }

    return true;
  });
}

function extractCmsCssPaths(sourceFile, source) {
  return filterCmsAssetPaths(
    extractLocalAssetPaths(sourceFile, source, { tagName: "link", extension: ".css" }).filter(
      (assetPath) => !isCmsVendorStylesheet(assetPath) && !isSharedSiteStylesheet(assetPath),
    ),
    detectPageDependencies(source),
  );
}

async function renderCmsStyleTag(sourceFile, source) {
  const cssParts = extractCmsCssPaths(sourceFile, source)
    .map((assetPath) => stripCssComments(readFileSync(assetPath, "utf8")))
    .filter(Boolean);

  if (cssParts.length === 0) {
    return "";
  }

  const css = await minifyCss(cssParts.join("\n\n"));
  return css ? `<style>\n${css}\n</style>` : "";
}

function toInlineCssSourceMap(assetPath, cssSource) {
  const sourceMapMatch = cssSource.match(/\/\*# sourceMappingURL=([^*]+)\*\//);

  if (!sourceMapMatch) {
    return cssSource;
  }

  const sourceMapRef = sourceMapMatch[1]?.trim();

  if (!sourceMapRef || sourceMapRef.startsWith("data:")) {
    return cssSource;
  }

  const sourceMapPath = join(dirname(assetPath), sourceMapRef);

  if (!existsSync(sourceMapPath)) {
    return cssSource;
  }

  const sourceMap = readFileSync(sourceMapPath, "utf8").trim();
  const inlineSourceMap = Buffer.from(sourceMap).toString("base64");

  return cssSource.replace(
    /\/\*# sourceMappingURL=([^*]+)\*\//,
    `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${inlineSourceMap} */`,
  );
}

async function renderDevCmsStyleTags(sourceFile, source) {
  const styleTags = extractCmsCssPaths(sourceFile, source)
    .map((assetPath) => {
      const cssSource = readFileSync(assetPath, "utf8").trim();

      if (!cssSource) {
        return "";
      }

      const cssWithInlineMap = toInlineCssSourceMap(assetPath, cssSource);
      const cssOutput = cssWithInlineMap.includes("sourceMappingURL=")
        ? cssWithInlineMap
        : stripCssSourceMapComment(cssWithInlineMap);

      return cssOutput ? `<style>\n${cssOutput}\n</style>` : "";
    })
    .filter(Boolean);

  return styleTags.join("\n\n");
}

function renderCmsLinkTags(source) {
  return [...extractHeadExternalLinks(source), ...extractHeadFontLinks(source)]
    .filter((link, index, links) => links.indexOf(link) === index)
    .map((link) => rebuildTag(link))
    .join("\n");
}

function removeScriptTags(source) {
  return source.replace(/<script\b[\s\S]*?<\/script>\s*/gi, "");
}

function extractCmsScriptBlocks(sourceFile, source) {
  const companionSourceFile = toCompanionScriptSourcePath(sourceFile);
  const companionSource = existsSync(companionSourceFile) ? readFileSync(companionSourceFile, "utf8") : "";
  const dependencies = detectPageDependencies([source, companionSource].filter(Boolean).join("\n"));
  const blocks = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const sources = [source, companionSource].filter(Boolean);

  for (const currentSource of sources) {
    for (const match of currentSource.matchAll(pattern)) {
      const attributeSource = match[1] ?? "";
      const inlineSource = match[2] ?? "";
      const srcMatch = attributeSource.match(/\bsrc=["']([^"']+)["']/i);
      const src = srcMatch?.[1] ?? null;

      if (src) {
        if (/^[a-z]+:/i.test(src) || src.startsWith("//")) {
          blocks.push({ type: "external", tag: rebuildTag(match[0].replace(/\s*<\/script>\s*$/i, ">")) });
          continue;
        }

        const assetPath = normalizeAssetPath(sourceFile, src);
        const assetPaths = [assetPath];

        for (const currentAssetPath of assetPaths) {
          if (!existsSync(currentAssetPath)) {
            continue;
          }

          if (isCmsMainScriptAsset(currentAssetPath)) {
            continue;
          }

          if (isBootstrapAsset(currentAssetPath) && !dependencies.bootstrap) {
            continue;
          }

          if (isSwiperAsset(currentAssetPath) && !dependencies.swiper) {
            continue;
          }

          if (isJqueryAsset(currentAssetPath) && !dependencies.jquery) {
            continue;
          }

          blocks.push({
            type: "inline",
            source: stripJsComments(readFileSync(currentAssetPath, "utf8")),
          });
        }

        continue;
      }

      const inlineJs = stripJsComments(inlineSource);

      if (!inlineJs) {
        continue;
      }

      blocks.push({
        type: "inline",
        source: inlineJs,
      });
    }
  }

  return blocks;
}

export async function renderCmsHtmlParts(sourceFile, outputFile, source, { minify = false } = {}) {
  const splitScripts = shouldSplitCmsScripts(sourceFile);
  const mainSource = extractCmsMain(source);
  const rewrittenMain = rewriteLocalAssetPaths(sourceFile, outputFile, mainSource);
  const mainOutput = minify ? minifyFragment(rewrittenMain) : removeCommentsAndSortAttributes(rewrittenMain);
  const styleTag = minify
    ? await renderCmsStyleTag(sourceFile, source)
    : await renderDevCmsStyleTags(sourceFile, source);
  const linkTags = renderCmsLinkTags(source);
  const scriptBlocks = extractCmsScriptBlocks(sourceFile, source);
  const bundleScriptPaths = getCmsBundleScriptPaths(source);
  const scriptParts = [];

  for (const block of scriptBlocks) {
    if (block.type === "external") {
      scriptParts.push(block.tag);
      continue;
    }

    const minifiedJs = await minifyJs(block.source);

    if (!minifiedJs) {
      continue;
    }

    scriptParts.push(`<script>\n${minifiedJs}\n</script>`);
  }

  for (const bundleScriptPath of bundleScriptPaths) {
    if (!existsSync(bundleScriptPath)) {
      continue;
    }

    const minifiedJs = await minifyJs(stripJsComments(readFileSync(bundleScriptPath, "utf8")));

    if (!minifiedJs) {
      continue;
    }

    scriptParts.push(`<script>\n${minifiedJs}\n</script>`);
  }

  const inlineScripts = scriptParts.join("\n\n").trim();
  const htmlParts = [styleTag, linkTags, mainOutput.trim()];

  if (!splitScripts && inlineScripts) {
    htmlParts.push(inlineScripts);
  }

  return {
    html: htmlParts.filter(Boolean).join("\n\n").trim(),
    scripts: splitScripts ? inlineScripts : "",
  };
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

async function minifyJs(source) {
  if (!source) {
    return "";
  }

  const result = await esbuild.transform(source, {
    loader: "js",
    minify: true,
    legalComments: "none",
  });

  return result.code.trim();
}

async function minifyCss(source) {
  if (!source) {
    return "";
  }

  const result = await esbuild.transform(source, {
    loader: "css",
    minify: true,
    legalComments: "none",
  });

  return result.code.trim();
}

export async function buildCmsPages({ minify = false } = {}) {
  const renderedPages = collectRenderedPageDocuments();
  const htmlFiles = renderedPages.map((page) => page.relativeOutputPath);

  if (htmlFiles.length === 0) {
    return false;
  }

  ensureOutputDir();
  const configuredSplitPaths = loadCmsScriptSplitPaths();
  const actualSplitPaths = new Set();
  cleanupRemovedCmsPages(htmlFiles, configuredSplitPaths);

  for (const renderedPage of renderedPages) {
    const sourceFile = renderedPage.relativeOutputPath;
    const outputFile = join(outputDir, renderedPage.relativeOutputPath);
    const scriptOutputFile = toCmsScriptHtmlOutputPath(sourceFile);
    const output = await renderCmsHtmlParts(sourceFile, outputFile, renderedPage.html, { minify });
    const shouldWriteSplitScript = shouldSplitCmsScripts(sourceFile, configuredSplitPaths) && Boolean(output.scripts);

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, `${output.html}\n`);
    if (shouldWriteSplitScript) {
      actualSplitPaths.add(toSourceRelativeHtmlPath(sourceFile));
      writeFileSync(scriptOutputFile, `${output.scripts}\n`);
    } else {
      rmSync(scriptOutputFile, { force: true });
    }
    console.log(`[cms] Built ${outputFile}${minify ? " [minified]" : ""}`);
    if (shouldWriteSplitScript) {
      console.log(`[cms] Built ${scriptOutputFile}${minify ? " [minified]" : ""}`);
    }
  }

  cleanupRemovedCmsPages(htmlFiles, actualSplitPaths);

  return htmlFiles.length > 0;
}

export async function buildCmsAssets({ minify = false } = {}) {
  const builtPages = await buildCmsPages({ minify });
  return builtPages;
}

export function createHtmlSnapshot() {
  const assetSnapshot = [
    ...(existsSync("css") ? collectFiles("css", ".css") : []),
    ...(existsSync("css") ? collectFiles("css", ".map") : []),
    ...(existsSync("js") ? collectFiles("js", ".js") : []),
    ...(existsSync("js") ? collectFiles("js", ".map") : []),
  ]
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");

  return [createContentSnapshot(), assetSnapshot].filter(Boolean).join("|");
}
