import { z } from "zod";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Zod schema validation for page and template data
 * Enforces strict structure: no inline HTML, no unapproved keys
 */

// Keys forbidden at any section or card level
const FORBIDDEN_HTML_KEYS = ["bodyHtml", "html", "contentHtml", "paragraphsHtml"];
// Raw class/className key pattern
const RAW_CLASS_PATTERN = /([Cc]lassName|Class)$/;

// Additional card-level keys that must not appear on individual cards
const FORBIDDEN_CARD_KEYS = ["className", "cardBodyClassName", "bodyClassName", "imageClassName", "listClassName"];

// Workspace root anchored to this file's location — cwd-independent.
const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Normalize an absolute or relative filePath to a workspace-relative posix path for baseline lookups.
// Relative inputs are treated as already workspace-relative.
// Absolute inputs are made relative to the workspace root regardless of cwd.
function normalizeFilePath(filePath) {
    const abs = resolve(WORKSPACE_ROOT, filePath);
    return relative(WORKSPACE_ROOT, abs).replace(/\\/g, "/");
}

// Legacy violations that are grandfathered as warnings.
// Key: relative file path (from workspace root). Value: Set of "sectionId:key" or "sectionId:cards.N.key" strings.
// Any violation NOT present here is an error. Add no entries for adas.yaml or industry-reinvestment.yaml.
const LEGACY_VIOLATION_BASELINE = new Map([
    ["content/pages/about-us/awards/jeff-silver-platinum-award.yaml", new Set([
        "hero:titleClassName", "hero:sublabelClassName", "hero:bodyClassName",
        "hero:rowClassName", "hero:contentClassName", "hero:badgeColumnClass",
    ])],
    ["content/pages/about-us/awards/russ-verona-gold-class-shop-award.yaml", new Set([
        "hero:titleClassName", "hero:sublabelClassName", "hero:bodyClassName",
        "hero:rowClassName", "hero:contentClassName", "hero:badgeColumnClass",
    ])],
    ["content/pages/about-us.yaml", new Set([
        "about-education:cards.0.paragraphsHtml",
        "about-education:cards.1.paragraphsHtml",
        "about-education:cards.2.paragraphsHtml",
    ])],
    ["content/pages/governance/board-of-directors.yaml", new Set([
        "terms-and-expectations:paragraphsHtml",
    ])],
    ["content/pages/governance/membership.yaml", new Set([
        "who-are-members:cardColumnClass",
    ])],
]);

/**
 * Find raw markup/class violations in a section data object.
 * Returns {errors, warnings} depending on whether the violation is in the baseline.
 * @param {object} data - Section data to check
 * @param {string} filePath - Relative file path for baseline lookup
 * @param {string} sectionId - Section id for path construction
 * @param {string[]} [additionalForbidden] - Extra keys to forbid (beyond FORBIDDEN_HTML_KEYS)
 */
function findRawMarkupKeys(data, filePath, sectionId, additionalForbidden = []) {
    const errors = [];
    const warnings = [];
    const fileBaseline = LEGACY_VIOLATION_BASELINE.get(filePath) || new Set();
    const extraForbidden = new Set(additionalForbidden);

    for (const key of Object.keys(data)) {
        const isForbiddenHtml = FORBIDDEN_HTML_KEYS.includes(key) || extraForbidden.has(key);
        const isRawClass = RAW_CLASS_PATTERN.test(key);

        if (isForbiddenHtml || isRawClass) {
            const violationKey = `${sectionId}:${key}`;
            if (fileBaseline.has(violationKey)) {
                warnings.push(`Legacy violation (baseline carve-out): '${key}' in section '${sectionId}'`);
            } else {
                errors.push(`Forbidden key '${key}' in section '${sectionId}'`);
            }
        }
    }

    return { errors, warnings };
}

/**
 * Find raw markup/class violations on individual cards within a cards section.
 * Returns {errors, warnings}.
 * @param {any[]} cards - Cards array
 * @param {string} filePath - Relative file path for baseline lookup
 * @param {string} sectionId - Section id for path construction
 */
function findCardRawMarkupKeys(cards, filePath, sectionId) {
    const errors = [];
    const warnings = [];
    if (!Array.isArray(cards)) return { errors, warnings };

    const fileBaseline = LEGACY_VIOLATION_BASELINE.get(filePath) || new Set();

    cards.forEach((card, i) => {
        if (!card || typeof card !== "object") return;
        for (const key of Object.keys(card)) {
            const isForbiddenHtml = FORBIDDEN_HTML_KEYS.includes(key);
            const isRawClass = RAW_CLASS_PATTERN.test(key);
            const isForbiddenCard = FORBIDDEN_CARD_KEYS.includes(key);

            if (isForbiddenHtml || isRawClass || isForbiddenCard) {
                const violationKey = `${sectionId}:cards.${i}.${key}`;
                if (fileBaseline.has(violationKey)) {
                    warnings.push(`Legacy violation (baseline carve-out): '${key}' on card ${i} in section '${sectionId}'`);
                } else {
                    errors.push(`Forbidden key '${key}' on card ${i} in section '${sectionId}'`);
                }
            }
        }
    });

    return { errors, warnings };
}

const ALLOWED_SECTION_TYPES = [
    "hero",
    "pageNav",
    "logoGrid",
    "stickyCards",
    "textMedia",
    "cards",
    "iconCardGrid",
    "cta",
    "statementList",
    "progressList",
    "text",
    "html",
    "embed",
    "accordion",
    "mediaSlider",
    "profileGrid",
    "quote",
    "quoteGrid",
    "legal",
    "accreditation",
    "leadForm",
    "mediaFeatureList",
    "anchor",
];

const ALLOWED_BUTTON_VARIANTS = ["primary", "outline", "white", "gray"];
const ALLOWED_HERO_VARIANTS = ["default", "banner", "split"];
const ALLOWED_HERO_IMAGE_PLACEMENTS = ["column", "background"];
const ALLOWED_HERO_BACKGROUND_COLORS = ["light", "white", "dark"];
// Semantic layout desktopSplit values
const ALLOWED_HERO_DESKTOP_SPLITS = ["equal", "text-5-media-7", "text-7-media-5", "lg-5-7"];
const ALLOWED_HERO_ROW_VERTICAL_ALIGNS = ["center", "end", "none"];
const ALLOWED_HERO_ROW_JUSTIFIES = ["between", "center", "none"];
const ALLOWED_HERO_MOBILE_MEDIA_ORDERS = ["above", "below"];
const ALLOWED_HERO_DESKTOP_MEDIA_POSITIONS = ["left", "right"];
const ALLOWED_HERO_IMAGE_STYLES = ["rounded", "cutout", "banner"];
// Top-level imageStyle applies only to the default hero rendering path; only "rounded" has an effect.
// "cutout" and "banner" would silently render as banner — reject them here; use layout.imageStyle instead.
const ALLOWED_HERO_DEFAULT_IMAGE_STYLES = ["rounded"];
const ALLOWED_HERO_IMAGE_FRAMES = ["section", "none"];
const ALLOWED_HERO_BOX_STYLES = ["none", "collapse"];
const ALLOWED_HERO_MOBILE_SPACINGS = ["none", "tight", "section", "offset"];
const ALLOWED_HERO_GAP_TARGETS = ["copy", "media", "none"];
const ALLOWED_HERO_SECTION_PADDINGS = ["padded"];
const ALLOWED_HERO_SPACING_BREAKPOINTS = ["sm", "md", "lg", "xl"];
// Keys explicitly allowed on the hero section data object
const ALLOWED_HERO_KEYS = new Set([
    "id", "type", "variant", "heroStyle", "heading", "title", "headline", "headline1", "headline2",
    "headingTag", "label", "sublabel", "body", "paragraphs", "buttons", "footerButtons", "links",
    "image", "imageLink", "imagePlacement", "badgeImage", "badge", "video", "bullets", "bulletIcon",
    "form", "pathDropdown", "layout", "imageStyle", "imageFrame", "spacing", "sectionSpacing",
    "inlineLinkParagraphs",
    "backgroundColor", "backgroundLight", "backgroundTheme", "__template", "__autoSectionClassName",
    "sectionChrome", "ctaDestination",
]);

const InlineLinkSegmentSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string().min(1) }).strict(),
    z.object({ type: z.literal("link"), label: z.string().trim().min(1), href: z.string().url().refine((href) => /^https?:\/\//i.test(href), "Inline link href must be HTTP(S)") }).strict(),
]);
export const InlineLinkParagraphSchema = z.object({ segments: z.array(InlineLinkSegmentSchema).min(1) }).strict();

const TYPED_MEDIA_PERMISSION_TOKENS = new Set(["autoplay", "encrypted-media", "fullscreen", "picture-in-picture"]);
const TYPED_MEDIA_LOADING_VALUES = ["eager", "lazy"];
const TYPED_MEDIA_REFERRER_POLICIES = ["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"];

function isSafeAbsoluteHttpUrl(value) {
    if (typeof value !== "string" || !value.trim() || /[\s\\\u0000-\u001f\u007f]/.test(value) || value.startsWith("//")) return false;
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
    } catch {
        return false;
    }
}

function isSafeTypedDestination(value, { allowScopedDestinations = false } = {}) {
    if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
    if (allowScopedDestinations && value.startsWith("#") && value.length > 1) return true;
    if (allowScopedDestinations && /^\/(?!\/)/.test(value)) return true;
    return isSafeAbsoluteHttpUrl(value);
}

function isPositiveDimension(value) {
    return (typeof value === "number" && Number.isInteger(value) && value > 0)
        || (typeof value === "string" && /^[1-9]\d*$/.test(value));
}

function isValidAspectRatio(value) {
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (typeof value !== "string" || !value) return false;
    if (/^(?:0\.\d+|[1-9]\d*(?:\.\d+)?)$/.test(value)) return Number(value) > 0;
    const fraction = value.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    return Boolean(fraction) && Number(fraction[1]) > 0 && Number(fraction[2]) > 0;
}

function validateTypedMediaLink(link, ctx, path, options = {}) {
    if (link === undefined) return;
    if (!link || typeof link !== "object" || Array.isArray(link)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media link must be an object", path }); return; }
    Object.keys(link).filter((key) => !["href", "label", "title", "target"].includes(key)).forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "unknown media link key", path: [...path, key] }));
    if (!isSafeTypedDestination(link.href, options)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "media link href must be a safe fragment, root-relative, or HTTP(S) URL", path: [...path, "href"] });
    if (typeof link.label !== "string" || !link.label.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "media link label is required", path: [...path, "label"] });
    if (link.title !== undefined && (typeof link.title !== "string" || !link.title.trim())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "media link title must be nonblank text", path: [...path, "title"] });
    if (link.target !== undefined && !["_blank", "_self"].includes(link.target)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "media link target is invalid", path: [...path, "target"] });
}

function validateTypedMedia(media, ctx, path, { requireAspectRatio = true, allowScopedDestinations = false } = {}) {
    if (!media || typeof media !== "object" || Array.isArray(media)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media must be an object", path }); return; }
    const allowed = ["src", "title", "allow", "fullscreen", "loading", "referrerPolicy", "width", "height", "aspectRatio", "link"];
    Object.keys(media).filter((key) => !allowed.includes(key)).forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "unknown typed media key", path: [...path, key] }));
    if (!isSafeAbsoluteHttpUrl(media.src)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media source must be an absolute HTTP(S) URL", path: [...path, "src"] });
    if (typeof media.title !== "string" || !media.title.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media title is required", path: [...path, "title"] });
    if (media.allow !== undefined) {
        if (!Array.isArray(media.allow) || media.allow.length === 0 || media.allow.some((token) => typeof token !== "string" || !TYPED_MEDIA_PERMISSION_TOKENS.has(token))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media permission policy is invalid", path: [...path, "allow"] });
        else if (new Set(media.allow).size !== media.allow.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media permission policy contains duplicates", path: [...path, "allow"] });
    }
    if (media.fullscreen !== undefined && typeof media.fullscreen !== "boolean") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media fullscreen must be boolean", path: [...path, "fullscreen"] });
    if (media.loading !== undefined && !TYPED_MEDIA_LOADING_VALUES.includes(media.loading)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media loading is invalid", path: [...path, "loading"] });
    if (media.referrerPolicy !== undefined && !TYPED_MEDIA_REFERRER_POLICIES.includes(media.referrerPolicy)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media referrer policy is invalid", path: [...path, "referrerPolicy"] });
    if (!isPositiveDimension(media.width)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media width must be positive", path: [...path, "width"] });
    if (!isPositiveDimension(media.height)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media height must be positive", path: [...path, "height"] });
    if (requireAspectRatio && !isValidAspectRatio(media.aspectRatio)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed media aspect ratio must be positive and valid", path: [...path, "aspectRatio"] });
    validateTypedMediaLink(media.link, ctx, [...path, "link"], { allowScopedDestinations });
}

function validateTypedAddress(address, ctx, path = ["address"]) {
    if (!address || typeof address !== "object" || Array.isArray(address)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed address must be an object", path }); return; }
    Object.keys(address).filter((key) => !["text", "href", "target"].includes(key)).forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "unknown typed address key", path: [...path, key] }));
    if (typeof address.text !== "string" || !address.text.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed address text is required", path: [...path, "text"] });
    if (!isSafeAbsoluteHttpUrl(address.href)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed address href must be an absolute HTTP(S) URL", path: [...path, "href"] });
    if (address.target !== undefined && !["_blank", "_self"].includes(address.target)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed address target is invalid", path: [...path, "target"] });
}

function validateTypedInlineLinks(data, ctx, { allowScopedDestinations = false } = {}) {
    if (data.inlineLinkParagraphs === undefined) return;
    if (!Array.isArray(data.inlineLinkParagraphs) || data.inlineLinkParagraphs.length === 0) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "inlineLinkParagraphs must be a non-empty array", path: ["inlineLinkParagraphs"] }); return; }
    data.inlineLinkParagraphs.forEach((paragraph, index) => {
        if (!paragraph || typeof paragraph !== "object" || Array.isArray(paragraph) || !Array.isArray(paragraph.segments) || paragraph.segments.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "inline link paragraph is invalid", path: ["inlineLinkParagraphs", index] });
            return;
        }
        paragraph.segments.forEach((segment, segmentIndex) => {
            const validText = segment?.type === "text" && typeof segment.text === "string" && segment.text.length > 0;
            const validLink = segment?.type === "link" && typeof segment.label === "string" && segment.label.trim() && isSafeTypedDestination(segment.href, { allowScopedDestinations });
            if (!validText && !validLink) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "inline link segment is invalid", path: ["inlineLinkParagraphs", index, "segments", segmentIndex] });
            if (segment && typeof segment === "object") {
                const allowed = segment.type === "link" ? ["type", "label", "href"] : ["type", "text"];
                Object.keys(segment).filter((key) => !allowed.includes(key)).forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "unknown inline link segment key", path: ["inlineLinkParagraphs", index, "segments", segmentIndex, key] }));
            }
        });
    });
}

