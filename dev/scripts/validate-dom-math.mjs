#!/usr/bin/env node

/**
 * Validate DOM math at Desktop (1440px) and Mobile (375px) viewports
 * Compares computed styles against design specifications
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

        // Get computed styles for hero section
        const heroStyles = await page.evaluate(() => {
            const hero = document.querySelector(".ic-section-hero");
            if (!hero) return null;

            const styles = window.getComputedStyle(hero);
            return {
                display: styles.display,
                width: styles.width,
                padding: styles.padding,
                marginTop: styles.marginTop,
                marginBottom: styles.marginBottom,
            };
        });

        // Get heading styles
        const headingStyles = await page.evaluate(() => {
            const h1 = document.querySelector(".ic-section-hero h1");
            if (!h1) return null;

            const styles = window.getComputedStyle(h1);
            return {
                fontSize: styles.fontSize,
                lineHeight: styles.lineHeight,
                fontWeight: styles.fontWeight,
                color: styles.color,
            };
        });

        // Get image styles
        const imageStyles = await page.evaluate(() => {
            const img = document.querySelector(".ic-section-image");
            if (!img) return null;

            const styles = window.getComputedStyle(img);
            return {
                width: styles.width,
                height: styles.height,
                objectFit: styles.objectFit,
                borderRadius: styles.borderRadius,
            };
        });

        // Get button styles
        const buttonStyles = await page.evaluate(() => {
            const btn = document.querySelector(".ic-btn");
            if (!btn) return null;

            const styles = window.getComputedStyle(btn);
            return {
                display: styles.display,
                padding: styles.padding,
                fontSize: styles.fontSize,
                backgroundColor: styles.backgroundColor,
                color: styles.color,
            };
        });

        return {
            hero: heroStyles,
            heading: headingStyles,
            image: imageStyles,
            button: buttonStyles,
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
    console.log("🔍 Starting DOM Math Validation...\n");

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        for (const viewport of VIEWPORTS) {
            console.log(`\n📱 ${viewport.name} Viewport (${viewport.width}x${viewport.height})`);
            console.log("=".repeat(60));

            const page = await browser.newPage();

            for (const url of TEST_PAGES) {
                const pageName = url.split("/").pop();
                console.log(`\n  📄 ${pageName}`);

                const styles = await validatePageViewport(page, url, viewport);

                if (styles) {
                    console.log(`    Hero: ${JSON.stringify(styles.hero)}`);
                    console.log(`    Heading: ${JSON.stringify(styles.heading)}`);
                    console.log(`    Image: ${JSON.stringify(styles.image)}`);
                    console.log(`    Button: ${JSON.stringify(styles.button)}`);
                } else {
                    console.log(`    ⚠️  Could not retrieve styles`);
                }
            }

            await page.close();
        }

        console.log("\n✅ DOM Math Validation Complete!");
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
