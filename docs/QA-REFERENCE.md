# QA Reference: Figma Gatekeeper & CMS Shell Integration

## Overview

This document consolidates QA validation protocols, Figma access enforcement, and CMS shell integration patterns. It serves as a reference for QA automation, validation scripts, and integration testing.

---

## Part 1: Figma Gatekeeper Protocol

### Purpose

The **QA Figma Gatekeeper** enforces mandatory Figma MCP access verification before any QA validation proceeds. This implements hard failure protocol per `.clinerules` Section 19: "Hard Failure on MCP Tool Errors."

### Execution Flow

#### Phase 1: Hard Figma Access Verification
- **Purpose:** Verify Figma MCP is accessible before proceeding
- **Canonical Key:** `80i51JCUKVIrTZ8Zt9y73X` (use Figma Registry instead)
- **Root Node:** `0:1` (canvas root)
- **Timeout:** 10 seconds
- **Failure Behavior:** HALT immediately, state exact MCP error, wait for user intervention

**Success Output:**
```
✅ Figma MCP Access: VERIFIED
   - File Key: [from registry]
   - Root Node: 0:1
   - Accessible: Yes
```

**Failure Output:**
```
🚫 Figma MCP Access: FAILED
   - Error: [Exact MCP error message]
   - Action: HALT - User intervention required
```

#### Phase 2: Design System Extraction
- Extract color palette from Figma
- Extract typography tokens
- Extract spacing scale
- Extract component library structure
- Cache results for Layer 2 validation

#### Phase 3: Sample Page Validation
- Select 3-5 representative pages
- Validate against Figma design tokens
- Check responsive behavior
- Verify content rendering

#### Phase 4: Comprehensive QA Validation
- Run full validation suite
- Check all pages
- Verify all viewports
- Generate report

#### Phase 5: Results Summary & Decision
- **APPROVED:** All validations pass
- **REJECTED:** Failures detected, handoff to frontend-dev

### Hard Failure Rules

**NO SILENT FALLBACKS:**
- If Figma MCP fails, HALT immediately
- State exact error message
- Wait for user intervention
- Do NOT use cached data as fallback
- Do NOT skip validation

**MANDATORY FIRST STEP:**
- Execute Figma gatekeeper before any validation
- Verify access before proceeding
- Cache design tokens for Layer 2
- Report access status clearly

### Implementation

**Script Location:** [`dev/scripts/qa-figma-gatekeeper.mjs`](../dev/scripts/qa-figma-gatekeeper.mjs)

**Usage:**
```bash
node dev/scripts/qa-figma-gatekeeper.mjs
```

**Exit Codes:**
- `0` - All validations passed
- `1` - Figma access failed (hard stop)
- `2` - Validation failed (handoff to frontend-dev)

---

## Part 2: Comprehensive QA Audit Protocol

### Mandatory Checklist

#### 1. HTML Structure Validation
- ✅ Verify proper `<html>`, `<head>`, `<body>`, `<main>` elements exist
- ✅ Files with only CSS/JS and no body content are CRITICAL FAILURES
- ✅ Check semantic HTML structure
- ✅ Verify proper nesting

**Failure Example:**
```
❌ CRITICAL: Missing <main> element
File: cms/get-to-gold-class.html
Expected: <main> wrapper around page content
Got: Content directly in <body>
```

#### 2. Content Rendering Verification
- ✅ Confirm YAML content renders to DOM
- ✅ Missing bullets, badges, H3 elements indicate template failures
- ✅ Check all text nodes render
- ✅ Verify form fields present

**Failure Example:**
```
❌ FAILED: Content rendering
Expected: 3 bullet points in benefits section
Got: 0 bullet points
File: cms/about-us.html:234
Cause: Template not rendering YAML array
```

#### 3. Salesforce Integration Audit
- ✅ Verify required hidden fields present:
  - `oid` (Organization ID)
  - `retURL` (Return URL)
  - `lead_source` (Lead Source)
  - `Campaign_ID` (Campaign ID)
  - `recordType` (Record Type)
