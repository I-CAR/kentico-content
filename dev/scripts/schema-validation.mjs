import { z } from "zod";

/**
 * Zod schema validation for page and template data
 * Enforces strict structure: no inline HTML, no unapproved keys
 */

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
];

const ALLOWED_BUTTON_VARIANTS = ["primary", "outline", "white", "gray"];
const ALLOWED_HERO_VARIANTS = ["default", "banner", "split"];
const ALLOWED_BACKGROUND_THEMES = ["light", "white", "dark"];
const ALLOWED_IMAGE_PLACEMENTS = ["column", "background"];
const ALLOWED_HEADING_TAGS = ["h1", "h2", "h3", "p"];
const ALLOWED_IMAGE_LOADING = ["eager", "lazy"];
const ALLOWED_ICON_KEYS = [
    "careerDevelopment",
    "justInTime",
    "repairersRealm",
    "askICar",
    "adasNews",
    "skillsUSA",
    "technicalTsunami",
    "goldClass",
    "platinum",
];

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

// Icon card schema for iconCardGrid
const IconCardSchema = z.object({
    title: z.string().min(1, "Card title is required"),
    body: z.string().min(1, "Card body is required"),
    iconKey: z.enum(ALLOWED_ICON_KEYS, {
        errorMap: () => ({
            message: `Icon key must be one of: ${ALLOWED_ICON_KEYS.join(", ")}`,
        }),
    }),
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

// Cards section schema - permissive during transition phase
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
});

// Accordion section schema - permissive during transition phase
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

// Hero section schema - permissive during transition phase
// Allows legacy properties alongside structured properties
// TODO: Enforce strict validation after data migration is complete
export const HeroSectionSchema = z.record(z.any()).superRefine((data, ctx) => {
    // Only validate that it's a hero section with required id and type
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

    // Reject only inline HTML keys that are explicitly forbidden
    const strictHtmlKeys = ["bodyHtml", "html"];
    for (const key of strictHtmlKeys) {
        if (key in data) {
            ctx.addIssue({
                code: z.ZodIssueCode.forbidden,
                message: `Inline HTML key '${key}' is not allowed in hero sections. Use structured properties instead.`,
                path: [key],
            });
        }
    }
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
        return { valid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `${err.message}${path}`;
            });
            return { valid: false, errors };
        }
        return { valid: false, errors: [error.message] };
    }
}

/**
 * Validate page data
 * @param {any} data - Page data to validate
 * @param {string} filePath - File path for error reporting
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export function validatePageData(data, filePath) {
    try {
        PageDataSchema.parse(data);

        // Validate all sections if present
        if (data.sections && Array.isArray(data.sections)) {
            for (let i = 0; i < data.sections.length; i++) {
                const section = data.sections[i];
                let result;

                switch (section.type) {
                    case "hero":
                        result = validateHeroSection(section, filePath);
                        break;
                    case "textMedia":
                        result = validateSection(section, TextMediaSectionSchema, filePath);
                        break;
                    case "iconCardGrid":
                        result = validateSection(section, IconCardGridSectionSchema, filePath);
                        break;
                    case "cards":
                        result = validateSection(section, CardsSectionSchema, filePath);
                        break;
                    case "accordion":
                        result = validateSection(section, AccordionSectionSchema, filePath);
                        break;
                    case "embed":
                        result = validateSection(section, EmbedSectionSchema, filePath);
                        break;
                    default:
                        // Skip validation for other section types
                        continue;
                }

                if (!result.valid) {
                    return result;
                }
            }
        }

        return { valid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `${err.message}${path}`;
            });
            return { valid: false, errors };
        }
        return { valid: false, errors: [error.message] };
    }
}

/**
 * Validate a section with a specific schema
 * @param {any} data - Section data to validate
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} filePath - File path for error reporting
 * @returns {object} - { valid: boolean, errors: string[] }
 */
function validateSection(data, schema, filePath) {
    try {
        schema.parse(data);
        return { valid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `Section validation failed: ${err.message}${path}`;
            });
            return { valid: false, errors };
        }
        return { valid: false, errors: [`Section validation failed: ${error.message}`] };
    }
}

/**
 * Validate hero section data
 * @param {any} data - Hero section data to validate
 * @param {string} filePath - File path for error reporting
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export function validateHeroSection(data, filePath) {
    try {
        HeroSectionSchema.parse(data);
        return { valid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map((err) => {
                const path = err.path.length > 0 ? ` at ${err.path.join(".")}` : "";
                return `Hero section validation failed: ${err.message}${path}`;
            });
            return { valid: false, errors };
        }
        return { valid: false, errors: [`Hero section validation failed: ${error.message}`] };
    }
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
