#!/usr/bin/env node

/**
 * Extract hero sections from legacy HTML files and convert to structured YAML
 * Usage: node dev/scripts/extract-hero-legacy.mjs
 *
 * Note: This is a demonstration script showing the extraction pattern.
 * For production use, integrate with the build-pages.mjs renderer.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

/**
 * Simple regex-based HTML parser for hero sections
 * @param {string} htmlContent - HTML content
 * @param {string} filePath - Source file path for context
 * @returns {object|null} - Hero section object or null if not found
 */
function extractHeroFromHtml(htmlContent, filePath) {
    // Find hero section
    const heroMatch = htmlContent.match(/<section[^>]*class="[^"]*section_hero[^"]*"[^>]*>([\s\S]*?)<\/section>/);
    if (!heroMatch) {
        return null;
    }

    const heroContent = heroMatch[1];

    // Extract basic properties using regex
    const titleMatch = heroContent.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const subtitleMatch = heroContent.match(/<p[^>]*class="[^"]*subhead[^"]*"[^>]*>([^<]+)<\/p>/);
    const subtitle = subtitleMatch ? subtitleMatch[1].trim() : "";

    const bodyMatch = heroContent.match(/<p[^>]*(?!class="[^"]*subhead[^"]*")[^>]*>([^<]+)<\/p>/);
    const body = bodyMatch ? bodyMatch[1].trim() : "";

    // Extract image
    const imgMatch = heroContent.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/);
    const image = imgMatch
        ? {
            src: imgMatch[1],
            alt: imgMatch[2],
            loading: "lazy",
        }
        : null;

    // Determine variant
    const variant = heroContent.includes("section_hero-banner") ? "banner" : "default";

    // Determine background theme
    const backgroundTheme = heroContent.includes("bg-light") ? "light" : "white";

    // Build hero section object
    const heroObj = {
        id: `hero-${path.basename(filePath, ".html")}`,
        type: "hero",
        title,
    };

    if (subtitle) heroObj.subtitle = subtitle;
    if (body) heroObj.body = body;
    if (image) heroObj.image = image;
    if (variant !== "default") heroObj.variant = variant;
    if (backgroundTheme !== "white") heroObj.backgroundTheme = backgroundTheme;

    return heroObj;
}

/**
 * Process legacy HTML file and extract hero section
 * @param {string} filePath - Path to legacy HTML file
 * @returns {object|null} - Extracted hero section or null
 */
function processLegacyFile(filePath) {
    try {
        const htmlContent = fs.readFileSync(filePath, "utf-8");
        const hero = extractHeroFromHtml(htmlContent, filePath);

        if (!hero) {
            console.log(`⚠️  No hero section found in ${filePath}`);
            return null;
        }

        return hero;
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Find all legacy HTML files
 * @returns {string[]} - Array of file paths
 */
function findLegacyHtmlFiles() {
    const legacyDir = path.join(projectRoot, "content", "legacy");
    const files = [];

    function walkDir(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walkDir(fullPath);
                } else if (entry.name.endsWith(".html")) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error.message);
        }
    }

    walkDir(legacyDir);
    return files;
}

/**
 * Main extraction process
 */
function main() {
    console.log("🔍 Scanning legacy HTML files for hero sections...\n");

    const legacyFiles = findLegacyHtmlFiles();
    console.log(`Found ${legacyFiles.length} legacy HTML files\n`);

    const extractedHeroes = [];

    for (const filePath of legacyFiles) {
        const hero = processLegacyFile(filePath);
        if (hero) {
            extractedHeroes.push({
                sourceFile: path.relative(projectRoot, filePath),
                hero,
            });
        }
    }

    if (extractedHeroes.length === 0) {
        console.log("❌ No hero sections found in legacy files");
        return;
    }

    console.log(`\n✅ Extracted ${extractedHeroes.length} hero sections\n`);

    // Display extracted heroes
    for (const { sourceFile, hero } of extractedHeroes.slice(0, 5)) {
        console.log(`📄 ${sourceFile}`);
        console.log(YAML.stringify(hero, null, 2));
        console.log("---\n");
    }

    if (extractedHeroes.length > 5) {
        console.log(`... and ${extractedHeroes.length - 5} more hero sections\n`);
    }

    console.log("✨ Hero extraction complete!");
    console.log("Next: Integrate extracted heroes into page data files");
}

main();