- ✅ Check form action URL
- ✅ Verify reCAPTCHA v3 integration

**Failure Example:**
```
❌ FAILED: Salesforce integration
Missing hidden field: oid
File: cms/contact-form.html:156
Required for: Lead capture
```

#### 4. SEO Metadata Validation
- ✅ Check page title (50-60 characters)
- ✅ Meta description (150-160 characters)
- ✅ Open Graph tags (og:title, og:description, og:image)
- ✅ Canonical URLs
- ✅ Lang attributes

**Failure Example:**
```
❌ FAILED: SEO metadata
Missing: og:image tag
File: cms/about-us.html:12
Impact: Social media sharing broken
```

#### 5. Analytics Implementation
- ✅ Google Analytics tracking code
- ✅ GTM (Google Tag Manager) integration
- ✅ Conversion tracking pixels
- ✅ Event tracking implementation
- ✅ User ID tracking (if applicable)

**Failure Example:**
```
❌ FAILED: Analytics
Missing: Google Analytics tracking code
File: cms/index.html:8
Impact: No traffic data collected
```

#### 6. Accessibility Compliance
- ✅ WCAG touch targets (44px minimum)
- ✅ Alt text on images
- ✅ ARIA attributes on interactive elements
- ✅ Keyboard navigation support
- ✅ Screen reader compatibility

**Failure Example:**
```
❌ FAILED: Accessibility
Touch target too small: 32px (min 44px)
Element: .cta-button
File: cms/hero.html:45
Impact: Mobile users cannot tap button
```

#### 7. Performance Analysis
- ✅ Unoptimized images (> 500KB)
- ✅ Missing lazy loading
- ✅ Large DOM size (> 1500 nodes)
- ✅ Slow resource loading (> 3s)
- ✅ Render-blocking resources

**Failure Example:**
```
❌ FAILED: Performance
Unoptimized image: hero.jpg (2.3MB)
File: cms/hero.html:67
Impact: Slow page load on mobile
```

#### 8. Security Review
- ✅ HTTPS enforcement
- ✅ Privacy policy links
- ✅ CSRF protection tokens
- ✅ Input sanitization
- ✅ No hardcoded credentials

**Failure Example:**
```
❌ FAILED: Security
Missing: CSRF token in form
File: cms/contact-form.html:89
Impact: Vulnerable to CSRF attacks
```

#### 9. Mobile-Specific Validation
- ✅ Viewport meta tag
- ✅ Touch target sizes (44px minimum)
- ✅ Horizontal scroll prevention
- ✅ Responsive breakpoints (375px, 768px, 1440px)
- ✅ Mobile-optimized spacing

**Failure Example:**
```
❌ FAILED: Mobile layout
Horizontal scroll detected on 375px viewport
File: cms/hero.html
Cause: Fixed width container (1200px)
```

#### 10. Third-Party Integration Check
- ✅ Google Fonts loading
- ✅ Bootstrap CSS/JS
- ✅ jQuery (if used)
- ✅ reCAPTCHA integration
- ✅ Social media embeds

**Failure Example:**
```
❌ FAILED: Third-party integration
Google Fonts not loading
File: cms/index.html:14
Status: 404 Not Found
Impact: Typography broken
```

#### 11. Console Error Monitoring
- ✅ JavaScript errors
- ✅ CSS errors
- ✅ Network failures
- ✅ Browser warnings
- ✅ Deprecation notices

**Failure Example:**
```
❌ FAILED: Console errors
JavaScript error: Uncaught TypeError
Message: Cannot read property 'addEventListener' of null
File: script.js:234
Impact: Interactive features broken
```

#### 12. Network Request Analysis
- ✅ 404 errors (missing resources)
- ✅ Slow requests (> 3s)
- ✅ Missing resources
- ✅ CDN failures
- ✅ Failed API calls

**Failure Example:**
```
❌ FAILED: Network requests
404 Not Found: /css/style.css
File: cms/index.html:8
Impact: Styles not applied
```

---

