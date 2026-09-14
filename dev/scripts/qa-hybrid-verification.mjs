#!/usr/bin/env node

/**
 * HYBRID VERIFICATION FRAMEWORK - ORCHESTRATOR
 * 
 * Uses the unified ValidationFramework to combine three verification layers:
 * 1. STRUCTURAL VALIDATION - DOM hierarchy & layout behavior (no Figma dependency)
 * 2. VISUAL REGRESSION - Screenshot comparison with tolerance thresholds
 * 3. SELECTIVE FIGMA VALIDATION - Content & design tokens (cached, with fallbacks)
 * 
 * This approach eliminates brittleness while maintaining design fidelity.
 * 
 * USAGE:
 *   node dev/scripts/qa-hybrid-verification.mjs
 *   node dev/scripts/qa-hybrid-verification.mjs --section="#benefits"
 *   node dev/scripts/qa-hybrid-verification.mjs --url="http://localhost:4001/custom.html"
 */

import { ValidationFramework, STANDARD_VIEWPORTS, DEFAULT_TOLERANCES } from './qa-validation-framework.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Parse command-line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        targetUrl: 'http://localhost:4001/get-to-gold-class.html',
        sectionId: '#stay-ahead',
        verbose: true
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--section' && args[i + 1]) {
            config.sectionId = args[i + 1];
            i++;
        } else if (args[i] === '--url' && args[i + 1]) {
            config.targetUrl = args[i + 1];
            i++;
        } else if (args[i] === '--quiet') {
            config.verbose = false;
        }
    }

    return config;
}

/**
 * HYBRID VERIFICATION ORCHESTRATOR
 * Runs all three validation layers using the unified framework
 */
async function runHybridVerification() {
    const cliConfig = parseArgs();

    const config = {
        targetUrl: cliConfig.targetUrl,
        sectionId: cliConfig.sectionId,
        screenshotDir: path.join(PROJECT_ROOT, '.qa-screenshots'),
        cacheDir: path.join(PROJECT_ROOT, '.qa-cache'),
        viewports: STANDARD_VIEWPORTS,
        tolerances: DEFAULT_TOLERANCES,
        port: 4001,
        headless: true,
        verbose: cliConfig.verbose
    };

    console.log('🧪 HYBRID VERIFICATION FRAMEWORK');
    console.log('================================================================================');
    console.log('Layers: 1) Structural 2) Visual Regression 3) Content Validation\n');
    console.log(`Target: ${config.targetUrl}`);
    console.log(`Section: ${config.sectionId}`);
    console.log(`Viewports: ${config.viewports.map(v => `${v.name} (${v.width}x${v.height})`).join(', ')}`);
    console.log('================================================================================\n');

    const framework = new ValidationFramework(config);

    try {
        // Run all validation plugins
        const results = await framework.validate([
            'structure',      // Layer 1: Structural validation
            'visual',         // Layer 2: Visual regression
            'content',        // Layer 3: Content validation
            'accessibility'   // Bonus: Accessibility validation
        ]);

        // Print detailed results
        console.log('\n📊 DETAILED RESULTS');
        console.log('================================================================================');

        Object.entries(results.details).forEach(([key, detail]) => {
            console.log(`\n${key}:`);
            if (detail.errors && detail.errors.length > 0) {
                console.log(`  ❌ Errors: ${detail.errors.join(', ')}`);
            } else if (detail.success === false) {
                console.log(`  ❌ Failed: ${detail.error}`);
            } else {
                console.log(`  ✅ Passed`);
            }
        });

        // Exit with appropriate code
        const exitCode = results.failed === 0 ? 0 : 1;
        process.exit(exitCode);

    } catch (error) {
        console.error('💥 Verification failed:', error.message);
        process.exit(1);
    }
}

// Execute
runHybridVerification().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
