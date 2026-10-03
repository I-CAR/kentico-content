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
    "accreditation",
];

const ALLOWED_BUTTON_VARIANTS = ["primary", "outline", "white", "gray"];
const ALLOWED_HERO_VARIANTS = ["default", "banner", "split"];
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

    // Validate pathDropdown if present
    if (data.pathDropdown !== undefined) {
        if (typeof data.pathDropdown !== "object" || data.pathDropdown === null) {
            ctx.addIssue({ code: z.ZodIssueCode.invalid_type, expected: "object", received: typeof data.pathDropdown, message: "pathDropdown must be an object", path: ["pathDropdown"] });
        } else {
            if (!data.pathDropdown.label || typeof data.pathDropdown.label !== "string") {
                ctx.addIssue({ code: z.ZodIssueCode.invalid_type, expected: "string", received: typeof data.pathDropdown.label, message: "pathDropdown.label is required", path: ["pathDropdown", "label"] });
            }
            if (!Array.isArray(data.pathDropdown.items) || data.pathDropdown.items.length === 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "pathDropdown.items must be a non-empty array", path: ["pathDropdown", "items"] });
            } else {
                data.pathDropdown.items.forEach((item, i) => {
                    if (!item.label || typeof item.label !== "string") {
                        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "pathDropdown item label is required", path: ["pathDropdown", "items", i, "label"] });
                    }
                    if (!item.href || typeof item.href !== "string") {
                        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "pathDropdown item href is required", path: ["pathDropdown", "items", i, "href"] });
                    }
                });
            }
        }
    }

    // Validate layout.labelPosition if present
    if (data.layout?.labelPosition !== undefined && data.layout.labelPosition !== "above") {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_enum_value, options: ["above"], received: data.layout.labelPosition, message: "layout.labelPosition must be \"above\"", path: ["layout", "labelPosition"] });
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
                    case "accreditation":
                        result = validateSection(section, AccreditationSectionSchema, filePath);
                        break;
                    case "text":
                        result = validateSection(section, TextSectionSchema, filePath);
                        break;
                    case "mediaSlider":
                        result = validateSection(section, MediaSliderSectionSchema, filePath);
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
