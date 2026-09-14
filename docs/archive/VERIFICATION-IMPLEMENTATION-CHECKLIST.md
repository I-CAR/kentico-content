# Hybrid Verification Implementation Checklist

## Phase 1: Setup & Configuration

### 1.1 Create Verification Directories
- [ ] Verify `.qa-screenshots/` directory exists (auto-created by script)
- [ ] Verify `.qa-cache/` directory exists (auto-created by script)
- [ ] Add to `.gitignore`:
  ```
  .qa-screenshots/
  .qa-cache/
  ```

### 1.2 Install Dependencies
- [ ] Verify `puppeteer` is in `package.json`
- [ ] Verify `js-yaml` is in `package.json`
- [ ] Run `npm install` to ensure all dependencies present

### 1.3 Verify Port 4001 Setup
- [ ] Confirm Python HTTP server running on Port 4001
- [ ] Test: `curl http://localhost:4001/get-to-gold-class.html`
- [ ] Verify CSS files accessible: `curl http://localhost:4001/style-cms.css`

---

## Phase 2: Create Component-Specific Verification Scripts

### 2.1 Template for New Component Verification

Create `dev/scripts/qa-component-template.mjs`:

```javascript
#!/usr/bin/env node

/**
 * Component Verification Template
 * Copy this file and customize for each component
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const CONFIG = {
  targetUrl: 'http://localhost:4001/PAGE-NAME.html',
  sectionId: '#SECTION-ID',
  screenshotDir: path.join(PROJECT_ROOT, '.qa-screenshots'),
  
  viewports: [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 }
  ],
  
  tolerances: {
    visualDiff: 0.05,
    layoutShift: 10,
    spacingVariance: 4
  }
};

// CUSTOMIZE: Define expected structure for your component
const EXPECTED_STRUCTURE = {
  heading: true,           // Component has h2/h3
  cardCount: 3,            // Expected number of cards
  imageCount: 1,           // Expected number of images
  columnLayout: {
    desktop: 3,            // 3 columns on desktop
    tablet: 2,             // 2 columns on tablet
    mobile: 1              // 1 column on mobile
  }
};

async function validateComponentStructure(page, viewport) {
  console.log(`\n📐 STRUCTURAL VALIDATION (${viewport.name})`);
  
  const data = await page.evaluate((sectionId, expected) => {
    const section = document.querySelector(sectionId);
    if (!section) return { exists: false, errors: [] };

    const errors = [];
    const result = {
      exists: true,
      heading: !!section.querySelector('h2, h3'),
      cardCount: section.querySelectorAll('[class*="card"], li').length,
      imageCount: section.querySelectorAll('img').length,
      errors: []
    };

    // Validate expected structure
    if (expected.heading && !result.heading) {
      errors.push('Missing heading element');
    }
    if (expected.cardCount > 0 && result.cardCount !== expected.cardCount) {
      errors.push(`Expected ${expected.cardCount} cards, found ${result.cardCount}`);
    }
    if (expected.imageCount > 0 && result.imageCount !== expected.imageCount) {
      errors.push(`Expected ${expected.imageCount} images, found ${result.imageCount}`);
    }

    result.errors = errors;
    return result;
  }, CONFIG.sectionId, EXPECTED_STRUCTURE);

  if (!data.exists) {
    console.log('  ❌ Section not found');
    return { passed: false };
  }

  console.log(`  ✅ Section found`);
  console.log(`     - Heading: ${data.heading ? '✓' : '✗'}`);
  console.log(`     - Cards: ${data.cardCount}/${EXPECTED_STRUCTURE.cardCount}`);
  console.log(`     - Images: ${data.imageCount}/${EXPECTED_STRUCTURE.imageCount}`);

  if (data.errors.length > 0) {
    console.log(`  ❌ Issues:`);
    data.errors.forEach(err => console.log(`     - ${err}`));
    return { passed: false };
  }

  console.log('  ✅ Structure validation passed');
  return { passed: true };
}

async function runVerification() {
  console.log('🧪 COMPONENT VERIFICATION');
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let passed = true;

  try {
    console.log(`🌐 Loading: ${CONFIG.targetUrl}`);
    await page.goto(CONFIG.targetUrl, { waitUntil: 'networkidle0' });
    console.log('✅ Page loaded\n');

    for (const viewport of CONFIG.viewports) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`VIEWPORT: ${viewport.name}`);
      console.log('='.repeat(80));

      await page.setViewport({ width: viewport.width, height: viewport.height });
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await validateComponentStructure(page, viewport);
      if (!result.passed) passed = false;
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    passed = false;
  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  return passed;
}

runVerification()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
```

