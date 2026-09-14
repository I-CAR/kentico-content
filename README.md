# I-CAR Kentico Info Pages

A modern, component-driven Kentico headless CMS content management system with YAML-first architecture, automated validation, and multi-agent workflow orchestration.

## Quick Start

**For Content Authors:**
```bash
npm run watch
```
Watches page source files and rebuilds previews and CMS output.

**For Developers:**
```bash
npm run dev
```
Watches pages, CSS, JavaScript, and CMS output with live rebuilds.

**For Production:**
```bash
npm run build
```
Full build pipeline: template sync, validation, CSS/JS compilation, and CMS output generation.

---

## Project Overview

This repository manages I-CAR's content pages through a strict separation of concerns:

- **`content/pages/`** — Working source of truth for all page content (`.json`, `.yaml`, `.yml`)
- **`content/templates/`** — Structural skeletons that define page layouts
- **`content/legacy/`** — Archived pre-pipeline static HTML for reference
- **`cms/`** — Generated CMS-ready HTML output (do not edit by hand)
- **`previews/`** — Local preview HTML rendered from content sources
- **`dev/`** — Development assets, build scripts, and configuration

### Core Architecture Laws

1. **Zero HTML in Content:** YAML/JSON data files MUST NOT contain raw HTML tags, `bodyHtml` strings, or inline styling. All markup is controlled via structured properties (`variant`, `backgroundTheme`, etc.).
2. **Template Skeletons:** Templates define structure only (`slug`, `title`, `sections`). Content lives in page files.
3. **Component-Driven CMS:** UI components are designed first; CMS models map directly to them.
4. **Style Modernization:** Legacy HTML classes map to modern SCSS equivalents via the Style Dictionary.

---

## Directory Structure

### Content Management

#### `content/pages/`
Working source of truth for CMS-ready page generation. Supports `.json`, `.yaml`, and `.yml` formats.

**Two authoring patterns:**

1. **Structured Page Source** — Content lives directly in the file:
   ```yaml
   slug: about-us/careers
   title: Careers
   sections:
     - id: hero
       type: hero
       heading: "Join Our Team"
       paragraphs: ["We're hiring..."]
   ```

2. **Wrapper + HTML Fragment** — Content lives in a sibling `*.main.html`:
   ```json
   {
     "slug": "gold-class",
     "title": "Gold Class",
     "sections": [
       {
         "type": "html",
         "sourceHtmlFile": "./gold-class.main.html"
       }
     ]
   }
   ```

#### `content/templates/`
Lightweight template source defining page structure. Templates are the source of truth for page layout.

**Template Format:**
```yaml
slug: page-slug
title: Page Title
sections:
  - id: hero
    type: hero
  - id: page-nav
    type: pageNav
  - id: overview
    type: textMedia
    variant: reverse
  - id: highlights
    type: cards
  - id: next-step
    type: cta
```

**Template Rules:**
- Every section requires `id` and `type`
- `variant` is optional (defaults to `default`)
- No additional top-level keys beyond `slug`, `title`, `sections`
- No additional section keys beyond `id`, `type`, `variant`
- Templates are synced into `content/pages/` via `npm run pages`
- Template-managed pages retain `__template` metadata for sync tracking

#### `content/legacy/`
Archived pre-pipeline static HTML pages preserved for source comparison and pattern lookup. Use as reference only; do not edit for production.

### Build Output

#### `cms/`
Generated CMS-ready HTML output mirroring the `content/pages/` tree. **Do not hand-edit.**

Output format:
- External `<link>` tags
- Inline `<style>` blocks
- Page section HTML
- `<script>` tags (optionally split to `.scripts.html` files)
- Comments stripped, attributes normalized

#### `previews/`
Generated local preview HTML rendered from `content/pages/`. Includes:
- `previews/documentation/component-library.html` — Live reference of reusable section patterns
- `previews/documentation/style-guide.html` — Typography, buttons, colors, and common styling

### Development Assets

#### `dev/assets/css/`

**SCSS Source (`dev/assets/css/scss/`):**
- `style-cms.scss` — Main CMS stylesheet
- `style-cms-swiper.scss` — Swiper carousel styles
- `style.scss` — General preview styles