function validateTypedSegmentItem(item, ctx, path, { allowMailto = false } = {}) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !Array.isArray(item.segments) || item.segments.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed segment item requires a non-empty segments array", path });
        return;
    }
    Object.keys(item).filter((key) => key !== "segments").forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "unknown typed segment item key", path: [...path, key] }));
    item.segments.forEach((segment, index) => {
        const segmentPath = [...path, "segments", index];
        const isText = segment?.type === "text" && typeof segment.text === "string" && segment.text.trim().length > 0;
        const destination = segment?.href;
        const isLink = segment?.type === "link" && typeof segment.label === "string" && segment.label.trim() && (isSafeTypedDestination(destination, { allowScopedDestinations: true }) || (allowMailto && isSafePlainMailto(destination)));
        if (!isText && !isLink) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed segment must be nonblank text or a safe complete link", path: segmentPath });
        if (segment && typeof segment === "object") {
            const allowed = segment.type === "link" ? ["type", "label", "href"] : ["type", "text"];
            Object.keys(segment).filter((key) => !allowed.includes(key)).forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "unknown typed segment key", path: [...segmentPath, key] }));
        }
    });
}

function isSafePlainMailto(value) {
    if (typeof value !== "string" || value.length > 254 || /[\s\\\u0000-\u001f\u007f%?#]/.test(value)) return false;
    const match = value.match(/^mailto:([^@]+)@([^@]+)$/);
    if (!match) return false;
    const [, local, domain] = match;
    if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..") || !/^[A-Za-z0-9.!#$&'*+\/=^_`{|}~-]+$/.test(local)) return false;
    const labels = domain.split(".");
    return labels.length >= 2 && labels.every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
}
const ALLOWED_LIST_VARIANTS = ["labeled", "ordered", "checks"];
const ALLOWED_DECORATIVE_IMAGE_PLACEMENTS = ["cover", "bottom"];
const ALLOWED_TEXT_SECTION_WIDTHS = ["default", "narrow", "full"];

function validateSectionList(list, ctx, path = ["list"]) {
    if (list === undefined || list === null) return;
    if (typeof list !== "object" || Array.isArray(list)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_type, expected: "object", received: typeof list, message: "list must be an object", path });
        return;
    }
    if (!ALLOWED_LIST_VARIANTS.includes(list.variant)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_LIST_VARIANTS, received: list.variant, message: `list.variant must be one of: ${ALLOWED_LIST_VARIANTS.join(", ")}`, path: [...path, "variant"] });
    }
    if (!Array.isArray(list.items) || list.items.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "list.items must be a non-empty array", path: [...path, "items"] });
    } else if (list.variant === "labeled") {
        list.items.forEach((item, i) => {
            if (!item?.label) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "labeled list item requires label", path: [...path, "items", i, "label"] });
            if (!item?.value) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "labeled list item requires value", path: [...path, "items", i, "value"] });
        });
    } else {
        list.items.forEach((item, i) => {
            const text = typeof item === "string" ? item : item?.text;
            if (!text) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "list item must be a string or have a text property", path: [...path, "items", i] });
        });
    }
}

function validateDecorativeImage(di, ctx, path = ["decorativeImage"]) {
    if (di === undefined || di === null) return;
    if (typeof di !== "object" || Array.isArray(di)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_type, expected: "object", received: typeof di, message: "decorativeImage must be an object", path });
        return;
    }
    if (!ALLOWED_DECORATIVE_IMAGE_PLACEMENTS.includes(di.placement)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_DECORATIVE_IMAGE_PLACEMENTS, received: di.placement, message: `decorativeImage.placement must be one of: ${ALLOWED_DECORATIVE_IMAGE_PLACEMENTS.join(", ")}`, path: [...path, "placement"] });
    }
    if (!di.image || typeof di.image !== "object") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorativeImage.image is required", path: [...path, "image"] });
    } else {
        if (!di.image.desktopSrc) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorativeImage.image.desktopSrc is required", path: [...path, "image", "desktopSrc"] });
        if (!di.image.width) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorativeImage.image.width is required", path: [...path, "image", "width"] });
        if (!di.image.height) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorativeImage.image.height is required", path: [...path, "image", "height"] });
        if (Array.isArray(di.image.sources)) {
            di.image.sources.forEach((s, i) => {
                if (!s?.srcset) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorativeImage.image.sources[].srcset is required", path: [...path, "image", "sources", i, "srcset"] });
                if (!s?.width) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorativeImage.image.sources[].width is required", path: [...path, "image", "sources", i, "width"] });
                if (!s?.height) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorativeImage.image.sources[].height is required", path: [...path, "image", "sources", i, "height"] });
            });
        }
    }
}
// layout.contentWidth on textMedia — distinct from layout.width on text sections (which uses col-xl-5 for narrow)
const ALLOWED_TEXT_MEDIA_CONTENT_WIDTHS = ["default", "narrow", "wide", "full"];
const ALLOWED_LAYOUT_BREAKPOINTS = ["sm", "md", "lg", "xl", "xxl"];
const ALLOWED_ICON_CARD_COLUMNS = [1, 2, 3, 4, "auto"];
const ALLOWED_ICON_CARD_SPACING_PROPERTIES = ["paddingInline", "paddingBlock", "paddingTop", "marginTop"];
const ALLOWED_ICON_CARD_SPACING_BREAKPOINTS = ["base", ...ALLOWED_LAYOUT_BREAKPOINTS];
const ALLOWED_ICON_CARD_SPACING_TOKENS = ["none", "tight", "small", "medium", "wide"];
const ALLOWED_TEXT_MEDIA_DOM_ORDERS = ["copy-first"];
const ALLOWED_TEXT_MEDIA_COPY_SPACING_RESETS = ["md", "lg", "xl"];
const ALLOWED_TEXT_MEDIA_GAP_SIDES = ["logical-start"];

const SAFE_SVG_ELEMENTS = new Set(["svg", "path", "circle", "rect", "line", "polyline", "polygon", "g", "defs", "clipPath", "mask", "title", "desc"]);
const SAFE_SVG_ATTRIBUTES = new Set(["xmlns", "class", "width", "height", "viewBox", "fill", "fill-rule", "clip-rule", "opacity", "stroke", "stroke-width", "stroke-miterlimit", "stroke-linecap", "stroke-linejoin", "d", "cx", "cy", "r", "x", "y", "x1", "x2", "y1", "y2", "points", "transform", "clip-path", "mask", "id", "role", "aria-label", "aria-hidden", "focusable"]);

export function admitIconSvg(iconSvg) {
    if (typeof iconSvg !== "string" || !/^\s*<svg\b[^>]*>[\s\S]*<\/svg>\s*$/.test(iconSvg)) return { ok: false, reason: "exactly one SVG root is required" };
    if ((iconSvg.match(/<svg\b/gi) || []).length !== 1 || (iconSvg.match(/<\/svg\b/gi) || []).length !== 1) return { ok: false, reason: "exactly one SVG root is required" };
    if (/<!|<\?|<!--|<!\[CDATA\[/i.test(iconSvg)) return { ok: false, reason: "SVG declarations and non-element markup are not allowed" };
    const ids = new Set([...iconSvg.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]));
    for (const match of iconSvg.matchAll(/<\/?([A-Za-z][\w:-]*)([^>]*)>/g)) {
        const [, element, attributes] = match;
        if (!SAFE_SVG_ELEMENTS.has(element)) return { ok: false, reason: "SVG contains an unsupported element" };
        if (match[0].startsWith("</")) continue;
        const attributePattern = /\s([\w:-]+)\s*=\s*(["'])(.*?)\2/g;
        const consumed = attributes.replace(attributePattern, "").replace(/\//g, "").trim();
        if (consumed) return { ok: false, reason: "SVG attributes must be quoted assignments" };
        const seenAttributes = new Set();
        for (const attribute of attributes.matchAll(attributePattern)) {
            const [, name, , value = ""] = attribute;
            if (seenAttributes.has(name)) return { ok: false, reason: "SVG contains duplicate attributes" };
            seenAttributes.add(name);
            if (!SAFE_SVG_ATTRIBUTES.has(name)) return { ok: false, reason: "SVG contains an unsupported attribute" };
            if (name === "xmlns") {
                if (element !== "svg" || value !== "http://www.w3.org/2000/svg") return { ok: false, reason: "SVG namespace is invalid" };
                continue;
            }
            if (name === "class" && element !== "svg") return { ok: false, reason: "SVG class is allowed only on the root" };
            if (name === "stroke-miterlimit" && !["path", "circle", "rect", "line", "polyline", "polygon"].includes(element)) return { ok: false, reason: "SVG stroke-miterlimit is not allowed on this element" };
            if (name === "stroke-miterlimit" && (!(Number(value) > 0))) return { ok: false, reason: "SVG stroke-miterlimit must be positive" };
            if (/^on/i.test(name) || name === "style") return { ok: false, reason: "SVG event and style attributes are not allowed" };
            if ((/url\s*\(/i.test(value) || /&/.test(value) || /\\/.test(value)) && !["clip-path", "mask"].includes(name)) return { ok: false, reason: "SVG URL functions are allowed only for clip-path or mask fragments" };
            if (/(?:https?:|\/\/|data:|javascript:)/i.test(value)) return { ok: false, reason: "SVG external references are not allowed" };
            if (["clip-path", "mask"].includes(name) && (!/^url\(#([\w.-]+)\)$/.test(value) || !ids.has(value.slice(5, -1)))) return { ok: false, reason: "SVG fragment reference is unresolved" };
        }
    }
    return { ok: true, reason: "" };
}

function validateSafeIconSvg(iconSvg, ctx, path) {
    if (iconSvg === undefined) return;
    const admission = admitIconSvg(iconSvg);
    if (!admission.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `iconSvg rejected: ${admission.reason}`, path });
}

function validateResponsiveImage(image, ctx, path) {
    if (!image || typeof image !== "object" || Array.isArray(image)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image must be an object", path });
        return;
    }
    const usableUrlDevices = new Set();
    if (image.urls !== undefined) {
        if (!image.urls || typeof image.urls !== "object" || Array.isArray(image.urls)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.urls must be an object", path: [...path, "urls"] });
        } else {
            for (const [device, entries] of Object.entries(image.urls)) {
                if (!["desktop", "mobile"].includes(device) || !entries || typeof entries !== "object" || Array.isArray(entries)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.urls supports only desktop and mobile source maps", path: [...path, "urls", device] });
                    continue;
                }
                for (const [descriptor, value] of Object.entries(entries)) {
                    if (!/^[1-9]\d*w$/.test(descriptor) || typeof value !== "string" || !value.trim()) {
                        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.urls entries require positive NNNw keys and nonempty string values", path: [...path, "urls", device, descriptor] });
                    } else {
                        usableUrlDevices.add(device);
                    }
                }
            }
        }
    }
    const hasUsableDesktopUrlMap = usableUrlDevices.has("desktop");
    if ((typeof image.desktopSrc !== "string" || !image.desktopSrc.trim()) && (typeof image.src !== "string" || !image.src.trim()) && !hasUsableDesktopUrlMap) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image requires a nonempty desktopSrc, src, or structured desktop urls source", path });
    if (image.decorative !== true && (typeof image.alt !== "string" || !image.alt.trim())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.alt is required unless decorative is true", path: [...path, "alt"] });
    const isPositive = (value) => /^\d+$/.test(String(value ?? "")) && Number(value) > 0;
    const desktopHeight = typeof image.height === "object" && image.height !== null ? image.height.desktop : image.height;
    const mobileHeight = typeof image.height === "object" && image.height !== null ? image.height.mobile : image.height;
    if (!isPositive(desktopHeight)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.height must provide a positive desktop/scalar value", path: [...path, "height"] });
    if (usableUrlDevices.has("mobile") && !isPositive(mobileHeight)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.height must provide a positive mobile/scalar value for mobile sources", path: [...path, "height"] });
    if (image.width !== undefined) {
        const width = typeof image.width === "object" && image.width !== null ? image.width.desktop : image.width;
        if (!isPositive(width)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.width must be a positive integer when supplied", path: [...path, "width"] });
    }
    if (image.sources !== undefined && !Array.isArray(image.sources)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.sources must be an array", path: [...path, "sources"] });
    if (Array.isArray(image.sources) && image.sources.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.sources must not be empty when supplied", path: [...path, "sources"] });
    (Array.isArray(image.sources) ? image.sources : []).forEach((source, index) => {
        const sourcePath = [...path, "sources", index];
        if (!source || typeof source !== "object" || Array.isArray(source)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.sources entries must be objects", path: sourcePath });
            return;
        }
        if (typeof source.srcset !== "string" || !source.srcset.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.sources entry requires nonempty string srcset", path: [...sourcePath, "srcset"] });
        for (const field of ["maxWidth", "width", "height"]) if (!/^\d+$/.test(String(source[field] ?? "")) || Number(source[field]) <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `image.sources.${field} must be a positive integer`, path: [...sourcePath, field] });
    });
}

function validateStructuredCardMedia(card, ctx, path) {
    if (!card || typeof card !== "object" || Array.isArray(card)) return;
    if (card.iconHtml !== undefined) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "iconHtml is not allowed; use iconSvg or image", path: [...path, "iconHtml"] });
    if (card.image !== undefined && card.iconSvg !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image and iconSvg are mutually exclusive", path });
    validateSafeIconSvg(card.iconSvg, ctx, [...path, "iconSvg"]);
    if (card.image !== undefined) validateResponsiveImage(card.image, ctx, [...path, "image"]);
}

function validateIconCardLayout(layout, ctx) {
    if (!layout || typeof layout !== "object" || Array.isArray(layout)) return;
    const cardsPerRow = layout.cardsPerRow;
    if (cardsPerRow !== undefined && typeof cardsPerRow !== "number") {
        if (!cardsPerRow || typeof cardsPerRow !== "object" || Array.isArray(cardsPerRow)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "layout.cardsPerRow must be 2, 3, 4, or a breakpoint map", path: ["layout", "cardsPerRow"] });
        } else {
            for (const [breakpoint, value] of Object.entries(cardsPerRow)) {
                if (!ALLOWED_LAYOUT_BREAKPOINTS.includes(breakpoint)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layout.cardsPerRow breakpoint '${breakpoint}' is not supported`, path: ["layout", "cardsPerRow", breakpoint] });
                } else if (!ALLOWED_ICON_CARD_COLUMNS.includes(value)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layout.cardsPerRow.${breakpoint} must be 1, 2, 3, 4, or 'auto'`, path: ["layout", "cardsPerRow", breakpoint] });
                }
            }
        }
    } else if (cardsPerRow !== undefined && ![2, 3, 4].includes(cardsPerRow)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "layout.cardsPerRow must be 2, 3, 4, or a breakpoint map", path: ["layout", "cardsPerRow"] });
    }

    const spacing = layout.cardSpacing;
    if (spacing === undefined) return;
    if (!spacing || typeof spacing !== "object" || Array.isArray(spacing)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "layout.cardSpacing must be an object", path: ["layout", "cardSpacing"] });
        return;
    }
    for (const [property, values] of Object.entries(spacing)) {
        if (!ALLOWED_ICON_CARD_SPACING_PROPERTIES.includes(property)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layout.cardSpacing property '${property}' is not supported`, path: ["layout", "cardSpacing", property] });
            continue;
        }
        if (!values || typeof values !== "object" || Array.isArray(values)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layout.cardSpacing.${property} must be a breakpoint map`, path: ["layout", "cardSpacing", property] });
            continue;
        }
        for (const [breakpoint, token] of Object.entries(values)) {
            if (!ALLOWED_ICON_CARD_SPACING_BREAKPOINTS.includes(breakpoint)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layout.cardSpacing.${property} breakpoint '${breakpoint}' is not supported`, path: ["layout", "cardSpacing", property, breakpoint] });
            } else if (!ALLOWED_ICON_CARD_SPACING_TOKENS.includes(token)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layout.cardSpacing.${property}.${breakpoint} must be one of: ${ALLOWED_ICON_CARD_SPACING_TOKENS.join(", ")}`, path: ["layout", "cardSpacing", property, breakpoint] });
            }
        }
    }
}

