#!/usr/bin/env node

/**
 * Enhanced DOM Math Validation - Inspects actual rendered pages
 * Measures computed styles at Desktop (1440px) and Mobile (375px)
 */

import puppeteer from "puppeteer";

const VIEWPORTS = [
    { name: "Desktop", width: 1440, height: 900 },
    { name: "Mobile", width: 375, height: 667 },
];

const TEST_PAGES = [
    "http://localhost:3001/about-us/culture.html",
    "http://localhost:3001/adas/what-is-adas.html",
    "http://localhost:3001/about-us/awards/jeff-silver-platinum-award.html",
];

/**
 * Validate a page at a specific viewport
 */
async function validatePageViewport(page, url, viewport) {
    try {
        await page.setViewport(viewport);
        await page.goto(url, { waitUntil: "networkidle2" });

        // Get all sections and their computed styles
        const sections = await page.evaluate(() => {
            const results = [];

            // Find all ic-section elements
            const sectionElements = document.querySelectorAll("[class*='ic-section']");

            sectionElements.forEach((section, idx) => {
                const styles = window.getComputedStyle(section);
                const rect = section.getBoundingClientRect();

                results.push({
                    index: idx,
                    classes: section.className,
                    display: styles.display,
                    width: styles.width,
                    padding: `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`,
                    margin: `${styles.marginTop} ${styles.marginRight} ${styles.marginBottom} ${styles.marginLeft}`,
                    backgroundColor: styles.backgroundColor,
                    boxHeight: `${rect.height}px`,
                });
            });

            return results;
        });

        // Get typography measurements
        const typography = await page.evaluate(() => {
            const results = [];

            // Measure h1, h2, h3 elements
            const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

            headings.forEach((heading, idx) => {
                if (idx < 5) { // Limit to first 5 headings
                    const styles = window.getComputedStyle(heading);
                    results.push({
                        tag: heading.tagName,
                        fontSize: styles.fontSize,
                        lineHeight: styles.lineHeight,
                        fontWeight: styles.fontWeight,
                        marginTop: styles.marginTop,
                        marginBottom: styles.marginBottom,
                        text: heading.textContent.substring(0, 50),
                    });
                }
            });

            return results;
        });

        // Get button styles
        const buttons = await page.evaluate(() => {
            const results = [];

            const btnElements = document.querySelectorAll("button, a[class*='btn']");

            btnElements.forEach((btn, idx) => {
                if (idx < 3) { // Limit to first 3 buttons
                    const styles = window.getComputedStyle(btn);
                    results.push({
                        tag: btn.tagName,
                        classes: btn.className,
                        display: styles.display,
                        padding: `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`,
                        fontSize: styles.fontSize,
                        backgroundColor: styles.backgroundColor,
                        color: styles.color,
                    });
                }
            });

            return results;
        });

        // Get grid/container measurements
        const containers = await page.evaluate(() => {
            const results = [];

            const containerElements = document.querySelectorAll(".container, [class*='grid']");

            containerElements.forEach((container, idx) => {
                if (idx < 3) { // Limit to first 3 containers
                    const styles = window.getComputedStyle(container);
                    const rect = container.getBoundingClientRect();

                    results.push({
                        classes: container.className,
                        display: styles.display,
                        width: styles.width,
                        maxWidth: styles.maxWidth,
                        padding: `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`,
                        gap: styles.gap,
                        gridTemplateColumns: styles.gridTemplateColumns,
                        actualWidth: `${rect.width}px`,
                    });
                }
            });

            return results;
        });

        return {
            sections,
            typography,
            buttons,
            containers,
        };
    } catch (error) {
        console.error(`Error validating ${url} at ${viewport.width}px:`, error.message);
        return null;
    }
}

/**
 * Main validation process
 */
async function main() {
    console.log("🔍 Starting Enhanced DOM Math Validation...\n");

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        for (const viewport of VIEWPORTS) {
            console.log(`\n📱 ${viewport.name} Viewport (${viewport.width}x${viewport.height})`);
            console.log("=".repeat(80));

            const page = await browser.newPage();

            for (const url of TEST_PAGES) {
                const pageName = url.split("/").pop();
                console.log(`\n  📄 ${pageName}`);
                console.log("-".repeat(80));

                const styles = await validatePageViewport(page, url, viewport);

                if (styles) {
                    // Sections
                    if (styles.sections.length > 0) {
                        console.log(`  ✅ Sections Found: ${styles.sections.length}`);
                        styles.sections.slice(0, 2).forEach((section) => {
                            console.log(`     - Classes: ${section.classes}`);
                            console.log(`       Display: ${section.display}, Width: ${section.width}`);
                            console.log(`       Padding: ${section.padding}`);
                            console.log(`       BG: ${section.backgroundColor}`);
                        });
                    }

                    // Typography
                    if (styles.typography.length > 0) {
                        console.log(`  ✅ Typography: ${styles.typography.length} headings`);
                        styles.typography.slice(0, 2).forEach((heading) => {
                            console.log(`     - ${heading.tag}: ${heading.fontSize} (${heading.fontWeight})`);
                            console.log(`       Line-height: ${heading.lineHeight}, Margin: ${heading.marginTop} / ${heading.marginBottom}`);
                        });
                    }

                    // Buttons
                    if (styles.buttons.length > 0) {
                        console.log(`  ✅ Buttons: ${styles.buttons.length} found`);
                        styles.buttons.slice(0, 1).forEach((btn) => {
                            console.log(`     - ${btn.tag}: ${btn.fontSize} padding ${btn.padding}`);
                            console.log(`       BG: ${btn.backgroundColor}, Color: ${btn.color}`);
                        });
                    }

                    // Containers
                    if (styles.containers.length > 0) {
                        console.log(`  ✅ Containers: ${styles.containers.length} found`);
                        styles.containers.slice(0, 1).forEach((container) => {
                            console.log(`     - Display: ${container.display}, Width: ${container.width}`);
                            console.log(`       Max-width: ${container.maxWidth}, Actual: ${container.actualWidth}`);
                            console.log(`       Gap: ${container.gap}`);
                        });
                    }
                } else {
                    console.log(`    ⚠️  Could not retrieve styles`);
                }
            }

            await page.close();
        }

        console.log("\n✅ Enhanced DOM Math Validation Complete!");
    } catch (error) {
        console.error("❌ Validation failed:", error.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

main();