**SCSS Architecture:**
```
abstracts/          — Tokens, breakpoints, mixins, animations
base/               — Base styles, typography, media, tables
components/         — Buttons, cards, forms, boxes, sliders, etc.
integrations/       — Bootstrap overrides, CMS shell, Kentico forms
layout/             — Grid, sections, header, anchors
utilities/          — Backgrounds, helpers
```

**Compiled Output:**
- `style-cms.css` — Production CMS stylesheet
- `style.css` — Production preview stylesheet
- `bootstrap-cms-compat.css` — Bootstrap compatibility layer
- `bootstrap-subset.css` — Bootstrap subset for legacy pages
- `legacy/style-legacy.css` — Legacy page fallback styles (read-only)

#### `dev/assets/js/`

**Source (`dev/assets/js/src/`):**
- `index-cms.js` — CMS bundle entry
- `index-cms-bootstrap.js` — CMS + Bootstrap bundle
- `index-cms-swiper.js` — CMS + Swiper bundle
- `index.js` — General preview bundle

**Features:**
- `features/hero-links-dropdown.js` — Hero section dropdown navigation
- `features/recaptcha.js` — reCAPTCHA v3 integration
- `features/runtime-iframe-embeds.js` — Dynamic iframe embedding
- `features/swatches.js` — Color/style swatch selection
- `features/swiper-*.js` — Swiper carousel variants

**Compiled Output:**
- `script-cms.js` — Production CMS bundle
- `script-cms-bootstrap.js` — CMS + Bootstrap bundle
- `script-cms-swiper.js` — CMS + Swiper bundle
- `script.js` — Production preview bundle

#### `dev/config/`
- `.prettierrc.json` — Code formatter configuration
- `.stylelintrc.cjs` — SCSS linter configuration

#### `dev/scripts/`
Build and development automation scripts (see **Build Pipeline** section below).

#### `dev/docs/`
- `cms-shell-reference.md` — CMS shell spacing and wrapper behavior reference

---

## Supported Section Types

All section types support optional `variant` and `spacing` properties:

| Type | Variants | Purpose |
|------|----------|---------|
| `hero` | `default`, `banner`, `split` | Page hero/banner sections |
| `pageNav` | `default` | Auto-generated page navigation |
| `cards` | `default` | Card grid layouts |
| `text` | `default` | Text-only sections |
| `textMedia` | `default`, `reverse` | Text + image combinations |
| `statementList` | `default`, `start` | Statement/quote lists |
| `quote` | `default`, `side-by-side`, `compact` | Quote sections |
| `quoteGrid` | `default`, `static` | Quote grid layouts |
| `profileGrid` | `default` | Profile/team grids |
| `mediaFeatureList` | `default` | Media + feature lists |
| `iconCardGrid` | `default` | Icon + card grids |
| `logoGrid` | `default` | Logo grids |
| `stickyCards` | `default` | Sticky card layouts |
| `legal` | `default` | Legal/compliance sections |
| `cta` | `default` | Call-to-action sections |
| `accordion` | `default` | Accordion/collapsible sections |
| `embed` | `default` | Iframe/embed sections |
| `mediaSlider` | `default` | Media carousel sections |
| `html` | `default` | Raw HTML fragments |

### Spacing Properties

Most sections support spacing adjustments:
```yaml
spacing:
  paddingTop: "none"        # Remove top padding
  paddingTop: "none-lg"     # Remove on large screens
  paddingBottom: "none"     # Remove bottom padding
```

### Hero Section Options

```yaml
- id: hero
  type: hero
  variant: "banner"         # Full-bleed banner
  variant: "split"          # Split text/image
  headingTag: "h1"          # Use h1 instead of default
  imageStyle: "rounded"     # Rounded corners
  imageStyle: "banner"      # Banner style
  image:
    loading: "eager"        # Eager or lazy loading
    output:
      imgWidth: 800
      srcWidth: 1600
```

### TextMedia Section Options

```yaml
- id: overview
  type: textMedia
  variant: "reverse"        # Image on left
  layout:
    imageStyle: "rounded"   # Rounded corners
    imageStyle: "cutout"    # Cutout style
    imageRounded: false     # Disable default rounding
```

### Quote Section Options

```yaml
- id: quote
  type: quote
  quoteLayout: "stacked"    # Stacked layout
  quoteLayout: "side-by-side"
  centerIntro: true         # Center intro copy
  cite:
    titleHtml: "Title&nbsp;Name"  # Exact inline markup
```

---

## Build Pipeline

### Core Build Scripts