### 2.2 Create Component-Specific Scripts

For each major component, create a verification script:

- [ ] `dev/scripts/qa-hero-section.mjs` - Hero sections
- [ ] `dev/scripts/qa-card-grid.mjs` - Card grids
- [ ] `dev/scripts/qa-forms.mjs` - Form sections
- [ ] `dev/scripts/qa-testimonials.mjs` - Testimonial sections
- [ ] `dev/scripts/qa-footer.mjs` - Footer sections

---

## Phase 3: Baseline Management

### 3.1 Initial Baseline Creation

```bash
# Build all assets
npm run build:css
node dev/scripts/build-cms-inline.mjs

# Create baselines for all components
node dev/scripts/qa-hybrid-verification.mjs
node dev/scripts/qa-hero-section.mjs
node dev/scripts/qa-card-grid.mjs
# ... etc

# Commit baselines
git add .qa-screenshots/
git commit -m "Initial visual regression baselines"
```

### 3.2 Baseline Update Workflow

When you intentionally change a component's design:

```bash
# 1. Make design changes
# 2. Build and verify
npm run build:css
node dev/scripts/build-cms-inline.mjs

# 3. Run verification (will fail due to visual diff)
node dev/scripts/qa-hybrid-verification.mjs

# 4. Review changes are intentional
# 5. Update baselines
rm .qa-screenshots/*-baseline.png

# 6. Regenerate baselines
node dev/scripts/qa-hybrid-verification.mjs

# 7. Commit
git add .qa-screenshots/
git commit -m "Update visual baselines - new color scheme for hero section"
```

### 3.3 Baseline Versioning

Track baseline changes in commit history:

```bash
# View baseline history
git log --oneline .qa-screenshots/

# Compare baseline changes
git diff HEAD~1 .qa-screenshots/desktop-baseline.png
```

---

## Phase 4: Integration with Build Pipeline

### 4.1 Update `package.json` Scripts

```json
{
  "scripts": {
    "build": "npm run build:css && node dev/scripts/build-cms-inline.mjs",
    "verify": "node dev/scripts/qa-hybrid-verification.mjs",
    "verify:all": "npm run verify && node dev/scripts/qa-hero-section.mjs && node dev/scripts/qa-card-grid.mjs",
    "verify:watch": "nodemon --watch cms --watch content --exec 'npm run verify'",
    "pre-commit": "npm run build && npm run verify"
  }
}
```

### 4.2 Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🧪 Running verification before commit..."
npm run verify

if [ $? -ne 0 ]; then
  echo "❌ Verification failed. Commit aborted."
  exit 1
fi

echo "✅ Verification passed. Proceeding with commit."
exit 0
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### 4.3 CI/CD Integration

Update GitHub Actions workflow:

```yaml
name: Verify Components

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build assets
        run: npm run build
      
      - name: Start server
        run: |
          python3 -m http.server 4001 --directory cms &
          sleep 2
      
      - name: Run verification
        run: npm run verify:all
      
      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: verification-screenshots
          path: .qa-screenshots/
```

---

## Phase 5: Monitoring & Maintenance

### 5.1 Track Verification Metrics

Create `dev/scripts/qa-metrics.mjs`:

