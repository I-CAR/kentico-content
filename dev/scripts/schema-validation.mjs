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
    ["content/pages/electric-hybrid-vehicle-repair.json", new Set([
        "top:sectionClassName", "top:rowClassName", "top:contentClassName",
        "top:mediaClassName", "top:boxClassName",
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
    "text",
    "html",
    "embed",
    "accordion",
    "mediaSlider",
    "profileGrid",
    "quoteGrid",
    "legal",
    "accreditation",
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
    "backgroundColor", "backgroundLight", "backgroundTheme", "__template", "__autoSectionClassName",
    "sectionChrome", "ctaDestination",
]);
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
    validateSectionList(data.list, ctx);
    validateDecorativeImage(data.decorativeImage, ctx);
    validatePathDropdown(data.pathDropdown, ctx);
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
            });
        }
    }
    validatePathDropdown(data.pathDropdown, ctx);
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
});

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

export const TextSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
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