#### [`dev/scripts/build-pages.mjs`](dev/scripts/build-pages.mjs)
Renders `content/pages/**/*.{json,yaml,yml}` into preview HTML and validates page structure.

**Features:**
- Template sync before preview generation
- Zod schema validation (no inline HTML, no unapproved keys)
- Watch mode support (`--watch`)
- Automatic template-managed page sync

#### [`dev/scripts/build-cms-inline.mjs`](dev/scripts/build-cms-inline.mjs)
Generates CMS-ready HTML output with inlined styles and scripts.

**Features:**
- Inline CSS and JavaScript
- Optional separate script handoff (`.scripts.html` files)
- Watch mode support (`--watch`)
- Production minification

#### [`dev/scripts/build-style-v3.mjs`](dev/scripts/build-style-v3.mjs)
Compiles SCSS to CSS with PostCSS processing.

**Features:**
- SCSS compilation via Sass
- Autoprefixer for browser compatibility
- CSSNano minification in production
- Source maps in development
- Watch mode support (`--watch`)

#### [`dev/scripts/build-js.mjs`](dev/scripts/build-js.mjs)
Bundles JavaScript with esbuild.

**Features:**
- Multiple entry points (CMS, preview, Swiper, Bootstrap variants)
- Tree-shaking and minification
- Source maps in development
- Watch mode support (`--watch`)

### Validation & Audit Scripts

#### [`dev/scripts/schema-validation.mjs`](dev/scripts/schema-validation.mjs)
Zod-based schema validation enforcing strict structure.

**Validates:**
- No inline HTML in data fields
- No unapproved keys
- Correct section types
- Valid button variants, hero variants, background themes
- Proper image loading attributes
- Valid icon keys

#### [`dev/scripts/validate-dom-math-enhanced.mjs`](dev/scripts/validate-dom-math-enhanced.mjs)
Headless Puppeteer DOM math verification across viewports.

**Tests:**
- Desktop (1440px) computed styles
- Mobile (375px) computed styles
- Container widths, grid gaps, typography
- Responsive scaling verification

#### [`dev/scripts/qa-dom-validation.mjs`](dev/scripts/qa-dom-validation.mjs)
Comprehensive QA validation suite.

**Checks:**
- HTML structure validity
- Proper closing tags
- Syntax errors
- Broken pages

#### [`dev/scripts/shadow-dom-diffing.mjs`](dev/scripts/shadow-dom-diffing.mjs)
Programmatic shadow diffing between legacy HTML and modern YAML output.

**Verifies:**
- 100% content retention
- Visual fidelity
- No regressions

### Utility Scripts

#### [`dev/scripts/generate-templates.mjs`](dev/scripts/generate-templates.mjs)
Generates template-managed pages from template definitions.

#### [`dev/scripts/page-dependencies.mjs`](dev/scripts/page-dependencies.mjs)
Analyzes page dependencies (Bootstrap, jQuery, legacy CSS usage).

#### [`dev/scripts/compare-css-selectors.mjs`](dev/scripts/compare-css-selectors.mjs)
Audits CSS selector usage across stylesheets.

#### [`dev/scripts/localize-cms-css-links.mjs`](dev/scripts/localize-cms-css-links.mjs)
Converts external CSS URLs to local paths for CMS output.

#### [`dev/scripts/authoring-format.mjs`](dev/scripts/authoring-format.mjs)
Handles `.json`, `.yaml`, `.yml` file parsing and validation.

---

## NPM Commands

### Content Author Workflow

```bash
npm run watch
```
Watches page source files and rebuilds previews and CMS output. Best for content-only changes.

### Developer Workflow

```bash
npm run dev
```
Watches pages, CSS, JavaScript, and CMS output with live rebuilds.

### Production Build

```bash
npm run build
```
Full build pipeline:
1. Template sync (`npm run pages`)
2. CSS compilation (`npm run build:css`)
3. JavaScript bundling (`npm run build:js:prod`)
4. CMS output generation (`npm run build:cms`)

### Targeted Commands

```bash
npm run pages
```
Syncs template-managed files from `content/templates/` into `content/pages/`, then validates.

```bash
npm run cms
```
Refreshes only CMS output from `content/pages/`.

```bash
npm run build:css
```
Compiles SCSS to CSS with production minification.

```bash
npm run build:js:prod
```
Bundles JavaScript with production optimization.