## Part 3: CMS Shell Integration

### Shell Structure Reference

The CMS shell provides the wrapper around rendered page content:

```html
<head id="head">
  <!-- Meta tags, canonical, favicon -->
  <!-- Vendor CSS (Bootstrap, etc.) -->
  <!-- Kentico CSS -->
  <!-- Google CSE assets -->
  <!-- Inline critical styles -->
</head>

<body>
  <div class="pageWrap">
    <header class="header">
      <div class="header-inner">
        <div class="header-main">
          <div class="header-logo"><!-- Logo --></div>
          <div class="c-search"><!-- Search --></div>
          <div class="header-login"><!-- Login --></div>
        </div>
        <nav class="c-nav--main"><!-- Navigation --></nav>
      </div>
    </header>

    <main>
      <div class="zoneMainContent">
        <div class="pdp container">
          <article>
            <div class="breadcrumb"><!-- Breadcrumbs --></div>
            <div class="content no-right-rail">
              <!-- Page content sections -->
            </div>
          </article>
        </div>
      </div>
    </main>

    <footer><!-- Footer --></footer>
  </div>
</body>
```

### CSS Integration Points

**Inline Styles (for Kentico):**
```html
<style>
  /* Critical CSS for above-the-fold content */
  .ic-section { /* ... */ }
  .ic-hero { /* ... */ }
</style>
```

**External CSS (for Port 4001 testing):**
```html
<link rel="stylesheet" href="style-cms.css">
<link rel="stylesheet" href="figma-overrides.css">
```

### Content Injection Points

**Main Content Area:**
```html
<div class="content no-right-rail">
  <!-- Generated page content from YAML -->
  <!-- Sections, cards, forms, etc. -->
</div>
```

**Form Integration:**
```html
<form method="POST" action="https://webto.salesforce.com/servlet/servlet.WebToLead">
  <!-- Hidden Salesforce fields -->
  <!-- Form fields from YAML -->
  <!-- reCAPTCHA v3 -->
</form>
```

---

## Validation Script Reference

### Primary Script
- **Location:** [`dev/scripts/qa-hybrid-verification.mjs`](../dev/scripts/qa-hybrid-verification.mjs)
- **Purpose:** Three-layer verification (structural, visual, content)
- **Usage:** `node dev/scripts/qa-hybrid-verification.mjs`

### Gatekeeper Script
- **Location:** [`dev/scripts/qa-figma-gatekeeper.mjs`](../dev/scripts/qa-figma-gatekeeper.mjs)
- **Purpose:** Figma access verification before validation
- **Usage:** `node dev/scripts/qa-figma-gatekeeper.mjs`

### Specialized Scripts
- **Form Validation:** `dev/scripts/qa-form-validation.mjs`
- **DOM Validation:** `dev/scripts/qa-dom-validation.mjs`
- **Benefits Validation:** `dev/scripts/qa-benefits-validation.mjs`

---

## Error Reporting Template

**Use this format for all QA failures:**

```
❌ FAILED: [Component/Feature Name]

Expected: [What should happen]
Got: [What actually happened]

File: [Path to file]:[Line number]
Viewport: [1440px / 768px / 375px]

Root Cause: [Why it failed]
Impact: [What breaks as a result]

Fix: [Specific action to resolve]
Priority: [Critical / High / Medium / Low]
```

---

## Best Practices

1. **Always run Figma gatekeeper first**: Verify access before validation
2. **Use specific error messages**: Include file paths and line numbers
3. **Report actionable failures**: Include specific fixes, not vague descriptions
4. **Test all viewports**: Desktop, tablet, mobile
5. **Check console errors**: JavaScript errors break functionality
6. **Verify Salesforce integration**: Forms must have all required fields
7. **Monitor performance**: Large images and slow requests impact UX
8. **Document known issues**: Keep log of expected failures

---

## Questions?

For issues or questions about QA validation:
1. Check this documentation
2. Review validation script output
3. Check console errors in browser
4. Review Figma design tokens
5. Check CMS shell structure
