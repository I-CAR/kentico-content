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
import postcss from "postcss";
import { parseStructuredAuthoringFile, stripAuthoringFileExtension } from "./authoring-format.mjs";
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
const cmsShellCss = `.header .header-inner,.footer .footer-inner{max-width:100%;margin-left:auto;margin-right:auto;padding-left:.75rem;padding-right:.75rem}#main,#main>article{padding-left:0;padding-right:0}#main>article{padding:0}.content.no-right-rail{padding:0 var(--space-8)}.content.no-right-rail h1:only-child{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.breadcrumb{margin:calc(25rem / var(--rem-base)) auto;padding:0 calc(10rem / 16)}@media screen and (min-width:1520px){.ic-section .container,.ic-header .container,.breadcrumb,.header .header-inner,.footer .footer-inner{max-width:calc(1520rem / 16)!important}}`;
const cmsFormShellCss = `.ic-section+.row.row--with-cols-padding,.section+.row.row--with-cols-padding{margin-top:var(--section-margin);background:var(--lightest)!important;padding:var(--section-padding) 0}.ic-section.ic-background-white+.row.row--with-cols-padding,.section.ic-background-white+.row.row--with-cols-padding,.section.bg-white+.row.row--with-cols-padding{background:var(--lightest)!important}.ic-section.ic-background-light+.row.row--with-cols-padding,.section.ic-background-light+.row.row--with-cols-padding,.section.bg-light+.row.row--with-cols-padding{margin-top:0;background:none!important}.ic-section+.row.row--with-cols-padding:last-child,.section+.row.row--with-cols-padding:last-child{padding-bottom:clamp(5rem,1.721rem + 9.697vw,7.5rem)}.ic-section+.row.row--with-cols-padding form,.section+.row.row--with-cols-padding form,.row--with-cols-padding form{max-width:100%}.row--with-cols-padding:has(form,.formwidget-submit-text){margin:0}.row--with-cols-padding:has(.formwidget-submit-text) .subhead,.row--with-cols-padding:has(.formwidget-submit-text) .disclaimer{display:none!important}`;
const cmsHeadBootstrapSource = `(function(){var bootstrapScript=document.currentScript;var deferredScriptType='text/plain';var run=function(){if(!document.head||!document.body){bootstrapScript&&bootstrapScript.remove();return}var headNodes=Array.from(document.body.querySelectorAll('link,style'));var scriptNodes=Array.from(document.body.querySelectorAll('script[type="'+deferredScriptType+'"]'));var sameLink=function(node){var href=node.getAttribute('href')||'';var rel=node.getAttribute('rel')||'';var media=node.getAttribute('media')||'';var as=node.getAttribute('as')||'';if(!href)return false;return Array.from(document.head.querySelectorAll('link[href]')).some(function(existing){return existing!==node&&(existing.getAttribute('href')||'')===href&&(existing.getAttribute('rel')||'')===rel&&(existing.getAttribute('media')||'')===media&&(existing.getAttribute('as')||'')===as;});};var sameStyle=function(node){var css=(node.textContent||'').trim();if(!css)return false;return Array.from(document.head.querySelectorAll('style')).some(function(existing){return existing!==node&&(existing.textContent||'').trim()===css;});};headNodes.forEach(function(node){var duplicate=node.tagName.toLowerCase()==='link'?sameLink(node):sameStyle(node);if(duplicate){node.remove();return}document.head.appendChild(node)});scriptNodes.forEach(function(node){var script=document.createElement('script');Array.from(node.attributes).forEach(function(attribute){if(attribute.name==='type')return;script.setAttribute(attribute.name,attribute.value)});if(node.textContent)script.textContent=node.textContent;node.remove();document.body.appendChild(script)});bootstrapScript&&bootstrapScript.remove()};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run,{once:true})}else{run()}})();`;
const cmsFormShellClasses = [
  "breadcrumb",
  "c-nav--main",
  "control-label",
  "content",
  "disclaimer",
  "editing-form-control-nested-control",
  "field-validation-error",
  "footer",
  "footer-inner",
  "form-control",
  "form-field",
  "formwidget-error",
  "formwidget-submit-text",
  "header",
  "header-inner",
  "input-validation-error",
  "ktc-default-section",
  "ktc-radio",
  "ktc-radio-list",
  "optional",
  "pageWrap",
  "row",
  "row--with-cols-padding",
  "subhead",
  "textarea-validation-error",
  "ic-form",
];
const cmsFormShellTags = ["article", "button", "form", "input", "label", "main", "select", "textarea"];

