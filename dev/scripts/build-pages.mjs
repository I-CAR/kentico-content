import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import {
  authoringFileExtensions,
  assertUniqueAuthoringBasenames,
  parseStructuredAuthoringFile,
  stripAuthoringFileExtension,
} from "./authoring-format.mjs";
import { createTemplateSnapshot, parseOnlySelections, syncTemplates } from "./generate-templates.mjs";
import { pageUsesBootstrap, pageUsesJquery, pageUsesLegacyCss, sourceReferencesJqueryAsset } from "./page-dependencies.mjs";
import { admitIconSvg, validatePageData, throwOnValidationError } from "./schema-validation.mjs";
import { createTemplateSection } from "./page-template-registry.mjs";

const watchMode = process.argv.includes("--watch");
const goldClassRatingProofMode = process.argv.includes("--proof-gtgc-rating-renderer");
const goldClassNoSendProofMode = process.argv.includes("--proof-gtgc-no-send-gate");
const goldClassInvisibleV2ProofMode = process.argv.includes("--proof-gtgc-invisible-v2")
  || process.argv.includes("--proof-gtgc-invisible-v2-flow");
const goldClassIframeReadinessProofMode = process.argv.includes("--proof-gtgc-iframe-readiness");
const goldClassSelectProofMode = process.argv.includes("--proof-gtgc-select");
const dryRun = process.argv.includes("--dry-run");
const selectedAuthoringBases = new Set(parseOnlySelections());
const contentSourceDir = join("content", "pages");
const previewOutputDir = "previews";
const legacyGeneratedPreviewDir = join("previews", "generated");
const isDirectRun = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

let buildQueued = false;
let buildRunning = false;
let queuedReason = null;
let watchDebounce = null;
let previousSnapshot = "";

const goldClassNoSendAllowedHostnames = [
  "localhost",
  "127.0.0.1",
  "::1",
  "stage.info.i-car.com",
  "info.i-car.com",
];
const goldClassNoSendAllowedStates = ["error", "failure", "success"];

function collectFiles(root, extension) {
  const files = [];

  if (!existsSync(root)) {
    return files;
  }

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

export function collectRenderableContentFiles() {
  return assertUniqueAuthoringBasenames(
    authoringFileExtensions.flatMap((extension) => collectFiles(contentSourceDir, extension)),
    "content page files",
  ).filter((sourceFile) => selectedAuthoringBases.size === 0
    || selectedAuthoringBases.has(stripAuthoringFileExtension(relative(contentSourceDir, sourceFile))));
}

function createFileSnapshot(files) {
  return files
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");
}

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

      reject(new Error(`Fresh pages build failed${signal ? ` (${signal})` : code != null ? ` (code ${code})` : ""}`));
    });
  });
}

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function joinClassNames(...classNames) {
  return classNames
    .filter((className) => typeof className === "string" && className.trim().length > 0)
    .map((className) => className.trim())
    .join(" ");
}

function getSearchParam(searchParams, name) {
  return typeof searchParams?.get === "function" ? searchParams.get(name) : null;
}

function resolveGoldClassNoSendSimulation(hostname = "", searchParams = new URLSearchParams()) {
  const state = getSearchParam(searchParams, "gtgcFormState") || "";
  const active = goldClassNoSendAllowedHostnames.includes(String(hostname))
    && getSearchParam(searchParams, "gtgcNoSend") === "1"
    && goldClassNoSendAllowedStates.includes(state);

  return {
    active,
    state: active ? state : "",
  };
}

function getSectionHeading(section = {}) {
  return section.heading || section.title || "";
}

function getHeroHeadline(section = {}) {
  return section.heading || section.headline || section.headline1 || section.title || "";
}

function getCardHeading(card = {}) {
  return card.heading || card.title || "";
}

function getAccordionItemHeading(item = {}) {
  return item.heading || item.title || "";
}

function getBackgroundColor(section = {}) {
  if (typeof section.backgroundColor === "string" && section.backgroundColor.trim()) {
    return section.backgroundColor.trim().toLowerCase();
  }

  if (section.backgroundLight === true) {
    return "light";
  }

  if (section.backgroundLight === false) {
    return "white";
  }

  return "";
}

function getBackgroundClassName(section = {}) {
  const backgroundColor = getBackgroundColor(section);

  if (backgroundColor === "light") {
    return " ic-background-light";
  }

  if (backgroundColor === "white") {
    return " ic-background-white";
  }

  return "";
}

function getActionLocation(item = {}, defaultLocation = "header") {
  return typeof item.location === "string" && item.location.trim()
    ? item.location.trim().toLowerCase()
    : defaultLocation;
}

function getSectionButtons(section = {}) {
  const buttonGroup = section.buttons;
  const buttons = Array.isArray(buttonGroup)
    ? [...buttonGroup]
    : Array.isArray(buttonGroup?.items)
      ? buttonGroup.items.map((button) => ({
        ...button,
        location: getActionLocation(button, getActionLocation(buttonGroup, "header")),
        variant: button.variant || buttonGroup.variant || buttonGroup.buttonVariant,
      }))
      : [];
  const legacyFooterButtons = Array.isArray(section.footerButtons)
    ? section.footerButtons.map((button) => ({ ...button, location: getActionLocation(button, "footer") }))
    : [];

  return [...buttons, ...legacyFooterButtons];
}

function getSectionButtonsByLocation(section = {}, location, defaultLocation = "header") {
  return getSectionButtons(section).filter((button) => getActionLocation(button, defaultLocation) === location);
}

function getSectionLinksByLocation(section = {}, location, defaultLocation = "header") {
  const linkGroup = section.links;
  const links = Array.isArray(linkGroup)
    ? linkGroup
    : Array.isArray(linkGroup?.items)
      ? linkGroup.items.map((link) => ({
        ...link,
        location: getActionLocation(link, getActionLocation(linkGroup, "header")),
      }))
      : [];
  return links.filter((link) => getActionLocation(link, defaultLocation) === location);
}

function buildSectionClassName(baseClassName, ...additionalClassNames) {
  return joinClassNames(baseClassName, ...additionalClassNames);
}

function getSectionChromeClassName(section = {}) {
  return section.sectionChrome === "bordered" ? "ic-background-white ic-section-border" : "";
}

function normalizeBreakpoint(value, fallback = "lg") {
  const breakpoint = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["sm", "md", "lg", "xl"].includes(breakpoint) ? breakpoint : fallback;
}

function resolveSplitColumnOrderClasses(desktopMediaPosition = "right", mobileMediaOrder = "below", mediaFirstInDom = true) {
  if (desktopMediaPosition === "right" && mobileMediaOrder === "above") {
    return {
      copyClassName: "order-last order-md-first",
      mediaClassName: "order-first order-md-last",
    };
  }

  if (desktopMediaPosition === "left" && mobileMediaOrder === "below") {
    return {
      copyClassName: "order-first order-md-last",
      mediaClassName: "order-last order-md-first",
    };
  }

  // Hero DOM has copy first, media second. For left/above the media must lead at all widths.
  if (desktopMediaPosition === "left" && mobileMediaOrder === "above" && !mediaFirstInDom) {
    return {
      copyClassName: "",
      mediaClassName: "order-first",
    };
  }

  return {
    copyClassName: "",
    mediaClassName: "",
  };
}

function resolveSplitColumnGapClassNames({
  desktopMediaPosition = "right",
  desktopGapTarget = "",
  desktopGapBreakpoint = "lg",
  gapSide = "physical",
} = {}) {
  const gapBreakpoint = normalizeBreakpoint(desktopGapBreakpoint, "lg");

  if (desktopGapTarget !== "copy" && desktopGapTarget !== "media") {
    return {
      copyClassName: "",
      mediaClassName: "",
    };
  }

  const physicalGapSide = desktopGapTarget === "copy"
    ? (desktopMediaPosition === "right" ? "pr" : "pl")
    : (desktopMediaPosition === "right" ? "pl" : "pr");
  const resolvedGapSide = gapSide === "logical-start" ? "ps" : physicalGapSide;
  const gapClassName = `${resolvedGapSide}-${gapBreakpoint}-5`;

  return {
    copyClassName: desktopGapTarget === "copy" ? gapClassName : "",
    mediaClassName: desktopGapTarget === "media" ? gapClassName : "",
  };
}

function resolveSplitImageClassName({
  imageStyle = "rounded",
  imageFrame = "section",
  imageInset = false,
  imageRounded = true,
} = {}) {
  const baseClassName = imageStyle === "cutout"
    ? "ic-image-cutout"
    : imageStyle === "banner"
      ? "ic-image-banner"
      : imageFrame === "none"
        ? (imageRounded ? "ic-image-rounded" : "")
        : joinClassNames("ic-section-image", imageRounded ? "ic-image-rounded" : "");

  return joinClassNames(baseClassName, imageInset ? "px-4" : "");
}

function resolveSectionSpacingClassNames(section) {
  const spacing = section.spacing;
  const semanticSectionSpacing = section.sectionSpacing;

  return joinClassNames(
    semanticSectionSpacing === "compact" || semanticSectionSpacing === "roomy" ? "ic-section-divider-spacing-40" : "",
    !spacing ? "" : [
      spacing.marginTop === "none" ? "mt-0" : "",
      spacing.paddingTop === "none" ? "pt-0" : "",
      spacing.paddingTop === "none-mobile" ? "pt-0 pt-md-5" : "",
      spacing.paddingTop === "none-lg" ? "pt-lg-0" : "",
      spacing.paddingTop === "sm" ? "ic-section-padding-top-sm" : "",
      spacing.paddingBottom === "none" ? "pb-0" : "",
      spacing.paddingBottom === "sm" ? "ic-section-padding-bottom-sm" : "",
      spacing.paddingBottom === "lg" ? "ic-section-padding-bottom-lg" : "",
      spacing.divider === 40 || spacing.divider === "40" ? "ic-section-divider-spacing-40" : "",
    ].join(" "),
  );
}

function useStructuredNoBleedRows(section = {}) {
  return section.sectionChrome === "bordered";
}

function buildStructuredSectionRowClassName(section = {}, ...additionalClassNames) {
  return joinClassNames(
    "row",
    "justify-content-center",
    useStructuredNoBleedRows(section) ? "ic-row-no-bleed" : "",
    ...additionalClassNames,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function restoreEncodedEntities(value) {
  return value.replace(/&amp;(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, "&$1;");
}

function normalizeImageAssetUrl(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  return value.replace(/https?:\/\/(?:stage\.)?info\.i-car\.com(?=\/)/gi, "");
}

const previewKenticoMediaOrigin = "https://stage.info.i-car.com";

function resolvePreviewKenticoMediaUrl(value) {
  if (typeof value !== "string") {
    return value;
  }

  const mediaPath = value.trimStart();

  if (!mediaPath.startsWith("/getmedia/")) {
    return value;
  }

  return `${previewKenticoMediaOrigin}${mediaPath}`;
}

function normalizeImageAssetSrcsetValue(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  return value
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();

      if (!trimmed) {
        return trimmed;
      }

      const [url, ...descriptorParts] = trimmed.split(/\s+/);
      return [normalizeImageAssetUrl(url), ...descriptorParts].filter(Boolean).join(" ");
    })
    .join(", ");
}

function resolvePreviewKenticoMediaSrcsetValue(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  return value
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();

      if (!trimmed) {
        return trimmed;
      }

      const [url, ...descriptorParts] = trimmed.split(/\s+/);
      return [resolvePreviewKenticoMediaUrl(url), ...descriptorParts].filter(Boolean).join(" ");
    })
    .join(", ");
}

function normalizeCssImageAssetUrls(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  return value.replace(/url\(\s*(['"]?)([^)"']+)\1\s*\)/gi, (match, quote = "", url) => {
    return `url(${quote}${normalizeImageAssetUrl(url)}${quote})`;
  });
}

function normalizeImageAssetUrlsInHtml(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  const normalizedAttributes = value.replace(/\b(src|srcset|poster)=("([^"]*)"|'([^']*)')/gi, (match, attribute, quotedValue, doubleQuoted, singleQuoted) => {
    const quote = quotedValue[0];
    const attributeValue = doubleQuoted ?? singleQuoted ?? "";
    const normalizedValue = attribute.toLowerCase() === "srcset"
      ? normalizeImageAssetSrcsetValue(attributeValue)
      : normalizeImageAssetUrl(attributeValue);
    return `${attribute}=${quote}${normalizedValue}${quote}`;
  });

  return normalizeCssImageAssetUrls(normalizedAttributes);
}

function resolvePreviewKenticoMediaUrlsInHtml(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  const resolvedAttributes = value.replace(/\b(href|src|srcset|poster)=("([^"]*)"|'([^']*)')/gi, (match, attribute, quotedValue, doubleQuoted, singleQuoted) => {
    const quote = quotedValue[0];
    const attributeValue = doubleQuoted ?? singleQuoted ?? "";
    const resolvedValue = attribute.toLowerCase() === "srcset"
      ? resolvePreviewKenticoMediaSrcsetValue(attributeValue)
      : resolvePreviewKenticoMediaUrl(attributeValue);
    return `${attribute}=${quote}${resolvedValue}${quote}`;
  });

  return resolvedAttributes.replace(/url\(\s*(['"]?)([^)"']+)\1\s*\)/gi, (match, quote = "", url) => {
    return `url(${quote}${resolvePreviewKenticoMediaUrl(url)}${quote})`;
  });
}

const downloadableFileExtensions = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "zip",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

function getHrefPathname(href = "") {
  if (typeof href !== "string" || !href.trim()) {
    return "";
  }

  try {
    return new URL(href, "https://example.com").pathname.toLowerCase();
  } catch {
    return href.split(/[?#]/, 1)[0].toLowerCase();
  }
}

function getHrefExtension(href = "") {
  const pathname = getHrefPathname(href);
  const extensionMatch = pathname.match(/\.([a-z0-9]+)$/i);
  return extensionMatch ? extensionMatch[1].toLowerCase() : "";
}

function hasDownloadableHref(href = "") {
  return downloadableFileExtensions.has(getHrefExtension(href));
}

function isDownloadAction(link = {}) {
  if (link.download === false) {
    return false;
  }

  if (link.download === true) {
    return true;
  }

  if (typeof link.download === "string" && link.download.trim()) {
    return true;
  }

  const actionText = [link.label, link.title, link.ariaLabel]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");

  return /\bdownload\b/i.test(actionText) && hasDownloadableHref(link.href);
}

function renderAnchorAttributes(link = {}, {
  href = link.href,
  className = "",
  title = link.title,
  target = link.target,
  ariaLabel = link.ariaLabel,
} = {}) {
  const attributes = [`href="${escapeHtml(href)}"`];

  if (className) {
    attributes.push(`class="${escapeHtml(className)}"`);
  }

  if (title) {
    attributes.push(`title="${escapeHtml(title)}"`);
  }

  const shouldDownload = isDownloadAction({
    ...link,
    href,
    title,
    target,
    ariaLabel,
  });

  if (!shouldDownload && target) {
    attributes.push(`target="${escapeHtml(target)}"`);
    if (target === "_blank") {
      attributes.push(`rel="noopener noreferrer"`);
    }
  }

  if (ariaLabel) {
    attributes.push(`aria-label="${escapeHtml(ariaLabel)}"`);
  }

  if (shouldDownload) {
    const downloadValue = typeof link.download === "string" ? link.download.trim() : "";
    attributes.push(downloadValue ? `download="${escapeHtml(downloadValue)}"` : "download");
  }

  return ` ${attributes.join(" ")}`;
}

function normalizeContentText(value) {
  return value
    .replace(/I(?:-|‑|&#8209;)CAR/g, "I&#8209;CAR")
    .replace(/Gold(?:\s|&nbsp;)Class/g, "Gold&nbsp;Class");
}

function applyWidowProtection(value) {
  const words = value.trim().split(/\s+/);

  if (words.length <= 5) {
    return value;
  }

  return value.replace(/\s+([^\s]+)\s*$/, "&nbsp;$1");
}

function renderText(value, { widowProtection = false } = {}) {
  const escapedValue = escapeHtml(value);
  const restoredValue = restoreEncodedEntities(escapedValue);
  const normalizedValue = normalizeContentText(restoredValue);
  return widowProtection ? applyWidowProtection(normalizedValue) : normalizedValue;
}

function renderLiteralText(value, { widowProtection = false } = {}) {
  const escapedValue = escapeHtml(value);
  const restoredValue = restoreEncodedEntities(escapedValue);
  return widowProtection ? applyWidowProtection(restoredValue) : restoredValue;
}

function normalizeHtmlBlocks(blocks) {
  if (!blocks) {
    return [];
  }

  return (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean);
}

function renderTrustedHtml(value, { normalizeText = true } = {}) {
  const normalizedValue = normalizeText ? normalizeContentText(value) : value;
  return normalizeImageAssetUrlsInHtml(normalizedValue);
}

function normalizeEmbedHtml(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (match, quote, styleSource) => {
    const declarations = styleSource
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean);
    const filteredDeclarations = declarations.filter((declaration) => {
      const property = declaration.split(":")[0]?.trim().toLowerCase();
      return property !== "width" && property !== "max-width";
    });

    return ` style=${quote}${["width: 100%", ...filteredDeclarations].join("; ")};${quote}`;
  });
}

function extractIframeSrcFromHtml(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const iframeMatch = value.match(/<iframe\b[^>]*\bsrc=(["'])(.*?)\1/i);
  return iframeMatch?.[2]?.trim() || "";
}

function renderIframeEmbedPlaceholder({ src = "", title = "" } = {}) {
  if (!src) {
    return "";
  }

  const embedTitle = title || "Embedded video";

  return `                        <div class="mx-auto mt-3 pt-3" data-runtime-iframe-embed data-iframe-src="${escapeHtml(src)}" data-iframe-title="${escapeHtml(embedTitle)}" style="width: 100%; position: relative; display: block;">
                            <div style="width: 100%; padding-top: 56.25%;"></div>
                        </div>`;
}

function renderParagraphs(paragraphs, className = "") {
  return paragraphs
    .map((paragraph) => {
      const classAttribute = className ? ` class="${className}"` : "";
      return `                <p${classAttribute}>${renderText(paragraph, { widowProtection: true })}</p>`;
    })
    .join("\n\n");
}

function normalizeParagraphList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.length > 0);
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

function getParagraphs(content = {}) {
  return normalizeParagraphList(content.paragraphs ?? content.body);
}

function getHtmlParagraphs(content = {}) {
  return normalizeParagraphList(content.paragraphsHtml ?? content.bodyHtml);
}

function hasParagraphContent(content = {}) {
  return getParagraphs(content).length > 0 || getHtmlParagraphs(content).length > 0;
}

function renderParagraphContent(content = {}, className = "") {
  return renderContentParagraphs(getParagraphs(content), getHtmlParagraphs(content), className);
}

function renderContentParagraphs(paragraphs = [], htmlParagraphs = [], className = "") {
  const classAttribute = className ? ` class="${className}"` : "";
  const plainMarkup = paragraphs.map(
    (paragraph) => `                <p${classAttribute}>${renderText(paragraph, { widowProtection: true })}</p>`,
  );
  const htmlMarkup = htmlParagraphs.map(
    (paragraph) => `                <p${classAttribute}>${renderTrustedHtml(paragraph)}</p>`,
  );

  return [...plainMarkup, ...htmlMarkup].join("\n\n");
}

function renderTypedInlineLinkParagraph(paragraph = {}) {
  return (paragraph.segments || []).map((segment) => segment.type === "link"
    ? `<a href="${escapeHtml(segment.href)}">${renderText(segment.label)}</a>`
    : renderText(segment.text || "")).join("");
}

function renderTypedInlineLinkParagraphs(paragraphs = [], className = "") {
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  return paragraphs.map((paragraph) => `                <p${classAttribute}>${renderTypedInlineLinkParagraph(paragraph)}</p>`).join("\n\n");
}

function renderTypedSegmentItem(item = {}) {
  return (item.segments || []).map((segment) => segment.type === "link"
    ? `<a${renderAnchorAttributes({ href: segment.href })}>${renderText(segment.label)}</a>`
    : renderText(segment.text || "")).join("");
}

function renderTypedMedia(media = {}, { className = "ic-video ic-rounded", context = "typed media" } = {}) {
  if (!media || typeof media !== "object") return "";
  const attributes = [
    `class="${escapeHtml(className)}"`,
    `src="${escapeHtml(media.src)}"`,
    `title="${escapeHtml(media.title)}"`,
    `width="${escapeHtml(String(media.width))}"`,
    `height="${escapeHtml(String(media.height))}"`,
    `loading="${escapeHtml(media.loading || "lazy")}"`,
    `referrerpolicy="${escapeHtml(media.referrerPolicy || "strict-origin-when-cross-origin")}"`,
  ];
  if (Array.isArray(media.allow) && media.allow.length) attributes.push(`allow="${escapeHtml(media.allow.join("; "))}"`);
  if (media.fullscreen === true) attributes.push("allowfullscreen");
  if (media.aspectRatio !== undefined) attributes.push(`style="aspect-ratio:${escapeHtml(String(media.aspectRatio))}"`);
  const iframe = `<iframe ${attributes.join(" ")}></iframe>`;
  if (!media.link) return iframe;
  return `<a${renderAnchorAttributes(media.link, { title: media.link.title || media.link.label })} aria-label="${escapeHtml(media.link.label)}">${iframe}</a>`;
}

export function renderCourseUpdatesInlineLinksProof() {
  return {
    hero: renderHeroSection({ id: "proof-course-hero", type: "hero", title: "Proof", inlineLinkParagraphs: [{ segments: [{ type: "text", text: "Read < " }, { type: "link", label: "Industry Knowledge & Skills Protocol", href: "https://www.i-car.com/knowledge-skill-protocol-overview" }, { type: "text", text: " & apply." }] }], image: { desktopSrc: "/proof.webp", alt: "Proof", width: "800", height: "600" } }),
    accordion: renderAccordionSection({ id: "proof-course-faq", type: "accordion", heading: "FAQ", items: [{ heading: "One", inlineLinkParagraphs: [{ segments: [{ type: "text", text: "Browse " }, { type: "link", label: "Full Course Catalog", href: "https://www.i-car.com/browse" }, { type: "text", text: " or \"visit\" " }, { type: "link", label: "MyLearning", href: "https://www.i-car.com/my-learning" }] }] }] }),
  };
}

function renderInlineMarkdownLinks(value = "", { widowProtection = false, getLinkAttributes = null } = {}) {
  const parts = [];
  const source = String(value ?? "");
  const linkPattern = /\[([^\]]+)]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(source)) !== null) {
    const before = source.slice(lastIndex, match.index);

    if (before) {
      parts.push(renderLiteralText(before));
    }

    const href = match[2];
    const extraAttributes = typeof getLinkAttributes === "function" ? getLinkAttributes(href, match[1]) : "";
    parts.push(`<a href="${escapeHtml(href)}"${extraAttributes}>${renderText(match[1])}</a>`);
    lastIndex = match.index + match[0].length;
  }

  const after = source.slice(lastIndex);

  if (after) {
    parts.push(renderLiteralText(after));
  }

  const markup = parts.join("");
  return widowProtection ? applyWidowProtection(markup) : markup;
}

function getCardParagraphLinkAttributes(href) {
  return href.startsWith("https://") || href.startsWith("http://") ? ' target="_blank" rel="noopener noreferrer"' : "";
}

function renderCardBodyParagraphs(card, className = "ic-card-text") {
  const classAttribute = className ? ` class="${className}"` : "";
  const plainMarkup = getParagraphs(card).map(
    (paragraph) =>
      `                <p${classAttribute}>${normalizeContentText(renderInlineMarkdownLinks(paragraph, { widowProtection: true, getLinkAttributes: getCardParagraphLinkAttributes }))}</p>`,
  );
  const htmlMarkup = getHtmlParagraphs(card).map(
    (paragraph) => `                <p${classAttribute}>${renderTrustedHtml(paragraph)}</p>`,
  );
  return [...plainMarkup, ...htmlMarkup].join("\n\n");
}

function buildResponsiveSrcset(entries = []) {
  return entries
    .filter((entry) => typeof entry?.url === "string" && entry.url.length > 0 && entry.width)
    .map((entry) => `${normalizeImageAssetUrl(entry.url)} ${entry.width}w`)
    .join(", ");
}

function getFixedImageEntries(image = {}, device = "desktop") {
  const nestedEntries = Object.entries(image.urls?.[device] || {})
    .map(([key, url]) => {
      const match = key.match(/^(\d+)w$/);
      return match && typeof url === "string" && url.length > 0
        ? { width: Number.parseInt(match[1], 10), url }
        : null;
    })
    .filter(Boolean);
  const legacyEntries = [70, 100, 140, 175, 200, 350, 400, 800, 1600, 3200]
    .map((width) => {
      const url = getImageUrl(image, device, width);
      return url ? { width, url } : null;
    })
    .filter(Boolean);

  return [...nestedEntries, ...legacyEntries]
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.width === entry.width) === index)
    .sort((left, right) => left.width - right.width);
}

function getImageUrl(image = {}, device, width) {
  const nestedUrl = image.urls?.[device]?.[`${width}w`];

  if (typeof nestedUrl === "string" && nestedUrl.length > 0) {
    return normalizeImageAssetUrl(nestedUrl);
  }

  const flatUrl = image[`${device}${width}w`];

  if (typeof flatUrl === "string" && flatUrl.length > 0) {
    return normalizeImageAssetUrl(flatUrl);
  }

  return "";
}

function getImageHeight(image = {}, device) {
  if (typeof image.height === "string" && image.height.length > 0) {
    return image.height;
  }

  if (typeof image.height === "number") {
    return String(image.height);
  }

  const nestedHeight = image.height?.[device];

  if (typeof nestedHeight === "string" && nestedHeight.length > 0) {
    return nestedHeight;
  }

  if (typeof nestedHeight === "number") {
    return String(nestedHeight);
  }

  const legacyHeight = image[`${device}Height`];

  if (typeof legacyHeight === "string" && legacyHeight.length > 0) {
    return legacyHeight;
  }

  if (typeof legacyHeight === "number") {
    return String(legacyHeight);
  }

  return "";
}

function imageHasDeviceUrls(image = {}, device) {
  return getFixedImageEntries(image, device).length > 0;
}

function validateImageAlt(image = {}, context = "image") {
  if (image.decorative === true) {
    return;
  }

  if (typeof image.alt !== "string" || image.alt.trim().length === 0) {
    throw new Error(`Missing required alt text for ${context}`);
  }
}

function validateImageHeight(image = {}, context = "image", { requireMobileHeight = false } = {}) {
  const desktopHeight = getImageHeight(image, "desktop");
  const mobileHeight = getImageHeight(image, "mobile");

  if (!desktopHeight) {
    throw new Error(`Missing required desktop height for ${context}`);
  }

  if (requireMobileHeight && !mobileHeight) {
    throw new Error(`Missing required mobile height for ${context}`);
  }
}

function validateResponsiveImage(image = {}, context = "image") {
  validateImageAlt(image, context);
  validateImageHeight(image, context, { requireMobileHeight: imageHasDeviceUrls(image, "mobile") });
  if (Array.isArray(image.sources)) {
    image.sources.forEach((s, i) => {
      if (s.maxWidth === undefined || s.maxWidth === null) {
        throw new Error(`${context}: sources[${i}] is missing required field 'maxWidth'`);
      }
      if (!s.srcset) {
        throw new Error(`${context}: sources[${i}] is missing required field 'srcset'`);
      }
      if (!s.width) {
        throw new Error(`${context}: sources[${i}] is missing required field 'width'`);
      }
      if (!s.height) {
        throw new Error(`${context}: sources[${i}] is missing required field 'height'`);
      }
    });
  }
}

function validateFixedImage(image = {}, context = "image") {
  validateImageAlt(image, context);
  validateImageHeight(image, context);
}

function resolveResponsiveImageConfig(image = {}, preset = "textMedia", defaultLoading = "lazy") {
  const singleSource = image.singleSource === true;
  const hasStructuredUrls = Boolean(
    image.urls?.mobile?.["400w"]
    || image.urls?.mobile?.["800w"]
    || image.urls?.mobile?.["1600w"]
    || image.urls?.desktop?.["400w"]
    || image.urls?.desktop?.["800w"]
    || image.urls?.desktop?.["1600w"]
    || image.urls?.desktop?.["3200w"]
    || image.mobile400w
    || image.mobile800w
    || image.mobile1600w
    || image.desktop400w
    || image.desktop800w
    || image.desktop1600w
    || image.desktop3200w
  );

  if (!hasStructuredUrls) {
    return {
      mobileSrcset: singleSource ? "" : normalizeImageAssetSrcsetValue(image.mobileSrcset || ""),
      sourceWidth: image.output?.sourceWidth || image.width || "800",
      sourceHeight: image.output?.sourceHeight || image.height || "450",
      desktopSrc: normalizeImageAssetUrl(image.desktopSrc || ""),
      desktopSrcset: singleSource ? "" : normalizeImageAssetSrcsetValue(image.desktopSrcset || image.desktopSrc || ""),
      imgWidth: image.output?.imgWidth || image.width || "",
      imgHeight: image.output?.imgHeight || image.height || "",
      sizes: image.output?.sizes || image.sizes || "",
      loading: image.output?.loading || image.loading || defaultLoading,
      includeSrcset: !singleSource,
    };
  }

  const presetConfig = {
    banner: {
      mobileWidths: [400, 800, 1600],
      desktopWidths: [800, 1600, 3200],
      defaultSizes: "(max-width: 1024px) 800px, 1600px",
      sourceWidth: "800",
      imgWidth: "3200",
      srcKey: "desktop3200w",
    },
    textMedia: {
      mobileWidths: [400, 800, 1600],
      desktopWidths: [400, 800, 1600],
      defaultSizes: "800px",
      sourceWidth: "800",
      imgWidth: "1600",
      srcKey: "desktop1600w",
    },
    card: {
      mobileWidths: [400, 800, 1600],
      desktopWidths: [400, 800, 1600],
      defaultSizes: "(max-width: 768px) 100vw, 33vw",
      sourceWidth: "800",
      imgWidth: "1600",
      srcKey: "desktop1600w",
    },
  }[preset] || {
    mobileWidths: [400, 800, 1600],
    desktopWidths: [400, 800, 1600],
    defaultSizes: "800px",
    sourceWidth: "800",
    imgWidth: "1600",
    srcKey: "desktop1600w",
  };

  const preferredSourceWidth = String(image.output?.sourceWidth || presetConfig.sourceWidth);
  const preferredImgWidth = String(image.output?.imgWidth || presetConfig.imgWidth);
  const preferredSrcWidth = Number.parseInt(
    String(image.output?.srcWidth || presetConfig.srcKey.replace(/\D+/g, "")),
    10,
  );
  const mobileEntries = getFixedImageEntries(image, "mobile");
  const desktopEntries = getFixedImageEntries(image, "desktop");

  const mobileSrcset = mobileEntries.length
    ? buildResponsiveSrcset(mobileEntries)
    : buildResponsiveSrcset(
      presetConfig.mobileWidths.map((width) => ({
        width,
        url: getImageUrl(image, "mobile", width),
      })),
    );
  const desktopSrcset = desktopEntries.length
    ? buildResponsiveSrcset(desktopEntries)
    : buildResponsiveSrcset(
      presetConfig.desktopWidths.map((width) => ({
        width,
        url: getImageUrl(image, "desktop", width),
      })),
    );
  const preferredDesktopEntry = desktopEntries.find((entry) => entry.width === preferredSrcWidth)
    || desktopEntries[desktopEntries.length - 1]
    || null;
  const desktopSrc = preferredDesktopEntry?.url
    || getImageUrl(image, "desktop", preferredSrcWidth)
    || getImageUrl(image, "desktop", 1600)
    || getImageUrl(image, "desktop", 800)
    || getImageUrl(image, "desktop", 400)
    || "";

  return {
    mobileSrcset: singleSource ? "" : mobileSrcset,
    sourceWidth: preferredSourceWidth,
    sourceHeight: getImageHeight(image, "mobile") || getImageHeight(image, "desktop") || "",
    desktopSrc,
    desktopSrcset: singleSource ? "" : (desktopSrcset || desktopSrc),
    imgWidth: preferredImgWidth,
    imgHeight: getImageHeight(image, "desktop") || getImageHeight(image, "mobile") || "",
    sizes: image.sizes || image.output?.sizes || presetConfig.defaultSizes,
    loading: image.loading || image.output?.loading || defaultLoading,
    includeSrcset: !singleSource,
  };
}

function resolveFixedImageConfig(image = {}, defaults = {}) {
  const singleSource = image.singleSource === true;
  const desktopEntries = getFixedImageEntries(image, "desktop");

  if (!desktopEntries.length) {
    const src = normalizeImageAssetUrl(image.desktopSrc || image.src || "");
    return {
      src,
      srcset: singleSource ? "" : normalizeImageAssetSrcsetValue(image.desktopSrcset || image.srcset || src),
      width: image.width || defaults.width || "",
      height: getImageHeight(image, "desktop") || image.height || defaults.height || "",
      sizes: image.sizes || defaults.sizes || "",
      loading: image.loading || defaults.loading || "lazy",
      includeSrcset: !singleSource,
    };
  }

  const preferredSrcWidth = Number.parseInt(String(image.output?.srcWidth || defaults.srcWidth || ""), 10);
  const preferredEntry = Number.isNaN(preferredSrcWidth)
    ? null
    : desktopEntries.find((entry) => entry.width === preferredSrcWidth);
  const largest = desktopEntries[desktopEntries.length - 1];
  const srcEntry = preferredEntry || largest;

  return {
    src: srcEntry.url,
    srcset: singleSource ? "" : buildResponsiveSrcset(desktopEntries),
    width: String(image.width || defaults.width || largest.width),
    height: getImageHeight(image, "desktop") || defaults.height || "",
    sizes: image.sizes || defaults.sizes || "",
    loading: defaults.loading || "lazy",
    includeSrcset: !singleSource,
  };
}

function renderImg(image, imageClassName = "", defaults = {}) {
  validateFixedImage(image, defaults.context || "image");
  const config = resolveFixedImageConfig(image, defaults);
  const sizesAttribute = config.sizes ? ` sizes="${escapeHtml(config.sizes)}"` : "";
  const srcsetAttribute = config.includeSrcset ? ` srcset="${escapeHtml(config.srcset)}"` : "";
  return `<img alt="${escapeHtml(image.alt || "")}" loading="${escapeHtml(config.loading)}"${imageClassName ? ` class="${escapeHtml(imageClassName)}"` : ""} width="${escapeHtml(config.width)}" height="${escapeHtml(config.height)}"${sizesAttribute} src="${escapeHtml(config.src)}"${srcsetAttribute}>`;
}

function resolveButtonClassName(button = {}, defaultClassName = "ic-btn ic-btn-primary") {
  if (button.className) {
    return button.className;
  }

  const variantClassName = {
    primary: "ic-btn ic-btn-primary",
    outline: "ic-btn ic-btn-primary ic-btn-outline",
    white: "ic-btn ic-btn-white",
    gray: "ic-btn ic-btn-gray",
  }[button.variant || ""];

  return variantClassName || defaultClassName;
}

function renderButtons(buttons, defaultClassName = "ic-btn ic-btn-primary") {
  if (!buttons?.length) {
    return "";
  }

  const buttonMarkup = buttons
    .map((button) => {
      const className = resolveButtonClassName(button, defaultClassName);
      return `                    <a${renderAnchorAttributes(button, { className })}>${renderText(button.label)}</a>`;
    })
    .join("\n");

  return `                <p>\n${buttonMarkup}\n                </p>`;
}

function renderActionLinks(buttons, {
  stack = false,
  linkClassName = "",
  wrapperClassName = "",
} = {}) {
  if (!buttons?.length) {
    return "";
  }

  if (stack) {
    const itemsMarkup = buttons
      .map((button, index) => {
        const paragraphClassName = index === buttons.length - 1 ? "mb-0" : "mb-2";

        return `                    <p class="${paragraphClassName}">
                        <a${renderAnchorAttributes(button, { className: linkClassName })}>${renderText(button.label)}</a>
                    </p>`;
      })
      .join("\n\n");

    if (wrapperClassName) {
      return `                <div class="${escapeHtml(wrapperClassName)}">
${itemsMarkup}
                </div>`;
    }

    return itemsMarkup;
  }

  const inlineLinksMarkup = buttons
    .map((button) => {
      return `                    <a${renderAnchorAttributes(button, { className: linkClassName })}>${renderText(button.label)}</a>`;
    })
    .join("\n");

  return `                <p>\n${inlineLinksMarkup}\n                </p>`;
}

function renderFooterButtonRow(
  buttons,
  defaultClassName = "ic-btn ic-btn-primary ic-btn-outline",
  columnClassName = "col col-auto",
) {
  const buttonsMarkup = renderButtons(buttons, defaultClassName);

  if (!buttonsMarkup) {
    return "";
  }

  return `                <div class="row justify-content-center mt-3 pt-3">
                    <div class="${escapeHtml(columnClassName)}">
${indentBlock(buttonsMarkup, 24)}
                    </div>
                </div>`;
}

function renderFooterLinkRow(links, className = "ic-menu mt-3", columnClassName = "col") {
  const linksMarkup = renderLinkList(links, className);

  if (!linksMarkup) {
    return "";
  }

  return `                <div class="row justify-content-center mt-3 pt-3">
                    <div class="${escapeHtml(columnClassName)}">
${indentBlock(linksMarkup, 24)}
                    </div>
                </div>`;
}

function resolveLinkListClassName(linkGroup, defaultClassName = "ic-menu mt-3") {
  if (!linkGroup || Array.isArray(linkGroup)) {
    return defaultClassName;
  }

  const spacing = typeof linkGroup.spacing === "string" ? linkGroup.spacing.trim().toLowerCase() : "";
  const layout = typeof linkGroup.layout === "string" ? linkGroup.layout.trim().toLowerCase() : "";
  const align = typeof linkGroup.align === "string" ? linkGroup.align.trim().toLowerCase() : "";

  if (spacing === "compact") {
    return "ic-menu mt-0";
  }

  if (layout === "horizontal") {
    return align === "center"
      ? "ic-menu ic-menu-horizontal ic-menu-center"
      : "ic-menu ic-menu-horizontal";
  }

  if (align === "center") {
    return "ic-menu mt-3 ic-menu-align-center";
  }

  return defaultClassName;
}

function renderLinkList(links = [], className = "ic-menu mt-3") {
  if (!links.length) {
    return "";
  }

  const items = links
    .map(
      (link) =>
        `                                    <li><a${renderAnchorAttributes(link)}>${renderText(link.label)}</a></li>`,
    )
    .join("\n");

  return `                                <ul class="${escapeHtml(className)}">
${items}
                                </ul>`;
}

function getSectionHeadingTag(section = {}, defaultTag = "h2") {
  return /^(h1|h2|h3|h4|h5|h6|p)$/i.test(section.headingTag || "")
    ? section.headingTag.toLowerCase()
    : defaultTag;
}

function renderSectionHeading(section = {}, defaultTag = "h2", defaultClassName = "ic-section-title") {
  const heading = getSectionHeading(section);

  if (!heading) {
    return "";
  }

  const headingTag = getSectionHeadingTag(section, defaultTag);
  const headingStyle = section.headingStyle || "sectionTitle";
  const className = headingStyle === "plain"
    ? (section.titleClassName || "")
    : (section.titleClassName || defaultClassName);
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";

  return `<${headingTag}${classAttribute}>${renderText(heading)}</${headingTag}>`;
}

function indentBlock(block, spaces) {
  const prefix = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function renderPicture(image, imageClassName = "", defaultLoading = "lazy", preset = "textMedia", context = "image") {
  if (!image) {
    return "";
  }

  validateResponsiveImage(image, context);
  const config = resolveResponsiveImageConfig(image, preset, defaultLoading);
  let sourceMarkup = "";
  if (image.sources && Array.isArray(image.sources) && image.sources.length > 0) {
    // Art-directed multi-source: narrowest first, each with explicit media query.
    sourceMarkup = image.sources.map((s) => {
      const sizesAttr = s.sizes ? ` sizes="${escapeHtml(s.sizes)}"` : "";
      return `\n                                <source media="(max-width: ${escapeHtml(String(s.maxWidth))}px)" width="${escapeHtml(String(s.width))}" height="${escapeHtml(String(s.height))}"${sizesAttr} srcset="${escapeHtml(s.srcset)}">`;
    }).join("");
  } else if (config.mobileSrcset) {
    sourceMarkup = `\n                                <source media="(max-width: 768px)" width="${escapeHtml(config.sourceWidth)}" height="${escapeHtml(config.sourceHeight)}" sizes="${escapeHtml(config.sizes)}" srcset="${escapeHtml(config.mobileSrcset)}">`;
  }
  const classAttribute = imageClassName ? ` class="${escapeHtml(imageClassName)}"` : "";
  const sizesAttribute = config.sizes ? ` sizes="${escapeHtml(config.sizes)}"` : "";
  const srcsetAttribute = config.includeSrcset ? ` srcset="${escapeHtml(config.desktopSrcset)}"` : "";

  return `<picture>${sourceMarkup}
                                <img alt="${escapeHtml(image.alt || "")}" loading="${escapeHtml(config.loading)}"${classAttribute} width="${escapeHtml(config.imgWidth)}" height="${escapeHtml(config.imgHeight)}"${sizesAttribute} src="${escapeHtml(config.desktopSrc)}"${srcsetAttribute}>
                            </picture>`;
}

const iconSvgMap = {
  askICar: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M10.5 7.84668H49.5C53.075 7.84668 56 10.7717 56 14.3467V40.3467C56 43.9217 53.075 46.8467 49.5 46.8467H24.8L14.9506 53.882C13.9947 54.5648 12.6667 53.8814 12.6667 52.7065V46.8467H10.5C6.925 46.8467 4 43.9217 4 40.3467V14.3467C4 10.7717 6.925 7.84668 10.5 7.84668Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M27.0248 32.2439C27.0248 28.5051 29.156 27.1378 31.1257 25.8518C32.8145 24.7256 34.3823 23.7214 34.3823 21.349C34.3823 18.6559 32.5327 17.0873 29.8794 17.0873C27.3472 17.0873 25.3369 18.6559 25.3369 21.4293V21.7508H21.7588V21.3092C21.7588 16.5652 25.2565 13.5498 30.0004 13.5498C34.7842 13.5498 38.2412 16.4849 38.2412 21.3092C38.2412 25.5303 35.8697 26.8967 33.779 28.1429C32.0902 29.1481 30.5631 30.0729 30.5631 32.2439V32.7262H27.0248V32.2439ZM26.221 38.2341C26.221 36.7061 27.3471 35.5808 28.8743 35.5808C30.4023 35.5808 31.5276 36.7061 31.5276 38.2341C31.5276 39.7613 30.4023 40.8874 28.8743 40.8874C27.3471 40.8874 26.221 39.7613 26.221 38.2341Z" fill="#333538" />
  </svg>`,
  repairersRealm: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M24.7234 42.3714C24.4098 42.3714 24.0963 42.2884 23.8192 42.1253C23.275 41.8033 22.9417 41.2196 22.9417 40.5882V27.2436C22.9417 26.6136 23.275 26.0286 23.8192 25.7108C24.3578 25.3957 25.0342 25.3803 25.5842 25.684L37.7052 32.357C38.2762 32.6692 38.6292 33.2654 38.6292 33.918C38.6292 34.5676 38.2762 35.164 37.7052 35.4747L25.5842 42.1492C25.3142 42.2982 25.0188 42.3714 24.7234 42.3714Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M42.585 8.42432H51.7754C54.1099 8.42432 56 10.3173 56 12.6476V47.3527C56 49.6857 54.1099 51.5758 51.7754 51.5758H8.22458C5.89009 51.5758 4 49.6857 4 47.3527V12.6476C4 10.3173 5.89009 8.42432 8.22458 8.42432H42.585Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M4 18.2278H56" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="49.597" cy="13.5293" r="1.5" fill="#333538" />
    <circle cx="42.7637" cy="13.5293" r="1.5" fill="#333538" />
  </svg>`,
  justInTime: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M30 57C42.4264 57 52.5 46.9264 52.5 34.5C52.5 22.0736 42.4264 12 30 12C17.5736 12 7.5 22.0736 7.5 34.5C7.5 46.9264 17.5736 57 30 57Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 51.8571C39.586 51.8571 47.3571 44.086 47.3571 34.5C47.3571 24.9139 39.586 17.1428 30 17.1428C20.4139 17.1428 12.6428 24.9139 12.6428 34.5C12.6428 44.086 20.4139 51.8571 30 51.8571Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M47.2803 12.4153C47.2764 12.4114 47.2705 12.4114 47.2666 12.4153C47.2627 12.4192 48.3012 13.4635 48.3051 13.4674L49.662 14.8243L45.9028 18.5835C45.8989 18.5874 45.8989 18.5933 45.9028 18.5972C45.9048 18.5991 45.9072 18.6001 45.9097 18.6001C45.9121 18.6001 45.9146 18.5991 45.9165 18.5972L49.6757 14.838L52.0711 17.2334C52.073 17.2354 52.0755 17.2363 52.0779 17.2363C52.0803 17.2363 52.0828 17.2354 52.0847 17.2334C52.0887 17.2295 52.0887 17.2237 52.0847 17.2197L47.2803 12.4153Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M12.7334 12.429C12.7373 12.425 12.7373 12.4192 12.7334 12.4153C12.7295 12.4114 12.7237 12.4114 12.7198 12.4153L7.91529 17.2198C7.91138 17.2237 7.91138 17.2295 7.91529 17.2334C7.91725 17.2354 7.91969 17.2364 7.92213 17.2364C7.92457 17.2364 7.92701 17.2354 7.92897 17.2334L10.3244 14.838L14.0835 18.5972C14.0855 18.5992 14.0879 18.6001 14.0904 18.6001C14.0928 18.6001 14.0952 18.5992 14.0972 18.5972C14.1011 18.5933 14.1011 18.5874 14.0972 18.5835L10.338 14.8244L12.7334 12.429Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M32.5714 8.14282H27.4286V12H32.5714V8.14282Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M34.5 3H25.5C25.145 3 24.8572 3.28781 24.8572 3.64285V7.5C24.8572 7.85504 25.145 8.14285 25.5 8.14285H34.5C34.8551 8.14285 35.1429 7.85504 35.1429 7.5V3.64285C35.1429 3.28781 34.8551 3 34.5 3Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M28.1816 36.3281C28.1792 36.3281 28.1768 36.3272 28.1748 36.3252C28.1709 36.3213 28.1709 36.3154 28.1748 36.3115L37.7207 26.7656C37.7246 26.7617 37.7305 26.7617 37.7344 26.7656C37.7383 26.7695 37.7383 26.7754 37.7344 26.7793L28.1885 36.3252C28.1865 36.3272 28.1841 36.3281 28.1816 36.3281Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M31.8184 36.3281C31.8159 36.3281 31.8135 36.3272 31.8115 36.3252L24.9927 29.5063C24.9888 29.5025 24.9888 29.4966 24.9927 29.4927C24.9966 29.4888 25.0024 29.4888 25.0063 29.4927L31.8252 36.3115C31.8291 36.3154 31.8291 36.3213 31.8252 36.3252C31.8232 36.3272 31.8208 36.3281 31.8184 36.3281Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  adasNews: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M57.5 45.5564V50.3767C57.5 51.5767 56.483 52.5568 55.2377 52.5568H4.77264C3.51696 52.5568 2.5 51.5767 2.5 50.3667V45.5564H20.7019C20.9198 46.6965 21.9472 47.5565 23.1924 47.5565H36.8075C38.0528 47.5565 39.0802 46.6965 39.2981 45.5564H57.5Z" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M14.5519 10.0098H5.05188V44.5564" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M45.4481 10.0098H54.9481V44.5565" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M32.75 36.9312V39.9117C32.75 40.4417 32.3164 40.8753 31.7864 40.8753H28.2136C27.6837 40.8753 27.25 40.4417 27.25 39.9117V36.9312" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M36.8762 27.8914C38.2257 26.2905 39.0263 24.2117 38.9878 21.9452C38.9082 17.2459 35.0645 13.3069 30.3682 13.1194C25.236 12.9145 21.0109 17.0144 21.0109 22.1012C21.0109 24.3058 21.8046 26.3251 23.1217 27.8888C23.92 28.8366 24.4255 29.9947 24.5358 31.2289L24.8839 35.1245C24.9752 36.1473 25.8322 36.9311 26.8591 36.9311H33.141C34.1679 36.9311 35.0249 36.1472 35.1162 35.1245L35.4748 31.1111C35.5817 29.9146 36.102 28.8098 36.8762 27.8914Z" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M24.3448 32.2505H34.9554" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M39.6624 13.2808L41.3467 11.5964" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M33.5367 9.74397L34.1533 7.44312" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M26.4633 9.74397L25.8468 7.44312" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M20.3375 13.2808L18.6532 11.5964" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M16.8008 19.4066L14.5 18.79" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M16.8008 26.4797L14.5 27.0962" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M20.3375 32.6055L18.6532 34.2898" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M39.6624 32.6055L41.3467 34.2898" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M43.1991 26.4797L45.5 27.0962" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M43.1991 19.4066L45.5 18.79" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M28.2184 17.1428C28.2184 17.1428 24.8302 18.1128 24.8302 22.5564" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  totalCompensation: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M56.6399 16.3301H3.35986V23.0401H56.6399V16.3301Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M55.49 9.62012H4.52002V16.3301H55.49V9.62012Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M57.7997 23.04H2.19971V50.37H57.7997V23.04Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M46.3395 36.71H44.0195" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M15.9797 36.71H13.6597" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M25.8198 39.5503C25.8198 41.1203 27.0898 42.3903 28.6598 42.3903H31.3398C32.9098 42.3903 34.1798 41.1203 34.1798 39.5503C34.1798 37.9803 32.9098 36.7103 31.3398 36.7103H28.6598C27.0898 36.7103 25.8198 35.4403 25.8198 33.8703C25.8198 32.3003 27.0898 31.0303 28.6598 31.0303H31.3398C32.9098 31.0303 34.1798 32.3003 34.1798 33.8703" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M30 31.0301V27.8701" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M30 45.4901V42.3901" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M49.0103 23.04C49.0103 27.89 52.9503 31.83 57.8003 31.83V23.04H49.0103Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M57.8003 41.5898C52.9403 41.5898 49.0103 45.5298 49.0103 50.3798H57.8003V41.5898Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M10.9897 50.3798C10.9897 45.5298 7.04971 41.5898 2.19971 41.5898V50.3798H10.9897Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M2.19971 31.83C7.05971 31.83 10.9897 27.89 10.9897 23.04H2.19971V31.83Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
  </svg>`,
  hybridFlexibleWork: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M9.93006 55V29.85H2.31006L30.0001 5L57.6901 29.85H50.0701V55H9.93006Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M8.31055 24.47V9.95996H16.8405V16.81" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M43.4 37.5796V47.6796H16.6V37.5796" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M28.5403 40.58H21.9003C19.6503 40.58 17.6803 39.38 16.5903 37.58C16.0303 36.65 15.7103 35.55 15.7103 34.39V27.46H44.2803V34.39C44.2803 35.56 43.9603 36.65 43.3903 37.58C42.3103 39.38 40.3403 40.58 38.0803 40.58H31.4403" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30.6599 38.04H29.3399C28.8981 38.04 28.5399 38.3982 28.5399 38.84V42.36C28.5399 42.8019 28.8981 43.16 29.3399 43.16H30.6599C31.1017 43.16 31.4599 42.8019 31.4599 42.36V38.84C31.4599 38.3982 31.1017 38.04 30.6599 38.04Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M25.1903 27.4498C25.3003 24.8898 27.4103 22.8398 30.0003 22.8398C32.5903 22.8398 34.7003 24.8898 34.8103 27.4498" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  timeOff: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M22.64 26.5599C22.64 23.7099 25.26 21.3999 28.48 21.3999C31.7 21.3999 34.33 23.7099 34.33 26.5599C34.33 23.7099 36.95 21.3999 40.17 21.3999C43.39 21.3999 46.02 23.7099 46.02 26.5599C46.02 23.7099 48.64 21.3999 51.86 21.3999C55.08 21.3999 57.71 23.7099 57.71 26.5599H57.95C57.98 26.1299 58 25.6799 58 25.2299C58 13.6999 47.4 4.35986 34.33 4.35986C21.26 4.35986 10.67 13.6999 10.67 25.2299C10.67 25.6799 10.69 26.1299 10.72 26.5699H10.96C10.96 23.7099 13.58 21.3999 16.8 21.3999C20.02 21.3999 22.65 23.7099 22.65 26.5599C22.65 26.5599 19.31 12.2099 34.34 4.79986V26.5599" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M46.02 26.5598C46.02 26.5598 49.36 12.2098 34.33 4.7998" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M34.33 1.50977V45.9398" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M55.3399 51.8298H17.3399C15.2199 51.8298 13.2399 50.7298 12.1199 48.9298L2.38995 33.2498C1.61995 31.9998 1.99995 30.3598 3.24995 29.5898C4.49995 28.8198 6.13995 29.1998 6.90995 30.4498L16.6399 46.1298C16.7899 46.3698 17.0499 46.5198 17.3399 46.5198H55.3399C56.8099 46.5198 57.9999 47.7098 57.9999 49.1798C57.9999 50.6498 56.8099 51.8398 55.3399 51.8398V51.8298Z" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M34.3 51.8301V58.4901" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14.34 51.6099L10.6 58.4899" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M54.39 51.8501L58 58.4901" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  healthBenefits: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M5.26997 27.63C2.98997 24.75 1.83997 20.93 2.46997 16.85C3.39997 10.8 8.40997 6.00002 14.49 5.29002C20.84 4.55002 27.65 8.86002 30.01 14.18C32.38 8.86002 39.19 4.55002 45.53 5.29002C51.61 6.00002 56.62 10.8 57.55 16.85C58.18 20.93 57.02 24.75 54.75 27.63L30.01 54.78L5.26997 27.63Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M52.76 30.2H40.98L37.47 37.04L34.29 23.31L28.21 38.41L23.1 19L19.97 30.2H7.84003" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
  </svg>`,
  retirement: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M57.6903 57.6896H2.32031V2.30957" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.31 45.0401L27.31 19.8001L33.75 26.2501L57.69 2.31006" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M11.3897 38.6401V35.8701" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M21.08 38.6398V26.0898" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30.77 38.64V23.27" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M40.47 57.69V19.54" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M50.16 57.6898V9.83984" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.6897 8.26006V2.31006H51.7397" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M11.3895 38.6401V57.6901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M21.0797 38.6401V57.6901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30.77 38.6401V57.6901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  careerDevelopment: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M13.89 23.1201H2.29004" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.61 23.1201H46.01" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M5.70004 26.54L2.29004 23.12L5.70004 19.71" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M54.2 19.71L57.61 23.12L54.2 26.54" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.29004 3.56006L13.89 11.7701" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.89004 7.66984L2.29004 3.55984L6.39004 2.83984" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24.52 58.48H35.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24.52 58.48V35.04" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M35.48 35.04V58.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24.52 24.8099V35.0399H22.94C21.12 35.0399 19.65 32.7499 19.65 31.0999V22.5899C19.65 19.9999 21.77 17.7299 24.81 17.0599C28.92 16.1499 31.06 16.1499 35.17 17.0599C38.22 17.7299 40.33 19.9999 40.33 22.5899V31.0999C40.33 32.7599 38.86 35.0399 37.04 35.0399H35.46V24.8099" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 58.4802V38.7002" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.71 3.56006L46.11 11.7701" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.11 7.66984L57.71 3.55984L53.61 2.83984" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.29004 42.68L13.89 34.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.89004 38.5801L2.29004 42.6801L6.39004 43.4101" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.71 42.68L46.11 34.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.11 38.5801L57.71 42.6801L53.61 43.4101" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 13.1601C32.6509 13.1601 34.7999 11.011 34.7999 8.36006C34.7999 5.70909 32.6509 3.56006 30 3.56006C27.349 3.56006 25.2 5.70909 25.2 8.36006C25.2 11.011 27.349 13.1601 30 13.1601Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  disability: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M31.8791 35.9793H36.7891C38.6891 35.9793 40.2191 34.4393 40.2191 32.5493C40.2191 30.6493 38.6791 29.1193 36.7891 29.1193H29.7891C28.8591 29.1193 28.0491 28.4793 27.8291 27.5693C27.2491 25.1693 25.9991 20.2593 23.2991 17.7093C23.2991 17.7093 19.1691 13.7493 15.2091 17.5793C13.0191 19.9593 13.2891 23.2093 13.9491 26.1393L17.1991 39.8993C17.9391 42.5493 20.3491 44.3793 23.0891 44.3793H37.2291C37.6691 44.3793 38.0691 44.6093 38.2991 44.9893L45.0891 56.3293C46.0791 57.9793 48.2191 58.4893 49.8491 57.4793C51.3791 56.5293 51.9191 54.5493 51.0691 52.9493L43.4391 38.5393C42.5991 36.9593 40.9591 35.9693 39.1691 35.9693H27.3191C26.0891 35.9693 24.9591 35.3093 24.3491 34.2393C24.3491 34.2393 22.4291 31.3793 21.8791 27.2593" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M25.1177 8.73121C26.035 5.84126 24.4359 2.75486 21.5459 1.83756C18.656 0.920258 15.5696 2.51941 14.6523 5.40936C13.735 8.29932 15.3341 11.3857 18.2241 12.303C21.114 13.2203 24.2004 11.6212 25.1177 8.73121Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14.5394 28.6992C8.43943 30.7192 4.03943 36.4692 4.03943 43.2392C4.03943 51.7092 10.9094 58.5692 19.3694 58.5692C27.8294 58.5692 34.0494 52.3292 34.6494 44.4192" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M51.1102 9.72998L45.3202 16.27L41.3602 12.17" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M54.8097 5.59041C51.4197 5.35041 48.2797 3.85041 46.0997 1.42041C43.9197 3.85041 40.7797 5.36041 37.3897 5.59041L36.2297 5.67041V10.5904C36.2297 13.4304 37.1397 16.2004 38.8897 18.4104C40.9297 20.9904 43.3997 22.6304 46.0897 23.9104C48.7797 22.6404 51.2497 20.9904 53.2897 18.4104C55.0397 16.2004 55.9497 13.4204 55.9497 10.5904V5.67041L54.7897 5.59041H54.8097Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  lifeInsurance: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <g clip-path="url(#clip0_life_insurance)">
      <path d="M23.97 19.8598C29.1063 19.8598 33.27 15.696 33.27 10.5598C33.27 5.42352 29.1063 1.25977 23.97 1.25977C18.8338 1.25977 14.67 5.42352 14.67 10.5598C14.67 15.696 18.8338 19.8598 23.97 19.8598Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M40.2601 30.68C40.0601 30.46 39.8501 30.24 39.6301 30.03C35.6201 26.02 30.0801 23.54 23.9601 23.54C11.7301 23.54 1.81006 33.46 1.81006 45.69V49.27H31.4901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M52.06 40.5103L44.74 48.7803L39.74 43.5903" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M56.72 35.29C52.44 34.99 48.48 33.09 45.72 30.02C42.97 33.09 39 34.99 34.72 35.29L33.26 35.39V41.6C33.26 45.18 34.41 48.69 36.62 51.48C39.2 54.74 42.32 56.81 45.72 58.42C49.12 56.81 52.24 54.74 54.82 51.48C57.03 48.69 58.18 45.18 58.18 41.6V35.39L56.72 35.29Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <defs>
      <clipPath id="clip0_life_insurance">
        <rect width="60" height="60" fill="white" />
      </clipPath>
    </defs>
  </svg>`,
  voluntaryBenefits: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M52.02 12.1298C43.46 11.5298 35.52 7.72982 30 1.56982C24.48 7.71982 16.54 11.5298 7.97999 12.1298L5.04999 12.3298V24.7698C5.04999 31.9398 7.34999 38.9598 11.78 44.5498C16.95 51.0698 23.19 55.2298 30 58.4498C36.81 55.2298 43.05 51.0798 48.22 44.5498C52.65 38.9598 54.95 31.9398 54.95 24.7698V12.3298L52.02 12.1298Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 42.77C37.0416 42.77 42.75 37.0616 42.75 30.02C42.75 22.9784 37.0416 17.27 30 17.27C22.9584 17.27 17.25 22.9784 17.25 30.02C17.25 37.0616 22.9584 42.77 30 42.77Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M22.57 30.02H37.43" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 37.4501V22.5801" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  icareWellbeingProgram: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M49.58 28.7399L53.86 35.5699C54.85 37.1499 53.71 39.2099 51.85 39.2099H51.17C50.29 39.2099 49.58 39.9199 49.58 40.7999V45.9299C49.58 49.6199 46.33 52.4799 42.67 51.9999L39.74 51.6199C38.66 51.4799 37.71 52.3199 37.71 53.4099V58.6999H15.09V41.2099C15.09 41.2099 -4.08999 23.0399 12.58 7.35989C25.48 -4.77011 49.51 2.06989 49.51 21.1299L49.58 28.7399Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M16.55 16.6099C17.4 14.2099 19.2 12.8699 21.72 12.6299C25.58 12.2599 27.77 16.1399 27.77 16.1399C27.77 16.1399 29.96 12.2599 33.82 12.6299C36.33 12.8699 38.14 14.2099 38.99 16.6099C39.86 19.0699 39.22 21.9899 37.78 24.1599C35.25 27.9899 28.3 32.3299 27.77 32.6599C27.24 32.3299 20.29 27.9899 17.76 24.1599C16.33 21.9899 15.69 19.0699 16.55 16.6099Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
};

function resolveIconSvg(card) {
  if (card.iconSvg) {
    return normalizeIconSvgMarkup(card.iconSvg);
  }

  if (card.iconKey && iconSvgMap[card.iconKey]) {
    return normalizeIconSvgMarkup(iconSvgMap[card.iconKey]);
  }

  if (card.iconSrc) {
    const altAttr = card.iconAlt
      ? ` alt="${escapeHtml(card.iconAlt)}"`
      : ` alt="" aria-hidden="true"`;
    const widthAttr = card.iconWidth ? ` width="${escapeHtml(String(card.iconWidth))}"` : "";
    const heightAttr = card.iconHeight ? ` height="${escapeHtml(String(card.iconHeight))}"` : "";
    return `<img class="ic-card-icon ic-card-icon--image"${altAttr}${widthAttr}${heightAttr} src="${escapeHtml(card.iconSrc)}" loading="lazy">`;
  }

  throw new Error(`Missing iconSvg, valid iconKey, or iconSrc for card "${card.title || "unknown"}"`);
}

function getSvgAttributeValue(attributes = "", attributeName = "") {
  const match = attributes.match(new RegExp(`\\b${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match?.[2] ?? match?.[3] ?? "";
}

function sanitizeSvgInnerMarkup(markup = "") {
  return markup
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:href|xlink:href)\s*=\s*("|')javascript:[\s\S]*?\1/gi, "");
}

function normalizeIconSvgMarkup(iconSvg, {
  className = "ic-card-icon",
  ariaHidden = false,
  label = "",
} = {}) {
  const svgMarkup = typeof iconSvg === "string" ? iconSvg.trim() : "";

  const admission = admitIconSvg(svgMarkup);
  if (!admission.ok) throw new Error(`Invalid iconSvg markup: ${admission.reason}`);

  const openTagMatch = svgMarkup.match(/^<svg\b([^>]*)>/i);
  const attributes = openTagMatch?.[1] || "";
  const width = getSvgAttributeValue(attributes, "width") || "60";
  const height = getSvgAttributeValue(attributes, "height") || "60";
  const viewBox = getSvgAttributeValue(attributes, "viewBox") || `0 0 ${width} ${height}`;
  const fill = getSvgAttributeValue(attributes, "fill") || "none";
  const innerMarkup = sanitizeSvgInnerMarkup(
    svgMarkup
      .replace(/^<svg\b[^>]*>/i, "")
      .replace(/<\/svg>\s*$/i, "")
      .trim(),
  );
  const accessibilityAttributes = label
    ? ` role="img" aria-label="${escapeHtml(label)}"`
    : ariaHidden ? ` aria-hidden="true" focusable="false"` : "";

  return `<svg class="${escapeHtml(className)}" xmlns="http://www.w3.org/2000/svg" width="${escapeHtml(width)}" height="${escapeHtml(height)}" viewBox="${escapeHtml(viewBox)}" fill="${escapeHtml(fill)}"${accessibilityAttributes}>
    ${innerMarkup}
  </svg>`;
}

function normalizeGoldClassSvgMarkup(svg) {
  let svgMarkup = typeof svg === "string" ? svg : "";

  if (svgMarkup.charCodeAt(0) === 0xFEFF) {
    svgMarkup = svgMarkup.slice(1);
  }

  svgMarkup = svgMarkup.trimStart();
  svgMarkup = svgMarkup.replace(/^<\?xml\b[\s\S]*?\?>\s*/i, "");

  return svgMarkup.trim();
}

function compactGoldClassSvgMarkup(svgMarkup = "") {
  return svgMarkup
    .replace(/[\r\n]/g, "")
    .replace(/>\s+</g, "><");
}

function renderGoldClassSvgIcon(svg, className, context) {
  const svgMarkup = normalizeGoldClassSvgMarkup(svg);

  if (!svgMarkup) {
    return "";
  }

  if (!/^<svg\b[\s\S]*<\/svg>$/i.test(svgMarkup)) {
    throw new Error(`Invalid GTGC SVG icon at ${context}: expected an <svg> root`);
  }

  const renderedSvg = svgMarkup.replace(
    /^<svg\b/i,
    `<svg class="${escapeHtml(className)}" aria-hidden="true" focusable="false"`,
  );

  return compactGoldClassSvgMarkup(renderedSvg);
}

function resolveHeroSemanticLayout(section) {
  const layout = section.layout;

  if ((section.variant || section.heroStyle || "default") !== "split" && !layout) {
    return null;
  }

  const desktopMediaPosition = layout?.desktopMediaPosition || "right";
  const mobileMediaOrder = layout?.mobileMediaOrder || "above";
  const desktopSplit = layout?.desktopSplit || "text-5-media-7";
  const rowVerticalAlign = layout?.rowVerticalAlign || "center";
  const rowJustify = layout?.rowJustify || "between";
  const mobileCopySpacing = layout?.mobileCopySpacing || "none";
  const mobileMediaSpacing = layout?.mobileMediaSpacing || (mobileMediaOrder === "above" ? "section" : "none");
  const desktopGapTarget = layout?.desktopGapTarget || "media";
  const desktopGapBreakpoint = layout?.desktopGapBreakpoint || "lg";
  const boxStyle = layout?.boxStyle || "none";
  const imageStyle = layout?.imageStyle || section.imageStyle || "rounded";
  const imageFrame = layout?.imageFrame || section.imageFrame || "section";
  const imageInset = layout?.imageInset === true || section.imageInset === true;
  const imageRounded = layout?.imageRounded !== false && section.imageRounded !== false;
  const autoSectionClass = layout?.sectionPadding === "padded" ? "ic-section-hero-padded" : "";

  const copyDesktopSplitClass = {
    equal: "col-md-6",
    "text-5-media-7": "col-md-6 col-xl-5",
    "text-7-media-5": "col-md-6 col-xl-7",
    // Non-split hero with media right, auto at md, 5/7 columns at lg
    "lg-5-7": "col-md col-lg-5",
  }[desktopSplit] || "col-md-6";
  const mediaDesktopSplitClass = {
    equal: "col-md-6",
    "text-5-media-7": "col-md-6 col-xl-7",
    "text-7-media-5": "col-md-6 col-xl-5",
    "lg-5-7": "col-md col-lg-7",
  }[desktopSplit] || "col-md-6";
  const orderClasses = resolveSplitColumnOrderClasses(desktopMediaPosition, mobileMediaOrder, false);
  const gapClasses = resolveSplitColumnGapClassNames({
    desktopMediaPosition,
    desktopGapTarget,
    desktopGapBreakpoint,
  });
  const copyMobileSpacingClass = mobileCopySpacing === "tight"
    ? "mb-3 mb-md-0"
    : mobileCopySpacing === "offset"
      ? "mt-2 pt-1 mt-md-0 pt-md-0"
      : "";
  const mediaMobileSpacingClass = mobileMediaSpacing === "tight"
    ? (mobileMediaOrder === "above" ? "mb-3 mb-md-0" : "mt-3 mt-md-0")
    : mobileMediaSpacing === "section"
      ? (mobileMediaOrder === "above" ? "mb-3 pb-1 mb-md-0 pb-md-0" : "mt-3 pt-3 mt-md-0 pt-md-0")
      : "";

  const rowAlignClass = rowVerticalAlign === "end" ? "align-items-end"
    : rowVerticalAlign === "none" ? ""
    : "align-items-center";

  return {
    contentClassName: joinClassNames(
      "col col-12",
      copyDesktopSplitClass,
      orderClasses.copyClassName,
      copyMobileSpacingClass,
      gapClasses.copyClassName,
    ),
    mediaClassName: joinClassNames(
      "col col-12",
      mediaDesktopSplitClass,
      orderClasses.mediaClassName,
      mediaMobileSpacingClass,
      gapClasses.mediaClassName,
    ),
    rowClassName: joinClassNames(
      rowJustify === "none" ? "row" : `row justify-content-${rowJustify}`,
      rowAlignClass,
    ),
    imageClassName: resolveSplitImageClassName({
      imageStyle,
      imageFrame,
      imageInset,
      imageRounded,
    }),
    imagePreset: imageStyle === "banner" ? "banner" : "textMedia",
    autoSectionClassName: autoSectionClass,
    boxClassName: boxStyle === "collapse" ? "ic-box ic-box-mobile-collapse" : "",
  };
}

function normalizeFormFieldId(field = {}) {
  return field.id || `gtgc-${field.name || "field"}`;
}

function isSafeHtmlAnchorId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value);
}

function getGoldClassFormRegionId(section = {}) {
  return section.form?.regionId || "";
}

function getGoldClassCta(section = {}) {
  const button = Array.isArray(section.buttons) ? section.buttons[0] : null;
  return {
    href: section.ctaDestination || button?.href || "",
    label: button?.label || "",
  };
}

function renderGoldClassLeadFormField(field = {}) {
  const fieldId = normalizeFormFieldId(field);
  const errorId = `${fieldId}-error`;
  const fieldType = field.type || "text";
  const autocomplete = field.autocomplete || field.autoComplete || {
    first_name: "given-name",
    last_name: "family-name",
    email: "email",
  }[field.name] || "";
  const errorText = field.errorMessage || "";
  const describedBy = `${errorId}`;
  const maxLength = field.maxLength || field.maxlength || "";
  const supportsMaxLength = ["text", "search", "tel", "url", "email", "password"].includes(fieldType.toLowerCase());
  const controlMarkup = fieldType === "select"
    ? `<div class="select-w">
                                            <select id="${escapeHtml(fieldId)}" name="${escapeHtml(field.name || "")}"${autocomplete ? ` autocomplete="${escapeHtml(autocomplete)}"` : ""}${field.required ? " required" : ""} aria-invalid="false" aria-describedby="${escapeHtml(describedBy)}"${errorText ? ` data-error-message="${escapeHtml(errorText)}"` : ""}>
                                            <option value="" disabled selected>${escapeHtml(field.placeholder || "")}</option>${(field.options || [])
      .map((option) => `
                                            <option value="${escapeHtml(String(option?.value ?? ""))}">${escapeHtml(String(option?.label ?? ""))}</option>`)
      .join("")}
                                            </select>
                                        </div>`
    : `<input id="${escapeHtml(fieldId)}" name="${escapeHtml(field.name || "")}" type="${escapeHtml(fieldType)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ""}${maxLength && supportsMaxLength ? ` maxlength="${escapeHtml(String(maxLength))}"` : ""}${autocomplete ? ` autocomplete="${escapeHtml(autocomplete)}"` : ""}${field.required ? " required" : ""} aria-invalid="false" aria-describedby="${escapeHtml(describedBy)}"${errorText ? ` data-error-message="${escapeHtml(errorText)}"` : ""}>`;

  return `                                    <div class="gtgc-form-field">
                                        <label for="${escapeHtml(fieldId)}">${renderText(field.label || "")}</label>
                                        ${controlMarkup}
                                        <p id="${escapeHtml(errorId)}" class="gtgc-field-error" hidden>${errorText ? renderText(errorText) : ""}</p>
                                    </div>`;
}

function getGoldClassPrivacyLinkAttributes(href = "") {
  return /\/privacy(?:[/?#]|$)/i.test(href)
    ? ` target="_blank" rel="noopener noreferrer"`
    : "";
}

function getGoldClassHiddenFields(form = {}) {
  const hiddenFields = Array.isArray(form.hiddenFields) ? form.hiddenFields : [];
  const groupedFields = (form.hiddenFieldGroups || [])
    .flatMap((group) => (Array.isArray(group?.fields) ? group.fields : []));

  return [...hiddenFields, ...groupedFields].filter((field) => field?.name);
}

function renderGoldClassHiddenFields(form = {}) {
  return getGoldClassHiddenFields(form)
    .map((field) => indentBlock(renderLeadFormHiddenField(field), 36))
    .join("\n");
}

function renderGoldClassCaptcha(form = {}) {
  const captcha = form.recaptcha || form.captcha || null;

  if (!captcha || !["v2-invisible", "v3"].includes(captcha.version)) {
    return "";
  }

  const responseFieldName = captcha.responseFieldName || captcha.responseTokenField || captcha.tokenFieldName || "g-recaptcha-response";
  const captchaContainer = captcha.version === "v2-invisible"
    ? `\n                                        <div class="g-recaptcha gtgc-recaptcha-widget" data-gtgc-recaptcha-widget data-size="invisible"></div>`
    : "";

  return `                                    <div class="gtgc-recaptcha">
                                        <input type="hidden" name="${escapeHtml(responseFieldName)}" value="">
${captchaContainer}
                                    </div>`;
}

function renderGoldClassIcon(icon, className, context) {
  if (!icon || typeof icon !== "object" || Array.isArray(icon)) {
    return "";
  }

  return renderGoldClassSvgIcon(icon.svg, className, context);
}

function renderGoldClassLeadForm(section = {}) {
  const form = section.form || {};
  const formRegionId = getGoldClassFormRegionId(section);
  const successState = form.successState || {};
  const hiddenFieldsMarkup = renderGoldClassHiddenFields(form);
  const fieldsMarkup = (form.fields || [])
    .map((field) => renderGoldClassLeadFormField(field))
    .join("\n");
  const captchaMarkup = renderGoldClassCaptcha(form);
  const failureMessage = form.failureNotice?.message || form.failureState?.message || "";
  const failureTitle = form.failureNotice?.title || form.failureState?.title || "";
  const successTitle = successState.title || "";
  const successBody = successState.body || "";
  const successIconMarkup = renderGoldClassIcon(
    successState.icon,
    "gtgc-success-icon",
    "GTGC success-state icon",
  );
  const noSendAttribute = form.noSend === true ? ` data-gtgc-no-send="true"` : "";
  const failureMarkup = (failureTitle || failureMessage)
    ? `                                    <p class="gtgc-form-failure" id="gtgc-form-failure" role="alert" tabindex="-1" hidden>${failureTitle ? `<strong>${renderText(failureTitle)}</strong>${failureMessage ? " " : ""}` : ""}${failureMessage ? renderText(failureMessage, { widowProtection: true }) : ""}</p>\n\n`
    : "";
  const successMarkup = (successTitle || successBody || successIconMarkup)
    ? `
                                <div class="gtgc-form-success" role="status" aria-live="polite" hidden>
${successIconMarkup ? `                                    ${successIconMarkup}\n` : ""}${successTitle ? `                                    <h2>${renderText(successTitle)}</h2>\n` : ""}${successBody ? `                                    <p>${renderText(successBody, { widowProtection: true })}</p>\n` : ""}                                </div>`
    : "";

  const captcha = form.recaptcha || form.captcha || {};
  const captchaVersion = captcha.version || "";
  const captchaSiteKey = captcha.siteKey || captcha.sitekey || "";
  const captchaAction = captcha.action || "submit";
  const captchaResponseFieldName = captcha.responseFieldName || captcha.responseTokenField || captcha.tokenFieldName || "g-recaptcha-response";
  const captchaAttributes = ["v2-invisible", "v3"].includes(captchaVersion)
    ? ` data-gtgc-captcha-version="${escapeHtml(captchaVersion)}"${captchaSiteKey ? ` data-gtgc-captcha-site-key="${escapeHtml(captchaSiteKey)}"` : ""} data-gtgc-captcha-action="${escapeHtml(captchaAction)}" data-gtgc-captcha-response-field="${escapeHtml(captchaResponseFieldName)}"`
    : "";
  const frameBaseId = formRegionId || "gtgc-lead-form";
  const frameName = `${frameBaseId.replace(/[^A-Za-z0-9_-]/g, "-")}-target`;
  const targetAttribute = ` target="${escapeHtml(frameName)}"`;

  return `                                <form${formRegionId ? ` id="${escapeHtml(formRegionId)}" tabindex="-1"` : ""} class="gtgc-lead-form" action="${escapeHtml(form.action || "")}" method="${escapeHtml(form.method || "POST")}"${targetAttribute} novalidate data-gtgc-lead-form${noSendAttribute}${captchaAttributes}>
${hiddenFieldsMarkup ? `${hiddenFieldsMarkup}\n` : ""}                                    <div class="gtgc-form-fields">
${fieldsMarkup}
                                    </div>

${captchaMarkup ? `${captchaMarkup}\n\n` : ""}                                    <button class="gtgc-submit" type="submit">${renderText(form.submitLabel || "")}</button>

${failureMarkup}${form.privacyText ? `                                    <p class="gtgc-form-privacy">${renderInlineMarkdownLinks(form.privacyText.replace(/^\*|\*$/g, ""), { widowProtection: true, getLinkAttributes: getGoldClassPrivacyLinkAttributes })}</p>\n` : ""}                                </form>${successMarkup}`;
}

function renderGoldClassHeroBullet(bullet, fallbackIcon) {
  const bulletConfig = typeof bullet === "object" && bullet !== null ? bullet : { text: bullet };
  const iconMarkup = renderGoldClassIcon(
    fallbackIcon,
    "gtgc-bullet-icon",
    "GTGC hero bullet icon",
  );
  const text = bulletConfig.text || bulletConfig.label || bulletConfig.copy || "";

  return `                                    <li>${iconMarkup ? `${iconMarkup}<span>` : ""}${renderText(text, { widowProtection: true })}${iconMarkup ? "</span>" : ""}</li>`;
}

function renderGoldClassHeroSection(section) {
  const imageMarkup = renderPicture(
    section.image,
    "gtgc-hero-image",
    "eager",
    "textMedia",
    `hero "${section.id}" image`,
  );
  const badgeMarkup = section.badge
    ? renderImg(section.badge, "gtgc-hero-badge", { loading: "eager", context: `hero "${section.id}" badge` })
    : "";
  const eyebrow = section.paragraphs?.[0] || "";
  const body = section.paragraphs?.[1] || "";
  const bulletIcon = section.bulletIcon;
  const bulletsMarkup = (section.bullets || [])
    .map((bullet) => renderGoldClassHeroBullet(bullet, bulletIcon))
    .join("\n");
  const hasBulletIcons = Boolean(bulletIcon?.svg);
  const bulletListClassName = hasBulletIcons
    ? "gtgc-hero-bullets gtgc-hero-bullets--icons"
    : "gtgc-hero-bullets";

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName("gtgc-page gtgc-hero", section.__autoSectionClassName))}">
            <div class="gtgc-hero-media">
                ${imageMarkup}
${badgeMarkup ? `                ${badgeMarkup}\n` : ""}            </div>

            <div class="gtgc-hero-panel">
                <div class="gtgc-hero-content">
                    <h1>${renderText(getHeroHeadline(section))}</h1>
${eyebrow ? `                    <h2 class="gtgc-eyebrow">${renderText(eyebrow)}</h2>\n` : ""}${body ? `                    <p class="gtgc-hero-copy">${renderText(body, { widowProtection: true })}</p>\n` : ""}${bulletsMarkup ? `                    <ul class="${bulletListClassName}">
${bulletsMarkup}
                    </ul>
\n` : ""}${renderGoldClassLeadForm(section)}
                </div>
            </div>
        </section>`;
}

function renderGoldClassRatingAsset(quote = {}) {
  if (!quote.image) {
    return "";
  }

  return `                        <div class="gtgc-testimonial-asset">
                            ${renderImg(quote.image, "gtgc-testimonial-image", { loading: "lazy", context: "GTGC testimonial asset" })}
                        </div>`;
}

function renderGoldClassRating(quote = {}, starRatingIcon = null) {
  const rating = Number(quote.rating);

  if (!Number.isFinite(rating) || rating <= 0) {
    return "";
  }

  const maxRating = Number.isFinite(Number(quote.maxRating || quote.ratingMax))
    ? Number(quote.maxRating || quote.ratingMax)
    : 5;
  const starCount = Math.max(0, Math.min(Math.round(rating), maxRating));
  const ratingLabel = quote.ratingLabel || `${rating} out of ${maxRating} stars`;

  if (!starCount) {
    return "";
  }

  const iconMarkup = renderGoldClassIcon(starRatingIcon, "gtgc-star-icon", "GTGC testimonial star rating icon");
  const ratingMarkup = iconMarkup
    ? Array.from({ length: starCount }, () => iconMarkup).join("")
    : "★".repeat(starCount);

  return `                        <p class="gtgc-stars" aria-label="${escapeHtml(ratingLabel)}"><span class="gtgc-stars-list" aria-hidden="true">${ratingMarkup}</span></p>`;
}

function renderGoldClassTestimonialsSection(section) {
  const quoteMarkup = (section.quotes || [])
    .map((quote) => `                    <figure class="gtgc-testimonial">
${renderGoldClassRating(quote, section.starRatingIcon) || renderGoldClassRatingAsset(quote)}
                        <blockquote>
                            <p>${renderText(quote.quote, { widowProtection: true })}</p>
                        </blockquote>
                        <figcaption>
                            <span class="gtgc-testimonial-attribution"><span aria-hidden="true">— </span><cite>${renderText(quote.name)}</cite>${quote.title ? `<span class="gtgc-testimonial-title">, ${renderText(quote.title)}</span>` : ""}</span>${quote.location ? `<span class="gtgc-testimonial-location">${renderText(quote.location)}</span>` : ""}
                        </figcaption>
                    </figure>`)
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="gtgc-page gtgc-testimonials">
            <div class="gtgc-container">
                <h2 class="gtgc-visually-hidden">${renderText(getSectionHeading(section))}</h2>
                <div class="gtgc-testimonial-grid">
${quoteMarkup}
                </div>
            </div>
        </section>`;
}

function renderGoldClassBenefitsSection(section) {
  const itemMarkup = (section.items || [])
    .map((item) => `                        <li>
                            <h3>${renderText(item.title)}</h3>
                            <p>${renderText(item.description, { widowProtection: true })}</p>
                        </li>`)
    .join("\n");
  const pictureMarkup = renderPicture(section.image, "gtgc-benefits-image", "lazy", "textMedia", `section "${section.id}" image`);

  return `        <section id="${escapeHtml(section.id)}" class="gtgc-page gtgc-benefits">
            <div class="gtgc-container">
                <div class="gtgc-benefits-grid">
                    <div class="gtgc-benefits-copy">
                        <h2>${renderText(getSectionHeading(section))}</h2>
                        <ul class="gtgc-benefit-list">
${itemMarkup}
                        </ul>
                    </div>

                    <div class="gtgc-benefits-media">
                        ${pictureMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderGoldClassValueIcon(card = {}) {
  return renderGoldClassIcon(card.icon, "gtgc-value-icon", "GTGC value icon");
}

function renderGoldClassValuePropsSection(section) {
  const cardMarkup = (section.cards || [])
    .map((card) => {
      const iconMarkup = renderGoldClassValueIcon(card);

      return `                    <li>
${iconMarkup ? `                        ${iconMarkup}\n` : ""}                        <h3>${renderText(getCardHeading(card), { widowProtection: true })}</h3>
                    </li>`;
    })
    .join("\n");

  return `        <section id="${escapeHtml(section.id)}" class="gtgc-page gtgc-value-props">
            <div class="gtgc-container">
                <h2>${renderText(getSectionHeading(section))}</h2>
                <ul class="gtgc-value-grid">
${cardMarkup}
                </ul>
            </div>
        </section>`;
}

function renderGoldClassFaqSection(section) {
  const accordionId = escapeHtml(section.accordionId || `${section.id}Accordion`);
  const itemsMarkup = (section.items || [])
    .map((item, index) => {
      const itemNumber = index + 1;
      const headingId = `${section.id}-heading-${itemNumber}`;
      const collapseId = `${section.id}-collapse-${itemNumber}`;

      return `                        <div class="ic-card ic-background-white accordion-item gtgc-faq-item mb-2">
                            <h3 class="ic-card-title accordion-header" id="${escapeHtml(headingId)}">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${escapeHtml(collapseId)}" aria-expanded="false" aria-controls="${escapeHtml(collapseId)}">
                                    ${renderText(getAccordionItemHeading(item))}
                                </button>
                            </h3>
                            <div id="${escapeHtml(collapseId)}" class="accordion-collapse collapse" aria-labelledby="${escapeHtml(headingId)}" data-bs-parent="#${accordionId}">
                                <div class="accordion-body">
${renderAccordionItemBody(item)}
                                </div>
                            </div>
                        </div>`;
    })
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="gtgc-page gtgc-faq">
            <div class="gtgc-container">
                <div class="gtgc-faq-grid">
                    <div class="gtgc-faq-intro">
                        <h2 class="ic-section-title ic-sticky">${renderText(getSectionHeading(section))}</h2>
                    </div>
                    <div class="accordion py-0 gtgc-faq-list" id="${accordionId}">
${itemsMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function hasResponsiveImageFields(image = {}) {
  return Boolean(
    image.desktopSrc
    || image.mobileSrc
    || image.desktopSrcset
    || image.mobileSrcset
    || image.urls
    || image.desktop
    || image.mobile,
  );
}

function renderGoldClassCtaImage(image, context) {
  if (!image) {
    return "";
  }

  if (hasResponsiveImageFields(image)) {
    return renderPicture(image, "gtgc-cta-image", "lazy", "textMedia", context);
  }

  return renderImg(image, "gtgc-cta-image", {
    loading: "lazy",
    context,
  });
}

function renderGoldClassCtaSection(section) {
  const mediaMarkup = renderGoldClassCtaImage(section.image, `section "${section.id}" image`);
  const bodyMarkup = renderParagraphContent(section, "gtgc-cta-copy");
  const cta = getGoldClassCta(section);

  return `        <section id="${escapeHtml(section.id)}" class="gtgc-page gtgc-footer-cta">
            <div class="gtgc-container">
                <div class="gtgc-cta-grid">
                    <div class="gtgc-cta-media">
                        ${mediaMarkup}
                    </div>

                    <div class="gtgc-cta-content">
                        <h2>${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `${indentBlock(bodyMarkup, 24)}\n` : ""}                        <p class="gtgc-cta-action"><a class="gtgc-submit" href="${escapeHtml(cta.href)}" data-gtgc-lead-form-cta>${renderText(cta.label)}</a></p>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderGoldClassFooterSection(section) {
  const logoMarkup = section.logo
    ? renderImg(section.logo, "gtgc-footer-logo", { loading: "lazy", context: `section "${section.id}" logo` })
    : "";
  const bodyMarkup = (section.paragraphs || [])
    .map((paragraph) => `                    <p>${renderText(paragraph, { widowProtection: true })}</p>`)
    .join("\n");

  return `        <section id="${escapeHtml(section.id)}" class="gtgc-page gtgc-legal-footer">
            <div class="gtgc-container">
                <div class="gtgc-legal-grid">
                    <div>
${bodyMarkup}
                    </div>
${logoMarkup ? `                    <div class="gtgc-footer-logo-wrap">
                        <a href="https://i-car.com" target="_blank" rel="noopener noreferrer">${logoMarkup}</a>
                    </div>\n` : ""}                </div>
            </div>
        </section>`;
}

function renderHeroVideo(video, className) {
  const videoClassName = escapeHtml(className || video.className || "ic-video ic-rounded");
  const widthAttr = video.width ? ` width="${escapeHtml(String(video.width))}"` : "";
  const heightAttr = video.height ? ` height="${escapeHtml(String(video.height))}"` : "";
  const posterAttr = video.poster ? ` poster="${escapeHtml(video.poster)}"` : "";
  const webmSource = video.webm
    ? `\n            <source type="video/webm" src="${escapeHtml(video.webm)}">`
    : "";
  const mp4Source = video.mp4
    ? `\n            <source type="video/mp4" src="${escapeHtml(video.mp4)}">`
    : "";

  return `<video${widthAttr}${heightAttr} preload="auto" playsinline loop autoplay muted${posterAttr} class="${videoClassName}" aria-hidden="true">${webmSource}${mp4Source}
        </video>`;
}

const PATH_DROPDOWN_CHEVRON = `<svg aria-hidden="true" focusable="false" width="14" height="10" viewBox="0 0 512 298.04" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12.08 70.78c-16.17-16.24-16.09-42.54.15-58.7 16.25-16.17 42.54-16.09 58.71.15L256 197.76 441.06 12.23c16.17-16.24 42.46-16.32 58.71-.15 16.24 16.16 16.32 42.46.15 58.7L285.27 285.96c-16.24 16.17-42.54 16.09-58.7-.15L12.08 70.78z"/></svg>`;

function renderPathDropdownMarkup(dropdown, sectionId, indent) {
  if (!dropdown) return "";
  const dropdownId = `${escapeHtml(sectionId)}-path-dropdown`;
  const pad = " ".repeat(indent);
  const pad4 = " ".repeat(indent + 4);
  const pad8 = " ".repeat(indent + 8);
  const outlineClass = (dropdown.variant || "primary") === "outline" ? " ic-btn-outline" : "";
  const itemsMarkup = (dropdown.items || [])
    .map((item) => `${pad8}<li><a${renderAnchorAttributes(item)}>${renderText(item.label)}</a></li>`)
    .join("\n");
  return `\n${pad}<div class="ic-dropdown-container js-ic-dropdown-container">
${pad4}<button class="ic-btn ic-btn-primary${outlineClass} ic-btn-dropdown js-ic-btn-dropdown" type="button" aria-expanded="false" aria-controls="${dropdownId}">${renderText(dropdown.label)} ${PATH_DROPDOWN_CHEVRON}</button>
${pad4}<ul class="ic-dropdown ic-dropdown-menu js-ic-dropdown ic-visually-hidden" id="${dropdownId}" aria-hidden="true" inert>
${itemsMarkup}
${pad4}</ul>
${pad}</div>`;
}

function renderPathDropdown(section) {
  return renderPathDropdownMarkup(section.pathDropdown, section.id, 28);
}

function renderHeroSection(section) {
  // Support both legacy and structured properties
  // Structured properties: title, subtitle, label, sublabel, body, image, buttons, etc.
  // Legacy properties: headline1, headline2, contentHtml, etc.

  if (section.variant === "splitForm") {
    return renderGoldClassHeroSection(section);
  }

  const heroHeadline = section.title || getHeroHeadline(section);
  const heroVariant = section.variant || section.heroStyle || "default";
  const headingTag = /^(h1|h2|h3|h4|h5|h6|p)$/i.test(section.headingTag || "") ? section.headingTag.toLowerCase() : "h1";
  const semanticLayout = (heroVariant === "split" || section.layout) ? resolveHeroSemanticLayout(section) : null;
  const heroImagePlacement = section.imagePlacement || "column";

  // Build body markup from structured properties or legacy properties
  let bodyMarkup = "";
  if (Array.isArray(section.inlineLinkParagraphs)) {
    bodyMarkup = section.inlineLinkParagraphs.map((paragraph) => `                            <p class="${escapeHtml(section.bodyClassName || "")}">${renderTypedInlineLinkParagraph(paragraph)}</p>`).join("\n");
  } else if (section.body) {
    // Structured property: render as paragraph
    bodyMarkup = `                            <p class="${escapeHtml(section.bodyClassName || "")}">${renderText(section.body)}</p>`;
  } else {
    // Legacy property: use existing logic
    bodyMarkup = renderParagraphContent(section, section.bodyClassName || "");
  }

  const contentHtmlMarkup = normalizeHtmlBlocks(section.contentHtml)
    .map((block) => renderTrustedHtml(block))
    .join("\n\n");

  // Build buttons from structured properties or legacy properties
  const sectionButtons = section.buttons || getSectionButtonsByLocation(section, "header") || [];
  const buttonsMarkup = renderButtons(sectionButtons, "ic-btn ic-btn-primary");
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary");
  const heroMediaElement = section.video
    ? renderHeroVideo(section.video, section.imageClassName)
    : renderPicture(
      section.image,
      section.imageClassName || section.image?.className || semanticLayout?.imageClassName
        || (section.imageStyle === "rounded" ? "ic-image-rounded" : "ic-image-banner"),
      "eager",
      semanticLayout?.imagePreset || "banner",
      `hero "${section.id}" image`,
    );
  const imageMarkup = heroMediaElement;
  const imageLinkHref = section.imageLink?.href || section.buttons?.[0]?.href || "";
  const imageLinkTitle = section.imageLink?.title || section.buttons?.[0]?.label || heroHeadline;
  // Map backgroundTheme to background class
  let backgroundClass = getBackgroundClassName(section);
  if (section.backgroundTheme && !backgroundClass) {
    const themeMap = {
      light: " ic-background-light",
      white: " ic-background-white",
      dark: " ic-background-dark",
    };
    backgroundClass = themeMap[section.backgroundTheme] || "";
  }

  const sectionClassName = buildSectionClassName(
    `ic-section ic-section-hero${backgroundClass}`,
    heroVariant === "banner" ? "pt-0 pt-md-5" : "",
    semanticLayout?.autoSectionClassName,
    resolveSectionSpacingClassNames(section),
    section.sectionClassName,
    section.__autoSectionClassName,
  );
  const containerClassName = section.containerClassName || "container";
  const heroContentClass = section.contentClassName || semanticLayout?.contentClassName || "col order-last order-md-first mt-2 pt-1 mt-md-0 pt-md-0";
  const heroMediaClass = section.mediaClassName || semanticLayout?.mediaClassName || "col col-12 col-md col-lg-7 order-first order-md-last";
  const heroRowClassName = section.rowClassName || semanticLayout?.rowClassName || "row justify-content-center";
  const heroBoxClassName = section.boxClassName ?? semanticLayout?.boxClassName ?? "ic-box ic-box-mobile-collapse";
  const titleClassName = section.titleClassName || "ic-section-title";
  const visibleTitleClassName = headingTag === "p" ? `${titleClassName} ic-h1` : titleClassName;
  const badgeMarkup = section.badgeImage
    ? `\n                    <div class="${escapeHtml(section.badgeColumnClass || "col col-auto order-first order-md-last mb-3 pb-3 mb-md-0 pb-md-0")}">
                        ${renderImg(section.badgeImage, section.badgeImage.className || "ic-image-logo", { loading: section.badgeImage.loading || "lazy", context: `hero "${section.id}" badge image` })}
                    </div>`
    : "";
  const heroLeadImageMarkup = heroImagePlacement === "background"
    ? `\n            ${imageLinkHref ? `<a${renderAnchorAttributes(section.imageLink || {}, { href: imageLinkHref, title: imageLinkTitle })}>
                ${imageMarkup}
            </a>` : imageMarkup}`
    : "";
  const heroMediaMarkup = heroImagePlacement === "background"
    ? ""
    : `\n                    <div class="${escapeHtml(heroMediaClass)}">
                        ${imageLinkHref ? `<a${renderAnchorAttributes(section.imageLink || {}, { href: imageLinkHref, title: imageLinkTitle })}>
                            ${imageMarkup}
                        </a>` : imageMarkup}
                    </div>`;
  const labelAbove = section.layout?.labelPosition === "above";
  const pathDropdownMarkup = section.pathDropdown
    ? renderPathDropdown(section)
    : "";
  const heroBodyMarkup = labelAbove && section.label
    ? `                            <p class="ic-label">${renderText(section.label)}</p>
                            <${headingTag} class="${escapeHtml(visibleTitleClassName)}">${renderText(heroHeadline)}</${headingTag}>
                            ${section.sublabel ? `<p class="${escapeHtml(section.sublabelClassName || "ic-sublabel")}">${renderText(section.sublabel, { widowProtection: true })}</p>` : ""}
${bodyMarkup ? `${bodyMarkup}\n\n` : ""}${buttonsMarkup}${pathDropdownMarkup}
${contentHtmlMarkup ? `${contentHtmlMarkup}\n` : ""}`
    : `                            <${headingTag} class="${escapeHtml(visibleTitleClassName)}">${renderText(heroHeadline)}</${headingTag}>
                            ${section.label ? `<p class="ic-label">${renderText(section.label)}</p>` : ""}
                            ${section.sublabel ? `<p class="${escapeHtml(section.sublabelClassName || "ic-sublabel")}">${renderText(section.sublabel, { widowProtection: true })}</p>` : ""}
${bodyMarkup ? `${bodyMarkup}\n\n` : ""}${buttonsMarkup}${pathDropdownMarkup}
${contentHtmlMarkup ? `${contentHtmlMarkup}\n` : ""}`;
  const heroBoxClassWithMod = labelAbove && section.label
    ? `${heroBoxClassName} ic-hero-body--label-above`
    : heroBoxClassName;
  const heroContentMarkup = heroBoxClassWithMod
    ? `                        <div class="${escapeHtml(heroBoxClassWithMod)}">
${heroBodyMarkup}                        </div>`
    : heroBodyMarkup;

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(sectionClassName)}">${heroLeadImageMarkup}
            <div class="${escapeHtml(containerClassName)}">
                <div class="${escapeHtml(heroRowClassName)}">

                    <div class="${escapeHtml(heroContentClass)}">
${heroContentMarkup}
                    </div>

${badgeMarkup}
${heroMediaMarkup}

                </div>
            </div>
${footerButtonsMarkup ? `\n${footerButtonsMarkup}` : ""}
        </section>`;
}

function renderPageNavSection(section) {
  const linkMarkup = (section.links || [])
    .map(
      (link) =>
        `                            <li><a${renderAnchorAttributes(link, { className: "ic-btn ic-btn-primary ic-btn-outline" })}>${renderText(link.label)}</a></li>`,
    )
    .join("\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName("ic-section ic-section-nav ic-background-light", section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">

                    <nav class="col col-12" aria-label="On-Page Navigation">
                        <ul class="ic-menu ic-menu-horizontal mt-0">
${linkMarkup}
                        </ul>
                    </nav>

                </div>
            </div>
        </section>`;
}

function resolveCardsSemanticLayout(section) {
  const layout = section.layout;

  if (!layout) {
    return null;
  }

  const cardsPerRow = layout.cardsPerRow || {};
  const introWidth = layout.introWidth || "default";
  const introAlign = layout.introAlign || "center";
  const contentWidth = layout.contentWidth || "default";
  const cardStyle = layout.cardStyle || "default";
  const imageStyle = layout.imageStyle || "rounded";
  const cardVariant = section.variant || layout.variant || "default";
  const hasExplicitCardsPerRow = ["sm", "md", "lg", "xl", "xxl"].some((breakpoint) => cardsPerRow[breakpoint]);

  const introAlignmentClass = introAlign === "start" ? "" : "text-md-center";
  const introColumnClass = joinClassNames({
    default: "col col-md-10 col-lg-8 col-xl-6",
    wide: "col col-12 col-lg-10 col-xl-8",
    full: "col col-12",
  }[introWidth] || "col col-md-10 col-lg-8 col-xl-6", introAlignmentClass);

  const contentColumnClass = {
    default: "col col-12 col-xl-9",
    wider: "col col-12 col-xl-10",
    wide: "col col-12 col-lg-10 col-xl-9",
    full: "col col-12",
  }[contentWidth] || "col col-12 col-xl-9";

  const breakpointColumnClasses = hasExplicitCardsPerRow
    ? [
      ["sm", cardsPerRow.sm],
      ["md", cardsPerRow.md],
      ["lg", cardsPerRow.lg],
      ["xl", cardsPerRow.xl],
      ["xxl", cardsPerRow.xxl],
    ]
      .map(([breakpoint, columns]) => {
        if (columns === "auto") {
          return `col-${breakpoint}-auto`;
        }

        const span = {
          1: "12",
          2: "6",
          3: "4",
          4: "3",
        }[columns];

        return span ? `col-${breakpoint}-${span}` : "";
      })
      .filter(Boolean)
    : ["col-md-6", "col-xl-4"];

  const cardPresentation = {
    default: {
      cardClassName: "ic-card",
      cardBodyClassName: "ic-card-body ic-card-body-indented",
    },
    standard: {
      cardClassName: "ic-card",
      cardBodyClassName: "ic-card-body",
    },
    panel: {
      cardClassName: "ic-card ic-background-white",
      cardBodyClassName: "ic-card-body",
    },
  }[cardStyle] || {
    cardClassName: "ic-card",
    cardBodyClassName: "ic-card-body ic-card-body-indented",
  };

  if (cardVariant === "iconTextGrid") {
    const iconTextGridIntroColumnClass = joinClassNames({
      default: "col col-12 col-xl-10",
      wide: "col col-12 col-lg-10 col-xl-10",
      full: "col col-12",
    }[introWidth] || "col col-12 col-xl-10", introAlign === "start" ? "" : "text-md-center");

    const iconTextGridContentColumnClass = {
      default: "col col-12 col-xl-10",
      wider: "col col-12 col-xl-10",
      wide: "col col-12 col-lg-10 col-xl-10",
      full: "col col-12",
    }[contentWidth] || "col col-12 col-xl-10";

    return {
      variant: cardVariant,
      introColumnClass: iconTextGridIntroColumnClass,
      contentColumnClass: iconTextGridContentColumnClass,
      cardListClassName: "row justify-content-center ic-card-list-icon-text-grid list-unstyled mb-0",
      cardColumnClass: joinNonEmptyClassNames("col col-12", ...(hasExplicitCardsPerRow ? breakpointColumnClasses : ["col-md-6", "col-lg-3"])),
      cardClassName: "ic-card ic-card-icon-text-grid",
      cardBodyClassName: "ic-card-body ic-card-body-icon-text-grid",
      imageClassName: "ic-card-icon-text-grid-icon",
    };
  }

  return {
    variant: cardVariant,
    introColumnClass,
    contentColumnClass,
    cardColumnClass: joinNonEmptyClassNames("col col-12", ...breakpointColumnClasses, "pt-3 mt-3"),
    cardClassName: cardPresentation.cardClassName,
    cardBodyClassName: cardPresentation.cardBodyClassName,
    imageClassName: imageStyle === "standard" ? "ic-card-image" : "ic-card-image ic-image-rounded",
  };
}

function resolveAssetDownloadImageClassName(card = {}) {
  const imagePreset = card.imagePreset || card.image?.imagePreset || "";

  return {
    logo: "d-block",
    socialSquare: "d-block",
  }[imagePreset] || "d-block";
}

function renderButtonSamplesSection(section) {
  const renderExample = (example) => {
    const classes = ["ic-btn", example.tone === "text" ? "" : `ic-btn-${example.tone}`, example.treatment === "outline" ? "ic-btn-outline" : ""].filter(Boolean).join(" ");
    const contents = `${renderText(example.label)}${example.arrow ? ' <span class="ic-btn-icon">➞</span>' : ""}`;
    return `                    ${example.disabled ? `<button class="${classes}" disabled>${contents}</button>` : `<a${renderAnchorAttributes({ href: example.href }, { className: classes })}>${contents}</a>`}`;
  };
  const groups = [["Branded Buttons", section.examples.slice(0, 8)], ["Gray Buttons", section.examples.slice(8, 16)], ["White Buttons", section.examples.slice(16, 24)], ["Text Buttons", section.examples.slice(24)]].map(([heading, examples]) => `                <div class="col col-12 col-lg-6 py-3"><h3 class="ic-h6">${heading}</h3><p class="mt-3">\n${examples.map(renderExample).join("\n")}\n</p></div>`).join("\n");
  return `        <section id="${escapeHtml(section.id)}" class="ic-section ic-background-light"><div class="container"><h2 class="ic-h5">${renderText(section.heading)}</h2><div class="row">\n${groups}\n</div></div></section>`;
}

function renderComponentSamplesSection(section) {
  const groups = section.groups.map((group) => {
    const cards = group.cards.map((card) => {
      const cardClasses = ["ic-card", card.background === "white" ? "ic-background-white" : card.background === "light" ? "ic-background-light" : ""].filter(Boolean).join(" ");
      const media = card.mediaKind === "image" || card.mediaKind === "logo" ? `<figure class="ic-card-media">${renderPicture(card.image, card.mediaKind === "logo" ? "ic-card-logo" : "ic-card-image", "lazy", "card", "component sample")}</figure>` : card.mediaKind === "icon" ? `<figure class="ic-card-media">${renderPicture(card.image, "ic-card-icon", "lazy", "card", "component sample icon")}</figure>` : card.mediaKind === "checkmark" ? '<span class="ic-checkmark" aria-hidden="true"></span>' : "";
      const title = card.href ? `<a${renderAnchorAttributes({ href: card.href }, { className: "stretched-link" })}>${renderText(card.heading)}</a>` : renderText(card.heading || "");
      const body = card.cardKind === "quote" ? `<div class="ic-card-body"><blockquote>${renderText(card.summary)}</blockquote><cite>${renderText(card.citation.name)}, ${renderText(card.citation.title)}</cite></div>` : `<div class="ic-card-body"><h3 class="ic-card-title">${title}</h3>${card.summary ? `<p class="ic-card-text">${renderText(card.summary)}</p>` : ""}${card.detail ? `<h4>${renderText(card.detail.heading)}</h4><ul>${card.detail.items.map(i=>`<li>${renderText(i)}</li>`).join("")}</ul>` : ""}${card.action ? `<p><a${renderAnchorAttributes(card.action, { className: "ic-btn ic-btn-primary ic-btn-outline" })}>${renderText(card.action.label)}</a></p>` : ""}</div>`;
      return `                    <li class="col col-12 col-md-6 col-xl-4 pt-3 mt-3" data-card-pattern="${escapeHtml(card.pattern)}"><div class="${cardClasses}">${card.mediaPlacement === "top" ? `${media}${body}` : `${body}${media}`}</div></li>`;
    }).join("\n");
    return `                <span id="${escapeHtml(group.anchor)}" class="ic-anchor" aria-hidden="true"></span><section data-card-kind="${escapeHtml(group.kind)}"><h3 class="ic-h6">${renderText(group.heading)}</h3><ul class="row list-unstyled mb-0">\n${cards}\n</ul></section>`;
  }).join("\n");
  return `        <section id="${escapeHtml(section.id)}" class="ic-section"><div class="container"><h2 class="ic-h5">${renderText(section.heading)}</h2>\n${groups}\n</div></section>`;
}

export function renderStyleGuideComponentProof() {
  const buttonsFixture = createTemplateSection("cards", "buttonSamples", "proof-buttons");
  const cardsFixture = createTemplateSection("cards", "componentSamples", "proof-cards");
  cardsFixture.groups[0].cards[0].heading = '<linked> & "quoted"';
  cardsFixture.groups[0].cards[0].summary = "Summary <safe> & text";
  return {
    buttons: renderCardsSection({ ...buttonsFixture, examples: buttonsFixture.examples.map((example, index) => ({ ...example, label: index === 0 ? "<escaped>" : example.label })) }),
    cards: renderComponentSamplesSection(cardsFixture),
    inventory: cardsFixture.groups.map((group) => ({ kind: group.kind, anchor: group.anchor, patterns: group.cards.map((card) => card.pattern) })),
  };
}

export function renderR7InlineLinksContractProof() {
  const cards = createTemplateSection("cards", "componentSamples", "cards");
  const sticky = createTemplateSection("stickyCards", "typedListItems", "collision-proof");
  const cta = createTemplateSection("cta", "inlineLinks", "insurance-proof");
  cards.groups[0].cards[0].heading = '<linked> & "quoted"';
  cards.groups[0].cards[0].summary = "Summary <safe> & text";
  sticky.cards[0].listItems[0] = { segments: [
    { type: "text", text: "Role <safe> & " },
    { type: "link", label: "Estimator <link>", href: "https://www.i-car.com/estimator-platinum-path" },
  ] };
  const pageData = { slug: "r7-proof", title: "R7 Proof", sections: [cards, sticky, cta] };
  const validation = validatePageData(pageData, "content/pages/r7-proof.yaml");
  if (!validation.valid) throw new Error(`R7 proof fixture validation failed: ${validation.errors.join("; ")}`);
  const summaryCards = cards.groups.flatMap((group) => group.cards);
  const presentSummaries = summaryCards.filter((card) => card.summary !== undefined).length;
  const absentSummaries = summaryCards.filter((card) => card.summary === undefined).length;
  if (presentSummaries !== 30 || absentSummaries !== 9) throw new Error(`R7 summary inventory expected 30 present and 9 absent, got ${presentSummaries}/${absentSummaries}`);
  const modernPage = parseStructuredAuthoringFile(resolve(process.cwd(), "content/pages/documentation/style-guide.yaml"));
  const modernValidation = validatePageData(modernPage, "content/pages/documentation/style-guide.yaml");
  const modernCards = modernPage.sections.find((section) => section.id === "cards");
  const modernMarkup = renderCardsSection(modernCards);
  if (!modernValidation.valid || modernValidation.warnings.length !== 0) throw new Error(`R20 modern Style Guide validation failed: ${modernValidation.errors.join("; ")} ${modernValidation.warnings.join("; ")}`);
  if ((modernMarkup.match(/data-card-pattern=/g) || []).length !== 39 || (modernMarkup.match(/ic-card-icon/g) || []).length !== 9 || modernMarkup.includes("iconSvg")) throw new Error("R20 modern Style Guide renderer proof is incomplete");
  const invalid = (section) => !validatePageData({ slug: "r7-negative", title: "R7 Negative", sections: [section] }, "content/pages/r7-negative.yaml").valid;
  const iconSvgOnly = structuredClone(cards);
  delete iconSvgOnly.groups[2].cards[0].image;
  iconSvgOnly.groups[2].cards[0].iconSvg = '<svg viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>';
  const iconSvgWithImage = structuredClone(cards);
  iconSvgWithImage.groups[2].cards[0].iconSvg = '<svg viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>';
  if (!invalid(iconSvgOnly) || !invalid(iconSvgWithImage)) throw new Error("R7 iconSvg boundary was not rejected");
  for (const authoredValue of [true, false, "trusted", { token: true }, "legacy-style-guide-icon-trust"]) {
    const modernExactPath = createTemplateSection("cards", "componentSamples", "modern-marker-exact");
    modernExactPath.__legacyStyleGuideIconTrusted = authoredValue;
    const modernUnrelatedPath = structuredClone(modernExactPath);
    if (validatePageData({ slug: "modern-marker-exact", title: "Modern Marker", sections: [modernExactPath] }, "content/pages/documentation/style-guide.yaml").valid) throw new Error(`R12 authored marker admitted at exact path: ${JSON.stringify(authoredValue)}`);
    if (validatePageData({ slug: "modern-marker-unrelated", title: "Modern Marker", sections: [modernUnrelatedPath] }, "content/pages/modern-marker.yaml").valid) throw new Error(`R12 authored marker admitted at unrelated path: ${JSON.stringify(authoredValue)}`);
  }
  for (const container of ["items", { items: true }, 1, true, null]) {
    const malformedContainer = structuredClone(sticky);
    malformedContainer.cards[0].listItems = container;
    if (!invalid(malformedContainer)) throw new Error(`R10 malformed listItems container was admitted: ${String(container)}`);
  }
  for (const item of [{ segments: [] }, { segments: [{ type: "text" }] }, { segments: [{ type: "link", label: "Missing href" }] }, { segments: [{ type: "text", text: "ok" }], extra: true }, { segments: [{ type: "text", text: "   " }] }]) {
    const malformedItem = structuredClone(sticky);
    malformedItem.cards[0].listItems = [item];
    if (!invalid(malformedItem)) throw new Error("R10 malformed typed list item was admitted");
  }
  for (const item of [null, 1, true, "", "   "]) {
    const primitiveItems = structuredClone(sticky);
    primitiveItems.cards[0].listItems = [item];
    if (!invalid(primitiveItems)) throw new Error(`R7 sticky primitive was admitted: ${String(item)}`);
  }
  for (const href of ["mailto:a@b?subject=x", "mailto:a@b#x", "mailto:a@b/c", "mailto:a@b%0d%0aBcc:evil"]) {
    const unsafeMailto = structuredClone(cta);
    unsafeMailto.inlineLinkParagraphs[0].segments[1].href = href;
    if (!invalid(unsafeMailto)) throw new Error(`R7 unsafe mailto was admitted: ${href}`);
  }
  const cardsMarkup = renderCardsSection(cards);
  const stickyMarkup = renderSection(sticky);
  const ctaMarkup = renderSection(cta);
  const combined = `${cardsMarkup}\n${stickyMarkup}\n${ctaMarkup}`;
  const requiredDestinations = [
    "https://www.i-car.com/estimator-platinum-path",
    "https://www.i-car.com/refinish-technician-platinum-path",
    "https://www.i-car.com/structural-technician-platinum-path",
    "https://www.i-car.com/nonstructural-technician-platinum-path",
    "https://info.i-car.com/I-CAR/media/ICarMain/PDF/Location-Level-Courses.pdf",
    "https://www.i-car.com/vehicle-technology-specific-training",
    "https://info.i-car.com/training/industry-training-alliance",
  ];
  for (const href of requiredDestinations) if (!stickyMarkup.includes(`href="${href}"`)) throw new Error(`R7 sticky proof missing ${href}`);
  for (const expected of ["<picture>", "width=\"100\"", "height=\"100\"", "ic-card-icon", "href=\"mailto:insurance@i-car.com\"", "&lt;safe&gt; &amp;", "Estimator &lt;link&gt;"]) {
    if (!combined.includes(expected)) throw new Error(`R7 renderer proof missing ${expected}`);
  }
  if ((cardsMarkup.match(/data-card-pattern=/g) || []).length !== 39) throw new Error("R7 Style Guide proof did not render 39 cards");
  if ((cardsMarkup.match(/id="(?:text|image|icon|logo|checkmark)-cards"/g) || []).length !== 5) throw new Error("R7 Style Guide proof did not render five anchors");
  if ((cardsMarkup.match(/ic-card-icon/g) || []).length !== 9 || cardsMarkup.includes("iconSvg")) throw new Error("R7 icon cards did not use responsive images");
  if (cardsMarkup.includes("Card summary text.") || !cardsMarkup.includes("Card quote.")) throw new Error("R7 summary copy is not pattern-specific");
  const stringCompatibility = renderSection({ id: "string-compatibility", type: "stickyCards", heading: "String compatibility", cards: [{ heading: "String", listItems: ["String <safe> & text"] }] });
  if (!stringCompatibility.includes("String &lt;safe&gt; &amp; text")) throw new Error("R7 string list-item compatibility failed");
  return { validation, cards: cardsMarkup, sticky: stickyMarkup, cta: ctaMarkup, requiredDestinations, stringCompatibility };
}

function renderCardsSection(section) {
  if (section.variant === "buttonSamples") return renderButtonSamplesSection(section);
  if (section.variant === "componentSamples") return renderComponentSamplesSection(section);
  const backgroundClass = getBackgroundClassName(section);
  const introBodyMarkup = renderParagraphContent(section);
  const headerButtonsMarkup = renderButtons(getSectionButtonsByLocation(section, "header"), "ic-btn ic-btn-primary ic-btn-outline");
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");
  const semanticLayout = resolveCardsSemanticLayout(section);
  const cardColumnClass = section.cardColumnClass || semanticLayout?.cardColumnClass || "col col-12 col-md-6 col-xl-4 pt-3 mt-3";
  const introColumnClass = section.introColumnClass || semanticLayout?.introColumnClass || "col col-md-10 col-lg-8 col-xl-6 text-md-center";
  const contentColumnClass = section.contentColumnClass || semanticLayout?.contentColumnClass || "col col-12 col-xl-9";
  const cardClassName = section.cardClassName || semanticLayout?.cardClassName || "ic-card";
  const cardTextAlignClass = section.layout?.cardTextAlign === "center" ? " ic-card--text-center" : "";
  const cardTitleSizeClass = section.layout?.cardTitleSize === "h3" ? " ic-card--title-h3" : "";
  const resolvedCardClassName = cardClassName + cardTextAlignClass + cardTitleSizeClass;
  const cardBodyClassName = section.cardBodyClassName || semanticLayout?.cardBodyClassName || "ic-card-body ic-card-body-indented";
  const imageClassName = section.imageClassName || semanticLayout?.imageClassName || "ic-card-image ic-image-rounded";
  const cardAlignClassName = section.layout?.cardAlign === "start" ? "justify-content-start" : "justify-content-center";
  const cardListClassName = section.cardListClassName || semanticLayout?.cardListClassName || joinClassNames(
    "row",
    cardAlignClassName,
    "list-unstyled",
    "mb-0",
  );
  const cardMarkup = semanticLayout?.variant === "assetDownloads"
    ? (section.cards || [])
      .map((card) => {
        const cardHeading = getCardHeading(card);
        const mediaWrap = section.layout?.mediaWrap || "wrap";
        const verticalAlign = section.layout?.verticalAlign || "start";
        const linkStyle = section.layout?.linkStyle || "text";
        const mediaGapClassName = section.layout?.mediaGap === "regular" ? "gap-3" : "gap-1";
        const mediaClassName = section.layout?.mediaPosition === "start"
          ? joinClassNames("d-flex", mediaGapClassName, verticalAlign === "center" ? "align-items-center" : "align-items-start", mediaWrap === "wrap" ? "flex-wrap" : "")
          : joinClassNames("d-flex", "flex-column", mediaGapClassName, verticalAlign === "center" ? "align-items-center" : "align-items-start");
        const headingTag = /^(h3|h4|h5|h6)$/i.test(card.headingTag || "") ? card.headingTag.toLowerCase() : "h4";
        const titleMarkup = cardHeading ? `                                        <${headingTag} class="mb-0">${renderText(cardHeading)}</${headingTag}>\n` : "";
        const linksMarkup = card.links?.length
          ? card.links
            .map((link) => {
              return `                                        <a${renderAnchorAttributes(link, { className: linkStyle === "text" ? "" : linkStyle })}>${renderText(link.label)}</a>`;
            })
            .join("<br>\n")
          : "";
        const mediaMarkup = card.image
          ? `                                    <figure class="m-0 mr-3 flex-shrink-0">
                                        ${card.links?.[0]?.href
            ? `<a${renderAnchorAttributes(card.links[0], { className: "d-block" })}>
                                            ${renderImg(card.image, card.imageClassName || resolveAssetDownloadImageClassName(card), { loading: card.image.loading || "lazy", context: `card "${cardHeading || "unknown"}" image` })}
                                        </a>`
            : renderImg(card.image, card.imageClassName || resolveAssetDownloadImageClassName(card), { loading: card.image.loading || "lazy", context: `card "${cardHeading || "unknown"}" image` })}
                                    </figure>`
          : "";

        return `                            <li class="${escapeHtml(joinNonEmptyClassNames(cardColumnClass, "py-2", "pt-0", "mt-0", "text-left"))}">
                                <div class="${escapeHtml(joinClassNames(mediaClassName, "justify-content-start", "text-left"))}">
${mediaMarkup}
                                    <div class="text-left">
${titleMarkup}${linksMarkup}
                                    </div>
                                </div>
                            </li>`;
      })
      .join("\n\n")
    : (() => {
        const imageBoxClass = section.layout?.imageBox === "3x2" ? " ic-card-media--box" : "";
        const separateLinks = section.layout?.cardLinks === "separate";
        return (section.cards || [])
          .map(
            (card) => {
              const cardHeading = getCardHeading(card);
              const titleMarkup = cardHeading
                ? `                                        <h3 class="ic-card-title">${card.href
                    ? separateLinks
                      ? `<a${renderAnchorAttributes(card, { href: card.href, title: card.linkTitle })}>${renderText(cardHeading)}</a>`
                      : `<a${renderAnchorAttributes(card, { href: card.href, className: "stretched-link", title: card.linkTitle })}>${renderText(cardHeading)}</a>`
                    : renderText(cardHeading)}</h3>\n`
                : "";
              const bodyMarkup = hasParagraphContent(card)
                ? `${indentBlock(renderCardBodyParagraphs(card, card.bodyClassName || "ic-card-text"), 24)}\n`
                : "";
              const listMarkup = card.listItems?.length
                ? `                                        <ul class="${escapeHtml(card.listClassName || "")}">
${card.listItems
                .map((item) => `                                            <li>${item && typeof item === "object" ? renderTypedSegmentItem(item) : renderText(item, { widowProtection: true })}</li>`)
                  .join("\n")}
                                        </ul>\n`
                : "";
              const contentHtmlMarkup = normalizeHtmlBlocks(card.contentHtml)
                .map((block) => `                                        ${renderTrustedHtml(block)}`)
                .join("\n");
              const linksMarkup = card.links?.length
                ? `                                        <p>\n${card.links
                  .map(
                    (link) =>
                      `                                            <a${renderAnchorAttributes(link)}>${renderText(link.label)}</a>`,
                  )
                  .join("<br>\n")}\n                                        </p>\n`
                : "";
              const ctaLabelMarkup = card.href && card.ctaLabel && !separateLinks
                ? `                                        <p class="ic-card-cta" aria-hidden="true">${renderText(card.ctaLabel)}</p>\n`
                : "";
              const figureMarkup = card.image
                ? `                                    <figure class="ic-card-media${escapeHtml(imageBoxClass)}">
                                        ${renderPicture(card.image, card.imageClassName || imageClassName, "lazy", "card", `card "${cardHeading || "unknown"}" image`)}
                                    </figure>`
                : card.iconSvg
                  ? `                                    <figure class="ic-card-media">
                                        ${normalizeIconSvgMarkup(card.iconSvg, { ariaHidden: true })}
                                    </figure>`
                  : "";
              const mediaMarkup = separateLinks && card.href && card.image
                ? `                                    <a${renderAnchorAttributes(card, { href: card.href, className: "ic-card-media-link", title: card.linkTitle })} tabindex="-1" aria-hidden="true">
${figureMarkup}
                                    </a>`
                : figureMarkup;

              const cardLabelMarkup = card.label
                ? `                                        <p class="ic-card-label">${renderText(card.label)}</p>\n`
                : "";
              // When card.label is present, bodyClassName must not leak to the wrapper div.
              const resolvedCardBodyClassName = card.label
                ? (card.cardBodyClassName || cardBodyClassName)
                : (card.cardBodyClassName || card.bodyClassName || cardBodyClassName);

              return `                            <li class="${escapeHtml(cardColumnClass)}">
                                <div class="${escapeHtml(card.className ? card.className + cardTextAlignClass + cardTitleSizeClass : resolvedCardClassName)}">
                                    <div class="${escapeHtml(resolvedCardBodyClassName)}">
${titleMarkup}${cardLabelMarkup}${bodyMarkup}${listMarkup}${contentHtmlMarkup ? `${contentHtmlMarkup}\n` : ""}${linksMarkup}${ctaLabelMarkup}
                                    </div>
${mediaMarkup}
                                </div>
                            </li>`;
            },
          )
          .join("\n\n");
      })();

  const pathDropdownMarkup = renderPathDropdownMarkup(section.pathDropdown, section.id, 24);
  const sectionOpen = `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName("ic-section", backgroundClass, getSectionChromeClassName(section), resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">`;
  const sectionClose = `${footerButtonsMarkup ? `\n\n${footerButtonsMarkup}` : ""}
            </div>
        </section>`;

  if (section.layout?.introPosition === "left") {
    const leftVerticalAlign = section.layout?.verticalAlign === "start"
      ? "align-items-start"
      : section.layout?.verticalAlign === "end"
        ? "align-items-end"
        : "align-items-center";
    return `${sectionOpen}
                <div class="row justify-content-center ${escapeHtml(leftVerticalAlign)}">
                    <div class="col col-12 col-xl-4">
                        ${renderSectionHeading(section)}
${introBodyMarkup ? `\n${introBodyMarkup}` : ""}${headerButtonsMarkup ? `\n\n${headerButtonsMarkup}` : ""}${pathDropdownMarkup}
                    </div>

                    <div class="col col-12 col-xl-6">
                        <ul class="${escapeHtml(cardListClassName)}">
${cardMarkup}
                        </ul>
                    </div>
                </div>
${sectionClose}`;
  }

  return `${sectionOpen}
                <div class="${escapeHtml(buildStructuredSectionRowClassName(section))}">
                    <div class="${escapeHtml(introColumnClass)}">
                        ${renderSectionHeading(section)}
${introBodyMarkup ? `\n${introBodyMarkup}` : ""}${headerButtonsMarkup ? `\n\n${headerButtonsMarkup}` : ""}${pathDropdownMarkup}
                    </div>
                </div>

                <div class="${escapeHtml(buildStructuredSectionRowClassName(section))}">
                    <div class="${escapeHtml(contentColumnClass)}">
                        <ul class="${escapeHtml(cardListClassName)}">
${cardMarkup}
                        </ul>
                    </div>
                </div>
${sectionClose}`;
}

// Inline SVG checkmark for boolean roster cells (replaces legacy .checkmark class)
const IC_TABLE_CHECK_SVG = '<svg class="ic-table-check" aria-hidden="true" viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M13.5 3.5a1 1 0 0 0-1.4 0L6 9.6 3.9 7.5a1 1 0 0 0-1.4 1.4l2.8 2.8a1 1 0 0 0 1.4 0L13.5 4.9a1 1 0 0 0 0-1.4z"/></svg>';

function renderRosterTable(table) {
  const columns = table.columns || [];
  const rows = table.rows || [];
  const captionMarkup = table.caption
    ? `\n                                <caption class="ic-visually-hidden">${escapeHtml(table.caption)}</caption>`
    : "";
  const theadCells = columns
    .map((col) => `\n                                        <th scope="col">${escapeHtml(col.label)}</th>`)
    .join("");
  const thead = `\n                                <thead>\n                                    <tr>${theadCells}\n                                    </tr>\n                                </thead>`;
  const tbodyRows = rows
    .map((row) => {
      const cells = columns
        .map((col, i) => {
          const rawVal = row[col.key] ?? "";
          if (col.type === "boolean") {
            const isYes = rawVal === true || rawVal === "yes" || rawVal === "true";
            return `\n                                        <td data-label="${escapeHtml(col.label)}"><span class="ic-visually-hidden">${isYes ? "Yes" : "No"}</span>${isYes ? IC_TABLE_CHECK_SVG : ""}</td>`;
          }
          if (i < 2) {
            return `\n                                        <th class="ic-table-row-header" scope="row" data-label="${escapeHtml(col.label)}">${renderText(String(rawVal))}</th>`;
          }
          return `\n                                        <td data-label="${escapeHtml(col.label)}">${renderText(String(rawVal))}</td>`;
        })
        .join("");
      return `\n                                    <tr>${cells}\n                                    </tr>`;
    })
    .join("");
  const tbody = `\n                                <tbody>${tbodyRows}\n                                </tbody>`;
  return `                <div class="row justify-content-center">\n                    <div class="col-12 col-md-auto">\n                        <div class="ic-table-responsive">\n                            <table class="ic-table ic-table--roster">${captionMarkup}${thead}${tbody}\n                            </table>\n                        </div>\n                    </div>\n                </div>`;
}

function renderStatsTable(table) {
  function renderRow(row) {
    const rowClass = row.emphasis === "total" ? ' class="ic-table-row--total"' : "";
    return `<tr${rowClass}>\n                                    <th scope="row">${renderText(String(row.label ?? ""))}</th>\n                                    <td>${renderText(String(row.value ?? ""))}</td>\n                                </tr>`;
  }
  const bodyRows = (table.rows || []).map((r) => renderRow(r)).join("\n                                ");
  const footerRows = (table.footerRows || []).map((r) => renderRow(r)).join("\n                                ");
  const tbody = `<tbody>\n                                ${bodyRows}\n                            </tbody>`;
  const tfoot = footerRows
    ? `\n                            <tfoot>\n                                ${footerRows}\n                            </tfoot>`
    : "";
  const leadMarkup = table.leadText
    ? `\n                <p class="ic-lead text-center">${renderText(String(table.leadText))}</p>`
    : "";
  const tableEl = `<table class="ic-table ic-table--stats">\n                            ${tbody}${tfoot}\n                        </table>`;
  const boxed = table.boxed !== false ? table.boxed === true : false;
  const inner = boxed
    ? `<div class="ic-box ic-background-light">\n                        ${tableEl}\n                    </div>`
    : tableEl;
  return `${leadMarkup}\n                <div class="row justify-content-center">\n                    <div class="col-12 col-md-10 col-lg-8 col-xl-6">\n                        ${inner}\n                    </div>\n                </div>`;
}

function renderDataTable(table) {
  if (!table?.variant) return { inner: "", outer: "" };
  if (table.variant === "roster") return { inner: "", outer: renderRosterTable(table) };
  if (table.variant === "stats") return { inner: "", outer: renderStatsTable(table) };
  return { inner: "", outer: "" };
}

function renderSectionList(list, indent = 24) {
  if (!list) return "";
  const { variant, items = [], columns, footnote, heading } = list;
  const pad = " ".repeat(indent);
  const padItem = " ".repeat(indent + 4);
  const headingMarkup = heading ? `${pad}<h3 class="ic-subsection-title">${renderText(heading)}</h3>\n` : "";

  if (variant === "labeled") {
    const colClass = columns === 2 ? " ic-list-block--cols-2" : "";
    const itemsMarkup = items
      .map((item) => `${padItem}<li><strong>${renderText(item.label)}</strong><br>${renderText(item.value)}</li>`)
      .join("\n");
    const footnoteMarkup = footnote ? `\n${pad}<p class="ic-disclaimer">${renderText(footnote, { widowProtection: true })}</p>` : "";
    return `${headingMarkup}${pad}<ul class="ic-list-block ic-list-block--labeled${colClass}">\n${itemsMarkup}\n${pad}</ul>${footnoteMarkup}`;
  }

  if (variant === "ordered") {
    const itemsMarkup = items
      .map((item) => {
        const text = typeof item === "string" ? item : (item.text || "");
        return `${padItem}<li>${renderText(text, { widowProtection: true })}</li>`;
      })
      .join("\n");
    return `${headingMarkup}${pad}<ol class="ic-list-block ic-list-block--ordered">\n${itemsMarkup}\n${pad}</ol>`;
  }

  if (variant === "checks") {
    const itemsMarkup = items
      .map((item) => {
        const text = typeof item === "string" ? item : (item.text || "");
        return `${padItem}<li>${renderText(text, { widowProtection: true })}</li>`;
      })
      .join("\n");
    return `${headingMarkup}${pad}<ul class="ic-check-list">\n${itemsMarkup}\n${pad}</ul>`;
  }

  return "";
}

function renderDecorativeImage(decorativeImage, indent = 8) {
  if (!decorativeImage?.image) return "";
  const imgClass = decorativeImage.placement === "cover" ? "ic-image-banner" : "ic-section-bg-img";
  const picHtml = renderPicture(decorativeImage.image, imgClass, "lazy", "decorative", `decorativeImage in section`);
  if (!picHtml) return "";
  const pad = " ".repeat(indent);
  return pad + picHtml.replace("<picture>", '<picture aria-hidden="true">').trim();
}

function renderTypographySegments(segments = []) {
  return segments.map((segment) => segment.type === "link"
    ? `<a${renderAnchorAttributes({ href: segment.href })}>${renderText(segment.label)}</a>`
    : renderText(segment.text || "")).join("");
}

function renderColorTokensSection(section) {
  const groupsMarkup = section.colorGroups.map((group) => {
    const tokensMarkup = group.tokens.map((token) => `                            <li class="js-ic-swatch ic-swatch ic-background-${escapeHtml(token.token)}"><strong>${renderText(token.label)}</strong></li>`).join("\n");
    return `                    <div class="col col-12 col-xl-4 pt-1 pb-3">
                        <h3 class="ic-h6">${renderText(group.label)}</h3>
                        <ul class="ic-swatches">
${tokensMarkup}
                        </ul>
                    </div>`;
  }).join("\n");
  return `        <section id="${escapeHtml(section.id)}" class="ic-section pb-0">
            <div class="container">
                <h2 class="ic-h5">${renderText(section.heading)}</h2>
                <div class="row">
${groupsMarkup}
                </div>
            </div>
        </section>`;
}

function renderTypographySamplesSection(section) {
  const headlinesMarkup = section.headlineSamples.map((sample) => `                        <p class="ic-h${sample.role}">${renderText(sample.text)}</p>`).join("\n");
  const paragraphsMarkup = section.paragraphSamples.map((sample) => {
    const className = sample.role === "lead" ? "ic-lead" : sample.role === "disclaimer" ? "ic-disclaimer" : "";
    return `                        <p${className ? ` class="${className}"` : ""}>${renderTypographySegments(sample.segments)}</p>`;
  }).join("\n");
  const listsMarkup = section.lists.map((list) => {
    const tag = list.kind === "ordered" ? "ol" : "ul";
    return `                        <${tag}>
${list.items.map((item) => `                            <li>${renderText(item)}</li>`).join("\n")}
                        </${tag}>`;
  }).join("\n");
  return `        <section id="${escapeHtml(section.id)}" class="ic-section">
            <div class="container">
                <h2 class="ic-h5">${renderText(section.heading)}</h2>
                <div class="row">
                    <div class="col col-12 py-3">
                        <h3 class="ic-h6">Headlines</h3>
${headlinesMarkup}
                    </div>
                    <div class="col col-12 col-lg-6 py-3">
                        <h3 class="ic-h6">Paragraphs</h3>
${paragraphsMarkup}
                    </div>
                    <div class="col col-12 col-lg-6 py-3">
                        <h3 class="ic-h6">Lists</h3>
${listsMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

export function renderStyleGuideFoundationProof() {
  return {
    colors: renderTextSection({ id: "proof-colors", type: "text", variant: "colorTokens", heading: "Colors", colorGroups: [
      { key: "brand", label: "Brand Colors", tokens: [{ token: "primary", label: "Primary" }, { token: "secondary", label: "Secondary" }, { token: "tertiary", label: "Tertiary" }] },
      { key: "grayscale", label: "Grayscale", tokens: [{ token: "white", label: "White" }, { token: "gray-50", label: "Gray 50" }, { token: "gray-100", label: "Gray 100" }, { token: "gray-200", label: "Gray 200" }, { token: "gray-500", label: "Gray 500" }, { token: "gray-700", label: "Gray 700" }, { token: "gray-900", label: "Gray 900" }, { token: "black", label: "Black" }] },
      { key: "ui", label: "UI Colors", tokens: [{ token: "positive", label: "Positive" }, { token: "negative", label: "Negative" }] },
    ] }),
    typography: renderTextSection({ id: "proof-typography", type: "text", variant: "typographySamples", heading: "Typography", headlineSamples: [1, 2, 3, 4, 5, 6].map((role) => ({ role, text: `Headline ${role}: <escaped>` })), paragraphSamples: [
      { role: "lead", segments: [{ type: "text", text: "Lead < " }, { type: "link", label: "Reference & guide", href: "#typography" }] },
      { role: "body", segments: [{ type: "text", text: "Body " }, { type: "link", label: "safe link", href: "https://www.i-car.com" }] },
      { role: "disclaimer", segments: [{ type: "text", text: "Disclaimer <escaped>" }] },
    ], lists: [{ kind: "unordered", items: ["Unordered <one>"] }, { kind: "ordered", items: ["Ordered <one>"] }] }),
  };
}

function renderTextSection(section) {
  if (section.variant === "colorTokens") return renderColorTokensSection(section);
  if (section.variant === "typographySamples") return renderTypographySamplesSection(section);
  const backgroundClass = getBackgroundClassName(section);
  const textLayout = section.layout || {};
  const textAlignment = section.textAlignment === "center"
    ? "center"
    : section.textAlignment === "start"
      ? "start"
      : (textLayout.align || "center");
  const introColumnClass = joinClassNames(
    {
      default: "col col-md-10 col-lg-8 col-xl-6",
      narrow: "col col-md-10 col-lg-8 col-xl-5",
      full: "col col-12",
    }[textLayout.width || "default"] || "col col-md-10 col-lg-8 col-xl-6",
    textAlignment === "start" ? "" : "text-md-center",
  );
  const buttons = getSectionButtonsByLocation(section, "header");
  const actionsStyle = textLayout.actionsStyle || section.actions?.style || "buttons";
  const actionsLayout = textLayout.actionsLayout || section.actions?.layout || "inline";
  const actionsVariant = textLayout.actionsVariant || section.actions?.variant || "outline";
  const bodyClassName = actionsStyle === "linkList" && actionsLayout === "stack" && actionsVariant === "text"
    ? "mb-2 pb-1"
    : "";
  const bodyMarkup = renderParagraphContent(section, bodyClassName);
  const buttonsMarkup = actionsStyle === "linkList"
    ? renderActionLinks(buttons, {
      stack: actionsLayout === "stack",
      linkClassName: actionsVariant === "text" ? "" : resolveButtonClassName({ variant: actionsVariant }, "ic-btn ic-btn-primary ic-btn-outline"),
    })
    : renderButtons(buttons, resolveButtonClassName({ variant: actionsVariant }, "ic-btn ic-btn-primary ic-btn-outline"));
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");
  const { outer: tableMarkup } = renderDataTable(section.table);
  const listMarkup = renderSectionList(section.list, 24);
  const decorativeCoverMarkup = section.decorativeImage?.placement === "cover" ? renderDecorativeImage(section.decorativeImage, 12) : "";
  const decorativeBottomMarkup = section.decorativeImage?.placement === "bottom" ? renderDecorativeImage(section.decorativeImage, 8) : "";
  const pathDropdownMarkup = renderPathDropdownMarkup(section.pathDropdown, section.id, 24);

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName("ic-section", backgroundClass, getSectionChromeClassName(section), resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
${decorativeCoverMarkup ? `${decorativeCoverMarkup}\n` : ""}            <div class="container">
                <div class="${escapeHtml(buildStructuredSectionRowClassName(section))}">
                    <div class="${escapeHtml(introColumnClass)}">
                        ${renderSectionHeading(section)}
${bodyMarkup ? `\n${bodyMarkup}` : ""}${listMarkup ? `\n\n${listMarkup}` : ""}
${buttonsMarkup ? `\n\n${buttonsMarkup}` : ""}${pathDropdownMarkup}
                    </div>
                </div>${tableMarkup ? `\n${tableMarkup}` : ""}
            </div>
${footerButtonsMarkup ? `\n${footerButtonsMarkup}` : ""}${decorativeBottomMarkup ? `\n${decorativeBottomMarkup}` : ""}
        </section>`;
}

function renderHtmlSection(section) {
  return normalizeHtmlBlocks(section.html)
    .map((block) => renderTrustedHtml(block, { normalizeText: false }).trim())
    .filter(Boolean)
    .join("\n");
}

function renderStatementListSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = renderParagraphContent(section);
  const contentAlignmentClass = section.textAlignment === "start" ? "" : "text-center";
  const statementHeadingClass = section.textAlignment === "start" ? "" : ' class="text-center w-100"';
  const sectionHeadingClass = joinNonEmptyClassNames("ic-section-title", contentAlignmentClass);
  const statementsMarkup = (section.statements || [])
    .map(
      (statement) => `                        <h3${statementHeadingClass}>${renderText(statement.heading || statement.title)}</h3>

                        <p>${renderText(statement.body, { widowProtection: true })}</p>`,
    )
    .join("\n\n");

  const pathDropdownMarkup = renderPathDropdownMarkup(section.pathDropdown, section.id, 24);

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(section.contentColumnClass || joinNonEmptyClassNames("col col-md-10 col-lg-8 col-xl-6", contentAlignmentClass))}">
                        <h2 class="${escapeHtml(sectionHeadingClass)}">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}\n` : ""}
${statementsMarkup}${pathDropdownMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderProgressListSection(section) {
  const introMarkup = indentBlock(renderParagraphContent(section), 24);
  const groupsMarkup = (section.groups || []).map((group, groupIndex) => {
    const measuresMarkup = (group.measures || []).map((measure, measureIndex) => {
      const progressId = `${section.id}-progress-${groupIndex + 1}-${measureIndex + 1}`;
      const valueMarkup = measure.percent === undefined
        ? `<span class="ic-progress-list-unavailable">${renderText(measure.unavailable)}</span>`
        : `<progress id="${escapeHtml(progressId)}" max="100" value="${escapeHtml(String(measure.percent))}">${escapeHtml(String(measure.percent))}%</progress><span aria-hidden="true">${escapeHtml(String(measure.percent))}%</span>`;
      return `                            <li class="ic-progress-list-item">${measure.percent === undefined ? `<span>${renderText(measure.label)}</span>` : `<label for="${escapeHtml(progressId)}">${renderText(measure.label)}</label>`}${valueMarkup}${measure.supportingText ? `<p>${renderText(measure.supportingText)}</p>` : ""}</li>`;
    }).join("\n");
    const groupBody = (group.paragraphs || []).map((paragraph) => `<p>${renderText(paragraph)}</p>`).join("\n");
    return `                        <section class="ic-progress-list-group"><h3>${renderText(group.heading)}</h3>${groupBody}\n                        <ul class="ic-progress-list list-unstyled">\n${measuresMarkup}\n                        </ul></section>`;
  }).join("\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${getBackgroundClassName(section)}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-9">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${introMarkup ? `${introMarkup}\n` : ""}${groupsMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderCtaSection(section) {
  const bodyMarkup = section.inlineLinkParagraphs
    ? renderTypedInlineLinkParagraphs(section.inlineLinkParagraphs)
    : renderParagraphContent(section);
  const buttonsMarkup = renderButtons(getSectionButtonsByLocation(section, "header"), "ic-btn ic-btn-primary ic-btn-outline");
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");
  const pathDropdownMarkup = renderPathDropdownMarkup(section.pathDropdown, section.id, 24);
  const imageMarkup = section.image
    ? `\n                    <div class="col col-12 col-md-5">${renderPicture(section.image, "ic-section-image ic-image-rounded", "lazy", "cta", `section \"${section.id}\" image`)}</div>`
    : "";
  // Default to ic-background-light; honor white override; spacing and chrome now apply.
  const ctaBackgroundClass = getBackgroundColor(section) === "white" ? "ic-background-white" : "ic-background-light";

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName("ic-section", ctaBackgroundClass, getSectionChromeClassName(section), resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
${buttonsMarkup ? `\n\n${buttonsMarkup}` : ""}${pathDropdownMarkup}
                    </div>${imageMarkup}
                </div>
            </div>
${footerButtonsMarkup ? `\n${footerButtonsMarkup}` : ""}
        </section>`;
}

function joinNonEmptyClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

function resolveTextMediaSemanticLayout(section) {
  const layout = section.layout;

  if (!layout) {
    return null;
  }

  const desktopMediaPosition = layout.desktopMediaPosition || (section.reverse ? "left" : "right");
  const mobileMediaOrder = layout.mobileMediaOrder || (desktopMediaPosition === "left" ? "above" : "below");
  const desktopSplit = layout.desktopSplit || "equal";
  const contentWidth = layout.contentWidth || "default";
  const copyVerticalAlign = layout.copyVerticalAlign || "start";
  const mobileCopySpacing = layout.mobileCopySpacing || (mobileMediaOrder === "above" ? "offset" : "none");
  const mobileMediaSpacing = layout.mobileMediaSpacing || (mobileMediaOrder === "below" ? "tight" : "none");
  const rowVerticalAlign = layout.rowVerticalAlign || "center";
  const imageStyle = layout.imageStyle || "rounded";
  const imageFrame = layout.imageFrame || "section";
  const imageSize = layout.imageSize || "default";
  const imageInset = layout.imageInset === true || imageSize === "compact";
  const imageRounded = layout.imageRounded !== false && section.imageRounded !== false;
  const desktopGapTarget = layout.desktopGapTarget || (desktopMediaPosition === "right" ? "copy" : "media");
  const desktopGapBreakpoint = layout.desktopGapBreakpoint || "lg";
  const mobileCopySpacingResetBreakpoint = layout.mobileCopySpacingResetBreakpoint || "md";

  const contentColumnClass = {
    default: "col col-12 col-xl-10",
    narrow: "col col-12 col-lg-10 col-xl-8",
    wide: "col col-12 col-lg-10 col-xl-9",
    full: "col col-12",
  }[contentWidth] || "col col-12 col-xl-10";

  const textDesktopSplitClass = {
    equal: "col-md-6",
    "text-5-media-7": "col-md-6 col-xl-5",
    "text-7-media-5": "col-md-6 col-xl-7",
  }[desktopSplit] || "col-md-6";

  const mediaDesktopSplitClass = {
    equal: "col-md-6",
    "text-5-media-7": "col-md-6 col-xl-7",
    "text-7-media-5": "col-md-6 col-xl-5",
  }[desktopSplit] || "col-md-6";
  const copyFirstDomOrder = layout.domOrder === "copy-first";
  const orderClasses = resolveSplitColumnOrderClasses(desktopMediaPosition, mobileMediaOrder, !copyFirstDomOrder);
  const gapClasses = resolveSplitColumnGapClassNames({
    desktopMediaPosition,
    desktopGapTarget,
    desktopGapBreakpoint,
    gapSide: layout.desktopGapSide,
  });

  const textMobileSpacingClass = mobileCopySpacing === "offset"
    ? `mt-2 pt-1 mt-${mobileCopySpacingResetBreakpoint}-0 pt-${mobileCopySpacingResetBreakpoint}-0`
    : mobileCopySpacing === "tight"
      ? (mobileMediaOrder === "above" ? `mt-3 pt-1 mt-${mobileCopySpacingResetBreakpoint}-0 pt-${mobileCopySpacingResetBreakpoint}-0` : `mb-3 mb-${mobileCopySpacingResetBreakpoint}-0`)
      : "";
  const mediaMobileSpacingClass = {
    none: "",
    tight: "mt-3 mt-md-0",
    loose: "mt-4 mt-md-0",
    section: "mt-3 pt-3 mt-md-0 pt-md-0",
  }[mobileMediaSpacing] || "";
  const textVerticalAlignClass = copyVerticalAlign === "center" ? "align-self-center" : "";

  return {
    textColumnClasses: joinNonEmptyClassNames(
      "col col-12",
      textDesktopSplitClass,
      orderClasses.copyClassName,
      textMobileSpacingClass,
      gapClasses.copyClassName,
      textVerticalAlignClass,
    ),
    mediaColumnClasses: joinNonEmptyClassNames(
      "col col-12",
      mediaDesktopSplitClass,
      orderClasses.mediaClassName,
      mediaMobileSpacingClass,
      gapClasses.mediaClassName,
    ),
    contentColumnClass,
    rowClassName: joinNonEmptyClassNames(
      "row justify-content-between",
      rowVerticalAlign === "end" ? "align-items-end" : "align-items-center",
    ),
    imageClassName: resolveSplitImageClassName({
      imageStyle,
      imageFrame,
      imageInset,
      imageRounded,
    }),
  };
}

function renderLinkedItems(linkedItems) {
  if (!Array.isArray(linkedItems) || linkedItems.length === 0) return "";
  const itemsMarkup = linkedItems
    .map((item) => {
      const logoMarkup = item.logo
        ? renderImg(item.logo, "ic-linked-item-img", { loading: "lazy", context: `linkedItem "${item.heading || "unknown"}" logo` })
        : "";
      const logoCellMarkup = logoMarkup
        ? `                                    <div class="ic-linked-item-logo">
                                        ${item.link?.href ? `<a${renderAnchorAttributes(item.link)}>${logoMarkup}</a>` : logoMarkup}
                                    </div>`
        : "";
      const headingMarkup = item.heading
        ? `                                        <h3 class="ic-linked-item-heading">${renderText(item.heading)}</h3>\n`
        : "";
      const bodyContent = hasParagraphContent(item)
        ? `${indentBlock(renderParagraphContent(item), 24)}\n`
        : "";
      const linkMarkup = item.link?.label
        ? `                                        <p><a${renderAnchorAttributes(item.link)}>${renderText(item.link.label)}</a></p>\n`
        : "";
      const copyCellMarkup = `                                    <div class="ic-linked-item-copy">
${headingMarkup}${bodyContent}${linkMarkup}                                    </div>`;
      return `                                <div class="ic-linked-item">
${logoCellMarkup ? `${logoCellMarkup}\n` : ""}${copyCellMarkup}
                                </div>`;
    })
    .join("\n\n");
  return `                                <div class="ic-linked-items">
${itemsMarkup}
                                </div>`;
}

function renderTextMediaSubsections(subsections) {
  if (!Array.isArray(subsections) || subsections.length === 0) return "";
  return subsections
    .map((sub) => {
      const level = sub.headingLevel === "h4" ? "h4" : "h3";
      const headingMarkup = `                                <${level} class="ic-subsection-title">${renderText(sub.heading)}</${level}>`;
      const subBodyMarkup = indentBlock(renderParagraphContent(sub), 12);
      return subBodyMarkup ? `${headingMarkup}\n${subBodyMarkup}` : headingMarkup;
    })
    .join("\n\n");
}

function renderTextMediaSection(section) {
  if (section.variant === "goldClassBenefits") {
    return renderGoldClassBenefitsSection(section);
  }

  if (section.variant === "goldClassCta") {
    return renderGoldClassCtaSection(section);
  }

  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = indentBlock(section.inlineLinkParagraphs
    ? renderTypedInlineLinkParagraphs(section.inlineLinkParagraphs)
    : renderParagraphContent(section), 12);
  const buttonsMarkup = indentBlock(
    renderButtons(getSectionButtonsByLocation(section, "header"), "ic-btn ic-btn-primary ic-btn-outline"),
    12,
  );
  const headerLinks = getSectionLinksByLocation(section, "header");
  const headerLinkListClassName = resolveLinkListClassName(section.links);
  const linkListMarkup = headerLinks.length ? `${renderLinkList(headerLinks, headerLinkListClassName)}\n` : "";
  const subsectionsMarkup = renderTextMediaSubsections(section.subsections);
  const linkedItemsMarkup = renderLinkedItems(section.linkedItems);
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");
  const footerLinksMarkup = renderFooterLinkRow(getSectionLinksByLocation(section, "footer"));
  const semanticLayout = resolveTextMediaSemanticLayout(section);
  const textColumnClasses = (section.textColumnClass || semanticLayout?.textColumnClasses || (section.reverse
    ? "col col-12 col-md-6 mt-3 mt-md-0 pl-lg-5"
    : "col col-12 col-md-6 mb-3 pb-3 mb-md-0 pb-md-0 pr-lg-5")) + (section.layout?.copyFlow === "block" ? " ic-copy-flow-block" : "");
  const mediaColumnClasses = section.mediaColumnClass || semanticLayout?.mediaColumnClasses || (section.reverse
    ? "col col-12 col-md-6 pr-lg-5"
    : "col col-12 col-md-6 mt-3 pt-1 mt-md-0 pt-md-0");
  const contentColumnClass = section.contentColumnClass || semanticLayout?.contentColumnClass || "col col-12 col-xl-10";
  const rowClassName = section.rowClassName || semanticLayout?.rowClassName || "row justify-content-between align-items-center";
  const textLabelAbove = section.layout?.labelPosition === "above";
  const textLabelMarkup = section.label ? `                                <p class="${escapeHtml(section.labelClassName || "ic-label")}">${renderText(section.label)}</p>\n` : "";
  const textColumnClassesFinal = textLabelAbove && section.label
    ? `${textColumnClasses} ic-text-column--label-above`
    : textColumnClasses;
  const listMarkup = renderSectionList(section.list, 32);
  const decorativeCoverMarkup = section.decorativeImage?.placement === "cover" ? renderDecorativeImage(section.decorativeImage, 12) : "";
  const decorativeBottomMarkup = section.decorativeImage?.placement === "bottom" ? renderDecorativeImage(section.decorativeImage, 8) : "";
  const pathDropdownMarkup = renderPathDropdownMarkup(section.pathDropdown, section.id, 32);
  const badgeImageMarkup = section.badgeImage
    ? `                                <div class="ic-text-logo">${renderImg(section.badgeImage, "ic-image-logo", { loading: section.badgeImage.loading || "lazy", context: `section "${section.id}" badge image` })}</div>\n`
    : "";
  const textColumn = `                            <div class="${escapeHtml(textColumnClassesFinal)}">
${badgeImageMarkup}${textLabelAbove && textLabelMarkup ? textLabelMarkup : ""}                                <h2 class="${escapeHtml(section.titleClassName || "ic-section-title")}">${renderText(getSectionHeading(section))}</h2>
${!textLabelAbove && textLabelMarkup ? textLabelMarkup : ""}${section.sublabel ? `                                <p class="ic-sublabel">${renderText(section.sublabel, { widowProtection: true })}</p>\n` : ""}${bodyMarkup ? `${bodyMarkup}\n` : ""}${listMarkup ? `${listMarkup}\n` : ""}${subsectionsMarkup ? `${subsectionsMarkup}\n` : ""}${linkedItemsMarkup ? `${linkedItemsMarkup}\n` : ""}${linkListMarkup}${buttonsMarkup ? `\n${buttonsMarkup}\n` : ""}${pathDropdownMarkup ? `${pathDropdownMarkup}\n` : ""}                            </div>`;
  const pictureMarkup = section.variant === "componentLibraryTyped" && section.media
    ? renderTypedMedia(section.media, { context: `section "${section.id}" media` })
    : section.mediaHtml
    ? renderTrustedHtml(section.mediaHtml)
    : renderPicture(section.image, section.imageClassName || semanticLayout?.imageClassName || joinClassNames("ic-section-image", section.imageRounded === false ? "" : "ic-image-rounded"), "lazy", "textMedia", `section "${section.id}" image`);
  const linkedPictureMarkup = (section.variant === "componentLibraryTyped" && section.media) || section.mediaHtml
    ? `                                ${pictureMarkup}`
    : section.imageLink
      ? `                                <a${renderAnchorAttributes(section.imageLink, { title: section.imageLink.title || getSectionHeading(section) })}>
${indentBlock(pictureMarkup, 36)}
                                </a>`
      : `                                ${pictureMarkup}`;
  const mediaColumn = `                            <div class="${escapeHtml(mediaColumnClasses)}">
${linkedPictureMarkup}
                            </div>`;

  const copyFirstDomOrder = section.layout?.domOrder === "copy-first";

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.sectionClassName, section.__autoSectionClassName))}">
${decorativeCoverMarkup ? `${decorativeCoverMarkup}\n` : ""}            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(contentColumnClass)}">
                        <div class="${escapeHtml(rowClassName)}">
${(section.layout?.desktopMediaPosition || (section.reverse ? "left" : "right")) === "left" && !copyFirstDomOrder ? `${mediaColumn}\n\n${textColumn}` : `${textColumn}\n\n${mediaColumn}`}
                        </div>
                    </div>
                </div>
            </div>
${footerLinksMarkup ? `\n${footerLinksMarkup}` : ""}${footerButtonsMarkup ? `\n${footerButtonsMarkup}` : ""}${decorativeBottomMarkup ? `\n${decorativeBottomMarkup}` : ""}
        </section>`;
}

function renderQuoteGridSection(section) {
  if (section.variant === "goldClassTestimonials") {
    return renderGoldClassTestimonialsSection(section);
  }

  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = indentBlock(renderParagraphContent(section), 8);
  const buttonsMarkup = renderButtons(getSectionButtonsByLocation(section, "header"), "ic-btn ic-btn-primary ic-btn-outline");
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");
  const useCarousel = section.carousel !== false;
  const slideClassName = useCarousel
    ? "swiper-slide col col-12 col-md-6 col-xl-3 pt-3 mt-1 mt-md-3"
    : "col col-12 col-md-6 col-xl-3 pt-3 mt-1 mt-md-3";
  const quoteMarkup = (section.quotes || [])
    .map(
      (quote) => `                            <div class="${slideClassName}">
                                <figure class="ic-card ic-background-white">
                                    <blockquote class="ic-card-body">
                                        <p class="ic-card-text">${renderText(quote.quote, { widowProtection: true })}</p>
                                    </blockquote>
                                    <figcaption class="ic-card-cite ic-cite">
                                        ${quote.image ? renderImg(quote.image, "ic-cite-photo", { width: "70", height: "70", sizes: "80px", loading: "lazy", context: `quote "${quote.name}" image` }) : ""}
                                        <p>
                                            <cite>
                                                <strong>${renderText(quote.name)}</strong><br>
                                                <span class="ic-cite-title">${renderText(quote.title, { widowProtection: true })}</span>
                                            </cite>
                                        </p>
                                    </figcaption>
                                </figure>
                            </div>`,
    )
    .join("\n\n");

  const quotesWrapperMarkup = useCarousel
    ? `                        <div class="swiper ic-swiper js-ic-swiper">
                            <div class="swiper-wrapper row align-items-stretch">
${quoteMarkup}
                            </div>
                        </div>`
    : `                        <div class="row align-items-stretch">
${quoteMarkup}
                        </div>`;
  const embedMarkup = section.embed?.src
    ? `\n                <div class="row justify-content-center pt-4"><div class="col col-12 col-lg-10 col-xl-8">${renderQuoteEmbedMarkup({ src: section.embed.src, title: section.embed.title })}</div></div>`
    : "";

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.sectionClassName, section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}${buttonsMarkup ? `\n\n${buttonsMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12">
${quotesWrapperMarkup}
                    </div>
                </div>
${footerButtonsMarkup ? `\n\n${footerButtonsMarkup}` : ""}
${embedMarkup}
            </div>
        </section>`;
}

function renderQuoteSection(section) {
  const legacyTrusted = section.__legacyQuoteTrusted === true;
  const backgroundClass = getBackgroundClassName(section);
  const variant = ["default", "side-by-side", "compact"].includes(section.variant) ? section.variant : (section.compact ? "compact" : section.quoteLayout === "side-by-side" ? "side-by-side" : "default");
  const quoteClass = variant === "compact" ? "ic-quote-text mb-3 pb-1" : "ic-quote-text";
  const quoteLayout = variant === "side-by-side" ? "side-by-side" : "stacked";
  const quoteEmbedSrc = typeof section.embed?.src === "string" ? section.embed.src.trim() : "";
  const quoteEmbedHtml = legacyTrusted && typeof section.embed?.html === "string" ? section.embed.html.trim() : "";
  const quoteEmbedTitle = typeof section.embed?.title === "string" && section.embed.title.trim()
    ? section.embed.title.trim()
    : `${getSectionHeading(section) || "Embedded"} video`;
  const quoteEmbedMarkup = renderQuoteEmbedMarkup({ html: quoteEmbedHtml, src: quoteEmbedSrc, title: quoteEmbedTitle });
  const citeTitleMarkup = legacyTrusted && section.cite?.titleHtml ? renderTrustedHtml(section.cite.titleHtml) : `<span class="ic-cite-title">${renderText(section.cite.title, { widowProtection: true })}</span>`;
  const introBodyMarkup = hasParagraphContent(section)
    ? indentBlock(renderParagraphContent(section, section.introTextClassName || (section.centerIntro ? "text-center" : "")), 8)
    : "";
  const quoteBody = (section.quoteParagraphs || (legacyTrusted ? section.quoteHtml : []) || [])
    .map((paragraph) => {
      const paragraphClass = variant === "compact" ? ' class="text-md-center"' : "";
      return `                                <p${paragraphClass}>${legacyTrusted ? renderTrustedHtml(paragraph) : renderText(paragraph)}</p>`;
    })
    .join("\n");

  if (variant === "compact") {
    return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6">
                        <h2 class="ic-section-title text-md-center">${renderText(getSectionHeading(section))}</h2>

                        <figure>
                            <blockquote>
                                <div class="${quoteClass}">
${quoteBody}
                                </div>
                            </blockquote>
                            <figcaption class="ic-cite">
                                    ${renderImg(section.cite.image, "ic-cite-photo", { width: "70", height: "70", sizes: "80px", loading: "lazy", context: `quote "${section.id}" cite image` })}
                                    <p>
                                        <cite>
                                            <strong>${renderText(section.cite.name)}</strong><br>
                                            ${citeTitleMarkup}
                                        </cite>
                                    </p>
                                </figcaption>
                        </figure>
${quoteEmbedMarkup ? `\n${quoteEmbedMarkup}` : ""}
                    </div>
                </div>
            </div>
        </section>`;
  }

  const quoteCardMarkup = quoteLayout === "side-by-side"
    ? `                        <blockquote class="ic-card ic-card-lg ic-background-white">
                            <div class="ic-card-body">
                                <div class="${quoteClass}">
${quoteBody}
                                </div>
                            </div>
                            <div class="ic-card-media">
                                <div class="ic-card-cite ic-cite">
                                    ${renderImg(section.cite.image, "ic-cite-photo", { width: "100", height: "100", sizes: "100px", loading: "lazy", srcWidth: "100", context: `quote "${section.id}" cite image` })}
                                    <p>
                                        <cite>
                                            <strong>${renderText(section.cite.name)}</strong><br>
                                            ${citeTitleMarkup}
                                        </cite>
                                    </p>
                                </div>
                            </div>
                        </blockquote>`
    : `                        <figure class="ic-card ic-card-lg ic-background-white">
                            <blockquote class="ic-card-body">
                                <div class="${quoteClass}">
${quoteBody}
                                </div>
                            </blockquote>
                            <figcaption class="ic-card-media">
                                <div class="ic-card-cite ic-cite">
                                    ${renderImg(section.cite.image, "ic-cite-photo", { width: "70", height: "70", sizes: "80px", loading: "lazy", context: `quote "${section.id}" cite image` })}
                                    <p>
                                        <cite>
                                            <strong>${renderText(section.cite.name)}</strong><br>
                                            ${citeTitleMarkup}
                                        </cite>
                                    </p>
                                </div>
                            </figcaption>
                        </figure>`;

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center mb-3 pb-3 mb-md-2 pb-md-0">
                    <div class="col col-md-10 col-lg-8 col-xl-6">
                        <h2 class="ic-section-title text-center">${renderText(getSectionHeading(section))}</h2>
${introBodyMarkup ? `\n${introBodyMarkup}\n` : ""}
${quoteCardMarkup}
${quoteEmbedMarkup ? `\n${quoteEmbedMarkup}` : ""}
                    </div>
                </div>
            </div>
        </section>`;
}

export function renderQuoteContractProof() {
  const cite={ name:"A & B", title:"Title <safe>", image:{ alt:"A", desktopSrc:"/a.webp", width:"70", height:"70" } };
  const culturePage=parseStructuredAuthoringFile(resolve(process.cwd(),"content/pages/about-us/culture.yaml"));
  const careersPage=parseStructuredAuthoringFile(resolve(process.cwd(),"content/pages/about-us/careers.yaml"));
  throwOnValidationError(validatePageData(culturePage,"content/pages/about-us/culture.yaml"),"culture proof");
  throwOnValidationError(validatePageData(careersPage,"content/pages/about-us/careers.yaml"),"careers proof");
  const legacyCulture=culturePage.sections.find((section)=>section.id==="ceo");
  const legacyCareers=careersPage.sections.find((section)=>section.id==="ceo-quote");
  return {
    default: renderQuoteSection({id:"quote-default",type:"quote",variant:"default",heading:"Default",quoteParagraphs:["<escaped>"],cite}),
    sideBySide: renderQuoteSection({id:"quote-side",type:"quote",variant:"side-by-side",heading:"Side",paragraphs:["Intro"],quoteParagraphs:["Quote"],cite,embed:{src:"https://example.test/video",title:"Video"}}),
    compact: renderQuoteSection({id:"quote-compact",type:"quote",variant:"compact",heading:"Compact",quoteParagraphs:["Quote"],cite}),
    legacyCulture: renderQuoteSection(legacyCulture),
    legacyCareers: renderQuoteSection(legacyCareers),
  };
}

function renderQuoteEmbedMarkup({ html = "", src = "", title = "" } = {}) {
  const iframeSrc = src || extractIframeSrcFromHtml(html);

  if (iframeSrc) {
    return renderIframeEmbedPlaceholder({ src: iframeSrc, title });
  }

  if (html) {
    return indentBlock(normalizeEmbedHtml(renderTrustedHtml(html, { normalizeText: false })), 24);
  }

  if (!src) {
    return "";
  }

  return renderIframeEmbedPlaceholder({ src, title });
}

function renderProfileGridSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = indentBlock(renderParagraphContent(section), 8);
  const profileMarkup = (section.profiles || [])
    .map(
      (profile) => `                            <li class="col-6 col-md-4 col-lg-3 col-xxl-5up mt-3 pt-3">
                                <article class="ic-card ic-card-column">
                                    <figure class="ic-card-media">
                                        <figcaption class="ic-card-profile ic-profile ic-profile-stacked">
                                            ${renderImg(profile.image || { alt: profile.name }, "ic-profile-photo", { width: "100", height: "100", sizes: "100px", loading: "lazy", context: `profile "${profile.name}" image` })}
                                            <p>
                                                <strong>${renderText(profile.name)}</strong><br>
                                                ${renderText(profile.title, { widowProtection: true })}
                                            </p>
                                        </figcaption>
                                    </figure>
                                </article>
                            </li>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center mb-2">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-center">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12 col-xl-10">
                        <ul class="row justify-content-md-center">
${profileMarkup}
                        </ul>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderMediaFeatureListSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = indentBlock(renderParagraphContent(section), 8);
  const introAlignmentClass = section.textAlignment === "center"
    ? "text-center"
    : section.textAlignment === "start"
      ? "text-md-start"
      : "text-md-center";
  const featureMarkup = (section.cards || [])
    .map(
      (card) => `                            <div class="col col-12 mt-3 pt-3 mt-md-4">
                                <div class="ic-card">
                                    <div class="row">
                                        <div class="col col-12 col-md order-last mt-2 pt-1 mt-md-0 pt-md-0">
                                            <h3 class="mb-2">${renderText(getCardHeading(card))}</h3>

                                            <p class="mb-1"><strong>${renderText(card.lead, { widowProtection: true })}</strong></p>

${hasParagraphContent(card) ? `${indentBlock(renderParagraphContent(card), 44)}\n` : ""}
                                        </div>

                                        <div class="col col-12 col-md order-first pr-lg-3">
                                            <figure class="ic-card-media">
                                                ${renderPicture(card.image, "ic-card-image ic-image-rounded", "lazy", "card", `feature "${getCardHeading(card) || "unknown"}" image`)}
                                            </figure>
                                        </div>
                                    </div>
                                </div>
                            </div>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.className, section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(section.introColumnClass || joinNonEmptyClassNames("col col-md-10 col-lg-8 col-xl-6", introAlignmentClass))}">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-8">
                        <div class="row justify-content-center">
${featureMarkup}
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function resolveIconCardColumnClass(cardsPerRow) {
  const columnsByBreakpoint = typeof cardsPerRow === "object" && cardsPerRow !== null && !Array.isArray(cardsPerRow)
    ? cardsPerRow
    : null;
  const responsiveClasses = columnsByBreakpoint
    ? ["sm", "md", "lg", "xl", "xxl"].flatMap((breakpoint) => {
      const columns = columnsByBreakpoint[breakpoint];
      if (columns === "auto") return [`col-${breakpoint}-auto`];
      const span = { 1: "12", 2: "6", 3: "4", 4: "3" }[columns];
      return span ? [`col-${breakpoint}-${span}`] : [];
    })
    : [];
  const numericClass = { 2: "col-md-6", 3: "col-md-4", 4: "col-md-3" }[cardsPerRow];

  return responsiveClasses.length > 0
    ? joinNonEmptyClassNames("col col-12", ...responsiveClasses)
    : numericClass
      ? joinNonEmptyClassNames("col col-12", numericClass)
      : "";
}

function resolveIconCardSpacingClassNames(cardSpacing) {
  if (!cardSpacing || typeof cardSpacing !== "object" || Array.isArray(cardSpacing)) return "";

  const tokenScale = { none: "0", tight: "1", small: "2", medium: "3", wide: "4" };
  const propertyPrefixes = {
    paddingInline: "px",
    paddingBlock: "py",
    paddingTop: "pt",
    marginTop: "mt",
  };
  const breakpointOrder = ["base", "sm", "md", "lg", "xl", "xxl"];

  return Object.entries(propertyPrefixes).flatMap(([property, prefix]) => {
    const values = cardSpacing[property];
    if (!values || typeof values !== "object" || Array.isArray(values)) return [];
    return breakpointOrder.flatMap((breakpoint) => {
      const scale = tokenScale[values[breakpoint]];
      if (scale === undefined) return [];
      return [`${prefix}${breakpoint === "base" ? "" : `-${breakpoint}`}-${scale}`];
    });
  }).join(" ");
}

function renderIconCardGridSection(section) {
  if (section.variant === "goldClassValueProps") {
    return renderGoldClassValuePropsSection(section);
  }

  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = indentBlock(renderParagraphContent(section), 8);
  const footerBodyMarkup = indentBlock(
    renderContentParagraphs(section.footerBody || [], section.footerBodyHtml || []),
    8,
  );
  const headerButtonsMarkup = renderButtons(getSectionButtonsByLocation(section, "header"), "ic-btn ic-btn-primary ic-btn-outline");
  const footerButtonsMarkup = renderButtons(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");
  const cardsPerRowClass = resolveIconCardColumnClass(section.layout?.cardsPerRow);
  const cardSpacingClass = resolveIconCardSpacingClassNames(section.layout?.cardSpacing);
  const defaultCardColumnClass = "col col-12 col-md-6 col-lg-4 col-xl-3 col-xxl-5up";
  const cardColumnClass = section.cardColumnClass || joinNonEmptyClassNames(cardsPerRowClass || defaultCardColumnClass, cardSpacingClass);
  const cardListClassName = section.cardListClassName
    // row_compact's compensating padding only targets .col-xxl-5up (the default
    // cardColumnClass below); a custom cardsPerRow needs plain Bootstrap gutters instead.
    || (cardsPerRowClass ? "row justify-content-center list-unstyled mb-0" : "row row_compact justify-content-center list-unstyled mb-0");
  const cardTextAlignClass = section.layout?.cardTextAlign === "center" ? " ic-card--text-center" : "";
  const cardMarkup = (section.cards || [])
    .map(
      (card) => {
        return `                    <li class="${escapeHtml(cardColumnClass)}">
                        <div class="ic-card ic-card-horizontal-mobile ic-background-white${escapeHtml(cardTextAlignClass)}">
                            <div class="ic-card-body">
${getCardHeading(card) ? `                                <h3 class="ic-card-title">${card.href ? `<a${renderAnchorAttributes(card, { href: card.href, className: "stretched-link", title: card.linkTitle || getCardHeading(card) })}>${renderText(getCardHeading(card))}</a>` : renderText(getCardHeading(card))}</h3>\n` : ""}
${hasParagraphContent(card) ? `${indentBlock(renderParagraphContent(card, "ic-card-text"), 32)}\n` : ""}
                            </div>
                            <figure class="ic-card-media">
${indentBlock(resolveIconSvg(card).trim(), 32)}
                            </figure>
                        </div>
                    </li>`;
      },
    )
    .join("\n\n");

  // The left-intro split layout narrows the card column (see introPosition branch
  // below), which needs the compact card treatment in _card-media.scss — content
  // authors only set layout.introPosition, this class is a derived consequence, not
  // a separate option.
  const splitVariantClass = section.layout?.introPosition === "left" ? "ic-icon-card-grid--split" : "";
  const sectionOpen = `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), splitVariantClass, section.__autoSectionClassName))}">
            <div class="container">`;
  const sectionClose = `            </div>
        </section>`;

  if (section.layout?.introPosition === "left") {
    const leftVerticalAlign = section.layout?.verticalAlign === "start"
      ? "align-items-start"
      : section.layout?.verticalAlign === "end"
        ? "align-items-end"
        : "align-items-center";
    return `${sectionOpen}
                <div class="row justify-content-center ${escapeHtml(leftVerticalAlign)}">
                    <div class="col col-12 col-xl-4 mb-3 pb-3 mb-md-0 pb-md-0 mb-md-3 pb-md-3 mb-xl-0 pb-xl-0">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}${headerButtonsMarkup ? `\n\n${headerButtonsMarkup}` : ""}
                    </div>

                    <div class="col col-12 col-xl-6">
                        <ul class="${escapeHtml(cardListClassName)}">
${cardMarkup}
                        </ul>
                    </div>
                </div>
${sectionClose}`;
  }

  return `${sectionOpen}
                <div class="row justify-content-center mb-3 pb-3">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}${headerButtonsMarkup ? `\n\n${headerButtonsMarkup}` : ""}
                    </div>
                </div>

                <ul class="${escapeHtml(cardListClassName)}">
${cardMarkup}
                </ul>
${section.footerTitle || footerBodyMarkup || footerButtonsMarkup ? `\n\n                <div class="row justify-content-center pt-4 mt-3 pt-md-5 mt-md-2">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-center">
${section.footerHeading || section.footerTitle ? `                        <h3>${renderText(section.footerHeading || section.footerTitle)}</h3>\n` : ""}${footerBodyMarkup ? `${footerBodyMarkup}\n` : ""}                    </div>
                </div>
${footerButtonsMarkup ? `\n                <div class="row justify-content-center mt-3 pt-3">
                    <div class="col col-auto">
${indentBlock(footerButtonsMarkup, 24)}
                    </div>
                </div>` : ""}` : ""}
${sectionClose}`;
}

function renderLogoGridSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const decorativeBottomMarkup = section.decorativeImage?.placement === "bottom" ? renderDecorativeImage(section.decorativeImage, 8) : "";
  const bodyMarkup = indentBlock(renderParagraphContent(section), 8);
  const introLinksRaw = Array.isArray(section.links) ? section.links : (section.links?.items || []);
  const introLinkListClassName = resolveLinkListClassName(section.links);
  const linkListMarkup = introLinksRaw.length ? `\n${renderLinkList(introLinksRaw, introLinkListClassName)}\n` : "";
  const logoListModifier = section.logoStyle === "box"
    ? ` ic-logo-list--box${section.layout?.logoBoxSize === "compact" ? " ic-logo-list--box-compact" : ""}`
    : "";
  const defaultLogoColumnClass = section.logoStyle === "box" ? "col-auto" : "col-auto mt-3 pt-3 px-md-4";
  const scrollRows = section.logoStyle === "box" && typeof section.logoScrollRows === "number" ? section.logoScrollRows : null;
  const fluidContainer = section.layout?.logoContainer === "fluid";
  // logoGrid has no layout.copyFlow mechanism of its own; the fluid variant's intro
  // needs the same flex-removal/responsive-align treatment as textMedia's copyFlow.
  // Derived from logoContainer: fluid, not a separate content-author option.
  const splitVariantClass = fluidContainer ? "ic-logo-grid--split" : "";
  const logoMarkup = (section.logos || [])
    .map(
      (logo) => `                            <li class="${escapeHtml(section.logoColumnClass || defaultLogoColumnClass)}">
                                ${logo.href ? `<a${renderAnchorAttributes(logo, { href: logo.href, className: "stretched-link" })}>` : ""}${renderImg(logo, logo.className || "ic-logo", { loading: "lazy", context: `logo "${logo.alt || "unknown"}"` })}${logo.href ? "</a>" : ""}
                            </li>`,
    )
    .join("\n\n");
  const logoListRowClass = fluidContainer ? " row justify-content-md-center" : " row justify-content-center";
  const logoListMarkup = `<ul class="ic-logo-list${escapeHtml(logoListModifier)}${logoListRowClass}">
${logoMarkup}
                        </ul>`;
  const logoGridMarkup = scrollRows
    ? `<div class="ic-logo-list-scroll" style="--logo-scroll-rows: ${scrollRows}" role="region" aria-label="${escapeHtml(getSectionHeading(section))}" tabindex="0">
                        ${logoListMarkup}
                    </div>`
    : logoListMarkup;

  const introAlign = section.layout?.introAlign || "center";
  const introAlignClass = introAlign === "start" ? "" : introAlign === "end" ? " text-end" : " text-center";
  const introColumnClass = section.introColumnClass || `col col-md-10 col-lg-8 col-xl-6${introAlignClass}`;

  if (fluidContainer) {
    return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), splitVariantClass, section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center mb-3 pb-3">
                    <div class="${escapeHtml(introColumnClass)}">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}${linkListMarkup}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12">
                        ${logoGridMarkup}
                    </div>
                </div>
            </div>${decorativeBottomMarkup ? `\n${decorativeBottomMarkup}` : ""}
        </section>`;
  }

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), splitVariantClass, section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center mb-2">
                    <div class="${escapeHtml(introColumnClass)}">
                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}${linkListMarkup}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-8">
                        ${logoGridMarkup}
                    </div>
                </div>
            </div>${decorativeBottomMarkup ? `\n${decorativeBottomMarkup}` : ""}
        </section>`;
}

function renderBrandStripSection(section) {
  const backgroundClass = getBackgroundClassName(section) || " ic-background-white";
  const imageMarkup = section.image
    ? renderImg(section.image, section.image.className || "d-block", {
      loading: section.image.loading || "lazy",
      context: `brand strip "${section.id}" image`,
    })
    : "";

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, section.__autoSectionClassName))}">
            <div class="container py-4 border-bottom">
                <div class="row">
                    <div class="col col-12">
                        ${imageMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderAccreditationSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const rowsMarkup = (section.rows || [])
    .map((row) => {
      const logoImg = renderImg(row.logo, row.logo?.className || "ic-logo", {
        loading: "lazy",
        context: `accreditation row logo`,
      });
      const logoMarkup = row.logoHref
        ? `<a href="${escapeHtml(row.logoHref)}" target="_blank" rel="noopener noreferrer">${logoImg}</a>`
        : logoImg;
      const copyMarkup = indentBlock(renderParagraphContent(row), 16);

      return `                <div class="ic-accreditation-row">
                    <div class="ic-accreditation-logo">
                        ${logoMarkup}
                    </div>
                    <div class="ic-accreditation-copy">
                        <h2>${renderText(row.heading || "")}</h2>
${copyMarkup}                    </div>
                </div>`;
    })
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, "ic-section-accreditation", section.__autoSectionClassName))}">
            <div class="container">
                <div class="ic-accreditation-rows">
${rowsMarkup}
                </div>
            </div>
        </section>`;
}

function renderStickyItemCardsSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const contentColumnClass = section.contentColumnClass || "col col-12 col-lg-10 col-xl-9";
  const introColumnClass = section.introColumnClass || "col col-12 col-md-6 col-xl-4 mb-4 pr-md-4";
  const cardsColumnClass = section.cardsColumnClass || "col col-12 col-md-6 col-xl-7 pl-md-4";
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");

  const leftIconMarkup = section.iconSvg
    ? normalizeIconSvgMarkup(section.iconSvg, { ariaHidden: true })
    : section.iconSrc
      ? section.iconAlt
        ? `<img src="${escapeHtml(section.iconSrc)}" alt="${escapeHtml(section.iconAlt)}">`
        : `<img src="${escapeHtml(section.iconSrc)}" alt="" aria-hidden="true">`
      : "";
  const leftStickyClass = leftIconMarkup ? "ic-grid ic-sticky" : "ic-sticky";

  const itemsMarkup = (section.items || [])
    .map((item) => {
      const addressMarkup = (item.addressLines || [])
        .map((line) => renderText(line))
        .join("<br>\n                                        ");
      const linksMarkup = (item.links || [])
        .map(
          (link) => `                                            <li><a${renderAnchorAttributes(link, { href: link.href })}>${renderText(link.label)}</a></li>`,
        )
        .join("\n");

      return `                                <li class="ic-card ic-background-white mt-2">
                                    <strong>${renderText(item.name || "")}</strong>
${addressMarkup ? `                                    ${addressMarkup}<br>\n` : ""}${item.distance ? `                                    <span class="ic-card-details">${renderText(item.distance)}</span>\n` : ""}${linksMarkup ? `                                    <ul class="ic-menu ic-menu-horizontal">
${linksMarkup}
                                    </ul>` : ""}
                                </li>`;
    })
    .join("\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(contentColumnClass)}">
                        <div class="row justify-content-center">
                            <div class="${escapeHtml(introColumnClass)}">
                                <div class="${escapeHtml(leftStickyClass)}">
${leftIconMarkup ? `                                    ${leftIconMarkup}\n` : ""}                                    <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
                                </div>
                            </div>

                            <div class="${escapeHtml(cardsColumnClass)}">
                                <ul>
${itemsMarkup}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
${footerButtonsMarkup ? `\n${footerButtonsMarkup}` : ""}        </section>`;
}

function renderStickyEmbedSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const stickyCardsContentWidth = section.layout?.contentWidth || "default";
  const contentColumnClass = section.contentColumnClass || {
    narrow: "col col-12 col-lg-10 col-xl-8",
    default: "col col-12 col-lg-10 col-xl-9",
    wider: "col col-12 col-xl-10",
    full: "col col-12",
  }[stickyCardsContentWidth] || "col col-12 col-lg-10 col-xl-9";
  const introColumnClass = section.introColumnClass || "col col-12 col-md-6 col-xl-4 mb-4 pr-md-4";
  const embedColumnClass = section.embedColumnClass || "col col-12 col-md-6 col-xl-7 pt-2 pt-md-0 pl-md-4";
  const iconMarkup = section.iconSvg ? normalizeIconSvgMarkup(section.iconSvg, { ariaHidden: true }) : "";
  const addressMarkup = section.address
    ? `<a${renderAnchorAttributes({ href: section.address.href, target: section.address.target }, { title: section.address.text })}>${renderText(section.address.text)}</a>`
    : section.addressHtml ? renderTrustedHtml(section.addressHtml) : "";
  const embedMarkup = section.embed
    ? renderTypedMedia(section.embed, { context: `section "${section.id}" embed` })
    : section.embedHtml ? renderTrustedHtml(section.embedHtml) : "";

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(contentColumnClass)}">
                        <div class="row justify-content-center">
                            <div class="${escapeHtml(introColumnClass)}">
                                <div class="ic-grid ic-sticky">
${iconMarkup ? `                                    ${iconMarkup}\n` : ""}                                    <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${addressMarkup ? `                                    <p>${addressMarkup}</p>\n` : ""}                                </div>
                            </div>

                            <div class="${escapeHtml(embedColumnClass)}">
                                ${embedMarkup}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderStickyCardsSection(section) {
  if (section.variant === "itemCards") {
    return renderStickyItemCardsSection(section);
  }

  if (section.variant === "embed") {
    return renderStickyEmbedSection(section);
  }

  if (section.variant === "resourceTables") {
    const cards = (section.cards || []).map((card) => {
      const groups = (card.groups || []).map((group) => `                                        <h4 class="ic-card-subtitle">${renderText(group.heading)}</h4>
${group.paragraphs ? indentBlock(renderParagraphContent(group), 40) + "\n" : ""}                                        <table class="ic-card-table ic-card-table-courses mt-0" aria-label="${escapeHtml(group.tableLabel)}"><thead class="ic-visually-hidden"><tr>${(group.columns || []).map((column) => `<th scope="col">${renderText(column)}</th>`).join("")}</tr></thead><tbody>${(group.rows || []).map((row) => `<tr>${row.map((cell, index) => `<${index === 0 ? "th scope=\"row\"" : "td"}>${cell?.href ? `<a${renderAnchorAttributes(cell)}>${renderText(cell.label)}</a>` : renderText(cell?.label || cell)}</${index === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</tbody></table>${group.disclaimer ? `\n                                        <p class="ic-disclaimer">${renderText(group.disclaimer)}</p>` : ""}`).join("\n");
      return `                                <div class="ic-card ic-background-white"><div class="ic-card-body"><h3 class="ic-card-title">${renderText(card.heading)}</h3>
${groups}${card.footer ? `\n                                        <p>${renderText(card.footer)}</p>` : ""}</div></div>`;
    }).join("\n\n");
    return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${getBackgroundClassName(section)}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}"><div class="container"><div class="row justify-content-center"><div class="col col-12 col-lg-10 col-xl-9"><div class="row justify-content-center"><div class="col col-12 col-md-6 col-xl-5 mb-4 pr-md-4"><div class="ic-sticky"><h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>${indentBlock(renderParagraphContent(section), 36)}</div></div><div class="col col-12 col-md-6 col-xl-7 pt-2 pt-md-0 pl-md-4">${cards}</div></div></div></div></div></section>`;
  }

  const backgroundClass = getBackgroundClassName(section);
  const introButtonsMarkup = getSectionButtonsByLocation(section, "header").length
    ? `                                ${renderButtons(getSectionButtonsByLocation(section, "header"), "ic-btn ic-btn-primary ic-btn-outline").trim()}`
    : "";
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");
  const introBodyMarkup = renderParagraphContent(section);
  const stickyCardsContentWidth = section.layout?.contentWidth || "default";
  const contentColumnClass = section.contentColumnClass || {
    narrow: "col col-12 col-lg-10 col-xl-8",
    default: "col col-12 col-lg-10 col-xl-9",
    wider: "col col-12 col-xl-10",
    full: "col col-12",
  }[stickyCardsContentWidth] || "col col-12 col-lg-10 col-xl-9";
  const introColumnClass = section.introColumnClass || "col col-12 col-md-6 col-xl-5 mb-4 pr-md-4";
  const cardsColumnClass = section.cardsColumnClass || "col col-12 col-md-6 col-xl-7 pt-2 pt-md-0 pl-md-4";
  const listMarkup = (section.cards || [])
    .map((card) => {
      const listMarkupInner = (card.listItems || [])
        .map((item) => `                                            <li>${item && typeof item === "object" ? renderTypedSegmentItem(item) : renderText(item, { widowProtection: true })}</li>`)
        .join("\n");
      const linkItems = card.linkItems || [];
      const linkItemsPresentation = card.linkItemsPresentation || section.linkItemsPresentation || "list";
      const hasLinkItemMeta = linkItems.some((item) => item.meta);
      const linkListMarkupInner = linkItems
        .map(
          (item) => `                                            <li>${item.href ? `<a${renderAnchorAttributes(item)}>` : ""}${renderText(item.label)}${item.href ? "</a>" : ""}${item.meta ? `<span>${renderText(item.meta)}</span>` : ""}</li>`,
        )
        .join("\n");
      const linkTableMarkup = linkItems.length && linkItemsPresentation === "table"
        ? `                                        <table class="${escapeHtml(card.linkTableClassName || "ic-card-table ic-card-table-courses")}" aria-label="${escapeHtml(card.linkTableAriaLabel || getCardHeading(card))}">
                                            <thead class="ic-visually-hidden">
                                                <tr>
                                                    <th scope="col">${renderText(card.linkColumnLabel || "Course")}</th>${hasLinkItemMeta ? `
                                                    <th scope="col">${renderText(card.metaColumnLabel || "Duration")}</th>` : ""}
                                                </tr>
                                            </thead>
                                            <tbody>
${linkItems
          .map(
            (item) => `                                                <tr><th scope="row">${item.href ? `<a${renderAnchorAttributes(item)}>` : ""}${renderText(item.label)}${item.href ? "</a>" : ""}</th>${hasLinkItemMeta ? `<td>${item.meta ? renderText(item.meta) : ""}</td>` : ""}</tr>`,
          )
          .join("\n")}
                                            </tbody>
                                        </table>
`
        : "";
      const contentHtmlMarkup = normalizeHtmlBlocks(card.contentHtml)
        .map((block) => `                                        ${renderTrustedHtml(block)}`)
        .join("\n");

      const cardBodyMarkup = renderParagraphContent(card);
      const cardImageMarkup = card.image
        ? `\n                                    <figure class="ic-card-media">${renderPicture(card.image, "ic-card-image", "lazy", "card", `sticky card \"${getCardHeading(card) || "unknown"}\" image`)}</figure>`
        : "";
      const cardIconMarkup = card.iconSvg
        ? `\n                                    <figure class="ic-card-media">${normalizeIconSvgMarkup(card.iconSvg, { ariaHidden: true })}</figure>`
        : "";

      const cardTitleContent = card.href
        ? `<a${renderAnchorAttributes(card, { href: card.href, className: "stretched-link", title: card.linkTitle || getCardHeading(card) })}>${renderText(getCardHeading(card))}</a>`
        : renderText(getCardHeading(card));
      return `                                <div class="ic-card ic-background-white">
                                    <div class="ic-card-body">
                                        <h3 class="ic-card-title${card.titleClassName ? ` ${escapeHtml(card.titleClassName)}` : ""}">${cardTitleContent}</h3>
${contentHtmlMarkup ? `${contentHtmlMarkup}\n` : ""}${cardBodyMarkup ? `${indentBlock(cardBodyMarkup, 40)}\n` : ""}${card.subheading ? `                                        <h4 class="ic-card-subheading">${renderText(card.subheading)}</h4>\n` : ""}${listMarkupInner ? `                                        <ul class="ic-card-list mt-0">
${listMarkupInner}
                                        </ul>
` : ""}${linkTableMarkup ? `${linkTableMarkup}` : ""}${linkListMarkupInner && !linkTableMarkup ? `                                        <ul class="${escapeHtml(card.linkListClassName || "ic-card-list ic-card-list-courses")}">
${linkListMarkupInner}
                                        </ul>
` : ""}${card.footer ? `                                        <p>${renderText(card.footer, { widowProtection: true })}</p>` : ""}${card.footerHtml ? `                                        <p>${renderTrustedHtml(card.footerHtml)}</p>` : ""}
                                    </div>${cardImageMarkup}${cardIconMarkup}
                                </div>`;
    })
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(contentColumnClass)}">
                        <div class="row justify-content-center">
                            <div class="${escapeHtml(introColumnClass)}">
                                <div class="ic-sticky">
                                    <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${introBodyMarkup ? `${indentBlock(introBodyMarkup, 36)}\n` : ""}${introButtonsMarkup ? `${introButtonsMarkup}\n` : ""}                                </div>
                            </div>

                            <div class="${escapeHtml(cardsColumnClass)}">
${listMarkup}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
${footerButtonsMarkup ? `\n${footerButtonsMarkup}` : ""}
        </section>`;
}

export function renderStructuredCardMediaProof() {
  const iconSvg = '<svg viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>';
  const image = { desktopSrc: "/getmedia/proof.webp", alt: "Proof image", width: "800", height: "600" };
  return {
    generic: renderCardsSection({ id: "proof-cards", type: "cards", heading: "Proof", cards: [{ heading: "Icon", iconSvg }] }),
    stickyIcon: renderStickyCardsSection({ id: "proof-sticky-icon", type: "stickyCards", heading: "Proof", cards: [{ heading: "Icon", iconSvg }] }),
    stickyImage: renderStickyCardsSection({ id: "proof-sticky-image", type: "stickyCards", heading: "Proof", cards: [{ heading: "Image", image }] }),
  };
}

export function renderGoldClassAndFacilitiesContractProof() {
  const gold = renderLogoGridSection({ id: "gold", type: "logoGrid", variant: "decorativeBottom", heading: "Gold", logos: [], decorativeImage: { placement: "bottom", image: { alt: "", decorative: true, desktopSrc: "/desktop-1400.webp", desktopSrcset: "/desktop-1200.webp 1200w, /desktop-1400.webp 1400w, /desktop-2400.webp 2400w, /desktop-2800.webp 2800w", sizes: "(max-width: 1199.9px) 1200px, (max-width: 1919.9px) 1400px, 2800px", width: "1400", height: "500", sources: [{ maxWidth: 768, srcset: "/mobile-400.webp 400w, /mobile-800.webp 800w, /mobile-1600.webp 1600w", width: "800", height: "450" }] } } });
  const sticky = renderStickyCardsSection({ id: "paths", type: "stickyCards", heading: "Paths", cards: [{ heading: "One", paragraphs: ["Copy & <safe>"], subheading: "Benefits One", listItems: ["Item"] }, { heading: "Two", paragraphs: ["Copy"], subheading: "Benefits Two", listItems: ["Item"] }] });
  const facilities = renderStickyCardsSection({ id: "resources", type: "stickyCards", variant: "resourceTables", heading: "Resources", paragraphs: ["Introduction"], cards: [{ heading: "Welding", groups: [{ heading: "Checklists", tableLabel: "Checklists", paragraphs: ["Copy"], columns: ["Name"], rows: [[{ label: "A", href: "https://example.test", target: "_blank" }]], disclaimer: "Disclaimer" }, { heading: "Additional Resources", tableLabel: "Additional Resources", paragraphs: ["Copy"], columns: ["Name"], rows: [["B"]] }] }, { heading: "Hands-On", groups: [{ heading: "Hands-On Resources", tableLabel: "Hands-On Resources", paragraphs: ["Copy"], columns: ["Name"], rows: [["C"]] }] }] });
  return { gold, sticky, facilities };
}

export function renderPlatinumContractProof() {
  return {
    embed: renderEmbedSection({ id: "proof-embed", type: "embed", heading: "Proof", embedHtml: "<div>Embed</div>", pathDropdown: { label: "Choose", variant: "outline", items: [{ label: "Role", href: "#role" }] } }),
    quote: renderQuoteGridSection({ id: "proof-quote", type: "quoteGrid", heading: "Proof", quotes: [], embed: { src: "https://example.com/video", title: "Proof video" } }),
    cta: renderCtaSection({ id: "proof-cta", type: "cta", heading: "Proof", image: { desktopSrc: "/proof.webp", alt: "Proof image", width: "800", height: "600" } }),
  };
}

export function renderTypedEmbedVariantsContractProof() {
  const defaultEmbed = createTemplateSection("embed", "default", "embed-default");
  const pathEmbed = createTemplateSection("embed", "pathDropdown", "embed-path-dropdown");
  const componentEmbed = createTemplateSection("embed", "componentLibraryTyped", "embed-component-library");
  const validate = (section, path = "content/pages/documentation/embed-proof.yaml") => validatePageData({ slug: "embed-proof", title: "Embed Proof", sections: [section] }, path);
  const defaultValidation = validate(defaultEmbed);
  const pathValidation = validate(pathEmbed);
  const componentValidation = validate(componentEmbed, "content/pages/documentation/component-library.yaml");
  if (!defaultValidation.valid || !pathValidation.valid || !componentValidation.valid) throw new Error("typed embed variant validation failed");
  const defaultMarkup = renderEmbedSection({ ...defaultEmbed, heading: "Default <embed>" });
  const pathMarkup = renderEmbedSection({ ...pathEmbed, heading: "Path & <embed>" });
  const componentMarkup = renderEmbedSection(componentEmbed);
  for (const [markup, title, source] of [[defaultMarkup, defaultEmbed.embed.title, defaultEmbed.embed.src], [pathMarkup, pathEmbed.embed.title, pathEmbed.embed.src], [componentMarkup, componentEmbed.embed.title, componentEmbed.embed.src]]) {
    if (!markup.includes(`<iframe`) || !markup.includes(`src="${source}"`) || !markup.includes(`title="${title}"`) || !markup.includes('width="616"') || !markup.includes('height="450"') || !markup.includes('allowfullscreen')) throw new Error("typed embed renderer output is incomplete");
  }
  const dropdownStart = pathMarkup.indexOf('Choose Your Path');
  const firstItem = pathMarkup.indexOf('Path One');
  const secondItem = pathMarkup.indexOf('Path Two');
  const iframe = pathMarkup.indexOf('<iframe');
  if (dropdownStart < 0 || firstItem < dropdownStart || secondItem < firstItem || iframe < secondItem || !pathMarkup.includes('href="#path-one"') || !pathMarkup.includes('href="#path-two"')) throw new Error("typed path-dropdown ordering or links are incorrect");
  if (!defaultMarkup.includes('Default &lt;embed&gt;') || !pathMarkup.includes('Path &amp; &lt;embed&gt;')) throw new Error("typed embed heading escaping failed");
  const raw = { id: "legacy-raw-embed", type: "embed", heading: "Legacy", embedHtml: "<div data-legacy=\"embed\">Legacy embed</div>" };
  const rawValidation = validate(raw, "content/pages/adas/what-is-adas.yaml");
  const rawMarkup = renderEmbedSection(raw);
  if (!rawValidation.valid || !rawMarkup.includes(raw.embedHtml)) throw new Error("raw embed compatibility failed");
  const rejects = [];
  const expectReject = (section, label) => { if (validate(section).valid) rejects.push(label); };
  const mixed = structuredClone(defaultEmbed); mixed.embedHtml = "<div>raw</div>"; expectReject(mixed, "typed plus embedHtml");
  for (const variant of ["default", "pathDropdown"]) {
    const base = variant === "default" ? defaultEmbed : pathEmbed;
    for (const media of [null, [], { ...base.embed, title: "" }, { ...base.embed, title: " " }, { ...base.embed, src: "javascript:alert(1)" }, { ...base.embed, src: "https://" }, { ...base.embed, width: 1.5 }, { ...base.embed, width: "0" }, { ...base.embed, width: "0x10" }, { ...base.embed, height: "1.0" }, { ...base.embed, height: " 450" }, { ...base.embed, loading: "eagerly" }, { ...base.embed, referrerPolicy: "invalid" }, { ...base.embed, allow: ["fullscreen", "fullscreen"] }, { ...base.embed, fullscreen: "true" }, { ...base.embed, aspectRatio: "0" }, { ...base.embed, aspectRatio: "0x10" }, { ...base.embed, extra: true }]) {
      const invalid = structuredClone(base); invalid.embed = media; expectReject(invalid, `${variant} malformed media`);
    }
  }
  if (rejects.length) throw new Error(`typed embed negative cases admitted: ${rejects.join(", ")}`);
  return { default: true, pathDropdown: true, componentLibraryTyped: true, rawOnly: true, negativesRejected: true, defaultMarkup, pathMarkup, componentMarkup };
}

export function renderTypedMediaContractProof() {
  const textMedia = createTemplateSection("textMedia", "componentLibraryTyped", "text-media-40-60");
  const centeredMedia = createTemplateSection("embed", "componentLibraryTyped", "centered-media");
  const mediaRail = createTemplateSection("stickyCards", "embed", "media-rail");
  textMedia.media.title = '<Training & "quoted">';
  textMedia.media.link.label = '<Explore & "Courses">';
  textMedia.media.link.href = "#text-media-40-60";
  textMedia.inlineLinkParagraphs[0].segments[1].href = "#text-media-40-60";
  textMedia.inlineLinkParagraphs[0].segments[0].text = "Copy <safe> & authored text. ";
  const mediaRailWithoutAddress = structuredClone(mediaRail);
  delete mediaRailWithoutAddress.address;
  const optionalAddressValidation = validatePageData({ slug: "typed-media-no-address", title: "Typed Media No Address", sections: [mediaRailWithoutAddress] }, "content/pages/typed-media-no-address.yaml");
  if (!optionalAddressValidation.valid) throw new Error(`typed sticky embed without address was rejected: ${optionalAddressValidation.errors.join("; ")}`);
  const optionalAddressMarkup = renderStickyEmbedSection(mediaRailWithoutAddress);
  for (const forbidden of ["https://maps.google.com", "href=\"#address\"", "<p>", "City, ST 00000"]) if (optionalAddressMarkup.includes(forbidden)) throw new Error(`typed sticky embed without address rendered forbidden content: ${forbidden}`);
  if (!optionalAddressMarkup.includes('src="https://www.google.com/maps/embed?pb=example"') || !optionalAddressMarkup.includes('title="I-CAR technical center map"')) throw new Error("typed sticky embed without address did not render its titled iframe");
  const typedNegative = (section) => !validatePageData({ slug: "typed-media-negative", title: "Typed Media Negative", sections: [section] }, "content/pages/typed-media-negative.yaml").valid;
  const addressWithoutEmbed = structuredClone(mediaRail);
  delete addressWithoutEmbed.embed;
  if (!typedNegative(addressWithoutEmbed)) throw new Error("typed address without embed was admitted");
  for (const rawKey of ["embedHtml", "addressHtml"]) {
    const mixed = structuredClone(mediaRail);
    mixed[rawKey] = "<p>raw</p>";
    if (!typedNegative(mixed)) throw new Error(`typed embed plus ${rawKey} was admitted`);
    const addressMixed = structuredClone(mediaRailWithoutAddress);
    addressMixed.address = structuredClone(mediaRail.address);
    addressMixed[rawKey] = "<p>raw</p>";
    if (!typedNegative(addressMixed)) throw new Error(`typed address plus ${rawKey} was admitted`);
  }
  for (const malformedEmbed of [null, [], { ...mediaRail.embed, src: "javascript:bad" }, { ...mediaRail.embed, width: "0" }, { ...mediaRail.embed, aspectRatio: "0x10" }, { ...mediaRail.embed, extra: true }]) {
    const malformed = structuredClone(mediaRailWithoutAddress);
    malformed.embed = malformedEmbed;
    if (!typedNegative(malformed)) throw new Error("malformed typed embed was admitted");
  }
  for (const malformedAddress of [null, [], { text: "Address" }, { text: "Address", href: "javascript:bad" }, { text: "Address", href: "https://maps.google.com", target: "_parent" }, { text: "Address", href: "https://maps.google.com", extra: true }]) {
    const malformed = structuredClone(mediaRail);
    malformed.address = malformedAddress;
    if (!typedNegative(malformed)) throw new Error("malformed optional typed address was admitted");
  }
  const rawOnly = { id: "raw-only", type: "stickyCards", variant: "embed", heading: "Raw only", embedHtml: "<div>raw embed</div>", addressHtml: "<p>raw address</p>" };
  if (!validatePageData({ slug: "raw-only", title: "Raw only", sections: [rawOnly] }, "content/pages/raw-only.yaml").valid || !renderStickyEmbedSection(rawOnly).includes("raw embed")) throw new Error("raw-only sticky embed compatibility failed");
  const page = { slug: "typed-media-proof", title: "Typed Media Proof", sections: [textMedia, centeredMedia, mediaRail] };
  const validation = validatePageData(page, "content/pages/documentation/typed-media-proof.yaml");
  if (!validation.valid) throw new Error(`typed media contract proof validation failed: ${validation.errors.join("; ")}`);
  const rendered = page.sections.map(renderSection);
  const combined = rendered.join("\n");
  if ((combined.match(/<a\b/g) || []).length !== 5) throw new Error("typed media renderer proof did not emit five links");
  for (const expected of [
    'src="https://players.brightcove.net/',
    'title="&lt;Training &amp; &quot;quoted&quot;&gt;"',
    'allow="autoplay; encrypted-media; fullscreen"',
    'allowfullscreen',
    'loading="lazy"',
    'referrerpolicy="strict-origin-when-cross-origin"',
    'width="616"',
    'height="450"',
    'style="aspect-ratio:616/450"',
    'aria-label="&lt;Explore &amp; &quot;Courses&quot;&gt;"',
    'href="#text-media-40-60"',
    'href="https://maps.google.com"',
    "Copy &lt;safe&gt; &amp; authored text.",
  ]) if (!combined.includes(expected)) throw new Error(`typed media renderer proof missing ${expected}`);
  return { validation, sections: rendered, registryParity: renderTypedMediaRegistryParityProof() };
}

export function renderTypedMediaRegistryParityProof() {
  const reverse = createTemplateSection("textMedia", "reverse", "unrelated-reverse");
  const embed = createTemplateSection("embed", "default", "unrelated-embed");
  if (reverse.variant !== undefined || reverse.media !== undefined || reverse.inlineLinkParagraphs !== undefined || JSON.stringify(reverse.paragraphs) !== JSON.stringify(["Add body copy that pairs with the supporting image."])) {
    throw new Error("global textMedia/reverse registry factory changed");
  }
  if (embed.variant !== undefined || !embed.embed || embed.embed.src !== "https://players.brightcove.net/1862663934001/default_default/index.html?videoId=6363935215112" || embed.embed.title !== "Embedded training video" || embed.embedHtml !== undefined) {
    throw new Error("embed/default typed registry contract changed");
  }
  return { reverse: "unchanged", embed: "typed-compatible" };
}

export function renderProgressListContractProof() {
  return renderProgressListSection({
    id: "proof-progress-list",
    type: "progressList",
    heading: "Progress <proof>",
    paragraphs: ["Section paragraph & context"],
    groups: [
      {
        heading: "First <group>",
        paragraphs: ["First group & paragraph"],
        measures: [
          { label: "Zero <measure>", percent: 0, supportingText: "Zero & supporting text" },
          { label: "Complete measure", percent: 100, supportingText: "Complete supporting text" },
        ],
      },
      {
        heading: "Second group",
        paragraphs: ["Second group paragraph"],
        measures: [{ label: "Unavailable measure", unavailable: "Data <unavailable>" }],
      },
    ],
  });
}

export function createKenticoAjaxSplitFormContractProofFixture() {
  return {
    id: "proof-kentico-form",
    type: "leadForm",
    variant: "kenticoAjaxSplit",
    heading: "Request <information>",
    paragraphs: ["Proof & copy"],
    list: ["First <benefit>"],
    image: { desktopSrc: "/proof-form.webp", alt: "Proof image", width: "800", height: "600", sources: [{ srcset: "/proof-form-mobile.webp", maxWidth: "767", width: "800", height: "600" }] },
    form: {
      wrapperId: "proof-kentico-wrapper", id: "proof-kentico-form-id", prefix: "proof-kentico-form-id", action: "/Kentico.Components/en-US/Kentico.FormWidget/KenticoFormWidget/FormSubmit?formName=Proof&prefix=proof-kentico-form-id&displayValidationErrors=False", method: "POST", ajaxUpdate: "#proof-kentico-wrapper", submitHandler: "window.kentico.updatableFormHelper.submitForm(event)",
      registration: { formId: "proof-kentico-form-id", targetAttributeName: "data-ktc-ajax-update", unobservedAttributeName: "data-ktc-notobserved-element" },
      fields: [
        { key: "organization", id: "proof-org", name: "proof-kentico-form-id.organization.Value", type: "text", label: "Organization", placeholder: "Name" }, { key: "first_name", id: "proof-first", name: "proof-kentico-form-id.first_name.Value", type: "text", label: "First Name", placeholder: "First Name" }, { key: "last_name", id: "proof-last", name: "proof-kentico-form-id.last_name.Value", type: "text", label: "Last Name", placeholder: "Last Name" }, { key: "phone_number", id: "proof-phone", name: "proof-kentico-form-id.phone_number.PhoneNumber", type: "tel", label: "Phone", placeholder: "Phone", phoneMask: { wrapperId: "proof-phone-mask", pattern: "(999) 999-9999" } }, { key: "email", id: "proof-email", name: "proof-kentico-form-id.email.Email", type: "email", label: "Email (optional)", placeholder: "Email Address" }, { key: "benefits_drop_down", id: "proof-benefits", name: "proof-kentico-form-id.benefits_drop_down.SelectedValue", type: "select", label: "Benefits", options: [{ value: "Accelerated Path to Gold Class", label: "Accelerated Path to Gold Class" }, { value: "Value of Gold Class", label: "Value of Gold Class" }, { value: "Discount", label: "Discount" }, { value: "Payment Plan", label: "Payment Plan" }, { value: "OEM Network", label: "OEM Network" }, { value: "Insurance Network", label: "Insurance Network" }] },
      ],
      runtimeToken: { name: "__RequestVerificationToken" }, submitLabel: "Request Information",
      privacy: { text: "Review the", href: "/about-us/governance/policies/privacy", label: "Privacy Policy" }, success: { title: "Request Submitted", body: "We will contact you." },
    },
  };
}

export function renderKenticoAjaxSplitFormContractProof() {
  return renderKenticoAjaxSplitLeadForm(createKenticoAjaxSplitFormContractProofFixture());
}

function createKenticoNavigationTrap(counters) {
  const fail = () => { counters.navigation += 1; throw new Error("navigation blocked"); };
  const location = { assign: fail, replace: fail, reload: fail };
  Object.defineProperty(location, "href", { get: () => "about:blank", set: fail });
  return { location, fail };
}

function runKenticoMockedScenario({ script, submitHook, registration, readyState }) {
  const counters = { fetch: 0, xhr: 0, beacon: 0, nativeSubmit: 0, requestSubmit: 0, navigation: 0, registrations: 0, submissions: 0, prevented: 0 };
  const listeners = [];
  const document = {
    readyState,
    addEventListener(type, callback, options) {
      listeners.push({ type, callback, options, fired: false });
    },
  };
  const form = {
    submit() { counters.nativeSubmit += 1; },
    requestSubmit() { counters.requestSubmit += 1; },
  };
  const navigation = createKenticoNavigationTrap(counters);
  Object.defineProperty(document, "location", { get: () => navigation.location, set: navigation.fail });
  const window = { kentico: { updatableFormHelper: {
    registerEventListeners(config) {
      if (JSON.stringify(config) !== JSON.stringify(registration)) throw new Error("Kentico registration configuration diverged");
      counters.registrations += 1;
    },
    submitForm(event) {
      counters.submissions += 1;
      event.preventDefault();
    },
  } } };
  Object.defineProperty(window, "location", { get: () => navigation.location, set: navigation.fail });
  const sandbox = {
    document,
    window,
    fetch() { counters.fetch += 1; throw new Error("network access blocked"); },
    XMLHttpRequest: class { constructor() { counters.xhr += 1; throw new Error("XHR blocked"); } },
    navigator: { sendBeacon() { counters.beacon += 1; throw new Error("beacon blocked"); } },
  };
  Object.defineProperty(sandbox, "location", { get: () => navigation.location, set: navigation.fail });
  runInNewContext(script, sandbox, { timeout: 1000 });
  if (readyState === "complete") {
    if (listeners.length !== 0 || counters.registrations !== 1) throw new Error("complete registration branch diverged");
  } else {
    if (listeners.length !== 1 || listeners[0].type !== "DOMContentLoaded" || listeners[0].options?.once !== true || counters.registrations !== 0) throw new Error("DOMContentLoaded registration branch diverged");
    for (let dispatch = 0; dispatch < 2; dispatch += 1) {
      const listener = listeners[0];
      if (!listener.fired) {
        listener.fired = true;
        listener.callback();
      }
    }
    if (counters.registrations !== 1) throw new Error("DOMContentLoaded registration was not once-only");
  }
  for (let submission = 0; submission < 2; submission += 1) {
    const event = { target: form, preventDefault() { counters.prevented += 1; } };
    sandbox.event = event;
    runInNewContext(submitHook, sandbox, { timeout: 1000 });
  }
  if (counters.submissions !== 2 || counters.prevented !== 2) throw new Error("Kentico submit hook was not intercepted");
  for (const key of ["fetch", "xhr", "beacon", "nativeSubmit", "requestSubmit", "navigation"]) if (counters[key] !== 0) throw new Error(`no-send trap fired: ${key}`);
  return counters;
}

function normalizeKenticoRegistrationScript(script) {
  return String(script || "").trim().replace(/\s+/g, " ");
}

function assertKenticoNavigationTraps() {
  const counters = { navigation: 0 };
  const navigation = createKenticoNavigationTrap(counters);
  const document = {};
  const window = {};
  Object.defineProperty(document, "location", { get: () => navigation.location, set: navigation.fail });
  Object.defineProperty(window, "location", { get: () => navigation.location, set: navigation.fail });
  const sandbox = { document, window };
  Object.defineProperty(sandbox, "location", { get: () => navigation.location, set: navigation.fail });
  for (const statement of ["location = '/blocked'", "window.location = '/blocked'", "document.location = '/blocked'", "location.href = '/blocked'", "window.location.assign('/blocked')", "document.location.replace('/blocked')", "location.reload()"] ) {
    const before = counters.navigation;
    let threw = false;
    try { runInNewContext(statement, sandbox, { timeout: 1000 }); } catch { threw = true; }
    if (!threw || counters.navigation !== before + 1) throw new Error(`navigation trap failed for ${statement}`);
  }
}

export function runKenticoAjaxSplitMockedRuntimeProof() {
  const fixture = createKenticoAjaxSplitFormContractProofFixture();
  const markup = renderKenticoAjaxSplitLeadForm(fixture);
  const submitHook = markup.match(/\bonsubmit="([^"]+)"/)?.[1];
  const script = markup.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  const registration = fixture.form.registration;
  const canonicalScript = `(function(){var config=${JSON.stringify(registration)};var register=function(){window.kentico.updatableFormHelper.registerEventListeners(config);};if(document.readyState === "complete"){register();}else{document.addEventListener("DOMContentLoaded", register, { once: true });}}());`;
  if (submitHook !== fixture.form.submitHandler || normalizeKenticoRegistrationScript(script) !== normalizeKenticoRegistrationScript(canonicalScript)) throw new Error("emitted Kentico contract diverged from the accepted typed contract");
  for (const alteredScript of [`${script};window.extraRegistration = true;`, String(script).replace("document.readyState === \"complete\"", "document.readyState === \"interactive\""), String(script).replace("DOMContentLoaded", "load")]) {
    if (normalizeKenticoRegistrationScript(alteredScript) === normalizeKenticoRegistrationScript(canonicalScript)) throw new Error("altered Kentico registration script was admitted");
  }
  assertKenticoNavigationTraps();
  return {
    complete: runKenticoMockedScenario({ script, submitHook, registration, readyState: "complete" }),
    loading: runKenticoMockedScenario({ script, submitHook, registration, readyState: "loading" }),
  };
}

function renderLegalSection(section) {
  if (section.variant === "goldClassFooter") {
    return renderGoldClassFooterSection(section);
  }

  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = (section.paragraphs || [])
    .map((paragraph) => `                        <p><small>${renderTrustedHtml(paragraph)}</small></p>`)
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.className, section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center mb-3 pb-3 mb-md-2 pb-md-0">
                    <div class="col col-md-10 col-lg-8 col-xl-6">
${bodyMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function escapeAttributeValue(value, quote = "\"") {
  const stringValue = String(value ?? "");
  const escapedValue = stringValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (quote === "'") {
    return escapedValue.replace(/'/g, "&#39;");
  }

  return escapedValue.replace(/"/g, "&quot;");
}

function renderLeadFormLabel(field = {}) {
  if (!field.label) {
    return "";
  }

  const requiredMarkup = field.required ? '&nbsp;<span class="ic-required">*</span>' : "";
  return `<label class="${escapeHtml(field.labelClassName || "form-label")}" for="${escapeHtml(field.id || field.name || "")}">${renderLiteralText(field.label)}${requiredMarkup}</label>`;
}

function renderLeadFormInput(field = {}) {
  const requiredAttribute = field.required ? " required" : "";
  const inputModeAttribute = field.inputMode ? ` inputmode="${escapeHtml(field.inputMode)}"` : "";

  return `<input id="${escapeHtml(field.id || field.name || "")}" name="${escapeHtml(field.name || "")}" type="${escapeHtml(field.type || "text")}" class="${escapeHtml(field.className || "form-control")}"
        maxlength="${escapeHtml(String(field.maxLength || field.maxlength || ""))}" autocomplete="${escapeHtml(field.autoComplete || field.autocomplete || "")}"${inputModeAttribute}${requiredAttribute}
        placeholder="${escapeHtml(field.placeholder || "")}" />`;
}

function renderLeadFormSelect(field = {}) {
  const requiredAttribute = field.required ? " required" : "";
  const placeholderMarkup = field.placeholder
    ? `\n    <option value="" disabled selected>${renderLiteralText(field.placeholder)}</option>`
    : "";
  const optionsMarkup = (field.options || [])
    .map((option) => `    <option value="${escapeHtml(option.value || "")}">${renderLiteralText(option.label || "")}</option>`)
    .join("\n");

  return `<select id="${escapeHtml(field.id || field.name || "")}" name="${escapeHtml(field.name || "")}" class="${escapeHtml(field.className || "form-control form-select")}"${requiredAttribute}>${placeholderMarkup}${optionsMarkup ? `\n${optionsMarkup}` : ""}
    </select>`;
}

function renderLeadFormField(field = {}) {
  const fieldMarkup = field.type === "select" ? renderLeadFormSelect(field) : renderLeadFormInput(field);
  const beforeCommentMarkup = field.beforeComment ? `<!-- ${escapeHtml(field.beforeComment)} -->\n` : "";

  return `${beforeCommentMarkup}<div class="${escapeHtml(field.columnClassName || "col-12")}">
    <div class="${escapeHtml(field.wrapperClassName || "ic-form-field")}">
        ${renderLeadFormLabel(field)}
${indentBlock(fieldMarkup, 8)}
    </div>
</div>`;
}

function renderLeadFormHiddenField(field = {}) {
  const quote = field.quote === "single" ? "'" : "\"";
  const escapedValue = escapeAttributeValue(field.value ?? "", quote);
  const valueAttribute = quote === "'"
    ? `value='${escapedValue}'`
    : `value="${escapedValue}"`;

  if (field.multiline) {
    return `<input name="${escapeHtml(field.name || "")}" type="hidden"
        ${valueAttribute} />`;
  }

  return `<input name="${escapeHtml(field.name || "")}" type="hidden" ${valueAttribute} />`;
}

function renderKenticoAjaxField(field = {}) {
  const id = escapeHtml(field.id || "");
  const name = escapeHtml(field.name || "");
  const required = field.required ? " required" : "";
  const control = field.type === "select"
    ? `<select id="${id}" name="${name}" data-ktc-notobserved-element=""${required}>${field.placeholder ? `\n<option value="" disabled selected>${renderText(field.placeholder)}</option>` : ""}${(field.options || []).map((option) => `\n<option value="${escapeHtml(option.value)}">${renderText(option.label)}</option>`).join("")}\n</select>`
    : `<input id="${id}" name="${name}" type="${escapeHtml(field.type || "text")}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ""} data-ktc-notobserved-element=""${required}>`;
  const maskedControl = field.phoneMask
    ? `<span id="${escapeHtml(field.phoneMask.wrapperId)}" data-kentico-phone-mask="${escapeHtml(field.phoneMask.pattern)}">${control}</span>`
    : control;
  return `                                <div class="kentico-form-field">
                                    <label for="${id}">${renderText(field.label || "")}</label>
                                    ${maskedControl}
                                </div>`;
}

function renderKenticoAjaxSplitLeadForm(section = {}) {
  const form = section.form || {};
  const fields = (form.fields || []).map((field) => renderKenticoAjaxField(field)).join("\n");
  const runtimeToken = form.runtimeToken
    ? `                                <input name="${escapeHtml(form.runtimeToken.name || "")}" type="hidden" value="" data-kentico-runtime-token="">`
    : "";
  const image = renderPicture(section.image, "ic-lead-form-image", "lazy", "textMedia", `leadForm \"${section.id}\" image`);
  const list = (section.list || []).map((item) => `                                <li>${renderText(item)}</li>`).join("\n");
  const registration = form.registration || {};
  const registrationConfig = JSON.stringify({ formId: registration.formId, targetAttributeName: registration.targetAttributeName, unobservedAttributeName: registration.unobservedAttributeName });
  return `        <section id="${escapeHtml(section.id)}" class="ic-section ic-lead-form-split">
            <div class="container"><div class="row">
                <div class="col col-12 col-lg-6">
                    <h2>${renderText(section.heading || "")}</h2>
${(section.paragraphs || []).map((paragraph) => `                    <p>${renderText(paragraph)}</p>`).join("\n")}
                    <ul>\n${list}\n                    </ul>
                    ${image}
                </div>
                <div class="col col-12 col-lg-6">
                    <div id="${escapeHtml(form.wrapperId || "")}" data-kentico-ajax-wrapper>
                        <form id="${escapeHtml(form.id || "")}" action="${escapeHtml(form.action || "")}" method="${escapeHtml(form.method || "POST")}" data-ktc-ajax-update="${escapeHtml(form.ajaxUpdate || "")}" onsubmit="${escapeHtml(form.submitHandler || "")}">
${runtimeToken}${runtimeToken ? "\n" : ""}${fields}
                                <button type="submit">${renderText(form.submitLabel || "")}</button>
                                <p>${renderText(form.privacy?.text || "")} <a href="${escapeHtml(form.privacy?.href || "")}" target="_blank" rel="noopener noreferrer">${renderText(form.privacy?.label || "")}</a></p>
                        </form>
                    </div>
                    <div class="kentico-form-success" hidden>
                        <h3>${renderText(form.success?.title || "")}</h3>
                        <p>${renderText(form.success?.body || "")}</p>
                    </div>
                </div>
            </div></div>
            <script>(function(){var config=${registrationConfig};var register=function(){window.kentico.updatableFormHelper.registerEventListeners(config);};if(document.readyState === "complete"){register();}else{document.addEventListener("DOMContentLoaded", register, { once: true });}}());</script>
        </section>`;
}

function renderLeadFormSection(section) {
  if (section.variant === "kenticoAjaxSplit") return renderKenticoAjaxSplitLeadForm(section);
  const emphasizedLeft = renderLiteralText(section.lead?.emphasisLeft || "").replace(/\s+([^\s]+)\s*$/, "&nbsp;$1");
  const emphasizedRight = renderLiteralText(section.lead?.emphasisRight || "").replace(/\s+([^\s]+)\s*$/, "&nbsp;$1");
  const leadMarkup = section.lead
    ? `                        <p class="${escapeHtml(section.lead.className || "cc-p ic-lead")}">
                            ${renderLiteralText(section.lead.prefix || "")}
                            <strong>${emphasizedLeft} ${renderLiteralText(section.lead.separator || "×")} ${emphasizedRight}</strong> ${renderLiteralText(section.lead.suffix || "")}
                        </p>`
    : "";
  const hiddenFieldsMarkup = (section.form?.hiddenFieldGroups || [])
    .map((group) => `                                <!-- ${escapeHtml(group.comment || "")} -->\n${(group.fields || [])
      .map((field) => indentBlock(renderLeadFormHiddenField(field), 32))
      .join("\n")}`)
    .join("\n");
  const formFieldsMarkup = (section.form?.fields || [])
    .map((field) => indentBlock(renderLeadFormField(field), 36))
    .join("\n");
  const alertMarkup = section.form?.alert
    ? `                                    <div class="col-12">
                                        <p class="ic-alert small">
                                            <strong>${renderLiteralText(section.form.alert.emphasis || "")}</strong><br>${renderLiteralText(section.form.alert.body || "", { widowProtection: true })}
                                        </p>
                                    </div>`
    : "";
  const disclaimerMarkup = section.form?.disclaimer
    ? `                                    <div class="col-12">
                                        <p class="ic-disclaimer small"><small>${renderLiteralText(section.form.disclaimer, { widowProtection: true })}</small></p>
                                    </div>`
    : "";

  return `        <div class="container">
            <!-- Header / Hero -->
            <div class="row justify-content-center text-center mb-4">
                <div class="col-12 col-lg-10">
                    <img alt="${escapeHtml(section.logoImage?.alt || "")}" class="${escapeHtml(section.logoImage?.className || "img-fluid mb-3")}"
                        src="${escapeHtml(normalizeImageAssetUrl(section.logoImage?.src || ""))}"
                        width="${escapeHtml(String(section.logoImage?.width || ""))}" height="${escapeHtml(String(section.logoImage?.height || ""))}" />
                    <${escapeHtml(section.headingTag || "h1")} class="${escapeHtml(section.headingClassName || "cc-h1 display-6 mb-2")}">${renderLiteralText(getSectionHeading(section))}</${escapeHtml(section.headingTag || "h1")}>
${leadMarkup}
                </div>
            </div>

            <!-- Promo Image -->
            <div class="row justify-content-center mb-5">
                <div class="col-12 col-md-8 col-lg-6">
                    <img alt="${escapeHtml(section.featureImage?.alt || "")}" class="${escapeHtml(section.featureImage?.className || "img-fluid shadow rounded")}" width="${escapeHtml(String(section.featureImage?.width || ""))}" height="${escapeHtml(String(section.featureImage?.height || ""))}"
                        src="${escapeHtml(normalizeImageAssetUrl(section.featureImage?.src || ""))}" />
                </div>
            </div>

            <!-- Form Card -->
            <div class="row justify-content-center">
                <div class="col-12 col-lg-8">
                    <div class="${escapeHtml(section.form?.cardClassName || "card shadow-sm")}">
                        <div class="${escapeHtml(section.form?.cardBodyClassName || "card-body p-4 p-md-5")}">
                            <form class="${escapeHtml(section.form?.className || "ic-form cc-form")}"
                                action="${escapeHtml(section.form?.action || "")}"
                                method="${escapeHtml(section.form?.method || "POST")}" novalidate>

${hiddenFieldsMarkup}

                                <!-- Name -->
                                <div class="row g-3">

                                    <!-- Alert -->
${alertMarkup}

${formFieldsMarkup}

                                    <!-- reCAPTCHA -->
                                    <div class="${escapeHtml(section.form?.recaptcha?.columnClassName || "col-auto")}">
                                        <div class="d-flex justify-content-center">
                                            <div class="g-recaptcha"
                                                data-sitekey="${escapeHtml(section.form?.recaptcha?.siteKey || "")}"></div>
                                        </div>
                                    </div>

                                    <!-- Submit -->
                                    <div class="col-12">
                                        <button type="submit" class="${escapeHtml(section.form?.submitClassName || "btn btn-primary btn-lg w-100")}">
                                            ${renderLiteralText(section.form?.submitLabel || "Submit")}
                                        </button>
                                    </div>

                                    <!-- Fine Print -->
${disclaimerMarkup}

                                </div>
                            </form>

                        </div>
                    </div>

                </div>
            </div>
        </div>`;
}

function renderAccordionItemBody(item) {
  const paragraphs = (Array.isArray(item.inlineLinkParagraphs) ? item.inlineLinkParagraphs.map(renderTypedInlineLinkParagraph) : getParagraphs(item).map((paragraph) => renderText(paragraph, { widowProtection: true })))
    .map((paragraph) => `                                                <p>${paragraph}</p>`)
    .join("\n");
  const htmlParagraphs = getHtmlParagraphs(item)
    .map((paragraph) => `                                                <p>${renderTrustedHtml(paragraph)}</p>`)
    .join("\n");
  const listIntro = item.listIntro
    ? `                                                <p class="my-0">${renderText(item.listIntro, { widowProtection: true })}</p>\n`
    : "";
  const listMarkup = item.listItems?.length
    ? `                                                <ul class="${escapeHtml(item.listClassName || "my-1 pl-3 ml-5")}">
${item.listItems
      .map((listItem) => `                                                    <li>${renderTrustedHtml(listItem)}</li>`)
      .join("\n")}
                                                </ul>\n`
    : "";
  const closingText = item.closingText
    ? `                                                <p class="my-0">${renderText(item.closingText, { widowProtection: true })}</p>`
    : "";

  return [paragraphs, htmlParagraphs, listIntro, listMarkup, closingText].filter(Boolean).join("\n");
}

function resolveAccordionSplitClasses(section) {
  const desktopSplit = section.layout?.desktopSplit;
  if (!desktopSplit) return null;
  const outerClass = {
    equal: "col col-12 col-lg-10 col-xl-8",
    "text-5-media-7": "col col-12 col-lg-10 col-xl-9",
    "text-7-media-5": "col col-12 col-lg-10 col-xl-9",
  }[desktopSplit];
  const introClass = {
    equal: "col col-12 col-md-6",
    "text-5-media-7": "col col-12 col-md-6 col-xl-5 mb-4 pr-md-4",
    "text-7-media-5": "col col-12 col-md-6 col-xl-7 mb-4 pr-md-4",
  }[desktopSplit];
  const accordionClass = {
    equal: "col col-12 col-md-6 pt-2 pt-md-0 pl-md-4",
    "text-5-media-7": "col col-12 col-md-6 col-xl-7 pt-2 pt-md-0 pl-md-4",
    "text-7-media-5": "col col-12 col-md-6 col-xl-5 pt-2 pt-md-0 pl-md-4",
  }[desktopSplit];
  if (!outerClass || !introClass || !accordionClass) return null;
  return { outerClass, introClass, accordionClass };
}

function renderAccordionSection(section) {
  if (section.variant === "goldClassFaq") {
    return renderGoldClassFaqSection(section);
  }

  const backgroundClass = getBackgroundClassName(section);
  const introBodyMarkup = indentBlock(renderParagraphContent(section), 32);
  const accordionId = escapeHtml(section.accordionId || `${section.id}Accordion`);
  const split = resolveAccordionSplitClasses(section);
  const outerColClass = split ? split.outerClass : "col col-12 col-lg-10 col-xl-8";
  const introColClass = section.introColumnClass || (split ? split.introClass : "col col-12 col-md-6 col-xl");
  const accordionColClass = section.accordionColumnClass || (split ? split.accordionClass : "col col-12 col-md-6 col-xl-auto pt-2 pt-md-0 pl-md-4");
  const itemsMarkup = (section.items || [])
    .map((item, index) => {
      const itemNumber = index + 1;
      const headingId = `${section.id}-heading-${itemNumber}`;
      const collapseId = `${section.id}-collapse-${itemNumber}`;

      return `                                <div class="ic-card ic-background-white accordion-item mb-2">
                                    <h3 class="ic-card-title accordion-header" id="${escapeHtml(headingId)}">
                                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${escapeHtml(collapseId)}" aria-expanded="false" aria-controls="${escapeHtml(collapseId)}">
                                            ${renderText(getAccordionItemHeading(item))}
                                        </button>
                                    </h3>
                                    <div id="${escapeHtml(collapseId)}" class="accordion-collapse collapse" aria-labelledby="${escapeHtml(headingId)}"${section.accordionId ? ` data-bs-parent="#${accordionId}"` : ""}>
                                        <div class="accordion-body">
${renderAccordionItemBody(item)}
                                        </div>
                                    </div>
                                </div>`;
    })
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, resolveSectionSpacingClassNames(section), section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(outerColClass)}">
                        <div class="row justify-content-center">

                            <div class="${escapeHtml(introColClass)}">
                                <h2 class="${escapeHtml(section.titleClassName || "ic-section-title ic-sticky")}">${renderText(getSectionHeading(section))}</h2>
${introBodyMarkup ? `${introBodyMarkup}\n` : ""}                            </div>

                            <div class="${escapeHtml(accordionColClass)}">
                                <div class="${escapeHtml(section.accordionClassName || "accordion py-0")}" id="${accordionId}">
${itemsMarkup}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderEmbedSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const bodyMarkup = indentBlock(section.inlineLinkParagraphs
    ? renderTypedInlineLinkParagraphs(section.inlineLinkParagraphs)
    : renderParagraphContent(section), 8);
  const pathDropdownMarkup = renderPathDropdownMarkup(section.pathDropdown, section.id, 24);

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, section.__autoSectionClassName))}">
            <div class="container">

                <div class="row justify-content-center${section.introRowClassName ? ` ${escapeHtml(section.introRowClassName)}` : " mb-3 pb-3"}">
                    <div class="${escapeHtml(section.introColumnClass || "col col-md-10 col-lg-8 col-xl-6 text-md-center")}">
${getSectionHeading(section) ? `                        <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>\n` : ""}${bodyMarkup ? `\n${bodyMarkup}` : ""}${pathDropdownMarkup}
                    </div>
                </div>

                <div class="row justify-content-center${section.embedRowClassName ? ` ${escapeHtml(section.embedRowClassName)}` : " pt-2"}">
                    <div class="${escapeHtml(section.embedColumnClass || "col col-12 col-lg-10 col-xl-8")}">
                        ${indentBlock(section.embed && typeof section.embed === "object" && !Array.isArray(section.embed) ? renderTypedMedia(section.embed, { context: `section "${section.id}" embed` }) : renderTrustedHtml(section.embedHtml || ""), 24)}
                    </div>
                </div>

            </div>
        </section>`;
}

function renderCoursesSliderSection(section) {
  const backgroundClass = getBackgroundClassName(section);
  const introBodyMarkup = indentBlock(renderParagraphContent(section), 24);
  const slidesMarkup = (section.slides || [])
    .map((slide, index) => {
      const imgMarkup = slide.image
        ? renderImg(slide.image, "ic-card-image", { loading: index === 0 ? "eager" : "lazy", context: `slide ${index + 1} image` })
        : "";
      const titleText = renderText(slide.title || "");
      const titleMarkup = slide.href
        ? `<a class="stretched-link" href="${escapeHtml(slide.href)}" title="${escapeHtml(slide.linkTitle || "View course details")}">${titleText}</a>`
        : titleText;
      return `                                <div class="swiper-slide">
                                    <div class="ic-card ic-background-white">
                                        <div class="ic-card-body">
                                            <h3 class="ic-card-title">${titleMarkup}</h3>
                                        </div>
${imgMarkup ? `                                        <figure class="ic-card-media">${imgMarkup}</figure>\n` : ""}                                    </div>
                                </div>`;
    })
    .join("\n\n");
  const heading = getSectionHeading(section);
  const headingRow = heading
    ? `\n                <div class="row justify-content-center mb-3">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(heading)}</h2>
${introBodyMarkup ? `${introBodyMarkup}\n` : ""}                    </div>
                </div>`
    : "";
  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, section.__autoSectionClassName))}">
            <div class="container">${headingRow}
                <div class="row justify-content-center">
                    <div class="col-12 col-md-9 col-lg-10 p-0">
                        <div class="swiper ic-swiper js-ic-swiper-courses ic-swiper-courses">
                            <div class="swiper-wrapper">
${slidesMarkup}
                            </div>
                        </div>
                        <button aria-label="Previous courses" class="ic-swiper-nav ic-swiper-nav-prev js-ic-swiper-nav-prev" type="button">❮</button><button aria-label="Next courses" class="ic-swiper-nav ic-swiper-nav-next js-ic-swiper-nav-next" type="button">❯</button>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderMediaSliderSection(section) {
  if (section.variant === "courses") return renderCoursesSliderSection(section);
  const backgroundClass = getBackgroundClassName(section);
  const introBodyMarkup = indentBlock(renderParagraphContent(section), 32);
  const slidesMarkup = (section.slides || [])
    .map(
      (slide, index) => `                                        <div class="${escapeHtml(section.slideClassName || "swiper-slide col col-12")}">
                                            ${slide.link?.href ? `<a${renderAnchorAttributes(slide.link)}>` : ""}${renderPicture(slide.image, slide.image.className || "ic-image-rounded", index === 0 ? "eager" : "lazy", "textMedia", `slide ${index + 1} image`)}${slide.link?.href ? "</a>" : ""}
                                        </div>`,
    )
    .join("\n\n");
  const buttonsMarkup = getSectionButtonsByLocation(section, "header").length
    ? `\n                                ${renderButtons(getSectionButtonsByLocation(section, "header"), "ic-btn ic-btn-primary ic-btn-outline").trim()}`
    : "";
  const footerButtonsMarkup = renderFooterButtonRow(getSectionButtonsByLocation(section, "footer"), "ic-btn ic-btn-primary ic-btn-outline");

  return `        <section id="${escapeHtml(section.id)}" class="${escapeHtml(buildSectionClassName(`ic-section${backgroundClass}`, section.__autoSectionClassName))}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-9">
                        <div class="row justify-content-between align-items-center">

                            <div class="${escapeHtml(section.introColumnClass || "col col-11 col-md-5 col-lg-4 mb-3 mb-md-0")}">
                                <h2 class="ic-section-title">${renderText(getSectionHeading(section))}</h2>
${introBodyMarkup ? `${introBodyMarkup}\n` : ""}${buttonsMarkup}
                            </div>

                            <div class="${escapeHtml(section.sliderColumnClass || "col col-12 col-md-7 col-lg-8 mt-3 mt-md-0")}">
                                <div class="${escapeHtml(section.sliderClassName || "swiper ic-swiper js-ic-swiper")}" aria-label="${escapeHtml(section.ariaLabel || `${getSectionHeading(section)} slider`)}">
                                    <div class="${escapeHtml(section.wrapperClassName || "swiper-wrapper row flex-nowrap")}">
${slidesMarkup}
                                    </div>

                                    <div class="swiper-pagination"></div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
${footerButtonsMarkup ? `\n${footerButtonsMarkup}` : ""}
        </section>`;
}

function renderSection(section) {
  switch (section.type) {
    case "hero":
      return renderHeroSection(section);
    case "pageNav":
      return renderPageNavSection(section);
    case "cards":
      return renderCardsSection(section);
    case "text":
      return renderTextSection(section);
    case "html":
      return renderHtmlSection(section);
    case "statementList":
      return renderStatementListSection(section);
    case "progressList":
      return renderProgressListSection(section);
    case "textMedia":
      return renderTextMediaSection(section);
    case "quote":
      return renderQuoteSection(section);
    case "anchor":
      return `        <a id="${escapeHtml(section.id)}"></a>`;
    case "quoteGrid":
      return renderQuoteGridSection(section);
    case "profileGrid":
      return renderProfileGridSection(section);
    case "mediaFeatureList":
      return renderMediaFeatureListSection(section);
    case "iconCardGrid":
      return renderIconCardGridSection(section);
    case "logoGrid":
      return renderLogoGridSection(section);
    case "brandStrip":
      return renderBrandStripSection(section);
    case "stickyCards":
      return renderStickyCardsSection(section);
    case "accreditation":
      return renderAccreditationSection(section);
    case "legal":
      return renderLegalSection(section);
    case "leadForm":
      return renderLeadFormSection(section);
    case "cta":
      return renderCtaSection(section);
    case "accordion":
      return renderAccordionSection(section);
    case "embed":
      return renderEmbedSection(section);
    case "mediaSlider":
      return renderMediaSliderSection(section);
    default:
      throw new Error(`Unsupported section type "${section.type}" in "${section.id || "unknown"}"`);
  }
}

const cmsFragmentSectionMarkerPattern = /<!--cms-section-(?:start|end):[^>]+-->/g;

function wrapSectionForCmsFragments(section, markup) {
  if (!section?.id || typeof markup !== "string" || markup.length === 0) {
    return markup;
  }

  return `<!--cms-section-start:${section.id}-->\n${markup}\n<!--cms-section-end:${section.id}-->`;
}

export function stripCmsFragmentMarkers(source = "") {
  return typeof source === "string" ? source.replace(cmsFragmentSectionMarkerPattern, "") : source;
}

function renderDocument(page, outputFile) {
  const pageTitle = escapeHtml(page.title || page.slug || "Generated Page");
  const stylesheetHref = toPosixPath(relative(dirname(outputFile), "dev/assets/css/vendor/cms-main-202106042.css"));
  const bootstrapCssHref = toPosixPath(relative(dirname(outputFile), "dev/assets/css/bootstrap-subset.css"));
  const swiperCssHref = toPosixPath(relative(dirname(outputFile), "node_modules/swiper/swiper-bundle.min.css"));
  const legacyCssHref = toPosixPath(relative(dirname(outputFile), "dev/assets/css/legacy/style-legacy.css"));
  const mainCssHref = toPosixPath(relative(dirname(outputFile), "dev/assets/css/style.css"));
  const jqueryHref = toPosixPath(relative(dirname(outputFile), "node_modules/jquery/dist/jquery.min.js"));
  const scriptHref = toPosixPath(relative(dirname(outputFile), "dev/assets/js/script.js"));
  const sectionMarkup = (page.sections || [])
    .map((section) => wrapSectionForCmsFragments(section, renderSection(section)))
    .join("\n\n");
  const headHtml = renderPageHeadHtml(page);
  const inlineCmsScriptHtml = renderPageCmsScriptHtml(page);
  const dependencySource = [headHtml, sectionMarkup, inlineCmsScriptHtml].filter(Boolean).join("\n");
  const brightcoveExperienceScriptHtml = renderBrightcoveExperienceScripts(dependencySource);
  const shouldIncludeBootstrapCss = pageUsesBootstrap(dependencySource);
  const shouldIncludeLegacyCss = pageUsesLegacyCss(dependencySource);
  const shouldIncludeJquery = pageUsesJquery(dependencySource) && !sourceReferencesJqueryAsset(dependencySource);
  const bootstrapCssTag = shouldIncludeBootstrapCss ? `    <link rel="stylesheet" href="${bootstrapCssHref}">\n` : "";
  const jqueryScriptTag = shouldIncludeJquery ? `    <script src="${jqueryHref}"></script>\n` : "";
  const legacyCssTag = shouldIncludeLegacyCss ? `    <link rel="stylesheet" href="${legacyCssHref}">\n` : "";

  return normalizeImageAssetUrlsInHtml(`<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    ${headHtml ? `${headHtml}\n    ` : ""}<link rel="stylesheet" href="${stylesheetHref}">
${bootstrapCssTag}    <link rel="stylesheet" href="${swiperCssHref}">
${legacyCssTag}    <link rel="stylesheet" href="${mainCssHref}">
${jqueryScriptTag}    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&amp;display=swap" rel="stylesheet" />
</head>

<body>

    <main>

${sectionMarkup}

    </main>

${inlineCmsScriptHtml ? `${inlineCmsScriptHtml}\n\n` : ""}${brightcoveExperienceScriptHtml ? `${brightcoveExperienceScriptHtml}\n` : ""}    <script src="${scriptHref}"></script>
</body>

</html>
`);
}

function renderPageCmsScriptHtml(page) {
  return normalizeHtmlBlocks(page.cms?.scriptHtml)
    .map((block) => renderTrustedHtml(block).trim())
    .filter(Boolean)
    .join("\n\n");
}

function collectBrightcoveExperienceIds(source = "") {
  if (typeof source !== "string" || !source) {
    return [];
  }

  return [...new Set(
    [...source.matchAll(/\bdata-experience=(["'])([^"']+)\1/gi)]
      .map((match) => match[2].trim())
      .filter(Boolean),
  )];
}

function renderBrightcoveExperienceScripts(source = "") {
  const experienceIds = collectBrightcoveExperienceIds(source);

  if (!experienceIds.length) {
    return "";
  }

  return experienceIds
    .filter((experienceId) => !source.includes(`/experience_${experienceId}/live.js`))
    .map(
      (experienceId) =>
        `    <script src="https://players.brightcove.net/1862663934001/experience_${escapeHtml(experienceId)}/live.js"></script>`,
    )
    .join("\n");
}
function renderPageHeadHtml(page) {
  return normalizeHtmlBlocks(page.cms?.headHtml)
    .map((block) => renderTrustedHtml(block).trim())
    .filter(Boolean)
    .sort((left, right) => {
      const leftIsLink = /^<link\b/i.test(left);
      const rightIsLink = /^<link\b/i.test(right);
      const leftIsStyle = /^<style\b/i.test(left);
      const rightIsStyle = /^<style\b/i.test(right);

      if (leftIsLink !== rightIsLink) {
        return leftIsLink ? -1 : 1;
      }

      if (leftIsStyle !== rightIsStyle) {
        return leftIsStyle ? 1 : -1;
      }

      return 0;
    })
    .join("\n    ");
}

function extractMainInnerHtml(source, filePath) {
  const mainMatch = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

  if (mainMatch) {
    return mainMatch[1].trim();
  }

  return source.trim();
}

function loadHtmlFragmentFile(baseDir, filePath) {
  const resolvedPath = resolve(baseDir, filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Missing HTML fragment "${filePath}"`);
  }

  return extractMainInnerHtml(readFileSync(resolvedPath, "utf8"), resolvedPath);
}

function loadRawTextFile(baseDir, filePath) {
  const resolvedPath = resolve(baseDir, filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Missing raw text file "${filePath}"`);
  }

  return readFileSync(resolvedPath, "utf8");
}

function normalizePageSections(page, sourceDirectory) {
  const normalizedSections = (page.sections || []).map((section) => {
    if (section?.type === "iconCardGrid" && Array.isArray(section.cards)) {
      return {
        ...section,
        cards: section.cards.map((card) => {
          if (!card?.iconSvgFile) {
            return card;
          }

          return {
            ...card,
            iconSvg: loadRawTextFile(sourceDirectory, card.iconSvgFile),
          };
        }),
      };
    }

    if (section?.type !== "html" || !section.sourceHtmlFile) {
      return section;
    }

    const htmlBlocks = [
      ...normalizeHtmlBlocks(section.html),
      loadHtmlFragmentFile(sourceDirectory, section.sourceHtmlFile),
    ];

    return {
      ...section,
      html: htmlBlocks,
    };
  });

  return normalizedSections.map((section, index) => {
    const nextSection = normalizedSections[index + 1];
    const hasExplicitPaddingBottom = ["default", "none", "sm", "lg"].includes(section.spacing?.paddingBottom);

    if (hasExplicitPaddingBottom || getBackgroundColor(section) !== "light" || getBackgroundColor(nextSection) !== "light") {
      return section;
    }

    return {
      ...section,
      __autoSectionClassName: joinClassNames(section.__autoSectionClassName, "pb-0"),
    };
  });
}

function normalizePageCms(page, sourceDirectory) {
  if (!page.cms) {
    return page.cms;
  }

  const cms = { ...page.cms };

  if (page.cms.headHtmlFile) {
    cms.headHtml = [
      ...normalizeHtmlBlocks(page.cms.headHtml),
      loadHtmlFragmentFile(sourceDirectory, page.cms.headHtmlFile),
    ];
  }

  if (page.cms.scriptHtmlFile) {
    cms.scriptHtml = [
      ...normalizeHtmlBlocks(page.cms.scriptHtml),
      loadHtmlFragmentFile(sourceDirectory, page.cms.scriptHtmlFile),
    ];
  }

  return cms;
}

function getGoldClassFormScriptHtml(recaptchaScriptSources = []) {
  return `<script>
function initGoldClassForm() {
  var forms = Array.from(document.querySelectorAll("[data-gtgc-lead-form]"));
  if (!forms.length) return;
  var params = new URLSearchParams(window.location.search);
  var noSendAllowedHostnames = ${JSON.stringify(goldClassNoSendAllowedHostnames)};
  var noSendAllowedStates = ${JSON.stringify(goldClassNoSendAllowedStates)};
  var recaptchaScriptSources = ${JSON.stringify(recaptchaScriptSources)};
  var noSendSimulation = resolveNoSendSimulation(window.location.hostname, params);
  var emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  var captchaChallengeTimeoutMs = 120000;
  var captchaApiTimeoutMs = 15000;
  var iframeResponseTimeoutMs = 30000;
  var recaptchaScriptPromise = null;

  function resolveNoSendSimulation(hostname, searchParams) {
    var state = searchParams.get("gtgcFormState") || "";
    var active = noSendAllowedHostnames.indexOf(hostname) !== -1
      && searchParams.get("gtgcNoSend") === "1"
      && noSendAllowedStates.indexOf(state) !== -1;
    return {
      active: active,
      state: active ? state : "",
    };
  }

  function isRecaptchaApiUsable() {
    return !!window.grecaptcha
      && typeof window.grecaptcha.ready === "function"
      && typeof window.grecaptcha.render === "function"
      && typeof window.grecaptcha.execute === "function";
  }

  function findExistingRecaptchaScript() {
    return Array.from(document.querySelectorAll("script[src]")).find(function (script) {
      var src = script.getAttribute("src") || "";
      return src.indexOf("/recaptcha/api.js") !== -1;
    });
  }

  function buildRecaptchaScriptUrl(src, callbackName) {
    try {
      var url = new URL(src, window.location.href);
      url.searchParams.set("onload", callbackName);
      url.searchParams.set("render", "explicit");
      return url.toString();
    } catch (error) {
      var separator = src.indexOf("?") === -1 ? "?" : "&";
      return src + separator + "onload=" + encodeURIComponent(callbackName) + "&render=explicit";
    }
  }

  function waitForUsableRecaptchaApi() {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timeout = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("GTGC reCAPTCHA API did not become ready."));
      }, captchaApiTimeoutMs);

      function finish(api) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(api);
      }

      function check() {
        if (settled) return;
        var api = window.grecaptcha;
        if (!api || typeof api.ready !== "function") {
          setTimeout(check, 50);
          return;
        }
        api.ready(function () {
          if (isRecaptchaApiUsable()) {
            finish(window.grecaptcha);
            return;
          }
          setTimeout(check, 50);
        });
      }

      check();
    });
  }

  function loadRecaptchaScripts() {
    if (noSendSimulation.active) {
      return Promise.reject(new Error("GTGC no-send simulation is active."));
    }
    if (recaptchaScriptPromise) {
      return recaptchaScriptPromise;
    }
    recaptchaScriptPromise = new Promise(function (resolve, reject) {
      var src = recaptchaScriptSources[0] || "";
      var existingScript = findExistingRecaptchaScript();
      var settled = false;
      var cleanupApiLoad = function () {};
      var apiLoadTimer = setTimeout(function () {
        rejectApi(new Error("GTGC reCAPTCHA API did not become ready."));
      }, captchaApiTimeoutMs);

      function resolveApi(api) {
        if (settled) return;
        settled = true;
        clearTimeout(apiLoadTimer);
        cleanupApiLoad();
        resolve(api);
      }

      function rejectApi(error) {
        if (settled) return;
        settled = true;
        clearTimeout(apiLoadTimer);
        cleanupApiLoad();
        reject(error);
      }

      if (isRecaptchaApiUsable()) {
        waitForUsableRecaptchaApi().then(resolveApi).catch(rejectApi);
        return;
      }

      if (existingScript) {
        existingScript.addEventListener("error", function () { rejectApi(new Error("GTGC reCAPTCHA failed to load.")); }, { once: true });
        waitForUsableRecaptchaApi().then(resolveApi).catch(rejectApi);
        return;
      }

      if (!src) {
        rejectApi(new Error("Missing GTGC reCAPTCHA script source."));
        return;
      }

      var callbackName = "__gtgcRecaptchaOnload_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      var script = document.createElement("script");
      var cleanupCallback = function () {
        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
      };
      cleanupApiLoad = cleanupCallback;

      window[callbackName] = function () {
        waitForUsableRecaptchaApi().then(function (api) {
          resolveApi(api);
        }).catch(function (error) {
          rejectApi(error);
        });
      };
      script.src = buildRecaptchaScriptUrl(src, callbackName);
      script.async = true;
      script.defer = true;
      script.addEventListener("error", function () {
        rejectApi(new Error("GTGC reCAPTCHA failed to load."));
      }, { once: true });
      document.head.appendChild(script);
    }).catch(function (error) {
      recaptchaScriptPromise = null;
      throw error;
    });
    return recaptchaScriptPromise;
  }

  function getFields(form) {
    return Array.from(form.querySelectorAll("input[required], select[required]"));
  }

  function getFieldLabel(field) {
    var wrapper = field.closest(".gtgc-form-field");
    return wrapper ? wrapper.querySelector("label") : null;
  }

  function setInvalid(field, message) {
    var error = document.getElementById(field.getAttribute("aria-describedby"));
    var label = getFieldLabel(field);
    var nextMessage = message || field.dataset.errorMessage || "";
    field.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");
    if (label) label.classList.add("is-invalid");
    if (error) {
      error.textContent = nextMessage;
      error.hidden = !nextMessage;
    }
  }

  function clearInvalid(field) {
    var error = document.getElementById(field.getAttribute("aria-describedby"));
    var label = getFieldLabel(field);
    field.classList.remove("is-invalid");
    field.setAttribute("aria-invalid", "false");
    if (label) label.classList.remove("is-invalid");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  function enforceMaxLength(field) {
    var tagName = (field.tagName || "").toLowerCase();
    var inputType = (field.type || "text").toLowerCase();
    var supportedInputTypes = ["text", "search", "tel", "url", "email", "password"];
    if (tagName !== "input" || supportedInputTypes.indexOf(inputType) === -1) return;
    if (field.maxLength < 0 || field.value.length <= field.maxLength) return;
    field.value = field.value.slice(0, field.maxLength);
  }

  function validate(form) {
    var firstInvalid = null;
    getFields(form).forEach(function (field) {
      enforceMaxLength(field);
      clearInvalid(field);
      var value = field.value.trim();
      if (!value) {
        setInvalid(field);
        firstInvalid = firstInvalid || field;
        return;
      }
      if (field.type === "email" && !emailPattern.test(value)) {
        setInvalid(field, field.dataset.errorMessage || "");
        firstInvalid = firstInvalid || field;
      }
    });
    return firstInvalid;
  }

  function isNoSendMode(form) {
    return noSendSimulation.active;
  }

  function getSubmitButton(form) {
    return form.querySelector('button[type="submit"], input[type="submit"]');
  }

  function updateCaptchaSettings(form) {
    var captchaSettings = form.querySelector('input[name="captcha_settings"]');
    if (!captchaSettings || !captchaSettings.value) return;
    try {
      var settings = JSON.parse(captchaSettings.value);
      settings.ts = String(Date.now());
      captchaSettings.value = JSON.stringify(settings);
    } catch (error) {
      return;
    }
  }

  function getCaptchaConfig(form) {
    return {
      version: form.dataset.gtgcCaptchaVersion || "",
      siteKey: form.dataset.gtgcCaptchaSiteKey || "",
      action: form.dataset.gtgcCaptchaAction || "submit",
      responseField: form.dataset.gtgcCaptchaResponseField || "g-recaptcha-response",
    };
  }

  function getCaptchaState(form) {
    if (!form.gtgcCaptchaState) {
      form.gtgcCaptchaState = {
        widgetId: null,
        pendingResolve: null,
        pendingReject: null,
        challengeTimer: null,
        renderPromise: null,
      };
    }
    return form.gtgcCaptchaState;
  }

  function settleCaptcha(form, error, token) {
    var state = getCaptchaState(form);
    clearTimeout(state.challengeTimer);
    state.challengeTimer = null;
    var resolve = state.pendingResolve;
    var reject = state.pendingReject;
    state.pendingResolve = null;
    state.pendingReject = null;
    if (error) {
      if (reject) reject(error);
      return;
    }
    if (resolve) resolve(token);
  }

  function ensureInvisibleRecaptcha(form) {
    var config = getCaptchaConfig(form);
    var state = getCaptchaState(form);

    if (config.version !== "v2-invisible" || !config.siteKey) {
      return Promise.reject(new Error("Missing GTGC invisible reCAPTCHA v2 configuration."));
    }
    if (state.widgetId !== null) {
      return Promise.resolve(state.widgetId);
    }
    if (state.renderPromise) {
      return state.renderPromise;
    }
    state.renderPromise = loadRecaptchaScripts().then(function (api) {
      if (!api || typeof api.ready !== "function" || typeof api.render !== "function" || typeof api.execute !== "function") {
        throw new Error("GTGC invisible reCAPTCHA v2 API is unavailable.");
      }
      return new Promise(function (resolve, reject) {
        api.ready(function () {
          try {
            var container = form.querySelector("[data-gtgc-recaptcha-widget]");
            if (!container) {
              reject(new Error("Missing GTGC invisible reCAPTCHA container."));
              return;
            }
            state.widgetId = api.render(container, {
              sitekey: config.siteKey,
              size: "invisible",
              callback: function (token) {
                settleCaptcha(form, null, token);
              },
              "error-callback": function () {
                settleCaptcha(form, new Error("GTGC reCAPTCHA challenge failed."));
              },
              "expired-callback": function () {
                settleCaptcha(form, new Error("GTGC reCAPTCHA token expired."));
              },
            });
            resolve(state.widgetId);
          } catch (error) {
            reject(error);
          }
        });
      });
    }).catch(function (error) {
      state.renderPromise = null;
      throw error;
    });
    return state.renderPromise;
  }

  function requestRecaptchaToken(form) {
    return new Promise(function (resolve, reject) {
      ensureInvisibleRecaptcha(form).then(function (widgetId) {
        var state = getCaptchaState(form);
        clearTimeout(state.challengeTimer);
        state.pendingResolve = function (token) {
          if (!token) {
            reject(new Error("GTGC reCAPTCHA returned an empty token."));
            return;
          }
          var config = getCaptchaConfig(form);
          var responseField = form.querySelector('input[name="' + config.responseField + '"]');
          if (responseField) responseField.value = token;
          resolve(token);
        };
        state.pendingReject = reject;
        state.challengeTimer = setTimeout(function () {
          settleCaptcha(form, new Error("GTGC reCAPTCHA challenge timed out."));
        }, captchaChallengeTimeoutMs);
        if (window.grecaptcha && typeof window.grecaptcha.reset === "function") {
          window.grecaptcha.reset(widgetId);
        }
        window.grecaptcha.execute(widgetId);
      }).catch(reject);
    });
  }

  function getIframeState(form) {
    if (!form.gtgcIframeState) {
      form.gtgcIframeState = {
        iframe: null,
        initialLoadObserved: false,
        awaitingResponse: false,
        readinessPromise: null,
        resolveReady: null,
        responseTimer: null,
      };
    }
    return form.gtgcIframeState;
  }

  function getTargetIframe(form) {
    var state = getIframeState(form);
    if (state.iframe) return state.iframe;
    var targetName = form.getAttribute("target") || "";
    state.iframe = targetName ? document.createElement("iframe") : null;
    if (state.iframe) {
      state.iframe.className = "gtgc-hidden-frame";
      state.iframe.name = targetName;
      state.iframe.title = "Gold Class lead submission status";
      state.iframe.hidden = true;
      state.iframe.setAttribute("aria-hidden", "true");
      state.iframe.setAttribute("tabindex", "-1");
      state.readinessPromise = new Promise(function (resolve) {
        state.resolveReady = resolve;
      });
      state.iframe.addEventListener("load", function () {
        if (!state.initialLoadObserved) {
          state.initialLoadObserved = true;
          if (state.resolveReady) {
            state.resolveReady();
            state.resolveReady = null;
          }
          return;
        }
        if (state.awaitingResponse) {
          state.awaitingResponse = false;
          clearTimeout(state.responseTimer);
          state.responseTimer = null;
          showSuccess(form);
          return;
        }
      });
      form.insertAdjacentElement("afterend", state.iframe);
      state.iframe.setAttribute("src", "about:blank");
    }
    return state.iframe;
  }

  function ensureIframeReady(form) {
    var iframe = getTargetIframe(form);
    var state = getIframeState(form);
    if (!iframe || !iframe.name) {
      return Promise.reject(new Error("Missing GTGC iframe target."));
    }
    if (state.initialLoadObserved) {
      return Promise.resolve(iframe);
    }
    return state.readinessPromise.then(function () {
      return iframe;
    });
  }

  function submitFormToIframe(form) {
    return ensureIframeReady(form).then(function (iframe) {
      var state = getIframeState(form);
      form.setAttribute("target", iframe.name);
      state.awaitingResponse = true;
      clearTimeout(state.responseTimer);
      state.responseTimer = setTimeout(function () {
        state.awaitingResponse = false;
        state.responseTimer = null;
        clearPending(form);
        showFailure(form, "We could not confirm the submission. Please try again.");
      }, iframeResponseTimeoutMs);
      HTMLFormElement.prototype.submit.call(form);
    });
  }

  function submitWithCaptcha(form) {
    return requestRecaptchaToken(form).then(function (token) {
      if (!token) {
        throw new Error("GTGC reCAPTCHA returned an empty token.");
      }
      updateCaptchaSettings(form);
      return submitFormToIframe(form);
    });
  }

  function clearPending(form) {
    var submitButton = getSubmitButton(form);
    form.dataset.gtgcPending = "false";
    form.removeAttribute("aria-busy");
    if (submitButton) {
      submitButton.disabled = false;
      if (typeof submitButton.dataset.gtgcOriginalLabel === "string") {
        if (submitButton.tagName.toLowerCase() === "input") {
          submitButton.value = submitButton.dataset.gtgcOriginalLabel;
        } else {
          submitButton.textContent = submitButton.dataset.gtgcOriginalLabel;
        }
        delete submitButton.dataset.gtgcOriginalLabel;
      }
    }
  }

  function setPending(form) {
    var submitButton = getSubmitButton(form);
    form.dataset.gtgcPending = "true";
    form.setAttribute("aria-busy", "true");
    if (submitButton) {
      if (typeof submitButton.dataset.gtgcOriginalLabel !== "string") {
        submitButton.dataset.gtgcOriginalLabel = submitButton.tagName.toLowerCase() === "input"
          ? submitButton.value
          : submitButton.textContent;
      }
      if (submitButton.tagName.toLowerCase() === "input") {
        submitButton.value = "Submitting...";
      } else {
        submitButton.textContent = "Submitting...";
      }
      submitButton.disabled = true;
    }
  }

  function showFailure(form, message) {
    var notice = form.querySelector(".gtgc-form-failure");
    clearPending(form);
    if (!notice) return;
    if (typeof notice.dataset.gtgcOriginalHtml !== "string") {
      notice.dataset.gtgcOriginalHtml = notice.innerHTML;
    }
    if (message) {
      notice.textContent = message;
    } else {
      notice.innerHTML = notice.dataset.gtgcOriginalHtml;
    }
    notice.hidden = false;
    notice.focus({ preventScroll: true });
    notice.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function showSuccess(form) {
    var success = form.parentElement.querySelector(".gtgc-form-success");
    clearPending(form);
    if (!success) return;
    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function renderSimulationState(form) {
    if (!noSendSimulation.active) return;
    if (noSendSimulation.state === "error") {
      getFields(form).forEach(function (field) {
        setInvalid(field);
      });
      var firstField = getFields(form)[0];
      if (firstField) firstField.focus();
    } else if (noSendSimulation.state === "failure") {
      showFailure(form);
    } else if (noSendSimulation.state === "success") {
      showSuccess(form);
    }
  }

  function scrollTargetIntoView(target) {
    if (!target) return;
    if (typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function resolveLeadFormTarget(link) {
    var hash = "";

    try {
      var url = new URL(link.href, window.location.href);
      var currentUrl = new URL(window.location.href);
      if (url.origin !== currentUrl.origin || url.pathname !== currentUrl.pathname || url.search !== currentUrl.search) {
        return null;
      }
      hash = url.hash;
    } catch (error) {
      hash = link.getAttribute("href") || "";
    }

    if (!hash || hash.charAt(0) !== "#") return null;

    var targetId = hash.slice(1);
    var target = targetId ? document.getElementById(targetId) : null;

    if (!target || !target.matches("[data-gtgc-lead-form]")) return null;

    return {
      hash: hash,
      target: target,
    };
  }

  document.querySelectorAll("[data-gtgc-lead-form-cta]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      var resolvedTarget = resolveLeadFormTarget(link);
      if (!resolvedTarget) return;
      event.preventDefault();
      if (window.location.hash !== resolvedTarget.hash) {
        history.pushState(null, "", resolvedTarget.hash);
      }
      scrollTargetIntoView(resolvedTarget.target);
    });
  });

  forms.forEach(function (form) {
    getFields(form).forEach(function (field) {
      var clearEventName = (field.tagName || "").toLowerCase() === "select" ? "change" : "input";
      field.addEventListener(clearEventName, function () {
        enforceMaxLength(field);
        clearInvalid(field);
      });
    });

    form.addEventListener("submit", function (event) {
      if (form.dataset.gtgcPending === "true") {
        event.preventDefault();
        return;
      }

      var firstInvalid = validate(form);
      if (firstInvalid) {
        event.preventDefault();
        firstInvalid.focus();
        return;
      }
      if (isNoSendMode(form)) {
        event.preventDefault();
        if (noSendSimulation.state === "error") {
          getFields(form).forEach(function (field) {
            setInvalid(field);
          });
          var firstField = getFields(form)[0];
          if (firstField) firstField.focus();
          return;
        }
        if (noSendSimulation.state === "failure") {
          showFailure(form);
          return;
        }
        showSuccess(form);
        return;
      }

      event.preventDefault();
      setPending(form);
      submitWithCaptcha(form).catch(function () {
        clearPending(form);
        showFailure(form);
      });
    });

    getTargetIframe(form);
    renderSimulationState(form);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGoldClassForm, { once: true });
} else {
  initGoldClassForm();
}
</script>`;
}

function renderGoldClassSectionVariant(section = {}) {
  const explicitVariant = section.goldClassVariant || section.getToGoldClass?.variant || "";
  const variant = explicitVariant || section.variant || "";

  if ([
    "splitForm",
    "goldClassTestimonials",
    "goldClassBenefits",
    "goldClassValueProps",
    "goldClassFaq",
    "goldClassCta",
    "goldClassFooter",
  ].includes(variant)) {
    return variant;
  }

  if (section.type === "hero" && section.form?.fields?.length) {
    return "splitForm";
  }

  const sectionKey = section.getToGoldClass?.section || section.__template?.id || section.id;
  const variantByTypeAndKey = {
    "quoteGrid:testimonials": "goldClassTestimonials",
    "textMedia:benefits": "goldClassBenefits",
    "iconCardGrid:value-props": "goldClassValueProps",
    "accordion:faq": "goldClassFaq",
    "textMedia:footer-cta": "goldClassCta",
    "legal:legal": "goldClassFooter",
  };

  return variantByTypeAndKey[`${section.type}:${sectionKey}`] || "";
}

function pageUsesGoldClassRenderer(page = {}) {
  const sections = page.sections || [];
  const hasGoldClassLeadForm = sections.some((section) => section.type === "hero" && section.form?.fields?.length);
  const hasGoldClassSupportingSection = sections.some((section) => [
    "goldClassTestimonials",
    "goldClassBenefits",
    "goldClassValueProps",
    "goldClassFaq",
    "goldClassCta",
    "goldClassFooter",
  ].includes(renderGoldClassSectionVariant(section)));

  return hasGoldClassLeadForm && hasGoldClassSupportingSection;
}

function pageHasGoldClassLeadForm(page = {}) {
  return (page.sections || []).some((section) => renderGoldClassSectionVariant(section) === "splitForm" && section.form?.fields?.length);
}

function getGoldClassRecaptchaScriptSources(page = {}) {
  return (page.sections || [])
    .map((section) => {
      const captcha = section.form?.recaptcha || section.form?.captcha || null;

      if (!["v2-invisible", "v3"].includes(captcha?.version)) {
        return "";
      }

      const siteKey = captcha.siteKey || captcha.sitekey || "";

      if (!siteKey) {
        return "";
      }

      if (captcha.version === "v2-invisible") {
        return captcha.scriptSrc || captcha.scriptSource || "https://www.google.com/recaptcha/api.js?render=explicit";
      }

      return captcha.scriptSrc || captcha.scriptSource || `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    })
    .filter(Boolean);
}

function validateGoldClassAnchorContract(page = {}) {
  const anchorIds = new Set();

  (page.sections || []).forEach((section) => {
    if (typeof section.id === "string" && section.id) {
      anchorIds.add(section.id);
    }
  });

  (page.sections || []).forEach((section) => {
    if (renderGoldClassSectionVariant(section) !== "splitForm") {
      return;
    }

    const regionId = getGoldClassFormRegionId(section);

    if (!regionId) {
      throw new Error("GTGC form regionId is required for iframe-targeted submission.");
    }

    if (!isSafeHtmlAnchorId(regionId)) {
      throw new Error(`GTGC form regionId "${regionId}" must be a safe HTML anchor id.`);
    }

    if (anchorIds.has(regionId)) {
      throw new Error(`GTGC form regionId "${regionId}" must be unique on the page.`);
    }

    anchorIds.add(regionId);
  });

  (page.sections || []).forEach((section) => {
    if (renderGoldClassSectionVariant(section) !== "goldClassCta") {
      return;
    }

    const cta = getGoldClassCta(section);
    const ctaHref = cta.href || "";

    if (!cta.label || !ctaHref) {
      throw new Error(`GTGC CTA section "${section.id}" must include a button label and href.`);
    }

    if (ctaHref === "#") {
      return;
    }

    if (!ctaHref.startsWith("#")) {
      return;
    }

    const targetId = ctaHref.slice(1);

    if (!anchorIds.has(targetId)) {
      throw new Error(`GTGC CTA href "${ctaHref}" must target an existing page anchor.`);
    }
  });
}

function normalizeGetToGoldClassPage(page = {}) {
  if (!pageUsesGoldClassRenderer(page)) {
    return page;
  }

  const sections = (page.sections || []).map((section) => {
    const goldClassVariant = renderGoldClassSectionVariant(section);

    if (!goldClassVariant) {
      return section;
    }

    return {
      ...section,
      variant: goldClassVariant,
    };
  });
  validateGoldClassAnchorContract({ ...page, sections });
  const recaptchaScriptSources = [...new Set(getGoldClassRecaptchaScriptSources({ ...page, sections }))];
  const scriptHtml = [
    ...normalizeHtmlBlocks(page.cms?.scriptHtml),
  ];

  if (pageHasGoldClassLeadForm({ ...page, sections })) {
    scriptHtml.push(getGoldClassFormScriptHtml(recaptchaScriptSources));
  }

  return {
    ...page,
    sections,
    cms: {
      ...(page.cms || {}),
      scriptHtml,
    },
  };
}

function assertGoldClassRatingProof(condition, message) {
  if (!condition) {
    throw new Error(`[gtgc-rating-proof] ${message}`);
  }
}

function runGoldClassRatingRendererProof() {
  const page = parseStructuredAuthoringFile(join(contentSourceDir, "get-to-gold-class.yaml"));
  const testimonialSection = (page.sections || []).find((section) => section.id === "testimonials");
  const starRatingIcon = testimonialSection?.starRatingIcon;
  const ratingMarkup = renderGoldClassRating({ rating: 5 }, starRatingIcon);
  const fallbackMarkup = renderGoldClassRating({ rating: 5 });
  const svgMatches = ratingMarkup.match(/<svg\b/g) || [];
  const decorativeSvgMatches = ratingMarkup.match(/<svg\b[^>]*aria-hidden="true"[^>]*focusable="false"/g) || [];
  const ariaLabelMatches = ratingMarkup.match(/aria-label="5 out of 5 stars"/g) || [];
  const fallbackVisibleStarMatch = fallbackMarkup.match(/<span class="gtgc-stars-list" aria-hidden="true">([^<]+)<\/span>/);

  assertGoldClassRatingProof(starRatingIcon?.svg?.includes("<svg"), "GTGC testimonials are missing structured starRatingIcon.svg");
  assertGoldClassRatingProof(ratingMarkup.startsWith('                        <p class="gtgc-stars"'), "rating renderer did not emit the GTGC rating wrapper");
  assertGoldClassRatingProof(svgMatches.length === 5, "configured rating renderer did not emit exactly five SVG stars");
  assertGoldClassRatingProof(decorativeSvgMatches.length === 5, "configured rating SVGs are not all decorative and unfocusable");
  assertGoldClassRatingProof(!ratingMarkup.includes("★"), "configured rating renderer emitted Unicode star text");
  assertGoldClassRatingProof(ariaLabelMatches.length === 1, "rating renderer did not emit exactly one accessible five-star label");
  assertGoldClassRatingProof(ratingMarkup.includes('<span class="gtgc-stars-list" aria-hidden="true">'), "rating renderer did not keep visible stars in an aria-hidden child");
  assertGoldClassRatingProof(!/[\r\n]/.test(ratingMarkup), "configured rating SVG output is not compact");
  assertGoldClassRatingProof(!/<\?xml/i.test(ratingMarkup), "configured rating SVG output retained an XML declaration");
  assertGoldClassRatingProof(fallbackVisibleStarMatch?.[1] === "★★★★★", "rating renderer did not preserve the Unicode fallback when no SVG is configured");
  assertGoldClassRatingProof(!/<svg\b/i.test(fallbackMarkup), "rating renderer emitted fallback SVG markup without configuration");

  console.log("[gtgc-rating-proof] configured five-SVG stars rendered compactly with one rating label; Unicode fallback retained when no SVG is configured");
}

function assertGoldClassNoSendProof(condition, message) {
  if (!condition) {
    throw new Error(`[gtgc-no-send-proof] ${message}`);
  }
}

function runGoldClassNoSendGateProof() {
  goldClassNoSendAllowedHostnames.forEach((hostname) => {
    goldClassNoSendAllowedStates.forEach((state) => {
      const simulation = resolveGoldClassNoSendSimulation(
        hostname,
        new URLSearchParams(`gtgcNoSend=1&gtgcFormState=${state}`),
      );
      assertGoldClassNoSendProof(simulation.active, `expected active simulation for ${hostname} ${state}`);
      assertGoldClassNoSendProof(simulation.state === state, `expected state "${state}" for ${hostname}`);
    });
  });

  [
    ["localhost", ""],
    ["localhost", "gtgcNoSend=1"],
    ["localhost", "gtgcFormState=success"],
    ["localhost", "gtgcNoSend=0&gtgcFormState=success"],
    ["localhost", "gtgcNoSend=true&gtgcFormState=success"],
    ["localhost", "gtgcNoSend=1&gtgcFormState=complete"],
    ["preview.info.i-car.com", "gtgcNoSend=1&gtgcFormState=success"],
    ["foo.stage.info.i-car.com", "gtgcNoSend=1&gtgcFormState=success"],
    ["stage.info.i-car.com.evil", "gtgcNoSend=1&gtgcFormState=success"],
  ].forEach(([hostname, query]) => {
    const simulation = resolveGoldClassNoSendSimulation(hostname, new URLSearchParams(query));
    assertGoldClassNoSendProof(!simulation.active, `expected inactive simulation for ${hostname} ${query || "(absent params)"}`);
    assertGoldClassNoSendProof(simulation.state === "", `expected empty inactive state for ${hostname} ${query || "(absent params)"}`);
  });

  const script = getGoldClassFormScriptHtml(["https://www.google.com/recaptcha/api.js?render=test"]);
  const simulationIndex = script.indexOf("var noSendSimulation = resolveNoSendSimulation(window.location.hostname, params);");
  const loadGuardIndex = script.indexOf("if (noSendSimulation.active) {");
  const loadRejectIndex = script.indexOf('return Promise.reject(new Error("GTGC no-send simulation is active."));', loadGuardIndex);
  const submitHandlerIndex = script.indexOf('form.addEventListener("submit"');
  const noSendSubmitIndex = script.indexOf("if (isNoSendMode(form))", submitHandlerIndex);
  const setPendingIndex = script.indexOf("setPending(form);", submitHandlerIndex);
  const captchaSubmitIndex = script.indexOf("submitWithCaptcha(form)", submitHandlerIndex);
  const submitWithCaptchaFunctionIndex = script.indexOf("function submitWithCaptcha(form)");
  const timestampIndex = script.indexOf("updateCaptchaSettings(form);", submitWithCaptchaFunctionIndex);
  const iframeFunctionIndex = script.indexOf("function submitFormToIframe(form)");
  const iframeSubmitIndex = script.indexOf("HTMLFormElement.prototype.submit.call(form);", iframeFunctionIndex);

  assertGoldClassNoSendProof(simulationIndex !== -1, "simulation resolution is missing from GTGC script");
  assertGoldClassNoSendProof(loadGuardIndex > simulationIndex, "reCAPTCHA load guard does not run after simulation resolution");
  assertGoldClassNoSendProof(loadRejectIndex > loadGuardIndex, "reCAPTCHA loader is not guarded by active simulation state");
  assertGoldClassNoSendProof(noSendSubmitIndex > submitHandlerIndex, "submit handler no-send branch is missing");
  assertGoldClassNoSendProof(noSendSubmitIndex < setPendingIndex, "no-send branch does not short-circuit before pending state");
  assertGoldClassNoSendProof(noSendSubmitIndex < captchaSubmitIndex, "no-send branch does not short-circuit before CAPTCHA/iframe path");
  assertGoldClassNoSendProof(timestampIndex > submitWithCaptchaFunctionIndex, "captcha_settings timestamp update is not confined to the CAPTCHA submit path");
  assertGoldClassNoSendProof(iframeSubmitIndex > iframeFunctionIndex, "native iframe submit is not confined to the iframe submit helper");

  console.log("[gtgc-no-send-proof] exact host/query matrix passed; simulation resolves before CAPTCHA load, timestamp, iframe submit, and Salesforce request paths");
}

function assertGoldClassSelectProof(condition, message) {
  if (!condition) {
    throw new Error(`[gtgc-select-proof] ${message}`);
  }
}

function createGoldClassSelectProofClassList() {
  const values = new Set();

  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function createGoldClassSelectProofHarness(fields, simulationState) {
  const errorsById = new Map();
  const controls = fields.map((field) => {
    const id = normalizeFormFieldId(field);
    const errorId = `${id}-error`;
    const label = { classList: createGoldClassSelectProofClassList() };
    const error = {
      id: errorId,
      textContent: field.errorMessage || "",
      hidden: true,
    };
    const listeners = {};
    const attributes = new Map([
      ["id", id],
      ["name", field.name || ""],
      ["aria-describedby", errorId],
      ["aria-invalid", "false"],
    ]);
    const control = {
      tagName: field.type === "select" ? "SELECT" : "INPUT",
      type: field.type === "select" ? "select-one" : field.type || "text",
      name: field.name || "",
      value: "",
      maxLength: field.type === "select" ? 1 : Number(field.maxLength || field.maxlength || -1),
      dataset: { errorMessage: field.errorMessage || "" },
      classList: createGoldClassSelectProofClassList(),
      label,
      error,
      listeners,
      focusCount: 0,
      addEventListener(name, listener) {
        listeners[name] = listener;
      },
      closest(selector) {
        return selector === ".gtgc-form-field"
          ? { querySelector: (nestedSelector) => nestedSelector === "label" ? label : null }
          : null;
      },
      getAttribute(name) {
        return attributes.get(name) || null;
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      focus() {
        this.focusCount += 1;
      },
      dispatch(name) {
        if (listeners[name]) listeners[name]();
      },
    };
    errorsById.set(errorId, error);
    return control;
  });
  const submitButton = {
    tagName: "BUTTON",
    textContent: "Submit",
    value: "",
    disabled: false,
    dataset: {},
  };
  const failureNotice = {
    dataset: {},
    innerHTML: "Unable to submit.",
    textContent: "Unable to submit.",
    hidden: true,
    focusCount: 0,
    focus() {
      this.focusCount += 1;
    },
    scrollIntoView() {},
  };
  const successNotice = {
    hidden: true,
    scrollIntoView() {},
  };
  const formListeners = {};
  const formAttributes = new Map([
    ["target", "gtgc-select-proof-target"],
    ["action", "https://webto.salesforce.com/servlet/servlet.WebToLead"],
  ]);
  const effects = {
    captchaCalls: 0,
    captchaScriptAppends: 0,
    iframeSources: [],
    nativeSubmits: 0,
  };
  const form = {
    dataset: {},
    hidden: false,
    parentElement: {
      querySelector(selector) {
        return selector === ".gtgc-form-success" ? successNotice : null;
      },
    },
    querySelectorAll(selector) {
      return selector === "input[required], select[required]" ? controls : [];
    },
    querySelector(selector) {
      if (selector === 'button[type="submit"], input[type="submit"]') return submitButton;
      if (selector === ".gtgc-form-failure") return failureNotice;
      return null;
    },
    addEventListener(name, listener) {
      formListeners[name] = listener;
    },
    getAttribute(name) {
      return formAttributes.get(name) || null;
    },
    setAttribute(name, value) {
      formAttributes.set(name, String(value));
    },
    removeAttribute(name) {
      formAttributes.delete(name);
    },
    insertAdjacentElement() {},
    dispatchSubmit() {
      const event = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      formListeners.submit(event);
      return event;
    },
  };
  const document = {
    readyState: "complete",
    head: {
      appendChild() {
        effects.captchaScriptAppends += 1;
      },
    },
    querySelectorAll(selector) {
      if (selector === "[data-gtgc-lead-form]") return [form];
      return [];
    },
    getElementById(id) {
      return errorsById.get(id) || null;
    },
    createElement(tagName) {
      if (tagName !== "iframe") {
        return {
          addEventListener() {},
        };
      }
      return {
        tagName: "IFRAME",
        className: "",
        name: "",
        title: "",
        hidden: false,
        attributes: {},
        addEventListener() {},
        setAttribute(name, value) {
          this.attributes[name] = String(value);
          if (name === "src") effects.iframeSources.push(String(value));
        },
      };
    },
  };
  const window = {
    location: {
      hostname: "localhost",
      search: `?gtgcNoSend=1&gtgcFormState=${simulationState}`,
      href: `https://localhost/get-to-gold-class?gtgcNoSend=1&gtgcFormState=${simulationState}`,
      hash: "",
    },
    grecaptcha: {
      ready() {
        effects.captchaCalls += 1;
      },
      render() {
        effects.captchaCalls += 1;
      },
      execute() {
        effects.captchaCalls += 1;
      },
      reset() {
        effects.captchaCalls += 1;
      },
    },
  };
  const HTMLFormElement = {
    prototype: {
      submit() {
        effects.nativeSubmits += 1;
      },
    },
  };
  const scriptMarkup = getGoldClassFormScriptHtml([]);
  const scriptSource = scriptMarkup.replace(/^<script>\s*/, "").replace(/\s*<\/script>$/, "");
  const executeScript = new Function(
    "window",
    "document",
    "URL",
    "URLSearchParams",
    "HTMLFormElement",
    "setTimeout",
    "clearTimeout",
    scriptSource,
  );
  executeScript(window, document, URL, URLSearchParams, HTMLFormElement, setTimeout, clearTimeout);

  return {
    controls,
    effects,
    failureNotice,
    form,
    successNotice,
  };
}

function runGoldClassSelectProof() {
  const fields = [
    {
      id: "first_name",
      name: "first_name",
      type: "text",
      label: "First Name",
      placeholder: "First name",
      maxLength: 5,
      autoComplete: "given-name",
      required: true,
      errorMessage: "Enter your first name.",
    },
    {
      id: "last_name",
      name: "last_name",
      type: "text",
      label: "Last Name",
      required: true,
      errorMessage: "Enter your last name.",
    },
    {
      id: "email",
      name: "email",
      type: "email",
      label: "Email",
      required: true,
      errorMessage: "Enter a valid email.",
    },
    {
      id: "state",
      name: "state",
      type: "select",
      label: "State",
      placeholder: 'Choose <State> & "Region"',
      maxLength: 1,
      autoComplete: "address-level1",
      required: true,
      errorMessage: "Choose your state.",
      options: [
        { value: "CA", label: "California" },
        { value: 'N\"><script>', label: 'North & <South> "Region"' },
      ],
    },
  ];
  const formMarkup = renderGoldClassLeadForm({
    form: {
      regionId: "gtgc-select-proof-form",
      action: "https://webto.salesforce.com/servlet/servlet.WebToLead",
      method: "POST",
      submitLabel: "Submit",
      fields,
    },
  });
  const stateMarkup = renderGoldClassLeadFormField(fields[3]);
  const firstNameMarkup = renderGoldClassLeadFormField(fields[0]);
  const unsupportedMaxLengthMarkup = renderGoldClassLeadFormField({
    id: "employee_count",
    name: "employee_count",
    type: "number",
    label: "Employee count",
    maxLength: 2,
  });

  const stateStructure = stateMarkup.match(/^\s*<div class="gtgc-form-field">\s*<label for="([^"]+)">State<\/label>\s*<div class="select-w">\s*<select\b([^>]*)>([\s\S]*?)<\/select>\s*<\/div>\s*<p id="([^"]+)" class="gtgc-field-error" hidden>Choose your state\.<\/p>\s*<\/div>\s*$/);
  assertGoldClassSelectProof(stateStructure, "select wrapper must contain only the native select, with label and error as direct siblings");
  const renderedStateId = stateStructure[2].match(/\bid="([^"]+)"/)?.[1] || "";
  const renderedErrorId = stateStructure[2].match(/\baria-describedby="([^"]+)"/)?.[1] || "";
  assertGoldClassSelectProof(stateStructure[1] === renderedStateId && renderedStateId === "state", "select label for/id association changed");
  assertGoldClassSelectProof(stateStructure[4] === renderedErrorId && renderedErrorId === `${renderedStateId}-error`, "select error ID linkage changed");
  assertGoldClassSelectProof((stateMarkup.match(/<div class="select-w">/g) || []).length === 1, "rendered State field must have exactly one select wrapper");
  assertGoldClassSelectProof((formMarkup.match(/<div class="select-w">/g) || []).length === 1, "rendered form must have exactly one select wrapper");
  assertGoldClassSelectProof(!firstNameMarkup.includes('class="select-w"') && !unsupportedMaxLengthMarkup.includes('class="select-w"'), "input controls gained a select wrapper");
  assertGoldClassSelectProof(stateMarkup.includes('<label for="state">State</label>'), "select label is not associated by for/id");
  assertGoldClassSelectProof(stateMarkup.includes('<select id="state" name="state" autocomplete="address-level1" required aria-invalid="false" aria-describedby="state-error" data-error-message="Choose your state.">'), "select accessibility or destination attributes are incomplete");
  assertGoldClassSelectProof(stateMarkup.includes('<option value="" disabled selected>Choose &lt;State&gt; &amp; &quot;Region&quot;</option>'), "escaped empty-value placeholder is missing");
  assertGoldClassSelectProof(stateMarkup.includes('<option value="CA">California</option>'), "configured state option is missing");
  assertGoldClassSelectProof(stateMarkup.includes('<option value="N&quot;&gt;&lt;script&gt;">North &amp; &lt;South&gt; &quot;Region&quot;</option>'), "configured option value or label is not escaped");
  assertGoldClassSelectProof(!stateMarkup.includes("<script>"), "configured option emitted executable markup");
  assertGoldClassSelectProof(stateMarkup.includes('<p id="state-error" class="gtgc-field-error" hidden>Choose your state.</p>'), "matching select error element is missing");
  assertGoldClassSelectProof(!/<select\b[^>]*\bmaxlength=/i.test(stateMarkup), "select emitted maxlength");
  assertGoldClassSelectProof(firstNameMarkup.includes('type="text" placeholder="First name" maxlength="5" autocomplete="given-name" required'), "existing supported input attributes were not preserved");
  assertGoldClassSelectProof(!unsupportedMaxLengthMarkup.includes("maxlength="), "unsupported input type emitted maxlength");
  assertGoldClassSelectProof((formMarkup.match(/<(?:input|select)\b[^>]*\brequired\b/g) || []).length === 4, "rendered form does not contain all four required controls");
  const renderedSelects = [...formMarkup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)].map((match) => ({
    attributes: match[1],
    optionsMarkup: match[2],
    name: match[1].match(/\bname="([^"]*)"/i)?.[1] || "",
  }));
  const renderedStateSelects = renderedSelects.filter((select) => select.name === "state");
  assertGoldClassSelectProof(renderedStateSelects.length === 1, "rendered form must contain exactly one state select");
  const renderedStateSelect = renderedStateSelects[0];
  const renderedCaliforniaOptions = [...renderedStateSelect.optionsMarkup.matchAll(/<option\b([^>]*)>\s*California\s*<\/option>/gi)];
  assertGoldClassSelectProof(renderedCaliforniaOptions.length === 1, "rendered state select must contain exactly one California option");
  const renderedStateOptionValue = renderedCaliforniaOptions[0][1].match(/\bvalue="([^"]*)"/i)?.[1] || "";
  assertGoldClassSelectProof(renderedStateOptionValue === "CA", "rendered California option value changed or is missing");

  const errorHarness = createGoldClassSelectProofHarness(fields, "error");
  const byName = Object.fromEntries(errorHarness.controls.map((control) => [control.name, control]));
  errorHarness.controls.forEach((control) => {
    assertGoldClassSelectProof(control.classList.contains("is-invalid"), `${control.name} missing initial no-send error`);
    assertGoldClassSelectProof(control.label.classList.contains("is-invalid"), `${control.name} label missing initial no-send error`);
    assertGoldClassSelectProof(!control.error.hidden, `${control.name} message missing initial no-send error`);
  });

  byName.state.value = "CA";
  byName.state.dispatch("change");
  assertGoldClassSelectProof(byName.state.value === "CA", "select value was truncated by maxlength handling");
  assertGoldClassSelectProof(!byName.state.classList.contains("is-invalid"), "select error did not clear on change");
  assertGoldClassSelectProof(!byName.state.label.classList.contains("is-invalid"), "select label error did not clear on change");
  assertGoldClassSelectProof(byName.state.error.hidden && byName.state.error.textContent === "", "select error message did not clear on change");

  byName.first_name.value = "Alexander";
  byName.first_name.dispatch("input");
  assertGoldClassSelectProof(byName.first_name.value === "Alexa", "supported input maxlength behavior regressed");
  assertGoldClassSelectProof(!byName.first_name.classList.contains("is-invalid"), "input error did not clear on input");
  byName.last_name.value = "Meza";
  byName.last_name.dispatch("input");
  byName.email.value = "invalid-email";
  byName.email.dispatch("input");
  const invalidEmailSubmit = errorHarness.form.dispatchSubmit();
  assertGoldClassSelectProof(invalidEmailSubmit.defaultPrevented, "invalid email submission was not prevented");
  assertGoldClassSelectProof(byName.email.classList.contains("is-invalid"), "existing invalid-email behavior regressed");
  assertGoldClassSelectProof(!byName.state.classList.contains("is-invalid"), "valid configured select option failed validation");

  byName.email.value = "alex@example.com";
  byName.email.dispatch("input");
  byName.state.value = "";
  const emptySelectSubmit = errorHarness.form.dispatchSubmit();
  assertGoldClassSelectProof(emptySelectSubmit.defaultPrevented, "empty select submission was not prevented");
  assertGoldClassSelectProof(byName.state.classList.contains("is-invalid"), "empty required select was treated as valid");
  byName.state.value = "CA";
  byName.state.dispatch("change");

  const firstNoSendSubmit = errorHarness.form.dispatchSubmit();
  const secondNoSendSubmit = errorHarness.form.dispatchSubmit();
  assertGoldClassSelectProof(firstNoSendSubmit.defaultPrevented && secondNoSendSubmit.defaultPrevented, "repeated no-send submissions were not prevented");
  errorHarness.controls.forEach((control) => {
    assertGoldClassSelectProof(control.classList.contains("is-invalid"), `${control.name} missing repeated no-send error simulation`);
  });
  assertGoldClassSelectProof(errorHarness.effects.captchaCalls === 0, "no-send error proof reached CAPTCHA");
  assertGoldClassSelectProof(errorHarness.effects.captchaScriptAppends === 0, "no-send error proof injected a CAPTCHA script");
  assertGoldClassSelectProof(errorHarness.effects.nativeSubmits === 0, "no-send error proof reached native iframe/Salesforce submission");
  assertGoldClassSelectProof(errorHarness.effects.iframeSources.length === 1 && errorHarness.effects.iframeSources[0] === "about:blank", "no-send error proof navigated an iframe outside the isolated readiness document");

  const validHarness = createGoldClassSelectProofHarness(fields, "failure");
  const validByName = Object.fromEntries(validHarness.controls.map((control) => [control.name, control]));
  validByName.first_name.value = "Alexa";
  validByName.last_name.value = "Meza";
  validByName.email.value = "alex@example.com";
  const renderedStateControl = validHarness.controls.find((control) => control.name === renderedStateSelect.name);
  assertGoldClassSelectProof(renderedStateControl, "rendered state control is missing from the no-send harness");
  renderedStateControl.value = renderedStateOptionValue;
  const validSubmit = validHarness.form.dispatchSubmit();
  assertGoldClassSelectProof(validSubmit.defaultPrevented, "valid no-send submission was not prevented");
  assertGoldClassSelectProof(validHarness.controls.every((control) => !control.classList.contains("is-invalid")), "valid required input/select controls failed validation");
  assertGoldClassSelectProof(!validHarness.failureNotice.hidden, "valid controls did not reach the isolated no-send failure state");
  const serializedState = new URLSearchParams([[renderedStateSelect.name, renderedStateOptionValue]]);
  const serializedStateEntries = serializedState.getAll("state");
  assertGoldClassSelectProof(serializedStateEntries.length === 1, "rendered serialization did not contain exactly one state entry");
  assertGoldClassSelectProof(serializedStateEntries[0] === "CA", "rendered state entry did not serialize the selected CA option");
  assertGoldClassSelectProof(serializedState.toString() === "state=CA", "rendered select did not encode exactly as state=CA");
  assertGoldClassSelectProof(validHarness.effects.captchaCalls === 0, "valid no-send proof reached CAPTCHA");
  assertGoldClassSelectProof(validHarness.effects.captchaScriptAppends === 0, "valid no-send proof injected a CAPTCHA script");
  assertGoldClassSelectProof(validHarness.effects.nativeSubmits === 0, "valid no-send proof reached native iframe/Salesforce submission");

  console.log("[gtgc-select-proof] single select-w wrapper, native select rendering, escaping, accessibility, validation, change clearing, maxlength boundaries, repeat no-send simulation, state=CA serialization, and zero live side effects verified");
}

function assertGoldClassInvisibleV2Proof(condition, message) {
  if (!condition) {
    throw new Error(`[gtgc-invisible-v2-proof] ${message}`);
  }
}

function assertGoldClassIframeReadinessProof(condition, message) {
  if (!condition) {
    throw new Error(`[gtgc-iframe-readiness-proof] ${message}`);
  }
}

function createGoldClassIframeReadinessProofHarness() {
  const events = [];
  const form = {
    dataset: {},
    target: "hero-form-target",
    getAttribute(name) {
      return name === "target" ? this.target : "";
    },
    setAttribute(name, value) {
      events.push(`form:${name}=${value}`);
      if (name === "target") this.target = value;
    },
    insertAdjacentElement(position, element) {
      events.push(`form:insert-${position}:${element.tagName}`);
    },
  };
  const document = {
    createElement(tagName) {
      events.push(`document:create-${tagName}`);
      return iframe;
    },
  };
  const iframe = {
    tagName: "iframe",
    className: "",
    name: "",
    title: "",
    hidden: false,
    src: "",
    listener: null,
    attributes: {},
    addEventListener(name, listener) {
      if (name === "load") {
        events.push("iframe:listener-attached");
        this.listener = listener;
      }
    },
    setAttribute(name, value) {
      events.push(`iframe:${name}=${value}`);
      this.attributes[name] = value;
      if (name === "src") this.src = value;
    },
  };
  const state = {
    iframe: null,
    initialLoadObserved: false,
    awaitingResponse: false,
    readinessPromise: null,
    resolveReady: null,
    responseTimer: null,
  };
  const timers = new Map();
  let timerId = 0;
  let nativeSubmitCount = 0;

  function clearTimer(id) {
    if (id) timers.delete(id);
  }

  function setTimer(callback) {
    timerId += 1;
    timers.set(timerId, callback);
    return timerId;
  }

  function showSuccess() {
    events.push("success");
  }

  function showFailure() {
    events.push("failure");
  }

  function clearPending() {
    events.push("clear-pending");
    form.dataset.gtgcPending = "false";
  }

  function getIframeState() {
    return state;
  }

  function getTargetIframe() {
    if (state.iframe) return state.iframe;
    state.iframe = form.getAttribute("target") ? document.createElement("iframe") : null;
    if (!state.iframe) return state.iframe;
    state.iframe.className = "gtgc-hidden-frame";
    state.iframe.name = form.getAttribute("target");
    state.iframe.title = "Gold Class lead submission status";
    state.iframe.hidden = true;
    state.iframe.setAttribute("aria-hidden", "true");
    state.iframe.setAttribute("tabindex", "-1");
    state.readinessPromise = new Promise((resolve) => {
      state.resolveReady = resolve;
    });
    state.iframe.addEventListener("load", () => {
      if (!state.initialLoadObserved) {
        state.initialLoadObserved = true;
        if (state.resolveReady) {
          state.resolveReady();
          state.resolveReady = null;
        }
        return;
      }
      if (state.awaitingResponse) {
        state.awaitingResponse = false;
        clearTimer(state.responseTimer);
        state.responseTimer = null;
        showSuccess();
      }
    });
    form.insertAdjacentElement("afterend", state.iframe);
    state.iframe.setAttribute("src", "about:blank");
    return state.iframe;
  }

  function ensureIframeReady() {
    const targetIframe = getTargetIframe();
    if (!targetIframe || !targetIframe.name) {
      return Promise.reject(new Error("Missing GTGC iframe target."));
    }
    if (state.initialLoadObserved) {
      return Promise.resolve(targetIframe);
    }
    return state.readinessPromise.then(() => targetIframe);
  }

  function submitFormToIframe() {
    return ensureIframeReady().then((targetIframe) => {
      const iframeState = getIframeState();
      form.setAttribute("target", targetIframe.name);
      iframeState.awaitingResponse = true;
      clearTimer(iframeState.responseTimer);
      iframeState.responseTimer = setTimer(() => {
        iframeState.awaitingResponse = false;
        iframeState.responseTimer = null;
        clearPending();
        showFailure();
      });
      nativeSubmitCount += 1;
      events.push("native-submit");
    });
  }

  function attemptSubmit() {
    if (form.dataset.gtgcPending === "true") {
      events.push("duplicate-blocked");
      return Promise.resolve(false);
    }
    form.dataset.gtgcPending = "true";
    return submitFormToIframe().then(() => true);
  }

  return {
    events,
    form,
    state,
    iframe,
    get nativeSubmitCount() {
      return nativeSubmitCount;
    },
    attemptSubmit,
    submitFormToIframe,
    fireLoad() {
      iframe.listener();
    },
    fireTimeout() {
      const callbacks = Array.from(timers.values());
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    flush() {
      return Promise.resolve();
    },
  };
}

async function runGoldClassIframeReadinessProof() {
  const script = getGoldClassFormScriptHtml(["https://www.google.com/recaptcha/api.js?render=explicit"]);
  const formMarkup = renderGoldClassLeadForm({
    form: {
      regionId: "hero-form",
      action: "https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=00D1I0000002nE3",
      method: "POST",
      submitLabel: "Submit",
      recaptcha: {
        version: "v2-invisible",
        siteKey: "test-site-key",
        responseFieldName: "g-recaptcha-response",
      },
      fields: [
        { name: "first_name", label: "First Name", required: true },
      ],
    },
  });
  const iframeFunctionIndex = script.indexOf("function getTargetIframe(form)");
  const createIframeIndex = script.indexOf('document.createElement("iframe")', iframeFunctionIndex);
  const nameAssignmentIndex = script.indexOf("state.iframe.name = targetName;", createIframeIndex);
  const hiddenAssignmentIndex = script.indexOf("state.iframe.hidden = true;", createIframeIndex);
  const ariaHiddenIndex = script.indexOf('state.iframe.setAttribute("aria-hidden", "true");', createIframeIndex);
  const tabindexIndex = script.indexOf('state.iframe.setAttribute("tabindex", "-1");', createIframeIndex);
  const listenerIndex = script.indexOf('state.iframe.addEventListener("load"', iframeFunctionIndex);
  const insertIframeIndex = script.indexOf('form.insertAdjacentElement("afterend", state.iframe);', listenerIndex);
  const initialNavigationIndex = script.indexOf('state.iframe.setAttribute("src", "about:blank");', listenerIndex);
  const readinessBranchIndex = script.indexOf("if (!state.initialLoadObserved)", listenerIndex);
  const awaitingBranchIndex = script.indexOf("if (state.awaitingResponse)", listenerIndex);
  const ensureFunctionIndex = script.indexOf("function ensureIframeReady(form)");
  const readinessPromiseIndex = script.indexOf("return state.readinessPromise.then", ensureFunctionIndex);
  const submitFunctionIndex = script.indexOf("function submitFormToIframe(form)");
  const submitWaitIndex = script.indexOf("return ensureIframeReady(form).then", submitFunctionIndex);
  const awaitingSetIndex = script.indexOf("state.awaitingResponse = true;", submitFunctionIndex);
  const nativeSubmitIndex = script.indexOf("HTMLFormElement.prototype.submit.call(form);", submitFunctionIndex);
  const timeoutIndex = script.indexOf("state.responseTimer = setTimeout", submitFunctionIndex);
  const responseTimeoutUnsetIndex = script.indexOf("state.awaitingResponse = false;", timeoutIndex);
  const captchaSubmitReturnIndex = script.indexOf("return submitFormToIframe(form);");
  const forbiddenIframeAccessTerms = ["content" + "Window", "content" + "Document"];

  assertGoldClassIframeReadinessProof(formMarkup.includes('target="hero-form-target"'), "GTGC form did not render unique iframe target");
  assertGoldClassIframeReadinessProof(!/<iframe\b[^>]*\bclass="gtgc-hidden-frame"/i.test(formMarkup), "GTGC rendered a static hidden response iframe");
  assertGoldClassIframeReadinessProof(!/\bsandbox=/.test(formMarkup), "GTGC form markup contains a sandbox attribute");
  assertGoldClassIframeReadinessProof(createIframeIndex > iframeFunctionIndex, "runtime iframe creation is missing");
  assertGoldClassIframeReadinessProof(nameAssignmentIndex > createIframeIndex, "runtime iframe name assignment is missing");
  assertGoldClassIframeReadinessProof(hiddenAssignmentIndex > createIframeIndex, "runtime iframe hidden assignment is missing");
  assertGoldClassIframeReadinessProof(ariaHiddenIndex > createIframeIndex, "runtime iframe aria-hidden assignment is missing");
  assertGoldClassIframeReadinessProof(tabindexIndex > createIframeIndex, "runtime iframe tabindex assignment is missing");
  assertGoldClassIframeReadinessProof(listenerIndex !== -1, "iframe load listener is missing");
  assertGoldClassIframeReadinessProof(insertIframeIndex > listenerIndex, "runtime iframe is not inserted after attaching the load listener");
  assertGoldClassIframeReadinessProof(initialNavigationIndex > insertIframeIndex, "initial about:blank navigation is not initiated after inserting the listener-backed iframe");
  assertGoldClassIframeReadinessProof(readinessBranchIndex > listenerIndex && readinessBranchIndex < awaitingBranchIndex, "initial readiness load is not handled before response loads");
  assertGoldClassIframeReadinessProof(readinessPromiseIndex > ensureFunctionIndex, "iframe readiness promise is not used before submission");
  assertGoldClassIframeReadinessProof(submitWaitIndex > submitFunctionIndex, "submit path does not wait for iframe readiness");
  assertGoldClassIframeReadinessProof(awaitingSetIndex > submitWaitIndex && nativeSubmitIndex > awaitingSetIndex, "awaitingResponse/native submit are not gated behind readiness");
  assertGoldClassIframeReadinessProof(timeoutIndex > awaitingSetIndex && responseTimeoutUnsetIndex > timeoutIndex, "response timeout disarm path is missing");
  assertGoldClassIframeReadinessProof(captchaSubmitReturnIndex !== -1, "CAPTCHA submit path does not return the iframe submission promise");
  assertGoldClassIframeReadinessProof(!forbiddenIframeAccessTerms.some((term) => script.includes(term)), "iframe content access is present");
  assertGoldClassIframeReadinessProof(!script.includes(".sandbox"), "script mutates iframe sandbox");
  assertGoldClassIframeReadinessProof(!script.includes('setAttribute("sandbox"'), "script sets iframe sandbox");
  assertGoldClassIframeReadinessProof(!script.includes('removeAttribute("sandbox"'), "script removes iframe sandbox");

  const earlySubmit = createGoldClassIframeReadinessProofHarness();
  const earlySubmitPromise = earlySubmit.attemptSubmit();
  assertGoldClassIframeReadinessProof(earlySubmit.events[0] === "document:create-iframe", "runtime iframe was not created");
  assertGoldClassIframeReadinessProof(earlySubmit.iframe.name === "hero-form-target", "runtime iframe name did not match form target");
  assertGoldClassIframeReadinessProof(earlySubmit.iframe.className === "gtgc-hidden-frame", "runtime iframe class is missing");
  assertGoldClassIframeReadinessProof(earlySubmit.iframe.hidden === true, "runtime iframe is not hidden");
  assertGoldClassIframeReadinessProof(earlySubmit.iframe.attributes["aria-hidden"] === "true", "runtime iframe aria-hidden is missing");
  assertGoldClassIframeReadinessProof(earlySubmit.iframe.attributes.tabindex === "-1", "runtime iframe tabindex is missing");
  assertGoldClassIframeReadinessProof(earlySubmit.events.indexOf("iframe:listener-attached") < earlySubmit.events.indexOf("form:insert-afterend:iframe"), "listener was not attached before insertion");
  assertGoldClassIframeReadinessProof(earlySubmit.events.indexOf("form:insert-afterend:iframe") < earlySubmit.events.indexOf("iframe:src=about:blank"), "initial navigation was not started after insertion");
  assertGoldClassIframeReadinessProof(earlySubmit.nativeSubmitCount === 0, "submit attempted before readiness performed native submit");
  assertGoldClassIframeReadinessProof(!earlySubmit.state.awaitingResponse, "submit attempted before readiness armed awaitingResponse");
  earlySubmit.fireLoad();
  await earlySubmitPromise;
  assertGoldClassIframeReadinessProof(!earlySubmit.events.includes("success"), "initial readiness load showed success");
  assertGoldClassIframeReadinessProof(earlySubmit.nativeSubmitCount === 1, "submission did not continue after iframe readiness");
  assertGoldClassIframeReadinessProof(earlySubmit.state.awaitingResponse, "post-readiness submission did not arm awaitingResponse");
  earlySubmit.fireLoad();
  assertGoldClassIframeReadinessProof(earlySubmit.events.includes("success"), "submission-associated iframe load did not show success");

  const timeoutThenLateLoad = createGoldClassIframeReadinessProofHarness();
  const timeoutSubmitPromise = timeoutThenLateLoad.attemptSubmit();
  timeoutThenLateLoad.fireLoad();
  await timeoutSubmitPromise;
  timeoutThenLateLoad.fireTimeout();
  timeoutThenLateLoad.fireLoad();
  assertGoldClassIframeReadinessProof(timeoutThenLateLoad.events.includes("failure"), "timeout did not show failure");
  assertGoldClassIframeReadinessProof(!timeoutThenLateLoad.events.includes("success"), "late iframe load after timeout showed success");

  const duplicateSubmit = createGoldClassIframeReadinessProofHarness();
  duplicateSubmit.form.dataset.gtgcPending = "true";
  await duplicateSubmit.attemptSubmit();
  assertGoldClassIframeReadinessProof(duplicateSubmit.events.includes("duplicate-blocked"), "duplicate submit was not blocked");
  assertGoldClassIframeReadinessProof(duplicateSubmit.nativeSubmitCount === 0, "duplicate submit performed native submit");

  console.log("[gtgc-iframe-readiness-proof] pre-readiness submit, initial load, response load, timeout/late-load, and duplicate-submit paths verified");
}

function createGoldClassRecaptchaLifecycleProofHarness({
  existingScript = false,
  usableApi = false,
  unavailableApi = false,
  executeMode = "success",
} = {}) {
  const events = [];
  const waiters = [];
  const form = {
    dataset: {},
    gtgcCaptchaState: {
      widgetId: null,
      pendingResolve: null,
      pendingReject: null,
      challengeTimer: null,
      renderPromise: null,
    },
  };
  const state = {
    recaptchaScriptPromise: null,
    existingScript,
    usableApi,
    unavailableApi,
    renderCount: 0,
    executeCount: 0,
    submitCount: 0,
    failureCount: 0,
    scriptInjectionCount: 0,
    duplicateCount: 0,
  };

  function makeApi() {
    return {
      ready(callback) {
        events.push("api-ready");
        callback();
      },
      render(container, options) {
        events.push("api-render");
        state.renderCount += 1;
        state.widgetOptions = options;
        return 7;
      },
      reset() {
        events.push("api-reset");
      },
      execute() {
        events.push("api-execute");
        state.executeCount += 1;
        if (executeMode === "error") {
          state.widgetOptions["error-callback"]();
        } else if (executeMode === "expiry") {
          state.widgetOptions["expired-callback"]();
        } else if (executeMode === "cancel") {
          state.widgetOptions.callback("");
        } else {
          state.widgetOptions.callback("mock-token");
        }
      },
    };
  }

  function waitForUsableApi() {
    events.push("wait-api");
    if (state.usableApi) {
      return Promise.resolve(makeApi());
    }
    if (state.unavailableApi) {
      return Promise.reject(new Error("GTGC reCAPTCHA API did not become ready."));
    }
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
    });
  }

  function makeApiUsable() {
    state.usableApi = true;
    const api = makeApi();
    waiters.splice(0).forEach((waiter) => waiter.resolve(api));
  }

  function loadRecaptchaScripts() {
    if (state.recaptchaScriptPromise) {
      events.push("reuse-api-promise");
      return state.recaptchaScriptPromise;
    }
    if (state.usableApi) {
      events.push("use-ready-api");
      state.recaptchaScriptPromise = waitForUsableApi();
      return state.recaptchaScriptPromise;
    }
    events.push(state.existingScript ? "reuse-existing-script" : "inject-script");
    if (!state.existingScript) {
      state.scriptInjectionCount += 1;
    }
    state.recaptchaScriptPromise = waitForUsableApi().catch((error) => {
      state.recaptchaScriptPromise = null;
      throw error;
    });
    return state.recaptchaScriptPromise;
  }

  function ensureInvisibleRecaptcha() {
    const captchaState = form.gtgcCaptchaState;
    if (captchaState.widgetId !== null) {
      return Promise.resolve(captchaState.widgetId);
    }
    if (captchaState.renderPromise) {
      return captchaState.renderPromise;
    }
    captchaState.renderPromise = loadRecaptchaScripts().then((api) => new Promise((resolve, reject) => {
      api.ready(() => {
        try {
          captchaState.widgetId = api.render({}, {
            sitekey: "test-site-key",
            size: "invisible",
            callback(token) {
              if (!token) {
                reject(new Error("GTGC reCAPTCHA returned an empty token."));
                return;
              }
              resolve(token);
            },
            "error-callback"() {
              reject(new Error("GTGC reCAPTCHA challenge failed."));
            },
            "expired-callback"() {
              reject(new Error("GTGC reCAPTCHA token expired."));
            },
          });
          resolve(captchaState.widgetId);
        } catch (error) {
          reject(error);
        }
      });
    })).catch((error) => {
      captchaState.renderPromise = null;
      throw error;
    });
    return captchaState.renderPromise;
  }

  function requestToken() {
    return ensureInvisibleRecaptcha().then((widgetId) => new Promise((resolve, reject) => {
      const api = makeApi();
      form.gtgcCaptchaState.pendingResolve = resolve;
      form.gtgcCaptchaState.pendingReject = reject;
      const options = state.widgetOptions;
      state.widgetOptions = {
        ...options,
        callback(token) {
          if (!token) {
            reject(new Error("GTGC reCAPTCHA returned an empty token."));
            return;
          }
          resolve(token);
        },
        "error-callback"() {
          reject(new Error("GTGC reCAPTCHA challenge failed."));
        },
        "expired-callback"() {
          reject(new Error("GTGC reCAPTCHA token expired."));
        },
      };
      api.reset(widgetId);
      api.execute(widgetId);
    }));
  }

  function submit() {
    if (form.dataset.gtgcPending === "true") {
      state.duplicateCount += 1;
      events.push("duplicate-blocked");
      return Promise.resolve(false);
    }
    form.dataset.gtgcPending = "true";
    return requestToken().then(() => {
      state.submitCount += 1;
      events.push("iframe-submit");
      return true;
    }).catch((error) => {
      form.dataset.gtgcPending = "false";
      state.failureCount += 1;
      events.push(`failure:${error.message}`);
      return false;
    });
  }

  return {
    events,
    state,
    form,
    submit,
    makeApiUsable,
  };
}

async function runGoldClassRecaptchaLifecycleProof() {
  const delayedApi = createGoldClassRecaptchaLifecycleProofHarness();
  const delayedSubmit = delayedApi.submit();
  await Promise.resolve();
  assertGoldClassInvisibleV2Proof(delayedApi.state.executeCount === 0 && delayedApi.state.submitCount === 0, "delayed API did not hold submission before readiness");
  delayedApi.makeApiUsable();
  await delayedSubmit;
  assertGoldClassInvisibleV2Proof(delayedApi.state.renderCount === 1 && delayedApi.state.executeCount === 1 && delayedApi.state.submitCount === 1, "delayed API did not render, execute, and submit once after readiness");

  const unavailableApi = createGoldClassRecaptchaLifecycleProofHarness({ unavailableApi: true });
  await unavailableApi.submit();
  assertGoldClassInvisibleV2Proof(unavailableApi.state.failureCount === 1 && unavailableApi.form.dataset.gtgcPending === "false", "unavailable API did not fail cleanly and restore pending state");

  const fullyLoadedApi = createGoldClassRecaptchaLifecycleProofHarness({ usableApi: true });
  await fullyLoadedApi.submit();
  assertGoldClassInvisibleV2Proof(fullyLoadedApi.state.scriptInjectionCount === 0 && fullyLoadedApi.state.renderCount === 1 && fullyLoadedApi.state.executeCount === 1, "fully loaded API did not initialize and execute normally");

  const existingLoadingApi = createGoldClassRecaptchaLifecycleProofHarness({ existingScript: true });
  const existingSubmit = existingLoadingApi.submit();
  await Promise.resolve();
  assertGoldClassInvisibleV2Proof(existingLoadingApi.state.scriptInjectionCount === 0 && existingLoadingApi.events.includes("reuse-existing-script"), "existing loading script was not reused");
  existingLoadingApi.makeApiUsable();
  await existingSubmit;
  assertGoldClassInvisibleV2Proof(existingLoadingApi.state.submitCount === 1, "existing loading API did not proceed after readiness");

  const repeatedClick = createGoldClassRecaptchaLifecycleProofHarness({ usableApi: true });
  const firstClick = repeatedClick.submit();
  const secondClick = repeatedClick.submit();
  await Promise.all([firstClick, secondClick]);
  assertGoldClassInvisibleV2Proof(repeatedClick.state.duplicateCount === 1 && repeatedClick.state.renderCount === 1 && repeatedClick.state.submitCount === 1, "repeated click created duplicate widget or submission");

  for (const mode of ["error", "expiry", "cancel"]) {
    const failedChallenge = createGoldClassRecaptchaLifecycleProofHarness({ usableApi: true, executeMode: mode });
    await failedChallenge.submit();
    assertGoldClassInvisibleV2Proof(failedChallenge.state.failureCount === 1 && failedChallenge.form.dataset.gtgcPending === "false", `${mode} challenge did not recover to failure state`);
  }
}

function runGoldClassInvisibleV2FlowProof() {
  const script = getGoldClassFormScriptHtml(["https://www.google.com/recaptcha/api.js?render=explicit"]);
  const formMarkup = renderGoldClassLeadForm({
    form: {
      regionId: "hero-form",
      action: "https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=00D1I0000002nE3",
      method: "POST",
      submitLabel: "Submit",
      recaptcha: {
        version: "v2-invisible",
        siteKey: "test-site-key",
        responseFieldName: "g-recaptcha-response",
      },
      fields: [
        { name: "first_name", label: "First Name", required: true },
      ],
    },
  });
  const submitHandlerIndex = script.indexOf('form.addEventListener("submit"');
  const duplicateIndex = script.indexOf('if (form.dataset.gtgcPending === "true")', submitHandlerIndex);
  const validateIndex = script.indexOf("var firstInvalid = validate(form);", submitHandlerIndex);
  const noSendSubmitIndex = script.indexOf("if (isNoSendMode(form))", submitHandlerIndex);
  const setPendingIndex = script.indexOf("setPending(form);", submitHandlerIndex);
  const captchaRequestIndex = script.indexOf("submitWithCaptcha(form)", submitHandlerIndex);
  const loadScriptFunctionIndex = script.indexOf("function loadRecaptchaScripts()");
  const ensureRecaptchaFunctionIndex = script.indexOf("function ensureInvisibleRecaptcha(form)");
  const captchaLoadIndex = script.indexOf("loadRecaptchaScripts().then", ensureRecaptchaFunctionIndex);
  const usableApiFunctionIndex = script.indexOf("function isRecaptchaApiUsable()");
  const existingScriptFunctionIndex = script.indexOf("function findExistingRecaptchaScript()");
  const buildScriptUrlFunctionIndex = script.indexOf("function buildRecaptchaScriptUrl");
  const waitUsableFunctionIndex = script.indexOf("function waitForUsableRecaptchaApi()");
  const onloadCallbackIndex = script.indexOf('url.searchParams.set("onload", callbackName);', buildScriptUrlFunctionIndex);
  const explicitRenderIndex = script.indexOf('url.searchParams.set("render", "explicit");', buildScriptUrlFunctionIndex);
  const existingReuseIndex = script.indexOf("if (existingScript)", loadScriptFunctionIndex);
  const earlyObjectResolveIndex = script.indexOf("if (window.grecaptcha) {", loadScriptFunctionIndex);
  const renderPromiseIndex = script.indexOf("state.renderPromise", script.indexOf("function ensureInvisibleRecaptcha(form)"));
  const submitWithCaptchaIndex = script.indexOf("function submitWithCaptcha(form)");
  const timestampIndex = script.indexOf("updateCaptchaSettings(form);", submitWithCaptchaIndex);
  const iframeSubmitIndex = script.indexOf("submitFormToIframe(form);", submitWithCaptchaIndex);
  const readinessLoadIndex = script.indexOf("if (!state.initialLoadObserved)");
  const awaitingLoadIndex = script.indexOf("if (state.awaitingResponse)", readinessLoadIndex);
  const successIndex = script.indexOf("showSuccess(form);", awaitingLoadIndex);
  const responseTimeoutIndex = script.indexOf("state.responseTimer = setTimeout");
  const responseTimeoutRecoveryIndex = script.indexOf("clearPending(form);", responseTimeoutIndex);
  const responseTimeoutUnsetIndex = script.indexOf("state.awaitingResponse = false;", responseTimeoutIndex);
  const forbiddenIframeAccessTerms = ["content" + "Window", "content" + "Document"];

  assertGoldClassInvisibleV2Proof(formMarkup.includes('target="hero-form-target"'), "GTGC form did not render unique iframe target");
  assertGoldClassInvisibleV2Proof(!/<iframe\b[^>]*\bclass="gtgc-hidden-frame"/i.test(formMarkup), "GTGC rendered a static hidden response iframe");
  assertGoldClassInvisibleV2Proof(script.includes('state.iframe.name = targetName;'), "GTGC runtime iframe name does not follow the form target");
  assertGoldClassInvisibleV2Proof(script.includes("state.iframe.hidden = true;"), "GTGC runtime iframe is not hidden");
  assertGoldClassInvisibleV2Proof(script.includes('state.iframe.setAttribute("aria-hidden", "true");'), "GTGC runtime iframe aria-hidden treatment is missing");
  assertGoldClassInvisibleV2Proof(script.includes('state.iframe.setAttribute("tabindex", "-1");'), "GTGC runtime iframe tabindex treatment is missing");
  assertGoldClassInvisibleV2Proof(formMarkup.includes('data-gtgc-captcha-version="v2-invisible"'), "GTGC form did not render v2-invisible captcha config");
  assertGoldClassInvisibleV2Proof(formMarkup.includes('data-gtgc-recaptcha-widget'), "GTGC invisible v2 widget container is missing");
  assertGoldClassInvisibleV2Proof(formMarkup.includes('name="g-recaptcha-response"'), "GTGC hidden CAPTCHA response field is missing");
  assertGoldClassInvisibleV2Proof(validateIndex > submitHandlerIndex && validateIndex < captchaRequestIndex, "validation does not occur before CAPTCHA execution");
  assertGoldClassInvisibleV2Proof(noSendSubmitIndex > validateIndex && noSendSubmitIndex < setPendingIndex, "no-send branch does not short-circuit before pending state");
  assertGoldClassInvisibleV2Proof(noSendSubmitIndex < captchaRequestIndex, "no-send branch does not short-circuit before CAPTCHA path");
  assertGoldClassInvisibleV2Proof(captchaLoadIndex > loadScriptFunctionIndex, "v2 script loading is not inside the CAPTCHA path");
  assertGoldClassInvisibleV2Proof(usableApiFunctionIndex !== -1, "usable API guard is missing");
  assertGoldClassInvisibleV2Proof(existingScriptFunctionIndex !== -1, "existing API script reuse path is missing");
  assertGoldClassInvisibleV2Proof(buildScriptUrlFunctionIndex !== -1 && onloadCallbackIndex > buildScriptUrlFunctionIndex && explicitRenderIndex > buildScriptUrlFunctionIndex, "new API script does not use callback-first explicit rendering parameters");
  assertGoldClassInvisibleV2Proof(waitUsableFunctionIndex !== -1 && script.includes("api.ready(function ()"), "API readiness does not wait for grecaptcha.ready");
  assertGoldClassInvisibleV2Proof(existingReuseIndex > loadScriptFunctionIndex, "existing loading API script is not reused");
  assertGoldClassInvisibleV2Proof(earlyObjectResolveIndex === -1, "loader still resolves merely because window.grecaptcha exists");
  assertGoldClassInvisibleV2Proof(renderPromiseIndex !== -1, "form-level render promise is missing");
  assertGoldClassInvisibleV2Proof(script.includes("GTGC reCAPTCHA API did not become ready."), "bounded API initialization timeout is missing");
  assertGoldClassInvisibleV2Proof(script.includes('size: "invisible"'), "invisible v2 render size is missing");
  assertGoldClassInvisibleV2Proof(script.includes('"error-callback": function ()'), "CAPTCHA error callback is missing");
  assertGoldClassInvisibleV2Proof(script.includes('"expired-callback": function ()'), "CAPTCHA expiry callback is missing");
  assertGoldClassInvisibleV2Proof(script.includes("GTGC reCAPTCHA returned an empty token."), "empty-token handling is missing");
  assertGoldClassInvisibleV2Proof(script.includes("GTGC reCAPTCHA challenge timed out."), "challenge timeout handling is missing");
  assertGoldClassInvisibleV2Proof(captchaRequestIndex > setPendingIndex, "submit handler does not enter CAPTCHA submission after pending state");
  assertGoldClassInvisibleV2Proof(timestampIndex > submitWithCaptchaIndex && timestampIndex < iframeSubmitIndex, "captcha_settings timestamp is not updated immediately before iframe submission");
  assertGoldClassInvisibleV2Proof(readinessLoadIndex !== -1 && readinessLoadIndex < awaitingLoadIndex, "initial iframe load is not handled before response loads");
  assertGoldClassInvisibleV2Proof(successIndex > awaitingLoadIndex, "post-submit iframe load does not assume inline success");
  assertGoldClassInvisibleV2Proof(responseTimeoutIndex !== -1 && responseTimeoutRecoveryIndex > responseTimeoutIndex, "iframe response timeout does not restore a usable form");
  assertGoldClassInvisibleV2Proof(responseTimeoutUnsetIndex > responseTimeoutIndex && responseTimeoutUnsetIndex < responseTimeoutRecoveryIndex, "late iframe loads are not disarmed after response timeout");
  assertGoldClassInvisibleV2Proof(duplicateIndex > submitHandlerIndex && duplicateIndex < validateIndex, "duplicate submit prevention does not run before validation/CAPTCHA");
  assertGoldClassInvisibleV2Proof(!forbiddenIframeAccessTerms.some((term) => script.includes(term)), "iframe content access is present");

  return runGoldClassRecaptchaLifecycleProof().then(function () {
    console.log("[gtgc-invisible-v2-proof] validation, no-send, explicit-render API readiness, iframe success, timeout, and duplicate-submit paths verified");
  });
}

function parseAuthoringFile(sourceFile) {
  const page = parseStructuredAuthoringFile(sourceFile);

  if (!page || typeof page !== "object") {
    throw new Error(`Expected an object in ${sourceFile}`);
  }

  if (!Array.isArray(page.sections)) {
    throw new Error(`Expected "sections" array in ${sourceFile}`);
  }

  // Validate page data against schema (rejects inline HTML, unapproved keys)
  const validationResult = validatePageData(page, sourceFile);
  throwOnValidationError(validationResult, sourceFile);

  const sourceDirectory = dirname(sourceFile);

  return {
    ...normalizeGetToGoldClassPage({
      ...page,
      sections: normalizePageSections(page, sourceDirectory),
      cms: normalizePageCms(page, sourceDirectory),
    }),
  };
}

function toContentHtmlRelativePath(sourceFile, page) {
  const sourceRelativePath = relative(contentSourceDir, sourceFile).replace(/\\/g, "/");
  const sourceDirectory = dirname(sourceRelativePath).replace(/\\/g, "/");
  const fallbackName = stripAuthoringFileExtension(sourceRelativePath.split("/").pop());
  const outputBaseName = page.slug || fallbackName;
  return join(sourceDirectory, `${outputBaseName}.html`).replace(/\\/g, "/");
}

function syncRenderedHtmlFile(renderedPage, { dryRun: isDryRun = false } = {}) {
  const outputFile = join(previewOutputDir, renderedPage.relativeOutputPath);
  const nextContents = stripCmsFragmentMarkers(renderedPage.previewHtml || renderedPage.html);

  if (!existsSync(outputFile)) {
    if (isDryRun) {
      return { status: "created", outputFile };
    }

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, nextContents);

    return {
      status: "created",
      outputFile,
    };
  }

  const previousContents = readFileSync(outputFile, "utf8");

  if (previousContents === nextContents) {
    return {
      status: "unchanged",
      outputFile,
    };
  }

  if (isDryRun) {
    return { status: "updated", outputFile };
  }

  writeFileSync(outputFile, nextContents);

  return {
    status: "updated",
    outputFile,
  };
}

export function collectRenderedPageDocuments() {
  const templateSyncResult = syncTemplates({
    only: [...selectedAuthoringBases],
    dryRun,
  });

  if (templateSyncResult.failures.length > 0) {
    throw new Error("Template sync failed");
  }

  if (!existsSync(contentSourceDir)) {
    return [];
  }

  return collectRenderableContentFiles().map((sourceFile) => {
    const page = parseAuthoringFile(sourceFile);
    const relativeOutputPath = toContentHtmlRelativePath(sourceFile, page);
    const htmlOutputPath = join(previewOutputDir, relativeOutputPath);
    const html = renderDocument(page, htmlOutputPath);

    return {
      sourceFile,
      page,
      relativeOutputPath,
      htmlOutputPath,
      html,
      previewHtml: resolvePreviewKenticoMediaUrlsInHtml(html),
    };
  });
}

async function buildPages() {
  const renderedPages = collectRenderedPageDocuments();
  if (!dryRun && selectedAuthoringBases.size === 0) {
    rmSync(legacyGeneratedPreviewDir, { recursive: true, force: true });
  }

  for (const renderedPage of renderedPages) {
    const result = syncRenderedHtmlFile(renderedPage, { dryRun });
    const label = result.status === "created"
      ? (dryRun ? "Would create" : "Created")
      : result.status === "updated"
        ? (dryRun ? "Would update" : "Updated")
        : "Unchanged";
    console.log(`[pages] ${label} ${result.outputFile}`);
  }

  return renderedPages.length > 0;
}

export function createContentSnapshot() {
  const contentFiles = existsSync(contentSourceDir)
    ? [...collectRenderableContentFiles(), ...collectFiles(contentSourceDir, ".html")]
    : [];
  const pageSnapshot = contentFiles.length > 0 ? createFileSnapshot(contentFiles) : "";
  const templateSnapshot = createTemplateSnapshot();
  const scriptFiles = existsSync("dev/scripts") ? collectFiles("dev/scripts", ".mjs") : [];
  const scriptSnapshot = scriptFiles.length > 0 ? createFileSnapshot(scriptFiles) : "";
  const packageSnapshot = existsSync("package.json") ? createFileSnapshot(["package.json"]) : "";

  return [pageSnapshot, templateSnapshot, scriptSnapshot, packageSnapshot].filter(Boolean).join("|");
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
      await buildPages();
    }

    if (watchMode) {
      console.log(`[pages] Build complete (${reason})`);
    }
  } catch (error) {
    console.error(`[pages] Build failed${watchMode ? ` (${reason})` : ""}`);
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

if (isDirectRun) {
  if (goldClassSelectProofMode) {
    runGoldClassSelectProof();
  } else if (goldClassRatingProofMode) {
    runGoldClassRatingRendererProof();
  } else if (goldClassNoSendProofMode) {
    runGoldClassNoSendGateProof();
  } else if (goldClassIframeReadinessProofMode) {
    await runGoldClassIframeReadinessProof();
  } else if (goldClassInvisibleV2ProofMode) {
    await runGoldClassInvisibleV2FlowProof();
  } else {
    if (watchMode && (dryRun || selectedAuthoringBases.size > 0)) {
      throw new Error("--watch cannot be combined with --dry-run or --only");
    }

    await build();

    if (watchMode) {
      console.log("[pages] Watching content/pages/**/*.{json,yaml,yml,html}, content/templates/**/*.{json,yaml,yml}, dev/scripts/**/*.mjs, and package.json");
      previousSnapshot = createContentSnapshot();

      setInterval(() => {
        const nextSnapshot = createContentSnapshot();

        if (nextSnapshot === previousSnapshot) {
          return;
        }

        previousSnapshot = nextSnapshot;
        scheduleBuild("polling change");
      }, 250);
    }
  }
}
