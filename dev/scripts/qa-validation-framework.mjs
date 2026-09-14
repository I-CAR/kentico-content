#!/usr/bin/env node

/**
 * UNIFIED QA VALIDATION FRAMEWORK
 *
 * Consolidates all validation logic into a single, modular framework.
 * Provides modular validation plugins for different component types.
 *
 * USAGE:
 *   import { ValidationFramework } from './qa-validation-framework.mjs';
 *   const framework = new ValidationFramework(config);
 *   await framework.validate();
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * SHARED CONFIGURATION & CONSTANTS
 */
export const STANDARD_VIEWPORTS = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 }
];

export const DEFAULT_TOLERANCES = {
    visualDiff: 0.05,        // 5% pixel difference allowed
    layoutShift: 10,         // 10px layout shift allowed
    spacingVariance: 4       // 4px spacing variance allowed
};

/**
 * UNIFIED VALIDATION FRAMEWORK
 * 
 * Provides modular validation plugins for different component types.
 * Shared Puppeteer setup, viewport management, and error reporting.
 */
export class ValidationFramework {
    constructor(config = {}) {
        this.config = {
            targetUrl: config.targetUrl || 'http://localhost:4001/get-to-gold-class.html',
            sectionId: config.sectionId || '#stay-ahead',
            screenshotDir: config.screenshotDir || path.join(PROJECT_ROOT, '.qa-screenshots'),
            cacheDir: config.cacheDir || path.join(PROJECT_ROOT, '.qa-cache'),
            viewports: config.viewports || STANDARD_VIEWPORTS,
            tolerances: { ...DEFAULT_TOLERANCES, ...config.tolerances },
            port: config.port || 4001,
            headless: config.headless !== false,
            verbose: config.verbose !== false
        };

        this.browser = null;
        this.page = null;
        this.results = {
            passed: 0,
            failed: 0,
            errors: [],
            details: {}
        };

        // Ensure directories exist
        if (!fs.existsSync(this.config.screenshotDir)) {
            fs.mkdirSync(this.config.screenshotDir, { recursive: true });
        }
        if (!fs.existsSync(this.config.cacheDir)) {
            fs.mkdirSync(this.config.cacheDir, { recursive: true });
        }
    }