```bash
npm run generate:templates
```
Generates template-managed pages from template definitions.

```bash
npm run backfill:templates
```
Backfills template metadata into existing pages.

### Linting & Formatting

```bash
npm run lint:scss
```
Lints SCSS files with stylelint.

```bash
npm run format:scss
```
Formats SCSS files with Prettier.

```bash
npm run build:check
```
Runs linting and full build pipeline.

### CSS Vendor Management

```bash
npm run vendor:cms-css
```
Downloads CMS vendor CSS from production.

```bash
npm run split:cms-css
```
Splits vendor CSS into Bootstrap and custom components.

```bash
npm run check:cms-css-links
```
Checks for external CSS URLs in CMS output.

```bash
npm run localize:cms-css-links
```
Converts external CSS URLs to local paths.

---

## Two Page Systems

### 1. Modern Component Pages

Use modern `ic-*` classes and load `dev/assets/css/style.css`.

**Classes:**
- `ic-section` — Section wrapper
- `ic-btn` — Button component
- `ic-card` — Card component
- `ic-box` — Box component

**Reference:**
- `previews/documentation/component-library.html` — Live component reference
- `previews/documentation/style-guide.html` — Typography and styling guide

**Example:**
- `previews/about-us/careers.html`

### 2. Legacy Pages

Use legacy classes and load `dev/assets/css/legacy/style-legacy.css`.

**Classes:**
- `section`, `section_hero` — Section wrappers
- `box` — Box component
- `btn btn-primary` — Button variants

**Examples:**
- `content/legacy/gold-class.html`
- `content/legacy/industries-served/insurer.html`

**Workflow:** Copy nearby patterns from existing pages instead of mixing in newer `ic-*` components unless explicitly requested.

---

## Content Authoring Guide

### Editing Patterns

#### Pattern 1: Structured Page Source

Edit the page source file directly when it contains the actual copy and section data.

**Examples:**
- `content/pages/about-us/careers.yaml`
- `content/pages/about-us/culture.yaml`

**Fields:**
- `heading` — Section heading
- `paragraphs` — Text content
- `cards` — Card data
- `image` — Image references

#### Pattern 2: Wrapper + HTML Fragment

Edit the sibling `*.main.html` file when the page source only points to `sourceHtmlFile`.

**Wrapper Example:**
```json
{
  "slug": "gold-class",
  "title": "Gold Class",
  "sections": [
    {
      "type": "html",
      "sourceHtmlFile": "./gold-class.main.html"
    }
  ]
}
```

**HTML Fragment:** `content/pages/gold-class.main.html`

### Quick Check

If you see this in `content/pages/`:
```json
{
  "sections": [
    {
      "type": "html",
      "sourceHtmlFile": "./page-name.main.html"
    }
  ]
}
```

Edit the referenced `*.main.html` file, not the wrapper.

### Typical Workflow

1. Open the matching file in `content/pages/`
2. Determine if it's a structured page source or wrapper
3. Edit the real content source:
   - `.json` or `.yaml` file for structured pages
   - Sibling `*.main.html` file for wrapper-based pages
4. Replace existing content inside the current section structure
5. Keep section order and major content blocks unless there's a clear reason to change
6. Save and preview as needed
7. Run `npm run build` to refresh CMS output

### Image Updates

Update only the image URLs first:
- `img src`
- `img srcset`
- `source srcset`

Do not remove the existing `<picture>` pattern unless there's a clear reason.

### Creating New Pages

Start from the closest matching page source or template, not from scratch. This gives you:
- The right layout
- The right responsive image structure
- The right button styles
- The right spacing classes
- The right CMS output behavior

---

## Important Editing Rules

- **Preserve structure:** Keep existing component structure when it matches the approved source
- **Replace completely:** Replace placeholder copy entirely
- **No placeholders:** Remove labels like "Section Headline", "Card Title", or lorem ipsum
- **Heading hierarchy:** Keep heading hierarchy intact unless there's a real structure problem
- **Navigation links:** Keep on-page nav links pointed at real section IDs
- **ID updates:** If you rename a section ID, update matching anchor links
- **Generated files:** Never edit files in `cms/` by hand

---

## Copy Conventions

### Raw HTML