const ALLOWED_PATH_DROPDOWN_VARIANTS = ["primary", "outline"];

function validatePathDropdown(pd, ctx, path = ["pathDropdown"]) {
    if (pd === undefined || pd === null) return;
    if (typeof pd !== "object" || Array.isArray(pd)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_type, expected: "object", received: typeof pd, message: "pathDropdown must be an object", path });
        return;
    }
    if (!pd.label || typeof pd.label !== "string") {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_type, expected: "string", received: typeof pd.label, message: "pathDropdown.label is required", path: [...path, "label"] });
    }
    if (!Array.isArray(pd.items) || pd.items.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "pathDropdown.items must be a non-empty array", path: [...path, "items"] });
    } else {
        pd.items.forEach((item, i) => {
            if (!item?.label || typeof item.label !== "string") {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "pathDropdown item label is required", path: [...path, "items", i, "label"] });
            }
            if (!item?.href || typeof item.href !== "string") {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "pathDropdown item href is required", path: [...path, "items", i, "href"] });
            }
        });
    }
    if (pd.variant !== undefined && !ALLOWED_PATH_DROPDOWN_VARIANTS.includes(pd.variant)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_PATH_DROPDOWN_VARIANTS, received: pd.variant, message: `pathDropdown.variant must be one of: ${ALLOWED_PATH_DROPDOWN_VARIANTS.join(", ")}`, path: [...path, "variant"] });
    }
}

const ALLOWED_BACKGROUND_THEMES = ["light", "white", "dark"];
const ALLOWED_IMAGE_PLACEMENTS = ["column", "background"];
const ALLOWED_HEADING_TAGS = ["h1", "h2", "h3", "p"];
const ALLOWED_IMAGE_LOADING = ["eager", "lazy"];

// Button schema for hero and other sections
const ButtonSchema = z.object({
    label: z.string().min(1, "Button label is required"),
    href: z.string().url("Button href must be a valid URL"),
    variant: z.enum(ALLOWED_BUTTON_VARIANTS).optional(),
    location: z.enum(["header", "footer"]).optional(),
    className: z.string().optional(),
}).strict();

// Image schema for hero and other sections
const ImageSchema = z.object({
    src: z.string().url("Image src must be a valid URL"),
    alt: z.string().min(1, "Image alt text is required"),
    className: z.string().optional(),
    loading: z.enum(ALLOWED_IMAGE_LOADING).optional(),
    desktopSrc: z.string().url().optional(),
    desktopSrcset: z.string().optional(),
    mobileSrcset: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
    sizes: z.string().optional(),
}).strict();

// Link schema for textMedia and other sections
const LinkSchema = z.object({
    label: z.string().min(1, "Link label is required"),
    href: z.string().url("Link href must be a valid URL"),
}).strict();

// Image card schema for cards section
const ImageCardSchema = z.object({
    title: z.string().min(1, "Card title is required"),
    body: z.string().min(1, "Card body is required"),
    href: z.string().url("Card href must be a valid URL"),
    image: ImageSchema,
}).strict();

// Accordion item schema
const AccordionItemSchema = z.object({
    title: z.string().min(1, "Accordion title is required"),
    body: z.string().min(1, "Accordion body is required"),
}).strict();

// TextMedia section schema - permissive during transition phase
export const TextMediaSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "textMedia") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_literal,
            expected: "textMedia",
            received: data.type,
            message: "Section type must be 'textMedia'",
            path: ["type"],
        });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`,
                path: [key],
            });
        }
    }

    // Validate layout.labelPosition if present
    if (data.layout?.labelPosition !== undefined && data.layout.labelPosition !== "above") {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ["above"], received: data.layout.labelPosition, message: "layout.labelPosition must be \"above\"", path: ["layout", "labelPosition"] });
    }
    if (data.layout?.contentWidth !== undefined && !ALLOWED_TEXT_MEDIA_CONTENT_WIDTHS.includes(data.layout.contentWidth)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_TEXT_MEDIA_CONTENT_WIDTHS, received: data.layout.contentWidth, message: `layout.contentWidth must be one of: ${ALLOWED_TEXT_MEDIA_CONTENT_WIDTHS.join(", ")}`, path: ["layout", "contentWidth"] });
    }
    if (data.layout?.domOrder !== undefined && !ALLOWED_TEXT_MEDIA_DOM_ORDERS.includes(data.layout.domOrder)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_TEXT_MEDIA_DOM_ORDERS, received: data.layout.domOrder, message: `layout.domOrder must be "copy-first"`, path: ["layout", "domOrder"] });
    }
    if (data.layout?.mobileCopySpacingResetBreakpoint !== undefined && !ALLOWED_TEXT_MEDIA_COPY_SPACING_RESETS.includes(data.layout.mobileCopySpacingResetBreakpoint)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_TEXT_MEDIA_COPY_SPACING_RESETS, received: data.layout.mobileCopySpacingResetBreakpoint, message: `layout.mobileCopySpacingResetBreakpoint must be one of: ${ALLOWED_TEXT_MEDIA_COPY_SPACING_RESETS.join(", ")}`, path: ["layout", "mobileCopySpacingResetBreakpoint"] });
    }
    if (data.layout?.desktopGapSide !== undefined && !ALLOWED_TEXT_MEDIA_GAP_SIDES.includes(data.layout.desktopGapSide)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_TEXT_MEDIA_GAP_SIDES, received: data.layout.desktopGapSide, message: `layout.desktopGapSide must be "logical-start"`, path: ["layout", "desktopGapSide"] });
    }
    validateSectionList(data.list, ctx);
    validateDecorativeImage(data.decorativeImage, ctx);
    validatePathDropdown(data.pathDropdown, ctx);
    if (data.variant === "componentLibraryTyped") {
        validateTypedInlineLinks(data, ctx, { allowScopedDestinations: true });
        for (const key of ["image", "imageLink", "mediaHtml", "embedHtml"]) if (key in data) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "Component Library typed media cannot include shadow media fields", path: [key] });
        if (data.media === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Component Library typed media is required", path: ["media"] });
        else validateTypedMedia(data.media, ctx, ["media"], { allowScopedDestinations: true });
    } else if (data.media !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "typed media is only supported by the Component Library typed variant", path: ["media"] });
    }
    if (data.badgeImage !== undefined && typeof data.badgeImage === "object" && data.badgeImage !== null) {
        if (!data.badgeImage.alt && data.badgeImage.decorative !== true) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "badgeImage.alt is required unless badgeImage.decorative is true", path: ["badgeImage", "alt"] });
        }
        if (data.badgeImage.className !== undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "badgeImage.className is not allowed; the logo class is fixed", path: ["badgeImage", "className"] });
        }
    }
});

// IconCardGrid section schema - permissive during transition phase
export const IconCardGridSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "iconCardGrid") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_literal,
            expected: "iconCardGrid",
            received: data.type,
            message: "Section type must be 'iconCardGrid'",
            path: ["type"],
        });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`,
                path: [key],
            });
        }
    }
    validateIconCardLayout(data.layout, ctx);
    if (data.iconHtml !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "iconHtml is not allowed; use iconSvg, iconKey, or iconSrc", path: ["iconHtml"] });
    }
    (data.cards || []).forEach((card, index) => {
        validateStructuredCardMedia(card, ctx, ["cards", index]);
    });
});