```javascript
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const screenshotDir = '.qa-screenshots';
const metricsFile = '.qa-metrics.json';

function captureMetrics() {
  const files = fs.readdirSync(screenshotDir);
  const metrics = {
    timestamp: new Date().toISOString(),
    screenshots: files.length,
    baselines: files.filter(f => f.includes('baseline')).length,
    current: files.filter(f => f.includes('current')).length
  };

  let history = [];
  if (fs.existsSync(metricsFile)) {
    history = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
  }

  history.push(metrics);
  fs.writeFileSync(metricsFile, JSON.stringify(history, null, 2));

  console.log('📊 Verification Metrics');
  console.log(`  Screenshots: ${metrics.screenshots}`);
  console.log(`  Baselines: ${metrics.baselines}`);
  console.log(`  Current: ${metrics.current}`);
}

captureMetrics();
```

### 5.2 Variance Tracking

Monitor visual variance trends:

```bash
# Run verification and capture variance
node dev/scripts/qa-hybrid-verification.mjs 2>&1 | grep "variance" > .qa-variance.log

# View trend
cat .qa-variance.log
# Output:
# Visual regression check passed (2.3% variance)
# Visual regression check passed (2.4% variance)
# Visual regression check passed (3.1% variance) ← Investigate
```

### 5.3 Failure Investigation Workflow

When verification fails:

```bash
# 1. Check which layer failed
node dev/scripts/qa-hybrid-verification.mjs

# 2. If structural failure:
#    - Check HTML structure in browser DevTools
#    - Verify YAML content is correct
#    - Check responsive classes

# 3. If visual failure:
#    - Compare screenshots: .qa-screenshots/desktop-current.png vs baseline
#    - Check CSS changes in git diff
#    - Verify no unintended style changes

# 4. If content failure:
#    - Check YAML file matches rendered content
#    - Verify template builder renders all items
#    - Check for CSS display: none hiding content

# 5. Fix issue and re-run
npm run build
npm run verify
```

---

## Phase 6: Team Workflow

### 6.1 Developer Checklist

Before pushing code:

```bash
# 1. Make changes to YAML/SCSS/templates
# 2. Build
npm run build

# 3. Verify locally
npm run verify

# 4. If verification fails:
#    - Fix issues
#    - Rebuild
#    - Re-verify
#    - Repeat until passing

# 5. If intentional design change:
#    - Update baselines
#    - Commit with explanation

# 6. Push
git push
```

### 6.2 Code Review Checklist

When reviewing PRs:

- [ ] Verification passed in CI/CD
- [ ] No new baseline changes without explanation
- [ ] Structural tests pass on all viewports
- [ ] Visual regression within tolerance
- [ ] Content matches YAML source

### 6.3 Baseline Change Review

When reviewing baseline updates:

```bash
# View what changed
git diff HEAD~1 .qa-screenshots/

# Compare screenshots visually
# (Use image diff tool or manual inspection)

# Verify change is intentional
# Ask: "Why did this baseline change?"
# Answer should be: "We updated the color scheme" or similar
```

---

## Phase 7: Troubleshooting Guide

### Issue: "Visual difference detected: 8.5%"

**Checklist:**
- [ ] Is this an intentional design change?
- [ ] Check git diff for CSS changes
- [ ] If intentional, update baseline
- [ ] If unintentional, revert CSS changes

**Fix:**
```bash
# If intentional
rm .qa-screenshots/*-baseline.png
npm run verify
git add .qa-screenshots/
git commit -m "Update baselines - intentional design change"

# If unintentional
git checkout dev/assets/css/scss/
npm run build
npm run verify
```

### Issue: "Columns not stacking properly (Mobile)"

**Checklist:**
- [ ] Check Bootstrap classes: `.col-12` for mobile
- [ ] Verify media queries in SCSS
- [ ] Check for hardcoded widths
- [ ] Verify no `display: none` on mobile

