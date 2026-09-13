#!/usr/bin/env node

/**
 * Extract all component types from legacy HTML files and convert to structured YAML
 * Usage: node dev/scripts/extract-components-legacy.mjs
 *
 * Supports extraction of:
 * - textMedia sections (text + image with optional reverse layout)
 * - iconCardGrid sections (grid of icon cards)
 * - cards sections (image cards with links)
 * - accordion sections (expandable FAQ)
 * - embed sections (video/media embeds)
 *
 * Note: Uses regex-based parsing (no external HTML parser dependency)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

/**
 * Extract text content from HTML, decoding entities
 */
function decodeHtmlEntities(text) {
    const entities = {
        "&nbsp;": " ",
        "&rsquo;": "'",
        "&lsquo;": "'",
        "&ldquo;": '"',
        "&rdquo;": '"',
        "&mdash;": "—",
        "&ndash;": "–",
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
    };
    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
        result = result.replace(new RegExp(entity, "g"), char);
    }
    return result;
}

/**
 * Extract textMedia sections from HTML
 * Pattern: section with text on one side, image on other (optional reverse)
 */
function extractTextMediaSections(htmlContent, filePath) {
    const sections = [];
    const sectionRegex = /<section[^>]*class="[^"]*(?!section_hero)[^"]*"[^>]*>([\s\S]*?)<\/section>/g;
    let match;

    while ((match = sectionRegex.exec(htmlContent)) !== null) {
        const sectionContent = match[1];
        const sectionClass = match[0].match(/class="([^"]*)"/)?.[1] || "";

        // Skip hero sections
        if (sectionClass.includes("section_hero")) continue;

        // Look for h2/h3 title
        const titleMatch = sectionContent.match(/<h[23][^>]*>([^<]+)<\/h[23]>/);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

        // Look for paragraph body (not subhead)
        const bodyMatch = sectionContent.match(/<p[^>]*(?!class="[^"]*subhead[^"]*")[^>]*>([^<]+)<\/p>/);
        const body = bodyMatch ? decodeHtmlEntities(bodyMatch[1].trim()) : "";

        // Look for image
        const imgMatch = sectionContent.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/);
        const imgSrc = imgMatch ? imgMatch[1] : "";
        const imgAlt = imgMatch ? decodeHtmlEntities(imgMatch[2]) : "";

        if (title && body && imgSrc) {
            const reverse = sectionContent.includes("order-2");
            const bgLight = sectionClass.includes("bg-light");

            sections.push({
                id: `textmedia-${sections.length}`,
                type: "textMedia",
                title,
                body: [body],
                reverse,
                backgroundTheme: bgLight ? "light" : "white",
                image: {
                    src: imgSrc,
                    alt: imgAlt,
                    loading: "lazy",
                },
            });
        }
    }

    return sections;
}

/**
 * Extract iconCardGrid sections from HTML
 * Pattern: section with grid of cards containing icons and text
 */
function extractIconCardGridSections(htmlContent, filePath) {
    const sections = [];
    const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/g;
    let match;

    while ((match = sectionRegex.exec(htmlContent)) !== null) {
        const sectionContent = match[1];
        const sectionClass = match[0].match(/class="([^"]*)"/)?.[1] || "";

        // Skip hero sections
        if (sectionClass.includes("section_hero")) continue;

        // Count cards
        const cardMatches = sectionContent.match(/<div[^>]*class="[^"]*card[^"]*"[^>]*>/g) || [];
        if (cardMatches.length < 3) continue;

        // Extract title
        const titleMatch = sectionContent.match(/<h[23][^>]*>([^<]+)<\/h[23]>/);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

        if (!title) continue;

        // Extract cards
        const cards = [];
        const cardRegex = /<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        let cardMatch;

        while ((cardMatch = cardRegex.exec(sectionContent)) !== null) {
            const cardContent = cardMatch[1];
            const cardTitleMatch = cardContent.match(/<(?:h[34]|div[^>]*class="[^"]*card-title[^"]*")[^>]*>([^<]+)<\/(?:h[34]|div)>/);
            const cardTitle = cardTitleMatch ? decodeHtmlEntities(cardTitleMatch[1].trim()) : "";

            const cardBodyMatch = cardContent.match(/<p[^>]*class="[^"]*card-text[^"]*"[^>]*>([^<]+)<\/p>/);
            const cardBody = cardBodyMatch ? decodeHtmlEntities(cardBodyMatch[1].trim()) : "";

            if (cardTitle && cardBody) {
                cards.push({
                    title: cardTitle,
                    body: cardBody,
                    iconKey: "careerDevelopment",
                });
            }
        }

        if (cards.length > 0) {
            const bgLight = sectionClass.includes("bg-light");

            sections.push({
                id: `icongrid-${sections.length}`,
                type: "iconCardGrid",
                title,
                cards,
                backgroundLight: bgLight,
                backgroundTheme: bgLight ? "light" : "white",
            });
        }
    }

    return sections;
}