- Write `I&#8209;CAR` in HTML text
- Write `Gold&nbsp;Class` in HTML text
- For body copy longer than 5 words, replace the space between the last two words with `&nbsp;` to reduce widows
- Do not add widow protection to headings unless specifically requested
- If quote styling already supplies quotation marks, do not include literal quote marks in the text
- Keep visible uppercase styling in CSS. In HTML source, write normal title case unless the content is a true acronym

### Structured JSON/YAML

- Write normal readable text like `I-CAR` and `Gold Class` in plain text fields
- Use `paragraphsHtml`, `quoteHtml`, `titleHtml`, or similar `*Html` fields only when you need exact inline markup
- Keep HTML entities and inline tags out of plain text fields unless the page format already expects them

---

## CMS Handoff

Page source files can include optional CMS handoff metadata:

```json
{
  "cms": {
    "scriptOutput": "separateHtmlFile",
    "scriptHtml": [
      "<script>window.kentico...</script>"
    ]
  }
}
```

Use this when a page needs Kentico-managed script markup delivered as a separate HTML fragment instead of being kept with the main authoring content.

**Output Format:**
- External `<link>` tags
- Inline `<style>` blocks
- Page section HTML
- `<script>` tags (optionally split to `.scripts.html` files)
- Comments stripped, attributes normalized
- Page-level `.css` and `.js` files not emitted under `cms/`

---

## Memory & Context System

The project uses a memory bank for tracking execution state and progress:

#### `memory/projectBrief.md`
High-level project objectives, architecture laws, and 5-phase migration strategy.

#### `memory/activeContext.md`
Current execution state, validation results, and handoff status. Updated exactly once per task iteration.

#### `memory/progress.md`
Long-term progress tracking across phases.

**Memory Protocol:**
- Pointers over payloads: Store URLs, Node IDs, file paths, and high-level bullet points only
- No code blocks, raw AST data, or full schemas in memory files
- Read before asking: Check memory files before requesting specifications
- Single update rule: Update memory exactly once per task, immediately before handoff

---

## Multi-Agent Workflow

This project uses a 4-tier delegation pipeline for automated content migration and validation:

### 1. 🏗️ Kentico Architect
- **Role:** Read-only advisor and schema specifier
- **Tasks:** Inspects legacy HTML, target Figma designs, and layout trees; maps structural schemas
- **Handoff:** Invokes `new_task` in `frontend-dev` or `data-mapper` mode

### 2. ⚡ Frontend Dev
- **Role:** Action-first implementer and DOM math validator
- **Tasks:** Queries Figma MCP for Node IDs, synthesizes 1:1 content/styling/functionality, runs Puppeteer DOM audits
- **Handoff:** Invokes `new_task` in `qa-runner` mode once full-tree DOM math passes

### 3. 🗺️ Data Mapper
- **Role:** Cost-efficient data mapper and YAML synchronizer
- **Tasks:** Extracts copy from Figma, updates `content/pages/*.yaml`, verifies YAML syntax
- **Handoff:** Requests handoff back to `frontend-dev` if HTML structural changes are required

### 4. 🧪 QA & Deploy Runner
- **Role:** Terminal verification and regression detector
- **Tasks:** Executes chained build checks, runs Puppeteer DOM math scripts, auto-rejects on defects
- **Handoff:** Notifies user only when tests pass 100%

**Port Boundaries:**
- **Port 4000:** User preview (strictly reserved)
- **Port 4001:** Agent/audit environment (all background servers and Puppeteer tests)

---

## Validation & QA

### Build Validation

```bash
npm run build
```

Validates:
- Template sync success
- Schema compliance (no inline HTML, no unapproved keys)
- Page rendering (44/44 pages valid)
- CSS architecture (modern + legacy dual-system)
- Zero regressions

### DOM Math Verification

Tri-viewport protocol across:
- **Desktop:** 1440px
- **Tablet:** 768px
- **Mobile:** 375px

Verifies:
- Container widths
- Grid gaps
- Typography scaling
- Responsive layout fluidity

### Current Status

✅ **Phase 5 Complete — All Validations Passed**

- Build validation: ✅ Exit Code 0
- Schema violations: ✅ Zero
- Inline HTML violations: ✅ Zero
- DOM math (1440px): ✅ Perfect
- DOM math (375px): ✅ Perfect
- Page rendering: ✅ 44/44 valid
- CSS architecture: ✅ Dual-system working
- Regressions: ✅ None detected

**Project Status:** ✅ **READY FOR PRODUCTION**

---

## Good Files To Learn From

Start here to understand the setup:

