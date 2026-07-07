import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const outputDir = "cms";
const pageOutputDir = join(outputDir, "pages");
const includeOutputDir = join(outputDir, "includes");
const htmlSourceDir = "html";
const cssSource = "css/style-v3.css";
const jsSource = "js/script-v2.js";
const cssInlineOutput = join(includeOutputDir, "style-v3-inline.html");
const jsInlineOutput = join(includeOutputDir, "script-v2-inline.html");
const cmsInlineFiles = new Set([cssInlineOutput, jsInlineOutput]);
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

function wrap(tagName, source) {
  return `<${tagName}>\n${source}\n</${tagName}>\n`;
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
  mkdirSync(pageOutputDir, { recursive: true });
  mkdirSync(includeOutputDir, { recursive: true });
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

function toCmsOutputPath(sourceFile) {
  return join(pageOutputDir, relative(htmlSourceDir, sourceFile));
}

function cleanupRemovedCmsPages(sourceFiles) {
  if (!existsSync(outputDir)) {
    return;
  }

  const expectedOutputs = new Set(sourceFiles.map((sourceFile) => toCmsOutputPath(sourceFile)));
  const existingOutputs = collectFiles(outputDir, ".html");

  for (const filePath of existingOutputs) {
    if (cmsInlineFiles.has(filePath)) {
      continue;
    }

    if (!expectedOutputs.has(filePath)) {
      rmSync(filePath, { force: true });
    }
  }
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

function extractCmsFragment(source) {
  const bodyMatch = source.match(/<body\b[\s\S]*?<\/body>/i);

  if (!bodyMatch) {
    throw new Error("Missing <body> in HTML source");
  }

  const body = bodyMatch[0];
  const links = extractLinkTags(body);
  const main = extractSection(body, "main");

  return [...links, main].join("\n\n").trim();
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

export function buildInlineStyle() {
  if (!existsSync(cssSource)) {
    return false;
  }

  ensureOutputDir();
  const css = stripCssComments(readFileSync(cssSource, "utf8"));
  writeFileSync(cssInlineOutput, wrap("style", css));
  console.log(`[cms] Built ${cssInlineOutput}`);
  return true;
}

export function buildInlineScript() {
  if (!existsSync(jsSource)) {
    return false;
  }

  ensureOutputDir();
  const js = stripJsComments(readFileSync(jsSource, "utf8"));
  writeFileSync(jsInlineOutput, wrap("script", js));
  console.log(`[cms] Built ${jsInlineOutput}`);
  return true;
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
    const outputFile = toCmsOutputPath(sourceFile);

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, `${output}\n`);
    console.log(`[cms] Built ${outputFile}${minify ? " [minified]" : ""}`);
  }

  return htmlFiles.length > 0;
}

export async function buildCmsAssets({ minify = false } = {}) {
  const builtStyle = buildInlineStyle();
  const builtScript = buildInlineScript();
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
