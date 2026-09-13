#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import YAML from "yaml";

/**
 * Convert JSON template files to YAML format
 * Enforces strict schema: slug, title, sections (with id, type, variant)
 */

const TEMPLATE_DIR = "content/templates";
const ALLOWED_SECTION_TYPES = new Set([
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
]);

function validateTemplate(data, filePath) {
    const errors = [];

    if (!data.slug || typeof data.slug !== "string") {
        errors.push(`Missing or invalid 'slug' in ${filePath}`);
    }

    if (!data.title || typeof data.title !== "string") {
        errors.push(`Missing or invalid 'title' in ${filePath}`);
    }

    if (!Array.isArray(data.sections)) {
        errors.push(`Missing or invalid 'sections' array in ${filePath}`);
    } else {
        data.sections.forEach((section, index) => {
            if (!section.id || typeof section.id !== "string") {
                errors.push(`Section ${index}: missing or invalid 'id' in ${filePath}`);
            }

            if (!section.type || typeof section.type !== "string") {
                errors.push(`Section ${index}: missing or invalid 'type' in ${filePath}`);
            } else if (!ALLOWED_SECTION_TYPES.has(section.type)) {
                errors.push(
                    `Section ${index}: invalid type '${section.type}' in ${filePath}. Allowed: ${Array.from(ALLOWED_SECTION_TYPES).join(", ")}`,
                );
            }

            if (section.variant && typeof section.variant !== "string") {
                errors.push(`Section ${index}: invalid 'variant' type in ${filePath}`);
            }

            // Reject any HTML or bodyHtml keys
            if (section.bodyHtml || section.html || section.contentHtml) {
                errors.push(`Section ${index}: inline HTML detected in ${filePath}. Use structured properties instead.`);
            }
        });
    }

    // Reject any top-level HTML keys
    if (data.bodyHtml || data.html || data.contentHtml) {
        errors.push(`Inline HTML detected in ${filePath}. Use structured properties instead.`);
    }

    return errors;
}

function convertJsonToYaml(jsonPath) {
    try {
        const jsonContent = readFileSync(jsonPath, "utf-8");
        const data = JSON.parse(jsonContent);

        // Validate template structure
        const errors = validateTemplate(data, jsonPath);
        if (errors.length > 0) {
            console.error(`❌ Validation failed for ${jsonPath}:`);
            errors.forEach((error) => console.error(`   - ${error}`));
            return false;
        }

        // Convert to YAML
        const yamlContent = YAML.stringify(data, { lineWidth: 0 });
        const yamlPath = jsonPath.replace(/\.json$/, ".yaml");

        writeFileSync(yamlPath, yamlContent, "utf-8");
        console.log(`✅ Converted: ${jsonPath} → ${yamlPath}`);
        return true;
    } catch (error) {
        console.error(`❌ Error converting ${jsonPath}:`, error.message);
        return false;
    }
}

function collectJsonFiles(dir) {
    const files = [];

    if (!existsSync(dir)) {
        return files;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === ".DS_Store") {
            continue;
        }

        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectJsonFiles(fullPath));
        } else if (entry.isFile() && fullPath.endsWith(".json")) {
            files.push(fullPath);
        }
    }

    return files.sort();
}

function main() {
    console.log("🔄 Starting template conversion from JSON to YAML...\n");

    const jsonFiles = collectJsonFiles(TEMPLATE_DIR);

    if (jsonFiles.length === 0) {
        console.log("ℹ️  No JSON template files found.");
        return;
    }

    console.log(`Found ${jsonFiles.length} JSON template file(s):\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const jsonPath of jsonFiles) {
        if (convertJsonToYaml(jsonPath)) {
            successCount++;
        } else {
            failureCount++;
        }
    }

    console.log(`\n📊 Conversion Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);

    if (failureCount > 0) {
        process.exit(1);
    }
}

main();