**Fix:**
```bash
# Check HTML structure
grep -A 10 "id=\"stay-ahead\"" cms/get-to-gold-class.html

# Check SCSS media queries
grep -A 5 "@media" dev/assets/css/scss/layout/_sections.scss

# Rebuild and verify
npm run build
npm run verify
```

### Issue: "Content validation failed: Card count mismatch"

**Checklist:**
- [ ] YAML has correct `items` array
- [ ] Template builder renders all items
- [ ] No CSS `display: none` hiding cards
- [ ] Check for conditional rendering

**Fix:**
```bash
# Check YAML
cat content/pages/get-to-gold-class.yaml | grep -A 20 "stay-ahead"

# Check template
grep -A 30 "stay-ahead" dev/scripts/build-pages.mjs

# Rebuild and verify
npm run build
npm run verify
```

### Issue: "Section not found in DOM"

**Checklist:**
- [ ] Port 4001 running: `lsof -i :4001`
- [ ] HTML file exists: `ls cms/get-to-gold-class.html`
- [ ] Section ID correct: `grep "id=\"stay-ahead\"" cms/get-to-gold-class.html`

**Fix:**
```bash
# Start server
python3 -m http.server 4001 --directory cms &

# Rebuild HTML
node dev/scripts/build-cms-inline.mjs

# Verify
npm run verify
```

---

## Phase 8: Documentation

### 8.1 Component Documentation Template

For each component, create `docs/COMPONENT-NAME.md`:

```markdown
# Component: Stay Ahead Section

## Purpose
Displays 3 key benefits in a grid layout with icons.

## Verification Strategy
- **Structural:** 3 cards render on desktop, 2 on tablet, 1 on mobile
- **Visual:** Screenshot comparison with 5% tolerance
- **Content:** Card text matches YAML source

## Expected Structure
- Heading: h2 with title
- Cards: 3 list items with icons
- Images: 1 background image

## Responsive Behavior
- Desktop (1440px): 3 columns
- Tablet (768px): 2 columns
- Mobile (375px): 1 column

## Verification Script
```bash
node dev/scripts/qa-stay-ahead-validation.mjs
```

## Known Issues
- None currently

## Last Updated
2026-09-14
```

### 8.2 Verification Status Dashboard

Create `docs/VERIFICATION-STATUS.md`:

```markdown
# Verification Status Dashboard

## Components

| Component | Structural | Visual | Content | Last Verified |
|-----------|-----------|--------|---------|---------------|
| Stay Ahead | ✅ | ✅ | ✅ | 2026-09-14 |
| Hero Section | ✅ | ✅ | ✅ | 2026-09-14 |
| Card Grid | ✅ | ✅ | ✅ | 2026-09-14 |
| Forms | ✅ | ⚠️ | ✅ | 2026-09-13 |
| Footer | ✅ | ✅ | ✅ | 2026-09-14 |

## Recent Changes

- 2026-09-14: Updated visual baselines for hero section
- 2026-09-13: Fixed mobile stacking in card grid
- 2026-09-12: Added form validation

## Pending Issues

- [ ] Form visual regression (8.2% variance)
- [ ] Investigate footer spacing on tablet
```

---

## Completion Checklist

- [ ] Phase 1: Setup & Configuration complete
- [ ] Phase 2: Component-specific scripts created
- [ ] Phase 3: Baselines established
- [ ] Phase 4: Build pipeline integrated
- [ ] Phase 5: Monitoring setup
- [ ] Phase 6: Team workflow documented
- [ ] Phase 7: Troubleshooting guide available
- [ ] Phase 8: Documentation complete
- [ ] All team members trained
- [ ] CI/CD pipeline updated
- [ ] Pre-commit hooks installed
- [ ] Baseline versioning in git

---

## Next Steps

1. **Immediate:** Run Phase 1-3 setup
2. **This Week:** Integrate with CI/CD (Phase 4)
3. **Next Week:** Train team on workflow (Phase 6)
4. **Ongoing:** Monitor metrics and adjust tolerances (Phase 5)