// Cards section schema - validates section structure and card array contents
export const CardsSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "cards") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_literal,
            expected: "cards",
            received: data.type,
            message: "Section type must be 'cards'",
            path: ["type"],
        });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml", "paragraphsHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`,
                path: [key],
            });
        }
    }
    if (data.variant === "buttonSamples") validateButtonSamples(data, ctx);
    if (data.variant === "componentSamples") { validateExactComponentInventory(data, ctx); return; }
    // Validate cards array and per-card label field
    if (data.cards !== undefined) {
        if (!Array.isArray(data.cards)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "cards must be an array", path: ["cards"] });
        } else {
            data.cards.forEach((card, i) => {
                if (!card || typeof card !== "object" || Array.isArray(card)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "card must be an object", path: ["cards", i] });
                    return;
                }
                if (card.label !== undefined && typeof card.label !== "string") {
                    ctx.addIssue({ code: z.ZodIssueCode.invalid_type, expected: "string", received: typeof card.label, message: "card.label must be a string", path: ["cards", i, "label"] });
                }
                validateStructuredCardMedia(card, ctx, ["cards", i]);
            });
        }
    }
    validatePathDropdown(data.pathDropdown, ctx);
    if (data.image !== undefined) validateStructuredCardMedia(data, ctx, []);
});

export const StickyCardsSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "stickyCards") {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_literal, expected: "stickyCards", received: data.type, message: "Section type must be 'stickyCards'", path: ["type"] });
    }
    if (data.cards !== undefined && !Array.isArray(data.cards)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "cards must be an array", path: ["cards"] });
        return;
    }
    if (["goldClassPaths", "resourceTables"].includes(data.variant) && (!Array.isArray(data.cards) || data.cards.length === 0)) ctx.addIssue({ code:z.ZodIssueCode.custom,message:"variant requires nonempty cards",path:["cards"] });
    const rawKeys = ["html", "bodyHtml", "contentHtml", "paragraphsHtml", "className"];
    if (data.variant === "embed" && (data.embed !== undefined || data.address !== undefined)) {
        if (data.embedHtml !== undefined || data.addressHtml !== undefined) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "typed sticky media cannot be mixed with raw embed or address HTML", path: ["embedHtml"] });
        if (data.embed === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typed address requires a typed embed", path: ["embed"] });
        else validateTypedMedia(data.embed, ctx, ["embed"]);
        if (data.address !== undefined) validateTypedAddress(data.address, ctx);
    }
    if (data.variant === "resourceTables") Object.keys(data).filter((key) => !["id","type","variant","heading","paragraphs","cards","backgroundColor","spacing","layout"].includes(key)).forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "unknown resource section key", path: [key] }));
    (data.cards || []).forEach((card, index) => {
        if (!card || typeof card !== "object" || Array.isArray(card)) { ctx.addIssue({code:z.ZodIssueCode.custom,message:"card must be an object",path:["cards",index]}); return; }
        validateStructuredCardMedia(card, ctx, ["cards", index]);
        if (card.listItems !== undefined && !Array.isArray(card.listItems)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "listItems must be an array", path: ["cards", index, "listItems"] });
        }
        if (Array.isArray(card.listItems)) card.listItems.forEach((item, itemIndex) => {
            const itemPath = ["cards", index, "listItems", itemIndex];
            if (typeof item === "string") {
                if (!item.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "string list item must be nonblank text", path: itemPath });
            } else {
                validateTypedSegmentItem(item, ctx, itemPath);
            }
        });
        for (const key of ["listItemsHtml", "listHtml", "itemsHtml"]) if (key in card) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "raw HTML list fields are not allowed", path: ["cards", index, key] });
        if (data.variant === "goldClassPaths" && (typeof card.subheading !== "string" || !card.subheading.trim())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "card subheading must be nonempty text", path: ["cards", index, "subheading"] });
        if (data.variant === "resourceTables") {
            if (typeof card.heading !== "string" || !card.heading.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "resource card heading is required", path: ["cards", index, "heading"] });
            Object.keys(card).filter((key) => !["heading","groups","footer"].includes(key)).forEach((key) => ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: `unknown resource card key '${key}'`, path: ["cards", index, key] }));
            if (!Array.isArray(card.groups) || card.groups.length === 0) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "resource card requires one or more groups", path: ["cards", index, "groups"] }); return; }
            (card.groups || []).forEach((group, groupIndex) => {
                const path = ["cards", index, "groups", groupIndex];
                if (!group || typeof group !== "object" || Array.isArray(group)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "resource group must be an object", path }); return; }
                rawKeys.forEach((key) => { if (key in group) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: `raw key '${key}' is not allowed`, path: [...path, key] }); });
                Object.keys(group).filter((key)=>!["heading","tableLabel","paragraphs","columns","rows","disclaimer"].includes(key)).forEach((key)=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown resource group key",path:[...path,key]}));
                if (typeof group.heading !== "string" || !group.heading.trim() || typeof group.tableLabel !== "string" || !group.tableLabel.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "resource group heading and tableLabel are required", path });
                if (!Array.isArray(group.columns) || group.columns.length < 1 || group.columns.some((column) => typeof column !== "string" || !column.trim())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "resource columns require nonempty labels", path: [...path, "columns"] });
                if (!Array.isArray(group.rows) || group.rows.length < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "resource rows are required", path: [...path, "rows"] });
                if (Array.isArray(group.rows)) group.rows.forEach((row, rowIndex) => { if (!Array.isArray(row) || row.length !== group.columns?.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "row must match column count", path: [...path, "rows", rowIndex] }); else row.forEach((cell, cellIndex) => { const cellPath=[...path,"rows",rowIndex,cellIndex]; if (typeof cell === "string" ? !cell.trim() : !cell || typeof cell !== "object" || Array.isArray(cell) || typeof cell.label !== "string" || !cell.label.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "cell must be nonempty text or a typed link", path: cellPath }); else if (typeof cell === "object") { Object.keys(cell).filter(key=>!["label","href","target"].includes(key)).forEach(key=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown link cell key",path:[...cellPath,key]})); try { const url=new URL(cell.href); if (!/^https?:$/.test(url.protocol)) throw new Error(); } catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "link href must be HTTP(S)", path: [...cellPath,"href"] }); } if (cell.target !== undefined && !["_blank","_self"].includes(cell.target)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "link target is invalid", path: [...cellPath,"target"] }); } }); });
                if (group.disclaimer !== undefined && (typeof group.disclaimer !== "string" || !group.disclaimer.trim())) ctx.addIssue({ code:z.ZodIssueCode.custom,message:"group disclaimer must be nonempty text",path:[...path,"disclaimer"] });
                if (group.paragraphs !== undefined && (!Array.isArray(group.paragraphs) || group.paragraphs.some((paragraph)=>typeof paragraph!=="string" || !paragraph.trim()))) ctx.addIssue({code:z.ZodIssueCode.custom,message:"group paragraphs must be nonempty text",path:[...path,"paragraphs"]});
            });
            if (card.footer !== undefined && (typeof card.footer !== "string" || !card.footer.trim())) ctx.addIssue({code:z.ZodIssueCode.custom,message:"card footer must be nonempty text",path:["cards",index,"footer"]});
        }
    });
});

export const LogoGridSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "logoGrid") ctx.addIssue({ code: z.ZodIssueCode.invalid_literal, expected: "logoGrid", received: data.type, message: "Section type must be 'logoGrid'", path: ["type"] });
    if (data.variant === "decorativeBottom" && data.decorativeImage === undefined) { ctx.addIssue({code:z.ZodIssueCode.custom,message:"decorativeBottom requires decorativeImage",path:["decorativeImage"]}); return; }
    if (data.decorativeImage === undefined) return;
    if (!data.decorativeImage || typeof data.decorativeImage !== "object" || Array.isArray(data.decorativeImage) || !data.decorativeImage.image || typeof data.decorativeImage.image !== "object" || Array.isArray(data.decorativeImage.image) || !Array.isArray(data.decorativeImage.image.sources) || data.decorativeImage.image.sources.length !== 1 || !data.decorativeImage.image.sources[0] || typeof data.decorativeImage.image.sources[0] !== "object" || Array.isArray(data.decorativeImage.image.sources[0])) { ctx.addIssue({code:z.ZodIssueCode.custom,message:"decorative image structure is invalid",path:["decorativeImage"]}); return; }
    if (data.variant !== "decorativeBottom" || data.decorativeImage.placement !== "bottom") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorative logo grid requires bottom placement", path: ["variant"] });
    validateDecorativeImage(data.decorativeImage, ctx, ["decorativeImage"]);
    const image = data.decorativeImage?.image;
    const safeUrl=(value)=>{ if(typeof value!=="string"||/[\s\\\u0000-\u001f\u007f]/.test(value))return false; if(/^\/(?!\/)/.test(value))return true; try { const url=new URL(value); return ["http:","https:"].includes(url.protocol)&&!!url.hostname; } catch{return false;} };
    const candidateWidths = (value, path) => {
        if (typeof value !== "string" || !value.trim() || /(?:javascript:|data:|[\u0000-\u001f\u007f])/i.test(value)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "responsive source is unsafe", path }); return []; }
        const parts=value.split(",").map(part=>part.trim()); const widths=[];
        for (const part of parts) { const match=part.match(/^([^\s]+)\s+([1-9]\d*)w$/); if (!part || !match || !safeUrl(match[1])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "responsive candidate is malformed", path }); else widths.push(Number(match[2])); }
        return widths;
    };
    const mobile=candidateWidths(image?.sources?.[0]?.srcset,["decorativeImage","image","sources",0,"srcset"]); const desktop=candidateWidths(image?.desktopSrcset,["decorativeImage","image","desktopSrcset"]);
    if (!safeUrl(image?.desktopSrc)) ctx.addIssue({code:z.ZodIssueCode.custom,message:"desktopSrc must be root-relative or HTTP(S)",path:["decorativeImage","image","desktopSrc"]});
    const exact=(actual, expected)=>actual.length===expected.length&&actual.every((value,index)=>value===expected[index]);
    if (!image?.decorative || image.alt !== "" || !String(image.desktopSrc || "").trim() || !Array.isArray(image.sources) || image.sources.length !== 1 || !exact(mobile,[400,800,1600]) || !exact(desktop,[1200,1400,2400,2800])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorative logo grid requires the seven-source responsive contract", path: ["decorativeImage", "image"] });
    const positive=(value)=>typeof value==="number" ? Number.isInteger(value)&&value>0 : typeof value==="string"&&/^\d+$/.test(value)&&Number(value)>0;
    if (![image?.width,image?.height,image?.sources?.[0]?.width,image?.sources?.[0]?.height,image?.sources?.[0]?.maxWidth].every(positive)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "decorative dimensions must be positive", path: ["decorativeImage","image"] });
    const allowedWrapper=new Set(["placement","image"]); const allowedImage=new Set(["alt","decorative","desktopSrc","desktopSrcset","width","height","sizes","sources"]); const allowedSource=new Set(["maxWidth","srcset","width","height","sizes"]);
    if(typeof image?.sizes!=="string"||!image.sizes.trim())ctx.addIssue({code:z.ZodIssueCode.custom,message:"decorative image sizes is required",path:["decorativeImage","image","sizes"]});
    if(image?.sources?.[0]?.sizes!==undefined&&(typeof image.sources[0].sizes!=="string"||!image.sources[0].sizes.trim()))ctx.addIssue({code:z.ZodIssueCode.custom,message:"source sizes must be nonempty text",path:["decorativeImage","image","sources",0,"sizes"]});
    Object.keys(data.decorativeImage||{}).filter((key)=>!allowedWrapper.has(key)).forEach((key)=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown decorative wrapper key",path:["decorativeImage",key]}));
    Object.keys(image||{}).filter((key)=>!allowedImage.has(key)).forEach((key)=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown decorative image key",path:["decorativeImage","image",key]}));
    Object.keys(image?.sources?.[0]||{}).filter((key)=>!allowedSource.has(key)).forEach((key)=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown decorative source key",path:["decorativeImage","image","sources",0,key]}));
    for (const key of ["html", "bodyHtml", "contentHtml", "className"]) if (key in data || key in (image || {})) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "raw HTML/classes are not allowed", path: [key] });
});

// CTA section schema
export const CtaSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "cta") {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_literal, expected: "cta", received: data.type, message: "Section type must be 'cta'", path: ["type"] });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`, path: [key] });
        }
    }
    validatePathDropdown(data.pathDropdown, ctx);
    if (data.image !== undefined) validateResponsiveImage(data.image, ctx, ["image"]);
    if (data.inlineLinkParagraphs !== undefined) {
        if (data.paragraphs !== undefined || data.body !== undefined) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "CTA typed paragraphs cannot be mixed with string paragraphs", path: ["paragraphs"] });
        for (const key of ["bodyHtml", "html", "contentHtml", "paragraphsHtml"]) if (key in data) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "CTA typed paragraphs cannot be mixed with raw HTML", path: [key] });
        if (!Array.isArray(data.inlineLinkParagraphs) || data.inlineLinkParagraphs.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CTA inlineLinkParagraphs must be non-empty", path: ["inlineLinkParagraphs"] });
        else data.inlineLinkParagraphs.forEach((item, index) => validateTypedSegmentItem(item, ctx, ["inlineLinkParagraphs", index], { allowMailto: true }));
    }
});

// StatementList section schema
export const StatementListSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "statementList") {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_literal, expected: "statementList", received: data.type, message: "Section type must be 'statementList'", path: ["type"] });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`, path: [key] });
        }
    }
    validatePathDropdown(data.pathDropdown, ctx);
});

// Accordion section schema - permissive during transition phase
// Valid desktopSplit values: "equal" | "text-5-media-7" | "text-7-media-5"
// Here "media" refers to the accordion column.
const ACCORDION_DESKTOP_SPLITS = ["equal", "text-5-media-7", "text-7-media-5"];

export const AccordionSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "accordion") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_literal,
            expected: "accordion",
            received: data.type,
            message: "Section type must be 'accordion'",
            path: ["type"],
        });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml", "paragraphsHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`,
                path: [key],
            });
        }
    }
    if (data.layout?.desktopSplit !== undefined && !ACCORDION_DESKTOP_SPLITS.includes(data.layout.desktopSplit)) {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_enum_value,
            options: ACCORDION_DESKTOP_SPLITS,
            received: data.layout.desktopSplit,
            message: `layout.desktopSplit must be one of: ${ACCORDION_DESKTOP_SPLITS.join(", ")}`,
            path: ["layout", "desktopSplit"],
        });
    }
    (data.items || []).forEach((item, index) => {
        if (item?.inlineLinkParagraphs === undefined) return;
        if (!Array.isArray(item.inlineLinkParagraphs) || item.inlineLinkParagraphs.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "item inlineLinkParagraphs must be a non-empty array", path: ["items", index, "inlineLinkParagraphs"] });
        else item.inlineLinkParagraphs.forEach((paragraph, paragraphIndex) => { const result = InlineLinkParagraphSchema.safeParse(paragraph); if (!result.success) result.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["items", index, "inlineLinkParagraphs", paragraphIndex, ...issue.path] })); });
        for (const key of ["html", "bodyHtml", "contentHtml", "paragraphsHtml"]) if (key in item) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "Inline link paragraphs do not permit raw HTML", path: ["items", index, key] });
    });
});

