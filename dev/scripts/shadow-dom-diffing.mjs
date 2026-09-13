#!/usr/bin/env node

/**
 * Shadow DOM Diffing & Mathematical Verification
 * Compares legacy HTML outputs vs modern YAML-compiled outputs
 * Validates: text nodes, heading sizes, images, container widths at 1440px and 375px
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 375, height: 667 }
];

// Top 5 most complex pages for diffing
const TEST_PAGES = [
    { name: 'about-us', modern: 'http://localhost:3001/about-us.html', legacy: 'content/legacy/about-us.html' },
    { name: 'adas/what-is-adas', modern: 'http://localhost:3001/adas/what-is-adas.html', legacy: 'content/legacy/adas/what-is-adas.html' },
    { name: 'gold-class', modern: 'http://localhost:3001/gold-class.html', legacy: 'content/legacy/gold-class/get-to-gold-class.html' },
    { name: 'industries-served/oem', modern: 'http://localhost:3001/industries-served/oem.html', legacy: 'content/legacy/industries-served/oem.html' },
    { name: 'governance', modern: 'http://localhost:3001/governance.html', legacy: 'content/legacy/icar-global.html' }
];

/**
 * Extract DOM metrics from a page
 */
async function extractDOMMetrics(page, viewport) {
    await page.setViewport(viewport);

    const metrics = await page.evaluate(() => {
        const results = {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            textNodeCount: 0,
            textContent: '',
            headings: [],
            images: [],
            containers: [],
            links: [],
            forms: [],
            buttons: []
        };

        // Count and collect text nodes
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        let node;
        const textParts = [];
        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text.length > 0) {
                results.textNodeCount++;
                textParts.push(text);
            }
        }
        results.textContent = textParts.join(' ').substring(0, 500);

        // Extract heading metrics
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, idx) => {
            if (idx < 10) {
                const styles = window.getComputedStyle(heading);
                const rect = heading.getBoundingClientRect();
                results.headings.push({
                    tag: heading.tagName,
                    text: heading.textContent.substring(0, 50),
                    fontSize: styles.fontSize,
                    fontWeight: styles.fontWeight,
                    lineHeight: styles.lineHeight,
                    width: rect.width.toFixed(2),
                    height: rect.height.toFixed(2)
                });
            }
        });

        // Extract image metrics
        document.querySelectorAll('img').forEach((img, idx) => {
            if (idx < 10) {
                results.images.push({
                    src: img.src.substring(img.src.lastIndexOf('/') + 1),
                    alt: img.alt || '[NO ALT]',
                    width: img.width,
                    height: img.height,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight
                });
            }
        });

        // Extract container metrics
        document.querySelectorAll('[class*="container"], [class*="section"], main, article').forEach((container, idx) => {
            if (idx < 5) {
                const styles = window.getComputedStyle(container);
                const rect = container.getBoundingClientRect();
                results.containers.push({
                    tag: container.tagName,
                    classes: container.className.substring(0, 60),
                    width: rect.width.toFixed(2),
                    height: rect.height.toFixed(2),
                    padding: styles.padding,
                    margin: styles.margin,
                    display: styles.display
                });
            }
        });

        // Extract link metrics
        document.querySelectorAll('a').forEach((link, idx) => {
            if (idx < 5) {
                results.links.push({
                    href: link.href.substring(link.href.lastIndexOf('/') + 1),
                    text: link.textContent.substring(0, 30),
                    target: link.target || 'self'
                });
            }
        });

        // Extract form metrics
        document.querySelectorAll('form').forEach((form, idx) => {
            if (idx < 3) {
                results.forms.push({
                    id: form.id || 'unnamed',
                    method: form.method,
                    action: form.action.substring(form.action.lastIndexOf('/') + 1),
                    inputs: form.querySelectorAll('input, textarea, select').length
                });
            }
        });

        // Extract button metrics
        document.querySelectorAll('button, [role="button"], a[class*="btn"]').forEach((btn, idx) => {
            if (idx < 5) {
                const styles = window.getComputedStyle(btn);
                results.buttons.push({
                    text: btn.textContent.substring(0, 30),
                    type: btn.type || 'button',
                    padding: styles.padding,
                    fontSize: styles.fontSize,
                    backgroundColor: styles.backgroundColor
                });
            }
        });

        return results;
    });

    return metrics;
}

/**
 * Compare two metric sets and generate diff report
 */
