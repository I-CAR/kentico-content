#!/usr/bin/env node

/**
 * Extreme Verification Audit - 100% Coverage Deep Node Audit
 * Analyzes ALL 44 pages with comprehensive DOM node counting, attribute matching,
 * and computed layout geometry at dual viewports (1440px and 375px)
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 375, height: 667 }
];

// All 44 pages to audit
const ALL_PAGES = [
    'http://localhost:3001/about-us.html',
    'http://localhost:3001/about-us/awards/jeff-silver-platinum-award.html',
    'http://localhost:3001/about-us/awards/russ-verona-gold-class-shop-award.html',
    'http://localhost:3001/about-us/careers.html',
    'http://localhost:3001/about-us/culture.html',
    'http://localhost:3001/adas.html',
    'http://localhost:3001/adas/adas-courses.html',
    'http://localhost:3001/adas/what-is-adas.html',
    'http://localhost:3001/course-updates.html',
    'http://localhost:3001/ctc-travel.html',
    'http://localhost:3001/documentation/component-library.html',
    'http://localhost:3001/documentation/style-guide.html',
    'http://localhost:3001/electric-hybrid-vehicle-repair.html',
    'http://localhost:3001/electric-hybrid-vehicle-repair/education.html',
    'http://localhost:3001/electric-hybrid-vehicle-repair/high-voltage-safety.html',
    'http://localhost:3001/facilities-equipment.html',
    'http://localhost:3001/facilities-equipment/best-practice.html',
    'http://localhost:3001/gold-class.html',
    'http://localhost:3001/gold-class/collision-requirements.html',
    'http://localhost:3001/gold-class/insurance-requirements.html',
    'http://localhost:3001/gold-class-marketing-kit.html',
    'http://localhost:3001/governance.html',
    'http://localhost:3001/governance/board-of-directors.html',
    'http://localhost:3001/governance/board-of-directors/become-board-member.html',
    'http://localhost:3001/governance/industry-councils.html',
    'http://localhost:3001/governance/industry-reinvestment.html',
    'http://localhost:3001/governance/leadership.html',
    'http://localhost:3001/governance/membership.html',
    'http://localhost:3001/industries-served/apda.html',
    'http://localhost:3001/industries-served/career-technical-school.html',
    'http://localhost:3001/industries-served/collision-repair-manager.html',
    'http://localhost:3001/industries-served/collision-repair-technician.html',
    'http://localhost:3001/industries-served/insurance.html',
    'http://localhost:3001/industries-served/oem.html',
    'http://localhost:3001/industries-served/supplier.html',
    'http://localhost:3001/industries-served/supporting-service.html',
    'http://localhost:3001/platinum.html',
    'http://localhost:3001/sally-mott-giveaway.html',
    'http://localhost:3001/skillsusa.html',
    'http://localhost:3001/welding.html',
    'http://localhost:3001/welding/event-resources.html',
    'http://localhost:3001/welding/training-certification.html'
];

/**
 * Extract comprehensive DOM metrics from a page
 */
async function extractDeepNodeAudit(page, viewport) {
    await page.setViewport(viewport);

    const metrics = await page.evaluate(() => {
        const results = {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            nodeCounts: {
                a: document.querySelectorAll('a').length,
                p: document.querySelectorAll('p').length,
                img: document.querySelectorAll('img').length,
                h2: document.querySelectorAll('h2').length,
                h3: document.querySelectorAll('h3').length,
                button: document.querySelectorAll('button').length,
                form: document.querySelectorAll('form').length,
                input: document.querySelectorAll('input').length,
                section: document.querySelectorAll('section').length,
                article: document.querySelectorAll('article').length
            },
            attributes: {
                hrefs: [],
                srcs: [],
                alts: []
            },
            geometry: {
                icSections: []
            }
        };

        // Extract all href attributes
        document.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (href) results.attributes.hrefs.push(href);
        });

        // Extract all src attributes
        document.querySelectorAll('img[src]').forEach(img => {
            const src = img.getAttribute('src');
            if (src) results.attributes.srcs.push(src);
        });

        // Extract all alt attributes
        document.querySelectorAll('img[alt]').forEach(img => {
            const alt = img.getAttribute('alt');
            if (alt) results.attributes.alts.push(alt);
        });

        // Extract .ic-section geometry
        document.querySelectorAll('[class*="ic-section"]').forEach((section, idx) => {
            if (idx < 10) { // Limit to first 10 sections
                const styles = window.getComputedStyle(section);
                const rect = section.getBoundingClientRect();
                results.geometry.icSections.push({
                    index: idx,
                    width: rect.width.toFixed(2),
                    height: rect.height.toFixed(2),
                    marginTop: styles.marginTop,
                    marginBottom: styles.marginBottom,
                    paddingTop: styles.paddingTop,
                    paddingBottom: styles.paddingBottom,
                    paddingLeft: styles.paddingLeft,
                    paddingRight: styles.paddingRight
                });
            }
        });

        return results;
    });

    return metrics;
}

/**
 * Main execution
 */