/**
 * Extract cards sections from HTML
 * Pattern: section with image cards containing title, body, and link
 */
function extractCardsSections(htmlContent, filePath) {
    const sections = [];
    const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/g;
    let match;

    while ((match = sectionRegex.exec(htmlContent)) !== null) {
        const sectionContent = match[1];
        const sectionClass = match[0].match(/class="([^"]*)"/)?.[1] || "";

        // Skip hero sections
        if (sectionClass.includes("section_hero")) continue;

        // Count cards with images
        const cardMatches = sectionContent.match(/<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>/g) || [];
        if (cardMatches.length < 2) continue;

        // Check if cards have images
        const hasImages = cardMatches.some((card) => card.includes("<img") || card.includes("<picture"));
        if (!hasImages) continue;

        // Extract title
        const titleMatch = sectionContent.match(/<h[23][^>]*>([^<]+)<\/h[23]>/);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

        if (!title) continue;

        // Extract cards
        const cards = [];
        const cardRegex = /<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        let cardMatch;

        while ((cardMatch = cardRegex.exec(sectionContent)) !== null) {
            const cardContent = cardMatch[1];

            // Extract image
            const imgMatch = cardContent.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/);
            if (!imgMatch) continue;

            const imgSrc = imgMatch[1];
            const imgAlt = decodeHtmlEntities(imgMatch[2]);

            // Extract title
            const cardTitleMatch = cardContent.match(/<(?:h[34]|div[^>]*class="[^"]*card-title[^"]*")[^>]*>([^<]+)<\/(?:h[34]|div)>/);
            const cardTitle = cardTitleMatch ? decodeHtmlEntities(cardTitleMatch[1].trim()) : "";

            // Extract body
            const cardBodyMatch = cardContent.match(/<p[^>]*class="[^"]*card-text[^"]*"[^>]*>([^<]+)<\/p>/);
            const cardBody = cardBodyMatch ? decodeHtmlEntities(cardBodyMatch[1].trim()) : "";

            // Extract link
            const linkMatch = cardContent.match(/<a[^>]*href="([^"]*)"[^>]*>/);
            const href = linkMatch ? linkMatch[1] : "";

            if (cardTitle && cardBody && href) {
                cards.push({
                    title: cardTitle,
                    body: cardBody,
                    href,
                    image: {
                        src: imgSrc,
                        alt: imgAlt,
                        loading: "lazy",
                    },
                });
            }
        }

        if (cards.length > 0) {
            const bgLight = sectionClass.includes("bg-light");

            sections.push({
                id: `cards-${sections.length}`,
                type: "cards",
                title,
                cards,
                backgroundTheme: bgLight ? "light" : "white",
            });
        }
    }

    return sections;
}

/**
 * Extract accordion sections from HTML
 * Pattern: section with expandable FAQ items
 */
function extractAccordionSections(htmlContent, filePath) {
    const sections = [];
    const accordionRegex = /<div[^>]*class="[^"]*accordion[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    let match;

    while ((match = accordionRegex.exec(htmlContent)) !== null) {
        const accordionContent = match[1];

        // Find parent section for title
        const sectionStart = htmlContent.lastIndexOf("<section", htmlContent.indexOf(match[0]));
        const sectionEnd = htmlContent.indexOf("</section>", match.index);
        const sectionContent = htmlContent.substring(sectionStart, sectionEnd);

        const titleMatch = sectionContent.match(/<h[23][^>]*>([^<]+)<\/h[23]>/);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

        if (!title) continue;

        // Extract accordion items
        const items = [];
        const itemRegex = /<(?:div[^>]*class="[^"]*accordion-item[^"]*"|li)[^>]*>([\s\S]*?)<\/(?:div|li)>/g;
        let itemMatch;

        while ((itemMatch = itemRegex.exec(accordionContent)) !== null) {
            const itemContent = itemMatch[1];

            // Extract item title
            const itemTitleMatch = itemContent.match(/<(?:h[34]|strong|div[^>]*class="[^"]*accordion-header[^"]*")[^>]*>([^<]+)<\/(?:h[34]|strong|div)>/);
            const itemTitle = itemTitleMatch ? decodeHtmlEntities(itemTitleMatch[1].trim()) : "";

            // Extract item body
            const itemBodyMatch = itemContent.match(/<(?:p|div[^>]*class="[^"]*accordion-body[^"]*")[^>]*>([^<]+)<\/(?:p|div)>/);
            const itemBody = itemBodyMatch ? decodeHtmlEntities(itemBodyMatch[1].trim()) : "";

            if (itemTitle && itemBody) {
                items.push({
                    title: itemTitle,
                    body: itemBody,
                });
            }
        }

        if (items.length > 0) {
            sections.push({
                id: `accordion-${sections.length}`,
                type: "accordion",
                title,
                items,
            });
        }
    }

    return sections;
}