function normalizeAssetPath(htmlFile, assetPath) {
  return join(dirname(htmlFile), assetPath).replace(/\\/g, "/");
}

function isBootstrapAsset(assetPath) {
  return /(^|\/)(?:node_modules\/bootstrap\/|css\/bootstrap-(?:subset|cms-compat)\.css$)/i.test(
    assetPath.replace(/\\/g, "/"),
  );
}

function isBootstrapSubsetAsset(assetPath) {
  return /(^|\/)(?:node_modules\/bootstrap\/dist\/css\/bootstrap(?:\.min)?\.css|css\/bootstrap-subset\.css)$/i.test(
    assetPath.replace(/\\/g, "/"),
  );
}

function getCmsBootstrapAssetPath(assetPath) {
  if (isBootstrapSubsetAsset(assetPath)) {
    return join("css", "bootstrap-cms-compat.css");
  }

  return assetPath;
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

function isSwiperStylesheet(assetPath) {
  return /(^|\/)css\/style-cms-swiper\.css$/i.test(assetPath.replace(/\\/g, "/"));
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function collectHtmlUsage(source, { includeCmsFormShell = false } = {}) {
  const classes = new Set();
  const ids = new Set(["main"]);
  const tags = new Set(["article"]);

  for (const match of source.matchAll(/\bclass=["']([^"']+)["']/gi)) {
    match[1]
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => classes.add(value));
  }

  for (const match of source.matchAll(/\bid=["']([^"']+)["']/gi)) {
    const value = match[1]?.trim();

    if (value) {
      ids.add(value);
    }
  }

  for (const match of source.matchAll(/<([a-z][\w-]*)\b/gi)) {
    tags.add(match[1].toLowerCase());
  }

  if (includeCmsFormShell) {
    cmsFormShellClasses.forEach((className) => classes.add(className));
    cmsFormShellTags.forEach((tagName) => tags.add(tagName));
  }

  if (classes.has("swiper") || classes.has("ic-swiper") || pageUsesSwiper(source)) {
    [
      "swiper-horizontal",
      "swiper-pagination-bullets",
      "swiper-pagination-horizontal",
      "swiper-pagination-lock",
      "swiper-slide-active",
      "swiper-slide-next",
      "swiper-slide-prev",
      "swiper-backface-hidden",
      "swiper-initialized",
    ].forEach((className) => classes.add(className));
  }

  return { classes, ids, tags };
}

function splitSelectorList(selectorSource) {
  const selectors = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;

  for (const character of selectorSource) {
    if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (character === "(") {
      parenDepth += 1;
    } else if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    }

    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      if (current.trim()) {
        selectors.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    selectors.push(current.trim());
  }

  return selectors;
}

function selectorMatchesHtmlUsage(selector, usage) {
  const normalized = selector
    .replace(/:not\(([^()]*)\)/g, "")
    .replace(/::?[\w-]+(?:\([^)]*\))?/g, "")
    .replace(/\[[^\]]*\]/g, "");

  if (!normalized.trim()) {
    return true;
  }

  const classMatches = [...normalized.matchAll(/\.(-?[_a-zA-Z]+[\w-]*)/g)].map((match) => match[1]);
  const idMatches = [...normalized.matchAll(/#([_a-zA-Z][\w-]*)/g)].map((match) => match[1]);
  const tagMatches = [...normalized.matchAll(/(^|[\s>+~])([a-z][\w-]*)/gi)]
    .map((match) => match[2].toLowerCase())
    .filter((tagName) => tagName !== "from" && tagName !== "to");

  if (classMatches.some((className) => !usage.classes.has(className))) {
    return false;
  }

  if (idMatches.some((id) => !usage.ids.has(id))) {
    return false;
  }

  if (tagMatches.some((tagName) => !usage.tags.has(tagName))) {
    return false;
  }

  return classMatches.length > 0 || idMatches.length > 0 || tagMatches.length > 0;
}

function filterSharedStylesheet(cssSource, htmlSource, { includeCmsFormShell = false } = {}) {
  const root = postcss.parse(cssSource);
  const usage = collectHtmlUsage(htmlSource, { includeCmsFormShell });

  function cloneMatchingNode(node) {
    if (node.type === "rule") {
      const selectors = splitSelectorList(node.selector).filter((selector) => selectorMatchesHtmlUsage(selector, usage));

      if (selectors.length === 0) {
        return null;
      }

      return node.clone({ selector: selectors.join(", ") });
    }

    if (node.type === "atrule") {
      if (node.name === "media" || node.name === "supports" || node.name === "layer" || node.name === "container") {
        const cloned = node.clone({ nodes: [] });

        for (const child of node.nodes ?? []) {
          const matchedChild = cloneMatchingNode(child);

          if (matchedChild) {
            cloned.append(matchedChild);
          }
        }

        return cloned.nodes.length > 0 ? cloned : null;
      }

      return node.clone();
    }

    return node.clone();
  }

  const filteredRoot = postcss.root();

  for (const node of root.nodes) {
    const matchedNode = cloneMatchingNode(node);

    if (matchedNode) {
      filteredRoot.append(matchedNode);
    }
  }

  return filteredRoot.toString().trim();
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

function toCmsFragmentHtmlOutputPath(sourceFile, fragmentName) {
  return toCmsHtmlOutputPath(sourceFile).replace(/\.html$/i, `.${fragmentName}.html`);
}

function toCompanionScriptSourcePath(sourceFile) {
  return sourceFile.replace(/\.html$/i, ".scripts.html");
}

function toContentHtmlRelativePath(sourceFile, page) {
  const sourceRelativePath = relative(contentSourceDir, sourceFile).replace(/\\/g, "/");
  const sourceDirectory = dirname(sourceRelativePath).replace(/\\/g, "/");
  const fallbackName = stripAuthoringFileExtension(sourceRelativePath.split("/").pop());
  const outputBaseName = page.slug || fallbackName;
  return join(sourceDirectory, `${outputBaseName}.html`).replace(/\\/g, "/");
}

function loadCmsScriptSplitPaths() {
  if (!existsSync(contentSourceDir)) {
    return new Set();
  }

  const splitPaths = new Set();

  for (const sourceFile of collectRenderableContentFiles()) {
    const page = parseStructuredAuthoringFile(sourceFile);

    if (page?.cms?.scriptOutput === "separateHtmlFile") {
      splitPaths.add(toContentHtmlRelativePath(sourceFile, page));
    }
  }

  return splitPaths;
}

function shouldSplitCmsScripts(sourceFile, splitPaths = loadCmsScriptSplitPaths()) {
  return splitPaths.has(toSourceRelativeHtmlPath(sourceFile));
}

function pageUsesCmsForm(page) {
  if (page?.cms?.hasForm === true) {
    return true;
  }

  if (page?.cms?.scriptOutput === "separateHtmlFile") {
    return true;
  }

  return normalizeCmsFragments(page).length > 0;
}

function normalizeCmsFragments(page) {
  const fragments = Array.isArray(page?.cms?.fragments) ? page.cms.fragments : [];

  return fragments
    .map((fragment) => ({
      name: typeof fragment?.name === "string" ? fragment.name.trim() : "",
      fromSectionId: typeof fragment?.fromSectionId === "string" ? fragment.fromSectionId.trim() : "",
      afterSectionId: typeof fragment?.afterSectionId === "string" ? fragment.afterSectionId.trim() : "",
      includeScripts: Boolean(fragment?.includeScripts),
    }))
    .filter((fragment) => fragment.name && (fragment.fromSectionId || fragment.afterSectionId));
}

function getExpectedCmsOutputPathsForPage(renderedPage, splitPaths) {
  const sourceFile = renderedPage.relativeOutputPath;
  const fragmentOutputs = normalizeCmsFragments(renderedPage.page).map((fragment) =>
    toCmsFragmentHtmlOutputPath(sourceFile, fragment.name),
  );
  const outputs = [toCmsHtmlOutputPath(sourceFile), ...fragmentOutputs];

  if (shouldSplitCmsScripts(sourceFile, splitPaths)) {
    outputs.push(toCmsScriptHtmlOutputPath(sourceFile));
  }

  return outputs;
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

function cleanupRemovedCmsPages(renderedPages, splitPaths = loadCmsScriptSplitPaths()) {
  if (!existsSync(outputDir)) {
    return;
  }

  const expectedOutputs = new Set(renderedPages.flatMap((renderedPage) => getExpectedCmsOutputPathsForPage(renderedPage, splitPaths)));
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
  return String(value).replaceAll('"', "&quot;");
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

function toOutputAssetPath(sourceFile, outputFile, assetPath, assetBaseFile = sourceFile) {
  if (
    !assetPath ||
    /^[a-z]+:/i.test(assetPath) ||
    assetPath.startsWith("//") ||
    assetPath.startsWith("/") ||
    assetPath.startsWith("#")
  ) {
    return assetPath;
  }

  return relative(dirname(outputFile), normalizeAssetPath(assetBaseFile, assetPath)).replace(/\\/g, "/");
}

function rewriteSrcsetValue(sourceFile, outputFile, srcsetValue, assetBaseFile = sourceFile) {
  return srcsetValue
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();

      if (!trimmed) {
        return trimmed;
      }

      const [url, ...descriptorParts] = trimmed.split(/\s+/);
      const rewrittenUrl = toOutputAssetPath(sourceFile, outputFile, url, assetBaseFile);
      return [rewrittenUrl, ...descriptorParts].filter(Boolean).join(" ");
    })
    .join(", ");
}

function rewriteLocalAssetPaths(sourceFile, outputFile, source, assetBaseFile = sourceFile) {
  return source
    .replace(/\b(href|src)=["']([^"']+)["']/gi, (match, attributeName, assetPath) => {
      const rewrittenPath = toOutputAssetPath(sourceFile, outputFile, assetPath, assetBaseFile);
      return `${attributeName}="${escapeAttribute(rewrittenPath)}"`;
    })
    .replace(/\bsrcset=["']([^"']+)["']/gi, (match, srcsetValue) => {
      const rewrittenValue = rewriteSrcsetValue(sourceFile, outputFile, srcsetValue, assetBaseFile);
      return `srcset="${escapeAttribute(rewrittenValue)}"`;
    });
}

function extractLocalAssetPaths(sourceFile, source, { tagName, extension, assetBaseFile = sourceFile }) {
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

    const normalizedPath = normalizeAssetPath(assetBaseFile, assetPath);

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

function extractMainInner(source) {
  const mainMatch = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

  if (!mainMatch) {
    throw new Error("Missing <main> in HTML source");
  }

  return mainMatch[1];
}

function extractTopLevelSections(mainInnerSource) {
  const sections = [];
  const lowerSource = mainInnerSource.toLowerCase();
  let index = 0;

  while (index < mainInnerSource.length) {
    const nextOpen = lowerSource.indexOf("<section", index);

    if (nextOpen === -1) {
      break;
    }

    const openEnd = getTagBoundary(mainInnerSource, nextOpen);

    if (openEnd === -1) {
      throw new Error("Malformed <section> tag in <main>");
    }

    const blockEnd = getClosingTagEnd(mainInnerSource, "section", nextOpen);

    if (blockEnd === -1) {
      throw new Error("Missing closing </section> tag in <main>");
    }

    const sectionHtml = mainInnerSource.slice(nextOpen, blockEnd);
    const idMatch = sectionHtml.match(/\bid=["']([^"']+)["']/i);

    sections.push({
      id: idMatch?.[1] ?? "",
      start: nextOpen,
      end: blockEnd,
      html: sectionHtml,
    });

    index = blockEnd;
  }

  return sections;
}

function normalizeMainFragment(source) {
  return source.trim();
}

function splitMainByCmsFragments(mainSource, page) {
  const fragments = normalizeCmsFragments(page);

  if (fragments.length === 0) {
    return [{ name: "", mainSource: normalizeMainFragment(extractMainInner(mainSource)) }];
  }

  const mainInnerSource = extractMainInner(mainSource);
  const sections = extractTopLevelSections(mainInnerSource);
  const fragmentBoundaries = fragments
    .map((fragment) => {
      let sectionIndex = -1;

      if (fragment.fromSectionId) {
        sectionIndex = sections.findIndex((section) => section.id === fragment.fromSectionId);
      } else if (fragment.afterSectionId) {
        const afterIndex = sections.findIndex((section) => section.id === fragment.afterSectionId);
        sectionIndex = afterIndex === -1 ? -1 : afterIndex + 1;
      }

      if (sectionIndex === -1 || sectionIndex > sections.length) {
        throw new Error(
          `Unable to resolve CMS fragment "${fragment.name}" on page "${page.slug || page.title || "unknown"}"`,
        );
      }

      return {
        ...fragment,
        sectionIndex,
      };
    })
    .sort((left, right) => left.sectionIndex - right.sectionIndex);

  const outputs = [];
  let previousStart = 0;

  for (const fragment of fragmentBoundaries) {
    const boundaryOffset =
      fragment.sectionIndex >= sections.length ? mainInnerSource.length : sections[fragment.sectionIndex].start;
    const primaryInner = mainInnerSource.slice(previousStart, boundaryOffset).trim();

    if (outputs.length === 0) {
      outputs.push({
        name: "",
        mainSource: normalizeMainFragment(primaryInner),
        includeScripts: false,
      });
    }

    previousStart = boundaryOffset;
  }

  for (let index = 0; index < fragmentBoundaries.length; index += 1) {
    const fragment = fragmentBoundaries[index];
    const startOffset =
      fragment.sectionIndex >= sections.length ? mainInnerSource.length : sections[fragment.sectionIndex].start;
    const nextFragment = fragmentBoundaries[index + 1];
    const endOffset = nextFragment
      ? nextFragment.sectionIndex >= sections.length
        ? mainInnerSource.length
        : sections[nextFragment.sectionIndex].start
      : mainInnerSource.length;
    const fragmentInner = mainInnerSource.slice(startOffset, endOffset).trim();

    outputs.push({
      name: fragment.name,
      mainSource: normalizeMainFragment(fragmentInner),
      includeScripts: fragment.includeScripts,
    });
  }

  if (outputs.length === 0) {
    return [{ name: "", mainSource }];
  }

  return outputs;
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

function filterCmsAssetPaths(assetPaths, dependencies, { forceBootstrap = false } = {}) {
  return assetPaths.filter((assetPath) => {
    if (isBootstrapAsset(assetPath)) {
      return forceBootstrap || dependencies.bootstrap;
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

function extractCmsCssPaths(sourceFile, source, { forceBootstrap = false, assetBaseFile = sourceFile } = {}) {
  return filterCmsAssetPaths(
    extractLocalAssetPaths(sourceFile, source, { tagName: "link", extension: ".css", assetBaseFile }).filter(
      (assetPath) => !isCmsVendorStylesheet(assetPath),
    ),
    detectPageDependencies(source),
    { forceBootstrap },
  );
}

async function renderCmsStyleTag(sourceFile, source, page, { forceBootstrap = false, assetBaseFile = sourceFile } = {}) {
  const includeCmsFormShell = pageUsesCmsForm(page);
  const cssParts = extractCmsCssPaths(sourceFile, source, { forceBootstrap, assetBaseFile })
    .map((assetPath) => {
      const resolvedAssetPath = getCmsBootstrapAssetPath(assetPath);
      const cssSource = stripCssComments(readFileSync(resolvedAssetPath, "utf8"));

      if (!cssSource) {
        return "";
      }

      if (isSwiperStylesheet(resolvedAssetPath)) {
        return cssSource;
      }

      if (isSharedSiteStylesheet(resolvedAssetPath)) {
        return filterSharedStylesheet(cssSource, source, { includeCmsFormShell });
      }

      return cssSource;
    })
    .filter(Boolean);

  cssParts.push(cmsShellCss);

  if (includeCmsFormShell) {
    cssParts.push(cmsFormShellCss);
  }

  if (cssParts.length === 0) {
    return "";
  }

  const css = await minifyCss(cssParts.join("\n\n"));
  return css ? `<style>\n${css}\n</style>` : "";
}

function renderCmsLinkTags(source) {
  return [...extractHeadExternalLinks(source), ...extractHeadFontLinks(source)]
    .filter((link, index, links) => links.indexOf(link) === index)
    .map((link) => rebuildTag(link))
    .join("\n");
}

async function renderCmsHeadBootstrapScript() {
  const minifiedJs = await minifyJs(cmsHeadBootstrapSource);
  return minifiedJs ? `<script>\n${minifiedJs}\n</script>` : "";
}

function toInactiveCmsScriptTag(tagSource) {
  const markedTag = tagSource.replace(/^<script(?=[\s>])/i, '<script type="text/plain"');
  return markedTag.replace(/\stype="[^"]*"/i, ' type="text/plain"');
}

function removeScriptTags(source) {
  return source.replace(/<script\b[\s\S]*?<\/script>\s*/gi, "");
}

function extractCmsScriptBlocks(sourceFile, source, assetBaseFile = sourceFile) {
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
          blocks.push({ type: "external", tag: rebuildExternalScriptTag(match[0]) });
          continue;
        }

        const assetPath = normalizeAssetPath(assetBaseFile, src);
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

export async function renderCmsHtmlParts(
  sourceFile,
  outputFile,
  source,
  page,
  { minify = false, minifyHtml = minify, assetBaseFile = sourceFile } = {},
) {
  const splitScripts = shouldSplitCmsScripts(sourceFile);
  const styleTag = await renderCmsStyleTag(sourceFile, source, page, {
    forceBootstrap: minify,
    assetBaseFile,
  });
  const linkTags = renderCmsLinkTags(source);
  const headBootstrapScript = linkTags || styleTag ? await renderCmsHeadBootstrapScript() : "";
  const scriptBlocks = extractCmsScriptBlocks(sourceFile, source, assetBaseFile);
  const bundleScriptPaths = getCmsBundleScriptPaths(source);
  const scriptParts = [];

  for (const block of scriptBlocks) {
    if (block.type === "external") {
      scriptParts.push(toInactiveCmsScriptTag(block.tag));
      continue;
    }

    const minifiedJs = await minifyJs(block.source);

    if (!minifiedJs) {
      continue;
    }

    scriptParts.push(`<script type="text/plain">\n${minifiedJs}\n</script>`);
  }

  for (const bundleScriptPath of bundleScriptPaths) {
    if (!existsSync(bundleScriptPath)) {
      continue;
    }

    const minifiedJs = await minifyJs(stripJsComments(readFileSync(bundleScriptPath, "utf8")));

    if (!minifiedJs) {
      continue;
    }

    scriptParts.push(`<script type="text/plain">\n${minifiedJs}\n</script>`);
  }

  const inlineScripts = scriptParts.join("\n\n").trim();
  const mainFragments = splitMainByCmsFragments(extractCmsMain(source), page);
  const files = mainFragments.map((fragment) => {
    const fragmentOutputFile = fragment.name ? toCmsFragmentHtmlOutputPath(sourceFile, fragment.name) : outputFile;
    const rewrittenMain = rewriteLocalAssetPaths(sourceFile, fragmentOutputFile, fragment.mainSource, assetBaseFile);
    const mainOutput = minifyHtml ? minifyFragment(rewrittenMain) : removeCommentsAndSortAttributes(rewrittenMain);
    const htmlParts = [fragment.name ? "" : linkTags, fragment.name ? "" : styleTag, mainOutput.trim()];

    if (fragment.includeScripts && inlineScripts) {
      htmlParts.push(inlineScripts);
    } else if (!splitScripts && !fragment.name && inlineScripts) {
      htmlParts.push(inlineScripts);
    }

    if (!fragment.name && headBootstrapScript) {
      htmlParts.push(headBootstrapScript);
    }

    return {
      name: fragment.name,
      outputFile: fragmentOutputFile,
      html: htmlParts.filter(Boolean).join("\n\n").trim(),
    };
  });

  return {
    files,
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
  const isVoidElement = htmlVoidElements.has(tagName.toLowerCase());
  return `<${tagName}${attributeSuffix}${selfClosing && !isVoidElement ? " />" : ">"}`;
}

function rebuildExternalScriptTag(tagSource) {
  const openTagMatch = tagSource.match(/<script\b[^>]*>/i);

  if (!openTagMatch) {
    return tagSource;
  }

  return `${rebuildTag(openTagMatch[0])}</script>`;
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

export async function buildCmsPages({ minify = false, minifyHtml = minify } = {}) {
  const renderedPages = collectRenderedPageDocuments();
  const htmlFiles = renderedPages.map((page) => page.relativeOutputPath);

  if (htmlFiles.length === 0) {
    return false;
  }

  ensureOutputDir();
  const configuredSplitPaths = loadCmsScriptSplitPaths();
  const actualSplitPaths = new Set();
  cleanupRemovedCmsPages(renderedPages, configuredSplitPaths);

  for (const renderedPage of renderedPages) {
    const sourceFile = renderedPage.relativeOutputPath;
    const assetBaseFile = join("html", renderedPage.relativeOutputPath);
    const outputFile = join(outputDir, renderedPage.relativeOutputPath);
    const scriptOutputFile = toCmsScriptHtmlOutputPath(sourceFile);
    const output = await renderCmsHtmlParts(sourceFile, outputFile, renderedPage.html, renderedPage.page, {
      assetBaseFile,
      minify,
      minifyHtml,
    });
    const shouldWriteSplitScript = shouldSplitCmsScripts(sourceFile, configuredSplitPaths) && Boolean(output.scripts);

    for (const file of output.files) {
      mkdirSync(dirname(file.outputFile), { recursive: true });
      writeFileSync(file.outputFile, `${file.html}\n`);
      console.log(`[cms] Built ${file.outputFile}${minify ? " [minified]" : ""}`);
    }

    if (shouldWriteSplitScript) {
      actualSplitPaths.add(toSourceRelativeHtmlPath(sourceFile));
      writeFileSync(scriptOutputFile, `${output.scripts}\n`);
    } else {
      rmSync(scriptOutputFile, { force: true });
    }
    if (shouldWriteSplitScript) {
      console.log(`[cms] Built ${scriptOutputFile}${minify ? " [minified]" : ""}`);
    }
  }

  cleanupRemovedCmsPages(renderedPages, actualSplitPaths);

  return htmlFiles.length > 0;
}

export async function buildCmsAssets({ minify = false, minifyHtml = minify } = {}) {
  const builtPages = await buildCmsPages({ minify, minifyHtml });
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