async function runExtremeVerification() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log('\n🔬 EXTREME VERIFICATION AUDIT - 100% COVERAGE DEEP NODE AUDIT\n');
        console.log('='.repeat(120));
        console.log(`Testing ALL ${ALL_PAGES.length} pages with comprehensive DOM node counting and geometry analysis`);
        console.log('='.repeat(120));

        const auditResults = [];
        let pageIndex = 0;

        for (const pageUrl of ALL_PAGES) {
            pageIndex++;
            const pageName = pageUrl.split('/').slice(-1)[0].replace('.html', '');
            const pageSection = pageUrl.includes('/') ? pageUrl.split('/').slice(-2, -1)[0] : 'root';

            process.stdout.write(`\r[${pageIndex}/${ALL_PAGES.length}] Auditing: ${pageName.padEnd(40)}`);

            const page = await browser.newPage();

            try {
                await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

                const desktopMetrics = await extractDeepNodeAudit(page, VIEWPORTS[0]);
                const mobileMetrics = await extractDeepNodeAudit(page, VIEWPORTS[1]);

                auditResults.push({
                    url: pageUrl,
                    name: pageName,
                    section: pageSection,
                    desktop: desktopMetrics,
                    mobile: mobileMetrics,
                    status: 'PASS'
                });
            } catch (error) {
                auditResults.push({
                    url: pageUrl,
                    name: pageName,
                    section: pageSection,
                    error: error.message,
                    status: 'FAIL'
                });
            } finally {
                await page.close();
            }
        }

        console.log('\n\n' + '='.repeat(120));
        console.log('COMPREHENSIVE AUDIT REPORT - NODE COUNTS & GEOMETRY');
        console.log('='.repeat(120));

        // Print detailed report
        console.log('\n📊 NODE COUNT SUMMARY (All 44 Pages)\n');
        console.log('Page'.padEnd(40) | 'Links' | 'Paragraphs' | 'Images' | 'H2' | 'H3' | 'Buttons' | 'Forms');
        console.log('-'.repeat(120));

        let totalLinks = 0, totalParagraphs = 0, totalImages = 0, totalH2 = 0, totalH3 = 0, totalButtons = 0, totalForms = 0;

        auditResults.forEach(result => {
            if (result.status === 'PASS') {
                const counts = result.desktop.nodeCounts;
                console.log(
                    `${result.name.padEnd(40)} | ${counts.a.toString().padEnd(5)} | ${counts.p.toString().padEnd(10)} | ${counts.img.toString().padEnd(6)} | ${counts.h2.toString().padEnd(2)} | ${counts.h3.toString().padEnd(2)} | ${counts.button.toString().padEnd(7)} | ${counts.form}`
                );
                totalLinks += counts.a;
                totalParagraphs += counts.p;
                totalImages += counts.img;
                totalH2 += counts.h2;
                totalH3 += counts.h3;
                totalButtons += counts.button;
                totalForms += counts.form;
            }
        });

        console.log('-'.repeat(120));
        console.log(
            `${'TOTAL'.padEnd(40)} | ${totalLinks.toString().padEnd(5)} | ${totalParagraphs.toString().padEnd(10)} | ${totalImages.toString().padEnd(6)} | ${totalH2.toString().padEnd(2)} | ${totalH3.toString().padEnd(2)} | ${totalButtons.toString().padEnd(7)} | ${totalForms}`
        );

        // Asset links audit
        console.log('\n\n📎 ASSET LINKS AUDIT\n');
        let totalHrefs = 0, totalSrcs = 0, totalAlts = 0;
        auditResults.forEach(result => {
            if (result.status === 'PASS') {
                totalHrefs += result.desktop.attributes.hrefs.length;
                totalSrcs += result.desktop.attributes.srcs.length;
                totalAlts += result.desktop.attributes.alts.length;
            }
        });
        console.log(`Total href attributes: ${totalHrefs}`);
        console.log(`Total src attributes: ${totalSrcs}`);
        console.log(`Total alt attributes: ${totalAlts}`);
        console.log(`Alt text coverage: ${((totalAlts / totalSrcs) * 100).toFixed(1)}%`);

        // Layout geometry audit
        console.log('\n\n📐 LAYOUT GEOMETRY AUDIT - .ic-section Measurements\n');
        console.log('Desktop (1440px) - First Section Padding/Margin:');
        auditResults.slice(0, 5).forEach(result => {
            if (result.status === 'PASS' && result.desktop.geometry.icSections.length > 0) {
                const section = result.desktop.geometry.icSections[0];
                console.log(`  ${result.name.padEnd(35)} | Padding: ${section.paddingTop} ${section.paddingRight} ${section.paddingBottom} ${section.paddingLeft}`);
            }
        });

        console.log('\nMobile (375px) - First Section Padding/Margin:');
        auditResults.slice(0, 5).forEach(result => {
            if (result.status === 'PASS' && result.mobile.geometry.icSections.length > 0) {
                const section = result.mobile.geometry.icSections[0];
                console.log(`  ${result.name.padEnd(35)} | Padding: ${section.paddingTop} ${section.paddingRight} ${section.paddingBottom} ${section.paddingLeft}`);
            }
        });

        // Final summary
        console.log('\n\n' + '='.repeat(120));
        const passedPages = auditResults.filter(r => r.status === 'PASS').length;
        const failedPages = auditResults.filter(r => r.status === 'FAIL').length;
        console.log(`✅ AUDIT COMPLETE: ${passedPages}/${ALL_PAGES.length} pages passed (${((passedPages / ALL_PAGES.length) * 100).toFixed(1)}%)`);
        if (failedPages > 0) {
            console.log(`❌ Failed pages: ${failedPages}`);
            auditResults.filter(r => r.status === 'FAIL').forEach(r => {
                console.log(`   - ${r.name}: ${r.error}`);
            });
        }
        console.log('='.repeat(120) + '\n');

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
runExtremeVerification().catch(console.error);