    /**
     * SHARED PUPPETEER SETUP
     */
    async initialize() {
        this.browser = await puppeteer.launch({
            headless: this.config.headless ? 'new' : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        this.log('✅ Puppeteer initialized');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.log('✅ Puppeteer closed');
        }
    }

    /**
     * VIEWPORT MANAGEMENT
     */
    async setViewport(viewport) {
        await this.page.setViewport({
            width: viewport.width,
            height: viewport.height
        });
    }

    async navigateTo(url) {
        try {
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            return true;
        } catch (error) {
            this.error(`Navigation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * STRUCTURAL VALIDATION PLUGIN
     * Tests DOM hierarchy, layout behavior, and responsive breakpoints
     */
    async validateStructure(sectionId = this.config.sectionId) {
        this.log(`\n📐 STRUCTURAL VALIDATION`);

        const structureData = await this.page.evaluate((selector) => {
            const section = document.querySelector(selector);
            if (!section) return { exists: false, errors: ['Section not found'] };

            const errors = [];
            const data = {
                exists: true,
                viewport: window.innerWidth,
                section: {
                    id: section.id || section.className,
                    classes: section.className,
                    children: section.children.length
                },
                layout: {},
                content: {},
                errors: []
            };

            // Check for required structural elements
            const container = section.querySelector('.container');
            if (!container) errors.push('Missing .container wrapper');

            const rows = section.querySelectorAll('.row');
            if (rows.length === 0) errors.push('No .row elements found');

            // Analyze layout columns
            const columns = section.querySelectorAll('.col, [class*="col-"]');
            data.layout.columnCount = columns.length;
            data.layout.columnClasses = Array.from(columns).map(col => col.className);

            // Check for content elements
            const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
                data.content.heading = heading.textContent.trim().substring(0, 50);
                data.content.headingLevel = heading.tagName;
            }

            const cards = section.querySelectorAll('[class*="card"], li');
            data.content.cardCount = cards.length;

            const images = section.querySelectorAll('img');
            data.content.imageCount = images.length;

            // Validate responsive behavior
            const computedStyle = window.getComputedStyle(section);
            data.layout.display = computedStyle.display;
            data.layout.flexDirection = computedStyle.flexDirection;
            data.layout.gridTemplateColumns = computedStyle.gridTemplateColumns;

            data.errors = errors;
            return data;
        }, sectionId);

        return structureData;
    }

    /**
     * VISUAL REGRESSION PLUGIN
     * Captures and compares screenshots with tolerance thresholds
     */
    async validateVisual(sectionId = this.config.sectionId, viewportName = 'Desktop') {
        this.log(`\n🎨 VISUAL VALIDATION (${viewportName})`);

        const filename = `${sectionId.replace('#', '')}-${viewportName.toLowerCase()}.png`;
        const filepath = path.join(this.config.screenshotDir, filename);

        try {
            const element = await this.page.$(sectionId);
            if (!element) {
                this.error(`Element not found: ${sectionId}`);
                return { success: false, error: 'Element not found' };
            }

            await element.screenshot({ path: filepath });
            this.log(`✅ Screenshot saved: ${filename}`);

            return { success: true, filepath, filename };
        } catch (error) {
            this.error(`Screenshot failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * FORM VALIDATION PLUGIN
     * Validates form structure, fields, and Salesforce integration
     */
    async validateForm(formSelector = 'form') {
        this.log(`\n📋 FORM VALIDATION`);

        const formData = await this.page.evaluate((selector) => {
            const form = document.querySelector(selector);
            if (!form) return { exists: false, errors: ['Form not found'] };

            const errors = [];
            const data = {
                exists: true,
                action: form.action,
                method: form.method,
                fields: [],
                hiddenFields: [],
                errors: []
            };

            // Validate form fields
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                const fieldData = {
                    name: input.name,
                    type: input.type,
                    required: input.required,
                    label: null
                };

                // Find associated label
                if (input.id) {
                    const label = form.querySelector(`label[for="${input.id}"]`);
                    if (label) fieldData.label = label.textContent.trim();
                }

                if (input.type === 'hidden') {
                    data.hiddenFields.push(fieldData);
                } else {
                    data.fields.push(fieldData);
                }
            });

            // Validate Salesforce integration
            const requiredSalesforceFields = ['oid', 'retURL', 'lead_source', 'Campaign_ID', 'recordType'];
            const hiddenFieldNames = data.hiddenFields.map(f => f.name);
            const missingSalesforceFields = requiredSalesforceFields.filter(f => !hiddenFieldNames.includes(f));

            if (missingSalesforceFields.length > 0) {
                errors.push(`Missing Salesforce fields: ${missingSalesforceFields.join(', ')}`);
            }

            // Validate reCAPTCHA
            const hasRecaptcha = !!form.querySelector('[data-sitekey]') ||
                !!window.grecaptcha ||
                !!document.querySelector('script[src*="recaptcha"]');
            data.hasRecaptcha = hasRecaptcha;

            data.errors = errors;
            return data;
        }, formSelector);

        return formData;
    }

    /**
     * CONTENT VALIDATION PLUGIN
     * Validates that YAML content renders correctly to DOM
     */
    async validateContent(yamlPath) {
        this.log(`\n📝 CONTENT VALIDATION`);

        if (!fs.existsSync(yamlPath)) {
            this.error(`YAML file not found: ${yamlPath}`);
            return { success: false, error: 'YAML file not found' };
        }

        try {
            const yamlContent = fs.readFileSync(yamlPath, 'utf8');
            const data = yaml.load(yamlContent);

            const contentData = await this.page.evaluate(() => {
                return {
                    headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                        .map(h => h.textContent.trim()),
                    paragraphs: Array.from(document.querySelectorAll('p'))
                        .map(p => p.textContent.trim().substring(0, 100)),
                    buttons: Array.from(document.querySelectorAll('button, a[role="button"]'))
                        .map(b => b.textContent.trim()),
                    lists: Array.from(document.querySelectorAll('ul, ol'))
                        .map(l => l.children.length)
                };
            });

            return {
                success: true,
                yamlData: data,
                domContent: contentData
            };
        } catch (error) {
            this.error(`Content validation failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * DOM MATH VALIDATION PLUGIN
     * Validates computed styles against design specifications
     */
    async validateDomMath(selector, expectedStyles = {}) {
        this.log(`\n🔢 DOM MATH VALIDATION`);

        const computedData = await this.page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (!element) return { exists: false };

            const styles = window.getComputedStyle(element);
            return {
                exists: true,
                display: styles.display,
                width: styles.width,
                height: styles.height,
                padding: styles.padding,
                margin: styles.margin,
                fontSize: styles.fontSize,
                lineHeight: styles.lineHeight,
                color: styles.color,
                backgroundColor: styles.backgroundColor,
                borderRadius: styles.borderRadius,
                flexDirection: styles.flexDirection,
                gridTemplateColumns: styles.gridTemplateColumns,
                justifyContent: styles.justifyContent,
                alignItems: styles.alignItems
            };
        }, selector);

        if (!computedData.exists) {
            this.error(`Element not found: ${selector}`);
            return { success: false, error: 'Element not found' };
        }

        // Compare with expected styles
        const mismatches = [];
        Object.entries(expectedStyles).forEach(([key, expectedValue]) => {
            const actualValue = computedData[key];
            if (actualValue !== expectedValue) {
                mismatches.push({
                    property: key,
                    expected: expectedValue,
                    actual: actualValue
                });
            }
        });

        return {
            success: mismatches.length === 0,
            computed: computedData,
            mismatches
        };
    }

    /**
     * RESPONSIVE VALIDATION PLUGIN
     * Validates layout behavior across all viewports
     */
    async validateResponsive(sectionId = this.config.sectionId) {
        this.log(`\n📱 RESPONSIVE VALIDATION`);

        const results = {};

        for (const viewport of this.config.viewports) {
            await this.setViewport(viewport);
            await this.navigateTo(this.config.targetUrl);

            const structureData = await this.validateStructure(sectionId);
            results[viewport.name] = structureData;

            this.log(`  ${viewport.name}: ${structureData.layout.columnCount} columns`);
        }

        return results;
    }

    /**
     * ACCESSIBILITY VALIDATION PLUGIN
     * Validates WCAG compliance and accessibility features
     */
    async validateAccessibility(sectionId = this.config.sectionId) {
        this.log(`\n♿ ACCESSIBILITY VALIDATION`);

        const a11yData = await this.page.evaluate((selector) => {
            const section = document.querySelector(selector);
            if (!section) return { exists: false, errors: [] };

            const errors = [];
            const data = {
                exists: true,
                errors: [],
                issues: []
            };

            // Check for alt text on images
            const images = section.querySelectorAll('img');
            images.forEach((img, idx) => {
                if (!img.alt || img.alt.trim() === '') {
                    data.issues.push(`Image ${idx + 1} missing alt text`);
                }
            });

            // Check for form labels
            const inputs = section.querySelectorAll('input, textarea, select');
            inputs.forEach((input, idx) => {
                if (!input.id || !document.querySelector(`label[for="${input.id}"]`)) {
                    if (input.type !== 'hidden') {
                        data.issues.push(`Input ${idx + 1} missing associated label`);
                    }
                }
            });

            // Check for heading hierarchy
            const headings = section.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let lastLevel = 0;
            headings.forEach((h, idx) => {
                const level = parseInt(h.tagName[1]);
                if (level > lastLevel + 1) {
                    data.issues.push(`Heading hierarchy skip at ${h.tagName}`);
                }
                lastLevel = level;
            });

            // Check for touch targets (44px minimum)
            const buttons = section.querySelectorAll('button, a[role="button"]');
            buttons.forEach((btn, idx) => {
                const rect = btn.getBoundingClientRect();
                if (rect.width < 44 || rect.height < 44) {
                    data.issues.push(`Button ${idx + 1} touch target too small: ${rect.width}x${rect.height}px`);
                }
            });

            // Check for ARIA attributes
            const interactiveElements = section.querySelectorAll('[role], [aria-label], [aria-describedby]');
            data.ariaCount = interactiveElements.length;

            data.errors = data.issues;
            return data;
        }, sectionId);

        return a11yData;
    }

    /**
     * PERFORMANCE VALIDATION PLUGIN
     * Validates performance metrics and resource loading
     */
    async validatePerformance() {
        this.log(`\n⚡ PERFORMANCE VALIDATION`);

        const perfData = await this.page.evaluate(() => {
            const perfEntries = performance.getEntriesByType('navigation')[0];
            const resourceEntries = performance.getEntriesByType('resource');

            return {
                navigationTiming: {
                    domContentLoaded: perfEntries?.domContentLoadedEventEnd - perfEntries?.domContentLoadedEventStart,
                    loadComplete: perfEntries?.loadEventEnd - perfEntries?.loadEventStart,
                    domInteractive: perfEntries?.domInteractive - perfEntries?.fetchStart
                },
                resources: {
                    count: resourceEntries.length,
                    slowRequests: resourceEntries.filter(r => r.duration > 1000).map(r => ({
                        name: r.name.split('/').pop(),
                        duration: Math.round(r.duration)
                    }))
                },
                domSize: {
                    elementCount: document.querySelectorAll('*').length,
                    imageCount: document.querySelectorAll('img').length,
                    scriptCount: document.querySelectorAll('script').length
                }
            };
        });

        return perfData;
    }

    /**
     * MAIN VALIDATION ORCHESTRATOR
     */
    async validate(plugins = ['structure', 'visual', 'responsive']) {
        try {
            await this.initialize();

            for (const viewport of this.config.viewports) {
                this.log(`\n${'='.repeat(80)}`);
                this.log(`📊 VALIDATION: ${viewport.name} (${viewport.width}x${viewport.height})`);
                this.log(`${'='.repeat(80)}`);

                await this.setViewport(viewport);
                if (!await this.navigateTo(this.config.targetUrl)) {
                    this.results.failed++;
                    continue;
                }

                for (const plugin of plugins) {
                    try {
                        switch (plugin) {
                            case 'structure':
                                const structureResult = await this.validateStructure();
                                this.results.details[`${viewport.name}-structure`] = structureResult;
                                if (structureResult.errors.length === 0) this.results.passed++;
                                else this.results.failed++;
                                break;

                            case 'visual':
                                const visualResult = await this.validateVisual();
                                this.results.details[`${viewport.name}-visual`] = visualResult;
                                if (visualResult.success) this.results.passed++;
                                else this.results.failed++;
                                break;

                            case 'form':
                                const formResult = await this.validateForm();
                                this.results.details[`${viewport.name}-form`] = formResult;
                                if (formResult.errors.length === 0) this.results.passed++;
                                else this.results.failed++;
                                break;

                            case 'accessibility':
                                const a11yResult = await this.validateAccessibility();
                                this.results.details[`${viewport.name}-a11y`] = a11yResult;
                                if (a11yResult.issues.length === 0) this.results.passed++;
                                else this.results.failed++;
                                break;

                            case 'performance':
                                const perfResult = await this.validatePerformance();
                                this.results.details[`${viewport.name}-perf`] = perfResult;
                                this.results.passed++;
                                break;
                        }
                    } catch (error) {
                        this.error(`Plugin ${plugin} failed: ${error.message}`);
                        this.results.failed++;
                        this.results.errors.push({ plugin, viewport: viewport.name, error: error.message });
                    }
                }
            }

            this.printSummary();
            return this.results;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * LOGGING & REPORTING
     */
    log(message) {
        if (this.config.verbose) {
            console.log(message);
        }
    }

    error(message) {
        console.error(`❌ ${message}`);
    }

    printSummary() {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 VALIDATION SUMMARY`);
        console.log(`${'='.repeat(80)}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⚠️  Errors: ${this.results.errors.length}`);

        if (this.results.errors.length > 0) {
            console.log(`\nErrors:`);
            this.results.errors.forEach(err => {
                console.log(`  - ${err.plugin} (${err.viewport}): ${err.error}`);
            });
        }

        console.log(`${'='.repeat(80)}\n`);
    }

    /**
     * UTILITY: Save results to JSON
     */
    saveResults(filepath) {
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        this.log(`✅ Results saved to ${filepath}`);
    }
}

export default ValidationFramework;