// Embed section schema - permissive during transition phase
export const EmbedSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "embed") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_literal,
            expected: "embed",
            received: data.type,
            message: "Section type must be 'embed'",
            path: ["type"],
        });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml", "paragraphsHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`,
                path: [key],
            });
        }
    }
    validatePathDropdown(data.pathDropdown, ctx);
    const typedEmbedVariant = ["default", "pathDropdown", "componentLibraryTyped"].includes(data.variant || "default");
    if (typedEmbedVariant) {
        if (data.variant === "componentLibraryTyped") {
            validateTypedInlineLinks(data, ctx, { allowScopedDestinations: true });
            if (data.embedHtml !== undefined || data.addressHtml !== undefined) {
                ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "Component Library typed embed cannot be mixed with raw embed or address HTML", path: ["embedHtml"] });
            }
            if (data.embed === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Component Library typed embed is required", path: ["embed"] });
        }
        if (data.embed !== undefined) {
            for (const key of ["embedHtml", "embedRawHtml", "rawEmbedHtml"]) {
                if (key in data) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "Typed embed cannot be mixed with raw embed HTML", path: [key] });
            }
            validateTypedMedia(data.embed, ctx, ["embed"]);
        }
    } else if (data.embed !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "typed embed is only supported by the Component Library typed variant", path: ["embed"] });
    }
});

export const QuoteGridSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "quoteGrid") ctx.addIssue({ code: z.ZodIssueCode.invalid_literal, expected: "quoteGrid", received: data.type, message: "Section type must be 'quoteGrid'", path: ["type"] });
    if (data.embedHtml !== undefined || data.embedRawHtml !== undefined) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "quoteGrid raw embed HTML is not allowed", path: ["embedHtml"] });
    if (data.embed === undefined) return;
    if (!data.embed || typeof data.embed !== "object" || Array.isArray(data.embed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quoteGrid.embed must be an object", path: ["embed"] });
        return;
    }
    const source = data.embed.src;
    let url;
    if (typeof source === "string" && source && !/[\s\u0000-\u001F\u007F]/.test(source)) {
        try { url = new URL(source); } catch { url = null; }
    }
    if (!url || !["http:", "https:"].includes(url.protocol)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quoteGrid.embed.src must be an absolute HTTP(S) URL", path: ["embed", "src"] });
    if (typeof data.embed.title !== "string" || !data.embed.title.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quoteGrid.embed.title is required", path: ["embed", "title"] });
    if (data.embed.html !== undefined || data.embed.embedHtml !== undefined) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "quoteGrid raw embed HTML is not allowed", path: ["embed"] });
});

export function getLegacyQuoteAdmission(data, filePath) {
    const specs={"content/pages/about-us/culture.yaml":{id:"ceo",templateId:"ceo",signature:"723e41d28080f7771610b6aa888a87fba4f37e71",variant:"default"},"content/pages/about-us/careers.yaml":{id:"ceo-quote",templateId:"ceo-quote",signature:"0c25faa0121d9a67cf8729641ae836165685b572",variant:"compact"}};
    const spec=specs[filePath]; if(!spec)return null;
    const culture=spec.id==="ceo";
    return data?.id===spec.id&&data.__template?.id===spec.templateId&&data.__template?.type==="quote"&&data.__template?.signature===spec.signature&&data.__template?.variant===spec.variant&&Array.isArray(data.quoteHtml)&&((culture&&data.quoteLayout==="side-by-side"&&data.centerIntro===true&&data.introTextClassName==="mb-3 pb-3 text-center")||(!culture&&data.compact===true)) ? {kind:culture?"culture":"careers",spec} : null;
}

export const QuoteSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "quote") ctx.addIssue({ code:z.ZodIssueCode.invalid_literal, expected:"quote", received:data.type, message:"Section type must be 'quote'", path:["type"] });
    if (![undefined,"default","side-by-side","compact"].includes(data.variant)) ctx.addIssue({ code:z.ZodIssueCode.custom,message:"unsupported quote variant",path:["variant"] });
    const admission=getLegacyQuoteAdmission(data,data.__quoteFilePath); const legacy=Boolean(admission);
    if (legacy) {
        const culture=data.id==="ceo";
        const allowed=new Set(culture?["id","type","heading","backgroundColor","quoteLayout","centerIntro","introTextClassName","paragraphs","embed","quoteHtml","cite","__template","__quoteFilePath"]:["id","type","compact","backgroundColor","heading","quoteHtml","cite","__template","__quoteFilePath"]);
        Object.keys(data).filter(key=>!allowed.has(key)).forEach(key=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown legacy quote key",path:[key]}));
        if(!data.cite||typeof data.cite!=="object"||typeof data.cite.name!=="string"||!data.cite.name.trim()||typeof data.cite.title!=="string"||!data.cite.title.trim())ctx.addIssue({code:z.ZodIssueCode.custom,message:"legacy citation is malformed",path:["cite"]});
        else { Object.keys(data.cite).filter(k=>!(culture?["name","title","titleHtml","image"]:["name","title","image"]).includes(k)).forEach(k=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown legacy citation key",path:["cite",k]})); if(!data.cite.image)ctx.addIssue({code:z.ZodIssueCode.custom,message:"legacy citation image required",path:["cite","image"]}); else validateResponsiveImage(data.cite.image,ctx,["cite","image"]); if(culture&&(typeof data.cite.titleHtml!=="string"||!data.cite.titleHtml.trim()))ctx.addIssue({code:z.ZodIssueCode.custom,message:"legacy citation titleHtml required",path:["cite","titleHtml"]}); }
        if(!Array.isArray(data.quoteHtml)||data.quoteHtml.length===0||data.quoteHtml.some(x=>typeof x!=="string"||!x.trim()))ctx.addIssue({code:z.ZodIssueCode.custom,message:"legacy quoteHtml must be nonempty text",path:["quoteHtml"]});
        if(data.paragraphs!==undefined&&(!Array.isArray(data.paragraphs)||data.paragraphs.some(x=>typeof x!=="string"||!x.trim())))ctx.addIssue({code:z.ZodIssueCode.custom,message:"legacy intro paragraphs are invalid",path:["paragraphs"]});
        if(culture&&(!data.embed||typeof data.embed!=="object"||Array.isArray(data.embed)||typeof data.embed.html!=="string"||!data.embed.html.trim()))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Culture legacy embed required",path:["embed"]});
        if(data.embed!==undefined){ if(!data.embed||typeof data.embed!=="object")ctx.addIssue({code:z.ZodIssueCode.custom,message:"legacy embed invalid",path:["embed"]}); else Object.keys(data.embed).filter(k=>k!=="html").forEach(k=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown legacy embed key",path:["embed",k]})); }
        Object.keys(data.__template||{}).filter(k=>!["id","type","variant","signature"].includes(k)).forEach(k=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown template key",path:["__template",k]}));
        return;
    }
    if (!Array.isArray(data.quoteParagraphs) || data.quoteParagraphs.length === 0 || data.quoteParagraphs.some((text)=>typeof text!=="string"||!text.trim())) ctx.addIssue({code:z.ZodIssueCode.custom,message:"quoteParagraphs must be nonempty text",path:["quoteParagraphs"]});
    if (!data.cite || typeof data.cite !=="object" || typeof data.cite.name!=="string" || !data.cite.name.trim() || (data.cite.title!==undefined&&(typeof data.cite.title!=="string"||!data.cite.title.trim()))) ctx.addIssue({code:z.ZodIssueCode.custom,message:"typed citation is required",path:["cite"]});
    const allowed=new Set(["id","type","variant","heading","backgroundColor","paragraphs","quoteParagraphs","cite","embed","__template","__quoteFilePath"]);
    for(const key of Object.keys(data)) if(!allowed.has(key))ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown or raw quote key is not allowed",path:[key]});
    Object.keys(data.cite||{}).filter(key=>!["name","title","image"].includes(key)).forEach(key=>ctx.addIssue({code:z.ZodIssueCode.forbidden,message:"unknown citation key",path:["cite",key]}));
    if(data.cite?.image) validateResponsiveImage(data.cite.image,ctx,["cite","image"]);
    if(data.paragraphs!==undefined&&(!Array.isArray(data.paragraphs)||data.paragraphs.some(x=>typeof x!=="string"||!x.trim())))ctx.addIssue({code:z.ZodIssueCode.custom,message:"intro paragraphs are invalid",path:["paragraphs"]});
    if(data.embed!==undefined){ if(!data.embed||typeof data.embed!=="object"||Array.isArray(data.embed)||Object.keys(data.embed).some(k=>!["src","title"].includes(k))||typeof data.embed.title!=="string"||!data.embed.title.trim())ctx.addIssue({code:z.ZodIssueCode.custom,message:"typed embed is invalid",path:["embed"]}); else { try {if(typeof data.embed.src!=="string"||/[\s\u0000-\u001f\u007f]/.test(data.embed.src))throw 0;const u=new URL(data.embed.src);if(!/^https?:$/.test(u.protocol)||!u.hostname)throw 0;}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:"typed embed URL must be HTTP(S)",path:["embed","src"]});} } }
});

export const AnchorSectionSchema = z.object({ id:z.string().min(1), type:z.literal("anchor") }).strict();

// Accreditation section schema
export const AccreditationSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.type !== "accreditation") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_literal,
            expected: "accreditation",
            received: data.type,
            message: "Section type must be 'accreditation'",
            path: ["type"],
        });
    }
    const htmlKeys = ["bodyHtml", "html", "contentHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`,
                path: [key],
            });
        }
    }
});