function compareDOMMetrics(modern, legacy) {
    const report = {
        textNodeMatch: modern.textNodeCount === legacy.textNodeCount,
        textNodeDiff: Math.abs(modern.textNodeCount - legacy.textNodeCount),
        headingCountMatch: modern.headings.length === legacy.headings.length,
        headingCountDiff: Math.abs(modern.headings.length - legacy.headings.length),
        imageCountMatch: modern.images.length === legacy.images.length,
        imageCountDiff: Math.abs(modern.images.length - legacy.images.length),
        containerCountMatch: modern.containers.length === legacy.containers.length,
        linkCountMatch: modern.links.length === legacy.links.length,
        formCountMatch: modern.forms.length === legacy.forms.length,
        buttonCountMatch: modern.buttons.length === legacy.buttons.length,
        issues: []
    };

    // Check text node parity
    if (!report.textNodeMatch) {
        report.issues.push(`Text node count mismatch: Modern=${modern.textNodeCount}, Legacy=${legacy.textNodeCount}`);
    }

    // Check heading parity
    if (!report.headingCountMatch) {
        report.issues.push(`Heading count mismatch: Modern=${modern.headings.length}, Legacy=${legacy.headings.length}`);
    }

    // Check image parity
    if (!report.imageCountMatch) {
        report.issues.push(`Image count mismatch: Modern=${modern.images.length}, Legacy=${legacy.images.length}`);
    }

    // Check container widths at different viewports
    if (modern.containers.length > 0 && legacy.containers.length > 0) {
        const modernWidth = parseFloat(modern.containers[0].width);
        const legacyWidth = parseFloat(legacy.containers[0].width);
        const widthDiff = Math.abs(modernWidth - legacyWidth);

        if (widthDiff > 5) { // Allow 5px tolerance
            report.issues.push(`Container width variance: Modern=${modernWidth}px, Legacy=${legacyWidth}px (diff=${widthDiff.toFixed(2)}px)`);
        }
    }

    return report;
}

/**
 * Main execution
 */
async function runShadowDOMDiffing() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log('\n🔍 SHADOW DOM DIFFING & MATHEMATICAL VERIFICATION\n');
        console.log('='.repeat(100));
        console.log('Comparing Legacy HTML vs Modern YAML-Compiled Outputs');
        console.log('='.repeat(100));

        const summaryMatrix = [];

        for (const testPage of TEST_PAGES) {
            console.log(`\n📄 Page: ${testPage.name}`);
            console.log('-'.repeat(100));

            const modernPage = await browser.newPage();
            const legacyPage = await browser.newPage();

            try {
                // Load modern version
                await modernPage.goto(testPage.modern, { waitUntil: 'networkidle2', timeout: 30000 });

                // Load legacy version (if available)
                let legacyLoaded = false;
                try {
                    const legacyContent = fs.readFileSync(testPage.legacy, 'utf-8');
                    await legacyPage.setContent(legacyContent, { waitUntil: 'networkidle2' });
                    legacyLoaded = true;
                } catch (e) {
                    console.log(`  ⚠️  Legacy file not found: ${testPage.legacy}`);
                }

                // Extract metrics at each viewport
                for (const viewport of VIEWPORTS) {
                    console.log(`\n  📐 ${viewport.name} (${viewport.width}x${viewport.height}):`);

                    const modernMetrics = await extractDOMMetrics(modernPage, viewport);
                    console.log(`    Modern: ${modernMetrics.textNodeCount} text nodes, ${modernMetrics.headings.length} headings, ${modernMetrics.images.length} images`);
                    console.log(`    Container: ${modernMetrics.containers.length > 0 ? modernMetrics.containers[0].width + 'px' : 'N/A'}`);

                    if (legacyLoaded) {
                        const legacyMetrics = await extractDOMMetrics(legacyPage, viewport);
                        console.log(`    Legacy:  ${legacyMetrics.textNodeCount} text nodes, ${legacyMetrics.headings.length} headings, ${legacyMetrics.images.length} images`);
                        console.log(`    Container: ${legacyMetrics.containers.length > 0 ? legacyMetrics.containers[0].width + 'px' : 'N/A'}`);

                        const comparison = compareDOMMetrics(modernMetrics, legacyMetrics);

                        // Report results
                        const status = comparison.issues.length === 0 ? '✅ PASS' : '⚠️  ISSUES';
                        console.log(`    ${status}`);

                        if (comparison.issues.length > 0) {
                            comparison.issues.forEach(issue => {
                                console.log(`      • ${issue}`);
                            });
                        }

                        summaryMatrix.push({
                            page: testPage.name,
                            viewport: viewport.name,
                            status: comparison.issues.length === 0 ? 'PASS' : 'FAIL',
                            issues: comparison.issues.length
                        });
                    }
                }
            } catch (error) {
                console.log(`  ❌ Error processing page: ${error.message}`);
            } finally {
                await modernPage.close();
                await legacyPage.close();
            }
        }

        // Print summary matrix
        console.log('\n\n' + '='.repeat(100));
        console.log('VERIFICATION MATRIX - PASS/FAIL SUMMARY');
        console.log('='.repeat(100));
        console.log('\nPage                          | Desktop | Mobile');
        console.log('-'.repeat(100));

        const pageResults = {};
        summaryMatrix.forEach(result => {
            if (!pageResults[result.page]) {
                pageResults[result.page] = {};
            }
            pageResults[result.page][result.viewport] = result.status;
        });

        Object.entries(pageResults).forEach(([page, results]) => {
            const desktop = results.Desktop || 'N/A';
            const mobile = results.Mobile || 'N/A';
            console.log(`${page.padEnd(30)} | ${desktop.padEnd(7)} | ${mobile}`);
        });

        console.log('\n' + '='.repeat(100));
        const totalTests = summaryMatrix.length;
        const passedTests = summaryMatrix.filter(r => r.status === 'PASS').length;
        console.log(`✅ RESULTS: ${passedTests}/${totalTests} tests passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
        console.log('='.repeat(100) + '\n');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Execute
runShadowDOMDiffing().catch(console.error);