/**
 * Extract embed sections from HTML
 * Pattern: section with video or media embeds
 */
function extractEmbedSections(htmlContent, filePath) {
    const sections = [];
    const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/g;
    let match;

    while ((match = sectionRegex.exec(htmlContent)) !== null) {
        const sectionContent = match[1];

        // Look for iframe or video
        const iframeMatch = sectionContent.match(/<iframe[^>]*src="([^"]*)"[^>]*>/);
        const videoMatch = sectionContent.match(/<video[^>]*src="([^"]*)"[^>]*>/);

        if (!iframeMatch && !videoMatch) continue;

        const embedUrl = iframeMatch ? iframeMatch[1] : videoMatch[1];
        const embedType = iframeMatch ? "iframe" : "video";

        // Extract title
        const titleMatch = sectionContent.match(/<h[23][^>]*>([^<]+)<\/h[23]>/);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

        if (title && embedUrl) {
            sections.push({
                id: `embed-${sections.length}`,
                type: "embed",
                title,
                embedUrl,
                embedType,
            });
        }
    }

    return sections;
}

/**
 * Process legacy HTML file and extract all component types
 */
function processLegacyFile(filePath) {
    try {
        const htmlContent = fs.readFileSync(filePath, "utf-8");

        const extracted = {
            sourceFile: path.relative(projectRoot, filePath),
            textMedia: extractTextMediaSections(htmlContent, filePath),
            iconCardGrid: extractIconCardGridSections(htmlContent, filePath),
            cards: extractCardsSections(htmlContent, filePath),
            accordion: extractAccordionSections(htmlContent, filePath),
            embed: extractEmbedSections(htmlContent, filePath),
        };

        return extracted;
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Find all legacy HTML files
 */
function findLegacyHtmlFiles() {
    const legacyDir = path.join(projectRoot, "content", "legacy");
    const pagesDir = path.join(projectRoot, "content", "pages");
    const files = [];

    function walkDir(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walkDir(fullPath);
                } else if (entry.name.endsWith(".main.html")) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory may not exist
        }
    }

    walkDir(legacyDir);
    walkDir(pagesDir);
    return files;
}

/**
 * Main extraction process
 */
function main() {
    console.log("🔍 Scanning legacy HTML files for component sections...\n");

    const legacyFiles = findLegacyHtmlFiles();
    console.log(`Found ${legacyFiles.length} legacy HTML files\n`);

    const allExtracted = {
        textMedia: [],
        iconCardGrid: [],
        cards: [],
        accordion: [],
        embed: [],
    };

    for (const filePath of legacyFiles) {
        const extracted = processLegacyFile(filePath);
        if (extracted) {
            allExtracted.textMedia.push(...extracted.textMedia);
            allExtracted.iconCardGrid.push(...extracted.iconCardGrid);
            allExtracted.cards.push(...extracted.cards);
            allExtracted.accordion.push(...extracted.accordion);
            allExtracted.embed.push(...extracted.embed);
        }
    }

    console.log("✅ Extraction Summary:\n");
    console.log(`  📝 TextMedia sections: ${allExtracted.textMedia.length}`);
    console.log(`  🎨 IconCardGrid sections: ${allExtracted.iconCardGrid.length}`);
    console.log(`  🖼️  Cards sections: ${allExtracted.cards.length}`);
    console.log(`  📋 Accordion sections: ${allExtracted.accordion.length}`);
    console.log(`  🎬 Embed sections: ${allExtracted.embed.length}\n`);

    // Display sample extractions
    if (allExtracted.textMedia.length > 0) {
        console.log("📝 Sample TextMedia Section:");
        console.log(YAML.stringify(allExtracted.textMedia[0], null, 2));
        console.log("---\n");
    }

    if (allExtracted.iconCardGrid.length > 0) {
        console.log("🎨 Sample IconCardGrid Section:");
        console.log(YAML.stringify(allExtracted.iconCardGrid[0], null, 2));
        console.log("---\n");
    }

    if (allExtracted.cards.length > 0) {
        console.log("🖼️  Sample Cards Section:");
        console.log(YAML.stringify(allExtracted.cards[0], null, 2));
        console.log("---\n");
    }

    console.log("✨ Component extraction complete!");
    console.log("Next: Integrate extracted components into page data files");
}

main();