// Hero section schema - strict allowlist; raw class and HTML keys are checked
// with baseline carve-out in validateHeroSection via findRawMarkupKeys.
export const HeroSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (!data.id || typeof data.id !== "string") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_type,
            expected: "string",
            received: typeof data.id,
            message: "Hero section id is required",
            path: ["id"],
        });
    }

    if (data.type !== "hero") {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_literal,
            expected: "hero",
            received: data.type,
            message: "Section type must be 'hero'",
            path: ["type"],
        });
    }

    // Unknown keys: any key not in the allowed set that is not a raw class/HTML key
    // (raw class/HTML key errors are handled by findRawMarkupKeys in validateHeroSection)
    for (const key of Object.keys(data)) {
        if (!ALLOWED_HERO_KEYS.has(key) && !RAW_CLASS_PATTERN.test(key) && !FORBIDDEN_HTML_KEYS.includes(key)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Unknown hero key '${key}'`,
                path: [key],
            });
        }
    }

    // Typed checks for known keys
    if (data.variant !== undefined && !ALLOWED_HERO_VARIANTS.includes(data.variant) && data.variant !== "splitForm") {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: [...ALLOWED_HERO_VARIANTS, "splitForm"], received: data.variant, message: `variant must be one of: ${[...ALLOWED_HERO_VARIANTS, "splitForm"].join(", ")}`, path: ["variant"] });
    }

    if (data.headingTag !== undefined && !ALLOWED_HEADING_TAGS.includes(data.headingTag)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HEADING_TAGS, received: data.headingTag, message: `headingTag must be one of: ${ALLOWED_HEADING_TAGS.join(", ")}`, path: ["headingTag"] });
    }

    if (data.imagePlacement !== undefined && !ALLOWED_HERO_IMAGE_PLACEMENTS.includes(data.imagePlacement)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_IMAGE_PLACEMENTS, received: data.imagePlacement, message: `imagePlacement must be one of: ${ALLOWED_HERO_IMAGE_PLACEMENTS.join(", ")}`, path: ["imagePlacement"] });
    }

    if (data.imageStyle !== undefined && !ALLOWED_HERO_DEFAULT_IMAGE_STYLES.includes(data.imageStyle)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_DEFAULT_IMAGE_STYLES, received: data.imageStyle, message: `imageStyle must be one of: ${ALLOWED_HERO_DEFAULT_IMAGE_STYLES.join(", ")} (top-level; use layout.imageStyle for split/semantic heroes)`, path: ["imageStyle"] });
    }

    if (data.backgroundColor !== undefined && data.backgroundColor !== "" && !ALLOWED_HERO_BACKGROUND_COLORS.includes(data.backgroundColor)) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_BACKGROUND_COLORS, received: data.backgroundColor, message: `backgroundColor must be one of: ${ALLOWED_HERO_BACKGROUND_COLORS.join(", ")}`, path: ["backgroundColor"] });
    }

    if (data.image !== undefined && typeof data.image === "object" && data.image !== null && !Array.isArray(data.image)) {
        if (!data.image.alt && data.image.decorative !== true) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image.alt is required unless image.decorative is true", path: ["image", "alt"] });
        }
    }
    if (data.inlineLinkParagraphs !== undefined) {
        for (const key of ["html", "bodyHtml", "contentHtml", "paragraphsHtml"]) if (key in data) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "Inline link paragraphs do not permit raw HTML", path: [key] });
        if (!Array.isArray(data.inlineLinkParagraphs) || data.inlineLinkParagraphs.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "inlineLinkParagraphs must be a non-empty array", path: ["inlineLinkParagraphs"] });
        else data.inlineLinkParagraphs.forEach((paragraph, index) => {
            const result = InlineLinkParagraphSchema.safeParse(paragraph);
            if (!result.success) result.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["inlineLinkParagraphs", index, ...issue.path] }));
        });
    }

    // Layout enum checks
    if (data.layout !== undefined && typeof data.layout === "object" && data.layout !== null) {
        const lay = data.layout;
        if (lay.labelPosition !== undefined && lay.labelPosition !== "above") {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ["above"], received: lay.labelPosition, message: "layout.labelPosition must be \"above\"", path: ["layout", "labelPosition"] });
        }
        if (lay.desktopSplit !== undefined && !ALLOWED_HERO_DESKTOP_SPLITS.includes(lay.desktopSplit)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_DESKTOP_SPLITS, received: lay.desktopSplit, message: `layout.desktopSplit must be one of: ${ALLOWED_HERO_DESKTOP_SPLITS.join(", ")}`, path: ["layout", "desktopSplit"] });
        }
        if (lay.rowVerticalAlign !== undefined && !ALLOWED_HERO_ROW_VERTICAL_ALIGNS.includes(lay.rowVerticalAlign)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_ROW_VERTICAL_ALIGNS, received: lay.rowVerticalAlign, message: `layout.rowVerticalAlign must be one of: ${ALLOWED_HERO_ROW_VERTICAL_ALIGNS.join(", ")}`, path: ["layout", "rowVerticalAlign"] });
        }
        if (lay.rowJustify !== undefined && !ALLOWED_HERO_ROW_JUSTIFIES.includes(lay.rowJustify)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_ROW_JUSTIFIES, received: lay.rowJustify, message: `layout.rowJustify must be one of: ${ALLOWED_HERO_ROW_JUSTIFIES.join(", ")}`, path: ["layout", "rowJustify"] });
        }
        if (lay.mobileMediaOrder !== undefined && !ALLOWED_HERO_MOBILE_MEDIA_ORDERS.includes(lay.mobileMediaOrder)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_MOBILE_MEDIA_ORDERS, received: lay.mobileMediaOrder, message: `layout.mobileMediaOrder must be one of: ${ALLOWED_HERO_MOBILE_MEDIA_ORDERS.join(", ")}`, path: ["layout", "mobileMediaOrder"] });
        }
        if (lay.desktopMediaPosition !== undefined && !ALLOWED_HERO_DESKTOP_MEDIA_POSITIONS.includes(lay.desktopMediaPosition)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_DESKTOP_MEDIA_POSITIONS, received: lay.desktopMediaPosition, message: `layout.desktopMediaPosition must be one of: ${ALLOWED_HERO_DESKTOP_MEDIA_POSITIONS.join(", ")}`, path: ["layout", "desktopMediaPosition"] });
        }
        if (lay.imageStyle !== undefined && !ALLOWED_HERO_IMAGE_STYLES.includes(lay.imageStyle)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_IMAGE_STYLES, received: lay.imageStyle, message: `layout.imageStyle must be one of: ${ALLOWED_HERO_IMAGE_STYLES.join(", ")}`, path: ["layout", "imageStyle"] });
        }
        if (lay.imageFrame !== undefined && !ALLOWED_HERO_IMAGE_FRAMES.includes(lay.imageFrame)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_IMAGE_FRAMES, received: lay.imageFrame, message: `layout.imageFrame must be one of: ${ALLOWED_HERO_IMAGE_FRAMES.join(", ")}`, path: ["layout", "imageFrame"] });
        }
        if (lay.boxStyle !== undefined && !ALLOWED_HERO_BOX_STYLES.includes(lay.boxStyle)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_BOX_STYLES, received: lay.boxStyle, message: `layout.boxStyle must be one of: ${ALLOWED_HERO_BOX_STYLES.join(", ")}`, path: ["layout", "boxStyle"] });
        }
        if (lay.sectionPadding !== undefined && !ALLOWED_HERO_SECTION_PADDINGS.includes(lay.sectionPadding)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_SECTION_PADDINGS, received: lay.sectionPadding, message: `layout.sectionPadding must be one of: ${ALLOWED_HERO_SECTION_PADDINGS.join(", ")}`, path: ["layout", "sectionPadding"] });
        }
        if (lay.desktopGapTarget !== undefined && !ALLOWED_HERO_GAP_TARGETS.includes(lay.desktopGapTarget)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_GAP_TARGETS, received: lay.desktopGapTarget, message: `layout.desktopGapTarget must be one of: ${ALLOWED_HERO_GAP_TARGETS.join(", ")}`, path: ["layout", "desktopGapTarget"] });
        }
        if (lay.desktopGapBreakpoint !== undefined && !ALLOWED_HERO_SPACING_BREAKPOINTS.includes(lay.desktopGapBreakpoint)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ALLOWED_HERO_SPACING_BREAKPOINTS, received: lay.desktopGapBreakpoint, message: `layout.desktopGapBreakpoint must be one of: ${ALLOWED_HERO_SPACING_BREAKPOINTS.join(", ")}`, path: ["layout", "desktopGapBreakpoint"] });
        }
        for (const layKey of Object.keys(lay)) {
            if (RAW_CLASS_PATTERN.test(layKey)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layout key '${layKey}' is a raw class string; use layout.sectionPadding for section padding, or a semantic option`, path: ["layout", layKey] });
            }
        }
    }

    // Spacing checks
    if (data.spacing !== undefined && typeof data.spacing === "object" && data.spacing !== null) {
        const sp = data.spacing;
        const validPaddingTop = ["none", "none-mobile", "none-lg", "sm"];
        const validPaddingBottom = ["none", "sm", "lg"];
        const validMarginTop = ["none"];
        if (sp.paddingTop !== undefined && !validPaddingTop.includes(sp.paddingTop)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: validPaddingTop, received: sp.paddingTop, message: `spacing.paddingTop must be one of: ${validPaddingTop.join(", ")}`, path: ["spacing", "paddingTop"] });
        }
        if (sp.paddingBottom !== undefined && !validPaddingBottom.includes(sp.paddingBottom)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: validPaddingBottom, received: sp.paddingBottom, message: `spacing.paddingBottom must be one of: ${validPaddingBottom.join(", ")}`, path: ["spacing", "paddingBottom"] });
        }
        if (sp.marginTop !== undefined && !validMarginTop.includes(sp.marginTop)) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: validMarginTop, received: sp.marginTop, message: `spacing.marginTop must be one of: ${validMarginTop.join(", ")}`, path: ["spacing", "marginTop"] });
        }
    }

    validatePathDropdown(data.pathDropdown, ctx);
});

// Base section schema - strict validation
const BaseSectionSchema = z.object({
    id: z.string().min(1, "Section id is required"),
    type: z.enum(ALLOWED_SECTION_TYPES, {
        errorMap: () => ({
            message: `Section type must be one of: ${ALLOWED_SECTION_TYPES.join(", ")}`,
        }),
    }),
    variant: z.string().optional(),
    // Typed lead-form inventory fields are further constrained by LeadFormSectionSchema.
    heading: z.any().optional(),
    paragraphs: z.any().optional(),
    list: z.any().optional(),
    image: z.any().optional(),
    form: z.any().optional(),
    inlineLinkParagraphs: z.any().optional(),
}).strict().superRefine((data, ctx) => {
    // Reject any HTML-related keys
    const htmlKeys = ["bodyHtml", "html", "contentHtml", "paragraphsHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed. Use structured properties instead.`,
                path: [key],
            });
        }
    }
});

// Column definition for roster tables
const RosterColumnSchema = z.object({
    key: z.string().min(1, "Column key is required"),
    label: z.string().min(1, "Column label is required"),
    type: z.enum(["boolean"]).optional(),
}).strict();

// Row schema for roster tables — validated dynamically against columns
const RosterRowSchema = z.record(z.union([z.string(), z.boolean(), z.number()]));

// Row schema for stats tables
const StatsRowSchema = z.object({
    label: z.string().min(1, "Stats row label is required"),
    value: z.string().min(1, "Stats row value is required"),
    emphasis: z.enum(["total"]).optional(),
}).strict();

// Courses slider variant for mediaSlider sections
const CoursesSlideImageSchema = z.object({
    src: z.string().min(1, "Slide image src is required"),
    alt: z.string().optional(),
    decorative: z.boolean().optional(),
    width: z.union([z.string(), z.number()]).optional(),
    height: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const CoursesSlideSchema = z.object({
    title: z.string().min(1, "Slide title is required"),
    href: z.string().optional(),
    linkTitle: z.string().optional(),
    image: CoursesSlideImageSchema.optional(),
}).strict();

export const MediaSliderSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.variant === "courses") {
        if (!Array.isArray(data.slides) || data.slides.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "courses variant requires at least one slide", path: ["slides"] });
            return;
        }
        data.slides.forEach((slide, i) => {
            const result = CoursesSlideSchema.safeParse(slide);
            if (!result.success) {
                for (const issue of result.error.issues) {
                    ctx.addIssue({ ...issue, path: ["slides", i, ...issue.path] });
                }
            }
        });
    }
});

const ProgressMeasureSchema = z.object({
    label: z.string().min(1),
    percent: z.number().int().min(0).max(100).optional(),
    unavailable: z.string().min(1).optional(),
    supportingText: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
    if ((value.percent === undefined) === (value.unavailable === undefined)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A progress measure requires exactly one of percent or unavailable" });
    }
});

export const ProgressListSectionSchema = z.object({
    id: z.string().min(1),
    type: z.literal("progressList"),
    heading: z.string().min(1),
    paragraphs: z.array(z.string().min(1)).optional(),
    groups: z.array(z.object({
        heading: z.string().min(1),
        paragraphs: z.array(z.string().min(1)).optional(),
        measures: z.array(ProgressMeasureSchema).min(1),
    }).strict()).min(1),
}).passthrough();

const KENTICO_SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
const KENTICO_POST_NAME = /^[A-Za-z][A-Za-z0-9_-]*\.[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/;
const KenticoAjaxFieldSchema = z.object({
    key: z.string().regex(KENTICO_SAFE_ID),
    id: z.string().regex(KENTICO_SAFE_ID),
    name: z.string().regex(KENTICO_POST_NAME),
    type: z.enum(["text", "tel", "email", "select"]),
    label: z.string().trim().min(1),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    options: z.array(z.object({ value: z.string().trim().min(1), label: z.string().trim().min(1) }).strict()).optional(),
    phoneMask: z.object({ wrapperId: z.string().regex(KENTICO_SAFE_ID), pattern: z.literal("(999) 999-9999") }).strict().optional(),
}).strict().superRefine((field, ctx) => {
    if (field.type === "select" && (!field.options || field.options.length === 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "select fields require options", path: ["options"] });
    if (field.type !== "select" && field.options !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "only select fields may define options", path: ["options"] });
});

export const LeadFormSectionSchema = z.object({
    id: z.string().regex(KENTICO_SAFE_ID),
    type: z.literal("leadForm"),
    variant: z.literal("kenticoAjaxSplit"),
    heading: z.string().trim().min(1),
    paragraphs: z.array(z.string().trim().min(1)).min(1),
    list: z.array(z.string().trim().min(1)).min(1),
    image: z.record(z.any()).superRefine((image, ctx) => validateResponsiveImage(image, ctx, [])),
    form: z.object({
        wrapperId: z.string().regex(KENTICO_SAFE_ID),
        id: z.string().regex(KENTICO_SAFE_ID),
        prefix: z.string().regex(KENTICO_SAFE_ID),
        action: z.string().trim().min(1),
        method: z.literal("POST"),
        ajaxUpdate: z.string().min(2),
        submitHandler: z.literal("window.kentico.updatableFormHelper.submitForm(event)"),
        registration: z.object({ formId: z.string().regex(KENTICO_SAFE_ID), targetAttributeName: z.literal("data-ktc-ajax-update"), unobservedAttributeName: z.literal("data-ktc-notobserved-element") }).strict(),
        fields: z.array(KenticoAjaxFieldSchema).length(6),
        runtimeToken: z.object({ name: z.literal("__RequestVerificationToken") }).strict(),
        submitLabel: z.string().trim().min(1),
        privacy: z.object({ text: z.string().trim().min(1), href: z.string().regex(/^\/about-us\/governance\/policies\/privacy(?:[/?#]|$)/), label: z.string().trim().min(1) }).strict(),
        success: z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) }).strict(),
    }).strict(),
}).strict().superRefine((section, ctx) => {
    const form = section.form;
    if (form.ajaxUpdate !== `#${form.wrapperId}`) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ajaxUpdate must target the declared wrapper", path: ["form", "ajaxUpdate"] });
    if (form.registration.formId !== form.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "registration.formId must match form.id", path: ["form", "registration", "formId"] });
    if (form.prefix !== form.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "prefix must match form.id", path: ["form", "prefix"] });
    let actionUrl;
    try { actionUrl = new URL(form.action, "https://contract.invalid"); } catch { actionUrl = null; }
    const actionEntries = actionUrl ? [...actionUrl.searchParams.entries()] : [];
    const actionKeys = new Set(["formName", "prefix", "displayValidationErrors"]);
    const exactActionQuery = actionEntries.length === 3
        && actionEntries.every(([key]) => actionKeys.has(key))
        && [...actionKeys].every((key) => actionEntries.filter(([entryKey]) => entryKey === key).length === 1);
    if (!actionUrl || !form.action.startsWith("/") || form.action.startsWith("//") || /\s/.test(form.action) || actionUrl.hash || actionUrl.pathname !== "/Kentico.Components/en-US/Kentico.FormWidget/KenticoFormWidget/FormSubmit" || !exactActionQuery || !actionUrl.searchParams.get("formName") || actionUrl.searchParams.get("prefix") !== form.prefix || actionUrl.searchParams.get("displayValidationErrors") !== "False") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kentico action must use the exact FormSubmit route with one formName, matching prefix, and displayValidationErrors=False", path: ["form", "action"] });
    for (const key of ["key", "id", "name"]) {
        const values = form.fields.map((field) => field[key]);
        if (new Set(values).size !== values.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate form field ${key}`, path: ["form", "fields"] });
    }
    const requiredControls = { organization: ["text", "organization.Value"], first_name: ["text", "first_name.Value"], last_name: ["text", "last_name.Value"], phone_number: ["tel", "phone_number.PhoneNumber"], email: ["email", "email.Email"], benefits_drop_down: ["select", "benefits_drop_down.SelectedValue"] };
    for (const [key, [type, suffix]] of Object.entries(requiredControls)) {
        const field = form.fields.find((candidate) => candidate.key === key);
        if (!field || field.type !== type || field.name !== `${form.prefix}.${suffix}`) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Kentico control '${key}' must use its required type and submitted-name suffix`, path: ["form", "fields"] });
    }
    const phone = form.fields.find((field) => field.key === "phone_number");
    if (!phone?.phoneMask) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "phone_number requires a typed phone mask", path: ["form", "fields"] });
    if (form.fields.some((field) => field.key !== "phone_number" && field.phoneMask !== undefined)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "phoneMask is allowed only on phone_number", path: ["form", "fields"] });
    const emittedIds = [section.id, form.wrapperId, form.id, ...form.fields.map((field) => field.id), ...form.fields.flatMap((field) => field.phoneMask ? [field.phoneMask.wrapperId] : [])];
    if (new Set(emittedIds).size !== emittedIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "all emitted section, form, field, and phone-mask IDs must be unique", path: ["form"] });
});

