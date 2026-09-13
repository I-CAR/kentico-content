#!/usr/bin/env node

/**
 * Clean up inline HTML keys from YAML/JSON page files
 * Converts paragraphsHtml, bodyHtml, contentHtml to structured paragraphs/body
 * Strips HTML tags and preserves text content
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

/**
 * Strip HTML tags from text
 */
function stripHtmlTags(html) {
    // Remove HTML tags but preserve text content
    let text = html.replace(/<[^>]*>/g, "");
    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&mdash;/g, "—")
        .replace(/&ndash;/g, "–")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    return text.trim();
}

/**
 * Recursively clean inline HTML keys from an object
 */
function cleanObject(obj) {
    if (Array.isArray(obj)) {
        return obj.map((item) => cleanObject(item));
    }

    if (obj !== null && typeof obj === "object") {
        const cleaned = {};

        for (const [key, value] of Object.entries(obj)) {
            // Convert paragraphsHtml to paragraphs
            if (key === "paragraphsHtml") {
                cleaned.paragraphs = Array.isArray(value)
                    ? value.map((p) => stripHtmlTags(p))
                    : [stripHtmlTags(value)];
            }
            // Convert bodyHtml to body
            else if (key === "bodyHtml") {
                cleaned.body = Array.isArray(value)
                    ? value.map((b) => stripHtmlTags(b))
                    : [stripHtmlTags(value)];
            }
            // Convert contentHtml to content
            else if (key === "contentHtml") {
                cleaned.content = Array.isArray(value)
                    ? value.map((c) => stripHtmlTags(c))
                    : [stripHtmlTags(value)];
            }
            // Recursively clean nested objects
            else {
                cleaned[key] = cleanObject(value);
            }
        }

        return cleaned;
    }

    return obj;
}

/**
 * Process a section and remove inline HTML keys
 */
function cleanSection(section) {
    return cleanObject(section);
}

/**
 * Process a page file
 */
function processPageFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        let data;

        if (filePath.endsWith(".yaml")) {
            data = YAML.parse(content);
        } else if (filePath.endsWith(".json")) {
            data = JSON.parse(content);
        } else {
            return false;
        }

        let modified = false;

        // Process sections
        if (data.sections && Array.isArray(data.sections)) {
            data.sections = data.sections.map((section) => {
                const cleaned = cleanSection(section);
                if (JSON.stringify(cleaned) !== JSON.stringify(section)) {
                    modified = true;
                }
                return cleaned;
            });
        }

        if (modified) {
            let output;
            if (filePath.endsWith(".yaml")) {
                output = YAML.stringify(data, { indent: 2 });
            } else {
                output = JSON.stringify(data, null, 2);
            }

            fs.writeFileSync(filePath, output, "utf-8");
            console.log(`✅ Cleaned: ${path.relative(projectRoot, filePath)}`);
            return true;
        }

        return false;
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Find all page files with inline HTML
 */
function findFilesWithInlineHtml() {
    const pagesDir = path.join(projectRoot, "content", "pages");
    const files = [];

    function walkDir(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walkDir(fullPath);
                } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".json")) {
                    const content = fs.readFileSync(fullPath, "utf-8");
                    if (
                        content.includes("paragraphsHtml") ||
                        content.includes("bodyHtml") ||
                        content.includes("contentHtml")
                    ) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory may not exist
        }
    }

    walkDir(pagesDir);
    return files;
}

/**
 * Main cleanup process
 */
function main() {
    console.log("🧹 Cleaning up inline HTML keys from page files...\n");

    const filesToClean = findFilesWithInlineHtml();
    console.log(`Found ${filesToClean.length} files with inline HTML\n`);

    let cleanedCount = 0;
    for (const filePath of filesToClean) {
        if (processPageFile(filePath)) {
            cleanedCount++;
        }
    }

    console.log(`\n✨ Cleanup complete! Cleaned ${cleanedCount} files`);
}

main();