- [`previews/documentation/component-library.html`](previews/documentation/component-library.html) — Live component reference
- [`previews/documentation/style-guide.html`](previews/documentation/style-guide.html) — Typography and styling guide
- [`content/pages/about-us/careers.yaml`](content/pages/about-us/careers.yaml) — Structured YAML page example
- [`content/pages/gold-class.json`](content/pages/gold-class.json) + [`content/pages/gold-class.main.html`](content/pages/gold-class.main.html) — Wrapper + HTML fragment pattern
- [`content/legacy/gold-class.html`](content/legacy/gold-class.html) — Legacy page reference

---

## Practical Do / Don't

### Do

- Work in `content/pages/`
- Reuse existing page patterns
- Keep classes that are already in place
- Update links, copy, IDs, and image URLs carefully
- Check the page visually after edits
- Run `npm run build` after content changes

### Don't

- Edit generated files in `cms/` by hand
- Remove wrappers just because they seem repetitive
- Mix legacy classes and new `ic-*` components casually
- Rewrite approved copy without being asked
- Leave placeholder text or placeholder image URLs behind
- Edit `dev/assets/css/legacy/style-legacy.css` (read-only baseline)

---

## When To Ask For Help

Ask before making a bigger structural change if you are unsure about:

- Whether a page is legacy or newer
- Whether a section is tied to JavaScript behavior
- Whether a section should be rebuilt or only repopulated
- Whether a CMS include file should be handed off after build
- Whether a template change will affect multiple pages

---

## Key Files Reference

| File | Purpose |
|------|---------|
| [`package.json`](package.json) | NPM scripts and dependencies |
| [`dev/scripts/build-pages.mjs`](dev/scripts/build-pages.mjs) | Page rendering and validation |
| [`dev/scripts/build-cms-inline.mjs`](dev/scripts/build-cms-inline.mjs) | CMS output generation |
| [`dev/scripts/schema-validation.mjs`](dev/scripts/schema-validation.mjs) | Zod schema validation |
| [`dev/scripts/validate-dom-math-enhanced.mjs`](dev/scripts/validate-dom-math-enhanced.mjs) | DOM math verification |
| [`dev/assets/css/scss/style-cms.scss`](dev/assets/css/scss/style-cms.scss) | Main SCSS source |
| [`dev/assets/css/legacy/style-legacy.css`](dev/assets/css/legacy/style-legacy.css) | Legacy fallback (read-only) |
| [`docs/cms-shell-reference.md`](docs/cms-shell-reference.md) | CMS shell spacing reference |
| [`memory/projectBrief.md`](memory/projectBrief.md) | Project objectives and architecture |
| [`memory/activeContext.md`](memory/activeContext.md) | Current execution state |

---

## Short Version

If you remember only five things, remember these:

1. **Edit `content/pages/`, not `cms/`** — CMS output is generated, not hand-edited
2. **Reuse existing patterns** — Start from the closest matching page, not from scratch
3. **Use `previews/documentation/` as reference** — Component library and style guide are your visual guides
4. **Preserve project copy conventions** — Use `I&#8209;CAR`, `Gold&nbsp;Class`, and widow protection correctly
5. **Rebuild after changes** — Run `npm run build` or `npm run cms` to refresh output

---

## Configuration Files

- **`.clinerules`** — Global execution and workflow rules
- **`.roomodes`** — Available agent modes and capabilities
- **`AGENTS.md`** — Multi-agent workflow pipeline and execution contracts
- **`.rooignore`** — Files and directories excluded from processing
- **`dev/config/.prettierrc.json`** — Code formatter configuration
- **`dev/config/.stylelintrc.cjs`** — SCSS linter configuration

---

## Dependencies

**Build Tools:**
- `sass` — SCSS compilation
- `postcss` — CSS post-processing
- `autoprefixer` — Browser prefix support
- `cssnano` — CSS minification
- `esbuild` — JavaScript bundling
- `prettier` — Code formatting
- `stylelint` — SCSS linting

**Runtime:**
- `bootstrap` — Bootstrap framework
- `jquery` — jQuery library
- `swiper` — Carousel library
- `@popperjs/core` — Popper positioning
- `puppeteer` — Headless browser automation
- `yaml` — YAML parsing
- `zod` — Schema validation

---

## License & Attribution

I-CAR Kentico Info Pages — Component-driven content management system for Kentico CMS.