// Table block for text sections
const TextSectionTableSchema = z.discriminatedUnion("variant", [
    z.object({
        variant: z.literal("roster"),
        caption: z.string().optional(),
        columns: z.array(RosterColumnSchema).min(1, "Roster table requires at least one column"),
        rows: z.array(RosterRowSchema).min(1, "Roster table requires at least one row"),
    }).strict(),
    z.object({
        variant: z.literal("stats"),
        leadText: z.string().optional(),
        boxed: z.boolean().optional(),
        rows: z.array(StatsRowSchema).min(1, "Stats table requires at least one row"),
        footerRows: z.array(StatsRowSchema).optional(),
    }).strict(),
]);

const COLOR_TOKEN_GROUPS = [
    { key: "brand", label: "Brand Colors", tokens: ["primary", "secondary", "tertiary"] },
    { key: "grayscale", label: "Grayscale", tokens: ["white", "gray-50", "gray-100", "gray-200", "gray-500", "gray-700", "gray-900", "black"] },
    { key: "ui", label: "UI Colors", tokens: ["positive", "negative"] },
];
const COLOR_TOKEN_NAMES = new Set(COLOR_TOKEN_GROUPS.flatMap((group) => group.tokens));
const COLOR_TOKEN_SECTION_KEYS = new Set(["id", "type", "variant", "heading", "colorGroups", "__template"]);
const TYPOGRAPHY_SECTION_KEYS = new Set(["id", "type", "variant", "heading", "headlineSamples", "paragraphSamples", "lists", "__template"]);
const BUTTON_SAMPLE_SECTION_KEYS = new Set(["id", "type", "variant", "heading", "examples", "__template"]);
const COMPONENT_SAMPLE_SECTION_KEYS = new Set(["id", "type", "variant", "heading", "groups", "__template"]);

function addUnexpectedKeys(ctx, value, allowed, path = []) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            ctx.addIssue({ code: z.ZodIssueCode.unrecognized_keys, message: `Unknown key '${key}' is not allowed`, path: [...path, key] });
        }
    }
}

function addExactComponentKeys(ctx, value, allowed, path = []) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) ctx.addIssue({ code: z.ZodIssueCode.unrecognized_keys, message: `Unknown key '${key}' is not allowed`, path: [...path, key] });
    }
}

function isTypographyHref(value) {
    if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
    if (value.startsWith("#")) return value.length > 1;
    if (value.startsWith("/")) return !value.startsWith("//");
    try {
        const parsed = new URL(value);
        return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
    } catch {
        return false;
    }
}

function validateGeneratedTemplateMetadata(data, ctx) {
    if (data.__template === undefined) return;
    const metadata = data.__template;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "__template must be an object", path: ["__template"] });
        return;
    }
    addUnexpectedKeys(ctx, metadata, new Set(["id", "type", "variant", "signature"]), ["__template"]);
    if (metadata.id !== data.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "__template.id must match section id", path: ["__template", "id"] });
    if (metadata.type !== data.type) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "__template.type must match section type", path: ["__template", "type"] });
    if (metadata.variant !== data.variant) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "__template.variant must match section variant", path: ["__template", "variant"] });
    if (typeof metadata.signature !== "string" || !metadata.signature.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "__template.signature must be a nonempty string", path: ["__template", "signature"] });
}

function validateButtonSamples(data, ctx) {
    addUnexpectedKeys(ctx, data, BUTTON_SAMPLE_SECTION_KEYS); validateGeneratedTemplateMetadata(data, ctx);
    if (!Array.isArray(data.examples) || data.examples.length !== 26) { ctx.addIssue({ code:z.ZodIssueCode.custom,message:"buttonSamples requires exactly 26 examples",path:["examples"] }); return; }
    const expected=["primary","gray","white"].flatMap(t=>[["solid",false,false],["solid",true,false],["outline",false,false],["outline",true,false],["solid",false,true],["solid",true,true],["outline",false,true],["outline",true,true]].map(x=>[t,...x])).concat([["text","solid",false,false],["text","solid",true,false]]); data.examples.forEach((example,index) => { const path=["examples",index],want=expected[index]; if (!example || typeof example !== "object" || Array.isArray(example)) { ctx.addIssue({code:z.ZodIssueCode.custom,message:"button example must be an object",path}); return; } addUnexpectedKeys(ctx,example,new Set(["tone","treatment","arrow","disabled","label","href"]),path); if(!want||example.tone!==want[0]||example.treatment!==want[1]||example.arrow!==want[2]||example.disabled!==want[3]||typeof example.label!=="string"||!example.label.trim())ctx.addIssue({code:z.ZodIssueCode.custom,message:"button inventory must use exact legacy order",path}); if(example.disabled ? example.href!==undefined : !isTypographyHref(example.href))ctx.addIssue({code:z.ZodIssueCode.custom,message:example.disabled?"disabled buttons cannot have destinations":"enabled buttons require a safe destination",path:[...path,"href"]}); });
}

function validateExactComponentInventory(data, ctx) {
    addExactComponentKeys(ctx, data, COMPONENT_SAMPLE_SECTION_KEYS);
    validateGeneratedTemplateMetadata(data, ctx);
    const groups = [
        ["text", "Text Cards", "text-cards", ["linked", "quote", "detail"]],
        ["image", "Image Cards", "image-cards", ["unlinked-bottom", "linked-bottom", "linked-top"]],
        ["icon", "Icon Cards", "icon-cards", ["unlinked-bottom", "linked-bottom", "linked-top"]],
        ["logo", "Logo Cards", "logo-cards", ["linked-bottom", "linked-top"]],
        ["checkmark", "Checkmark Cards", "checkmark-cards", ["unlinked-bottom", "unlinked-top"]],
    ];
    const cardKeys = new Set(["pattern", "background", "cardKind", "mediaKind", "mediaPlacement", "heading", "summary", "href", "citation", "detail", "action", "image"]);
    if (!Array.isArray(data.groups) || data.groups.length !== groups.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "componentSamples requires five ordered groups", path: ["groups"] });
        return;
    }
    data.groups.forEach((group, groupIndex) => {
        const [kind, heading, anchor, patterns] = groups[groupIndex];
        const path = ["groups", groupIndex];
        if (!group || typeof group !== "object" || Array.isArray(group)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "component group must be an object", path });
            return;
        }
        addExactComponentKeys(ctx, group, new Set(["kind", "heading", "anchor", "cards"]), path);
        if (group.kind !== kind || group.heading !== heading || group.anchor !== anchor || !Array.isArray(group.cards) || group.cards.length !== patterns.length * 3) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "group kind, heading, anchor, or inventory is invalid", path });
            return;
        }
        group.cards.forEach((card, cardIndex) => {
            const pattern = patterns[Math.floor(cardIndex / 3)];
            const background = ["white", "light", "none"][cardIndex % 3];
            const cardPath = [...path, "cards", cardIndex];
            const linked = pattern.startsWith("linked") || pattern === "detail";
            const isQuote = pattern === "quote";
            const expectsImage = kind === "image" || kind === "icon" || kind === "logo";
            if (!card || typeof card !== "object" || Array.isArray(card)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "component card must be an object", path: cardPath });
                return;
            }
            addExactComponentKeys(ctx, card, cardKeys, cardPath);
            if (card.pattern !== pattern || card.background !== background || card.cardKind !== (isQuote ? "quote" : "standard") || card.mediaKind !== (kind === "text" ? "none" : kind) || card.mediaPlacement !== (pattern.endsWith("top") ? "top" : "bottom")) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "card pattern, background, media, or order is invalid", path: cardPath });
            }
            const summaryRequired = kind === "text" || kind === "image" || kind === "checkmark" || (kind === "icon" && pattern === "unlinked-bottom") || (kind === "logo" && pattern === "linked-bottom") || pattern === "quote";
            if (summaryRequired && (typeof card.summary !== "string" || !card.summary.trim())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "card summary must be nonempty text", path: [...cardPath, "summary"] });
            if (!summaryRequired && card.summary !== undefined) ctx.addIssue({ code: z.ZodIssueCode.forbidden, message: "this legacy card pattern omits summary copy", path: [...cardPath, "summary"] });
            if (isQuote) {
                if (card.heading !== undefined || card.href !== undefined || card.detail !== undefined || card.action !== undefined || card.image !== undefined || !card.citation || typeof card.citation !== "object" || Array.isArray(card.citation)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quote cards permit only quote fields", path: cardPath });
                } else {
                    addExactComponentKeys(ctx, card.citation, new Set(["name", "title"]), [...cardPath, "citation"]);
                    if (typeof card.citation.name !== "string" || !card.citation.name.trim() || typeof card.citation.title !== "string" || !card.citation.title.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quote cards require citation name and title", path: [...cardPath, "citation"] });
                }
                return;
            }
            if (typeof card.heading !== "string" || !card.heading.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "card heading must be nonempty text", path: [...cardPath, "heading"] });
            if (linked !== (card.href !== undefined) || (linked && !isTypographyHref(card.href))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: linked ? "linked cards require a safe href" : "unlinked cards cannot declare href", path: [...cardPath, "href"] });
            const expectsAction = pattern === "linked" || pattern === "detail";
            if (expectsAction !== (card.action !== undefined)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: expectsAction ? "linked cards require an action" : "this card pattern cannot declare an action", path: [...cardPath, "action"] });
            if (card.action !== undefined && card.action && typeof card.action === "object" && !Array.isArray(card.action)) addExactComponentKeys(ctx, card.action, new Set(["label", "href"]), [...cardPath, "action"]);
            if (card.action !== undefined && (!card.action || typeof card.action !== "object" || Array.isArray(card.action) || typeof card.action.label !== "string" || !card.action.label.trim() || !isTypographyHref(card.action.href) || card.action.href !== card.href)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "card action must be complete and match card href", path: [...cardPath, "action"] });
            const expectsDetail = pattern === "detail";
            if (expectsDetail !== (card.detail !== undefined)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: expectsDetail ? "detail cards require detail content" : "this card pattern cannot declare detail content", path: [...cardPath, "detail"] });
            if (card.detail !== undefined && card.detail && typeof card.detail === "object" && !Array.isArray(card.detail)) addExactComponentKeys(ctx, card.detail, new Set(["heading", "items"]), [...cardPath, "detail"]);
            if (card.detail !== undefined && (!card.detail || typeof card.detail !== "object" || Array.isArray(card.detail) || typeof card.detail.heading !== "string" || !card.detail.heading.trim() || !Array.isArray(card.detail.items) || card.detail.items.length === 0 || card.detail.items.some((item) => typeof item !== "string" || !item.trim()))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "detail requires a heading and nonempty text items", path: [...cardPath, "detail"] });
            if (card.citation !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "only quote cards can declare a citation", path: [...cardPath, "citation"] });
            if (expectsImage) {
                if (!card.image || typeof card.image !== "object" || Array.isArray(card.image)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "image, icon, and logo cards require structured responsive image data", path: [...cardPath, "image"] });
                else validateResponsiveImage(card.image, ctx, [...cardPath, "image"]);
            } else if (card.image !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "this card kind cannot declare an image", path: [...cardPath, "image"] });
            if (kind === "icon" && card.image && (card.image.width !== "100" || card.image.height !== "100")) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "icon cards require exact 100x100 image dimensions", path: [...cardPath, "image"] });
        });
    });
}

function validateColorTokens(data, ctx) {
    addUnexpectedKeys(ctx, data, COLOR_TOKEN_SECTION_KEYS);
    validateGeneratedTemplateMetadata(data, ctx);
    if (typeof data.heading !== "string" || !data.heading.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "colorTokens requires a nonempty heading", path: ["heading"] });
    if (!Array.isArray(data.colorGroups) || data.colorGroups.length !== COLOR_TOKEN_GROUPS.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "colorTokens requires the three ordered color groups", path: ["colorGroups"] });
        return;
    }
    data.colorGroups.forEach((group, groupIndex) => {
        const expected = COLOR_TOKEN_GROUPS[groupIndex];
        if (!group || typeof group !== "object" || Array.isArray(group)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Color group must be an object", path: ["colorGroups", groupIndex] });
            return;
        }
        addUnexpectedKeys(ctx, group, new Set(["key", "label", "tokens"]), ["colorGroups", groupIndex]);
        if (group.key !== expected.key || group.label !== expected.label) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Color groups must use the supported legacy order and labels", path: ["colorGroups", groupIndex] });
        if (!Array.isArray(group.tokens) || group.tokens.length !== expected.tokens.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Color group tokens must be a nonempty ordered array", path: ["colorGroups", groupIndex, "tokens"] });
            return;
        }
        group.tokens.forEach((token, tokenIndex) => {
            if (!token || typeof token !== "object" || Array.isArray(token)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Color token must be an object", path: ["colorGroups", groupIndex, "tokens", tokenIndex] });
                return;
            }
            addUnexpectedKeys(ctx, token, new Set(["token", "label"]), ["colorGroups", groupIndex, "tokens", tokenIndex]);
            if (!COLOR_TOKEN_NAMES.has(token.token) || token.token !== expected.tokens[tokenIndex]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Color token is not in the supported ordered allowlist", path: ["colorGroups", groupIndex, "tokens", tokenIndex, "token"] });
            if (typeof token.label !== "string" || !token.label.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Color token label must be nonempty", path: ["colorGroups", groupIndex, "tokens", tokenIndex, "label"] });
        });
    });
}

function validateTypographySamples(data, ctx) {
    addUnexpectedKeys(ctx, data, TYPOGRAPHY_SECTION_KEYS);
    validateGeneratedTemplateMetadata(data, ctx);
    if (typeof data.heading !== "string" || !data.heading.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typographySamples requires a nonempty heading", path: ["heading"] });
    if (!Array.isArray(data.headlineSamples) || data.headlineSamples.length !== 6) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typographySamples requires headline roles 1 through 6", path: ["headlineSamples"] });
    } else {
        data.headlineSamples.forEach((sample, index) => {
            if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Headline sample must be an object", path: ["headlineSamples", index] }); return;
            }
            addUnexpectedKeys(ctx, sample, new Set(["role", "text"]), ["headlineSamples", index]);
            if (sample.role !== index + 1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Headline roles must be unique and ordered from 1 through 6", path: ["headlineSamples", index, "role"] });
            if (typeof sample.text !== "string" || !sample.text.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Headline text must be nonempty", path: ["headlineSamples", index, "text"] });
        });
    }
    const roles = ["lead", "body", "disclaimer"];
    if (!Array.isArray(data.paragraphSamples) || data.paragraphSamples.length !== roles.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typographySamples requires lead, body, and disclaimer samples", path: ["paragraphSamples"] });
    } else {
        data.paragraphSamples.forEach((sample, index) => {
            if (!sample || typeof sample !== "object" || Array.isArray(sample)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paragraph sample must be an object", path: ["paragraphSamples", index] }); return; }
            addUnexpectedKeys(ctx, sample, new Set(["role", "segments"]), ["paragraphSamples", index]);
            if (sample.role !== roles[index]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paragraph sample roles must be ordered lead, body, disclaimer", path: ["paragraphSamples", index, "role"] });
            if (!Array.isArray(sample.segments) || !sample.segments.length) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paragraph samples require nonempty typed segments", path: ["paragraphSamples", index, "segments"] }); return; }
            sample.segments.forEach((segment, segmentIndex) => {
                if (!segment || typeof segment !== "object" || Array.isArray(segment)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paragraph segment must be an object", path: ["paragraphSamples", index, "segments", segmentIndex] }); return; }
                if (segment.type === "text") {
                    addUnexpectedKeys(ctx, segment, new Set(["type", "text"]), ["paragraphSamples", index, "segments", segmentIndex]);
                    if (typeof segment.text !== "string" || !segment.text.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text segments must be nonempty trimmed strings", path: ["paragraphSamples", index, "segments", segmentIndex, "text"] });
                } else if (segment.type === "link") {
                    addUnexpectedKeys(ctx, segment, new Set(["type", "label", "href"]), ["paragraphSamples", index, "segments", segmentIndex]);
                    if (typeof segment.label !== "string" || !segment.label.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Link labels must be nonempty", path: ["paragraphSamples", index, "segments", segmentIndex, "label"] });
                    if (!isTypographyHref(segment.href)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Typography link href must be safe HTTP(S), root-relative, or fragment URL", path: ["paragraphSamples", index, "segments", segmentIndex, "href"] });
                } else ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paragraph segments must be text or link", path: ["paragraphSamples", index, "segments", segmentIndex, "type"] });
            });
        });
    }
    const kinds = ["unordered", "ordered"];
    if (!Array.isArray(data.lists) || data.lists.length !== kinds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "typographySamples requires unordered and ordered lists", path: ["lists"] });
    else data.lists.forEach((list, index) => {
        if (!list || typeof list !== "object" || Array.isArray(list)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Typography list must be an object", path: ["lists", index] }); return; }
        addUnexpectedKeys(ctx, list, new Set(["kind", "items"]), ["lists", index]);
        if (list.kind !== kinds[index]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Typography list kinds must be unordered then ordered", path: ["lists", index, "kind"] });
        if (!Array.isArray(list.items) || !list.items.length || list.items.some((item) => typeof item !== "string" || !item.trim())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Typography list items must be nonempty strings", path: ["lists", index, "items"] });
    });
}

export const TextSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    if (data.variant === "colorTokens") validateColorTokens(data, ctx);
    if (data.variant === "typographySamples") validateTypographySamples(data, ctx);
    if (data.table !== undefined) {
        const result = TextSectionTableSchema.safeParse(data.table);
        if (!result.success) {
            for (const issue of result.error.issues) {
                ctx.addIssue({
                    ...issue,
                    path: ["table", ...issue.path],
                });
            }
        }
        // For roster: validate that all row keys exist as column keys
        if (data.table?.variant === "roster" && Array.isArray(data.table.columns) && Array.isArray(data.table.rows)) {
            const validKeys = new Set(data.table.columns.map((c) => c.key));
            data.table.rows.forEach((row, ri) => {
                for (const key of Object.keys(row)) {
                    if (!validKeys.has(key)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Unknown column key '${key}' in roster row ${ri}`,
                            path: ["table", "rows", ri, key],
                        });
                    }
                }
            });
        }
    }
    if (data.layout?.width !== undefined && !ALLOWED_TEXT_SECTION_WIDTHS.includes(data.layout.width)) {
        ctx.addIssue({
            code: z.ZodIssueCode.invalid_enum_value,
            options: ALLOWED_TEXT_SECTION_WIDTHS,
            received: data.layout.width,
            message: `layout.width must be one of: ${ALLOWED_TEXT_SECTION_WIDTHS.join(", ")}`,
            path: ["layout", "width"],
        });
    }
    validateSectionList(data.list, ctx);
    validateDecorativeImage(data.decorativeImage, ctx);
    validatePathDropdown(data.pathDropdown, ctx);
});

// Template schema
export const TemplateSchema = z.object({
    slug: z.string().min(1, "Template slug is required"),
    title: z.string().min(1, "Template title is required"),
    sections: z.array(BaseSectionSchema).min(1, "At least one section is required"),
}).strict().superRefine((data, ctx) => {
    // Reject any HTML-related keys at template level
    const htmlKeys = ["bodyHtml", "html", "contentHtml"];
    for (const key of htmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed at template level.`,
                path: [key],
            });
        }
    }
});

// Page data schema (permissive during transition phase - allows inline HTML for data migration)
// TODO: Enforce strict HTML rejection after data migration is complete
export const PageDataSchema = z.record(z.any());

/**
 * Validate template data
 * @param {any} data - Template data to validate
 * @param {string} filePath - File path for error reporting
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export function validateTemplate(data, filePath) {
    try {
        TemplateSchema.parse(data);
        return { valid: true, errors: [], warnings: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `${err.message}${path}`;
            });
            return { valid: false, errors, warnings: [] };
        }
        return { valid: false, errors: [error.message], warnings: [] };
    }
}

/**
 * Validate page data
 * @param {any} data - Page data to validate
 * @param {string} filePath - Relative file path for baseline lookup and error reporting
 * @returns {object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validatePageData(data, filePath) {
    const normalizedPath = normalizeFilePath(filePath);
    const allWarnings = [];

    try {
        PageDataSchema.parse(data);

        // Validate all sections if present
        if (data.sections && Array.isArray(data.sections)) {
            for (let i = 0; i < data.sections.length; i++) {
                const section = data.sections[i];
                let result;

                switch (section.type) {
                    case "hero":
                        result = validateHeroSection(section, normalizedPath);
                        break;
                    case "textMedia":
                        result = validateSection(section, TextMediaSectionSchema, normalizedPath);
                        break;
                    case "iconCardGrid":
                        result = validateSection(section, IconCardGridSectionSchema, normalizedPath);
                        break;
                    case "cards": {
                        result = validateSection(section, CardsSectionSchema, normalizedPath);
                        // Baseline-aware per-card checks
                        const cardLegacy = findCardRawMarkupKeys(section.cards, normalizedPath, section.id);
                        if (cardLegacy.errors.length > 0) {
                            return { valid: false, errors: cardLegacy.errors, warnings: [...allWarnings, ...cardLegacy.warnings] };
                        }
                        allWarnings.push(...cardLegacy.warnings);
                        // Baseline-aware section-level raw class checks (HTML already checked by Zod)
                        const sectionLegacy = findRawMarkupKeys(section, normalizedPath, section.id);
                        // Filter out HTML keys (already handled by Zod) to avoid double-reporting
                        const filteredErrors = sectionLegacy.errors.filter((e) => !FORBIDDEN_HTML_KEYS.some((k) => e.includes(`'${k}'`)));
                        if (filteredErrors.length > 0) {
                            return { valid: false, errors: filteredErrors, warnings: [...allWarnings, ...sectionLegacy.warnings] };
                        }
                        allWarnings.push(...sectionLegacy.warnings);
                        break;
                    }
                    case "stickyCards":
                        result = validateSection(section, StickyCardsSectionSchema, normalizedPath);
                        break;
                    case "logoGrid":
                        result = validateSection(section, LogoGridSectionSchema, normalizedPath);
                        break;
                    case "accordion":
                        result = validateSection(section, AccordionSectionSchema, normalizedPath);
                        break;
                    case "embed":
                        result = validateSection(section, EmbedSectionSchema, normalizedPath);
                        break;
                    case "accreditation":
                        result = validateSection(section, AccreditationSectionSchema, normalizedPath);
                        break;
                    case "text": {
                        result = validateSection(section, TextSectionSchema, normalizedPath);
                        // Baseline-aware section-level HTML and raw class checks
                        const textLegacy = findRawMarkupKeys(section, normalizedPath, section.id);
                        if (textLegacy.errors.length > 0) {
                            return { valid: false, errors: textLegacy.errors, warnings: [...allWarnings, ...textLegacy.warnings] };
                        }
                        allWarnings.push(...textLegacy.warnings);
                        break;
                    }
                    case "cta":
                        result = validateSection(section, CtaSectionSchema, normalizedPath);
                        break;
                    case "statementList":
                        result = validateSection(section, StatementListSectionSchema, normalizedPath);
                        break;
                    case "mediaSlider":
                        result = validateSection(section, MediaSliderSectionSchema, normalizedPath);
                        break;
                    case "quoteGrid":
                        result = validateSection(section, QuoteGridSectionSchema, normalizedPath);
                        break;
                    case "quote":
                        result = validateSection({ ...section, __quoteFilePath: normalizedPath }, QuoteSectionSchema, normalizedPath);
                        { const admission=getLegacyQuoteAdmission(section,normalizedPath); if(result.valid&&admission){Object.defineProperty(section,"__legacyQuoteTrusted",{value:true,enumerable:false}); allWarnings.push(`Legacy quote compatibility admitted: ${normalizedPath}#${section.id}`);} }
                        break;
                    case "anchor":
                        result = validateSection(section, AnchorSectionSchema, normalizedPath);
                        break;
                    case "progressList":
                        result = validateSection(section, ProgressListSectionSchema, normalizedPath);
                        break;
                    case "leadForm":
                        if (section.variant === "kenticoAjaxSplit") result = validateSection(section, LeadFormSectionSchema, normalizedPath);
                        break;
                    default:
                        // Skip validation for other section types
                        continue;
                }

                if (result && !result.valid) {
                    return { valid: false, errors: result.errors, warnings: [...allWarnings, ...(result.warnings || [])] };
                }
                if (result?.warnings?.length) {
                    allWarnings.push(...result.warnings);
                }
            }
        }

        return { valid: true, errors: [], warnings: allWarnings };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `${err.message}${path}`;
            });
            return { valid: false, errors, warnings: allWarnings };
        }
        return { valid: false, errors: [error.message], warnings: allWarnings };
    }
}

/**
 * Validate a section with a specific schema
 * @param {any} data - Section data to validate
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} filePath - Relative file path for error reporting
 * @returns {object} - { valid: boolean, errors: string[], warnings: string[] }
 */
function validateSection(data, schema, filePath) {
    try {
        schema.parse(data);
        return { valid: true, errors: [], warnings: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `Section validation failed: ${err.message}${path}`;
            });
            return { valid: false, errors, warnings: [] };
        }
        return { valid: false, errors: [`Section validation failed: ${error.message}`], warnings: [] };
    }
}

/**
 * Validate hero section data
 * @param {any} data - Hero section data to validate
 * @param {string} filePath - Relative file path for baseline lookup and error reporting
 * @returns {object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateHeroSection(data, filePath) {
    const normalizedPath = normalizeFilePath(filePath);
    const warnings = [];
    let zodErrors = [];

    try {
        HeroSectionSchema.parse(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            zodErrors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `Hero section validation failed: ${err.message}${path}`;
            });
        } else {
            return { valid: false, errors: [`Hero section validation failed: ${error.message}`], warnings };
        }
    }

    // Baseline-aware check for raw HTML/class keys at section level
    const sectionId = data?.id || "(no id)";
    const legacyResult = findRawMarkupKeys(data, normalizedPath, sectionId);
    zodErrors.push(...legacyResult.errors);
    warnings.push(...legacyResult.warnings);

    if (zodErrors.length > 0) {
        return { valid: false, errors: zodErrors, warnings };
    }

    return { valid: true, errors: [], warnings };
}

/**
 * Throw fatal error if validation fails
 * @param {object} result - Validation result from validateTemplate or validatePageData
 * @param {string} filePath - File path for error reporting
 */
export function throwOnValidationError(result, filePath) {
    if (!result.valid) {
        const errorMessage = `Schema validation failed for ${filePath}:\n${result.errors.map((e) => `  ❌ ${e}`).join("\n")}`;
        throw new Error(errorMessage);
    }
}
