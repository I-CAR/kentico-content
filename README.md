# I-CAR Kentico Info Pages

This repo is set up for building and maintaining content pages that are later prepared for Kentico CMS.

If you are a content author with basic HTML and CSS skills, the main thing to know is:

- Edit files in `content/pages/`
- Use `content/legacy/` as the archived library of legacy/source markup
- Use `previews/` for generated local preview pages
- Do not hand-edit files in `cms/`
- Use the existing content structure and swap in approved copy, links, and image URLs
- First figure out whether the page is driven by JSON/YAML fields or by a sibling `*.main.html` fragment

## What Lives Where

- `content/pages/`
  Working source of truth for CMS-ready page generation. These files can be `.json`, `.yaml`, or `.yml`.
- `content/templates/`
  Lightweight template source used to define page structure for template-managed files in `content/pages/`.
- `content/legacy/`
  Archived pre-pipeline static HTML pages preserved for source comparison and pattern lookup.
- `cms/`
  Generated CMS-ready HTML output that mirrors the rendered `content/pages/` tree. Pages that opt into separate script handoff also get a matching `.scripts.html` file.
- `previews/`
  Generated local preview HTML rendered from `content/pages/`.
- `dev/`
  Development-only source assets, scripts, and tool configuration.
- `dev/assets/css/scss/`
  Source styles for the newer page system.
- `dev/assets/css/legacy/style-legacy.css`
  Styles used by older legacy pages.
- `dev/assets/js/`
  Source and built JavaScript bundles for previews and CMS output.
- `dev/assets/img/`
  Reserved image asset directory.
- `dev/scripts/`
  Build and development scripts.
- `dev/config/`
  Shared formatter and lint configuration.
- `previews/documentation/component-library.html`
  A live reference of reusable section patterns for newer pages.
- `previews/documentation/style-guide.html`
  A live reference for typography, buttons, colors, and common styling.

## The Two Page Systems

This repo currently contains two kinds of pages.

### 1. Newer component pages

These usually use classes like:

- `ic-section`
- `ic-btn`
- `ic-card`
- `ic-box`

They usually load `dev/assets/css/style.css`.

Example:

- `previews/about-us/careers.html`

For these pages, the component library at `previews/documentation/component-library.html` is the best reference.

### 2. Legacy pages

These usually use classes like:

- `section`
- `section_hero`
- `box`
- `btn btn-primary`

They usually load `dev/assets/css/legacy/style-legacy.css`.

Examples:

- `content/legacy/gold-class.html`
- `content/legacy/industries-served/insurer.html`

For legacy pages, the safest workflow is to copy nearby patterns from an existing page instead of mixing in newer `ic-*` components unless someone has asked for a rebuild.

## Start Here

Before you edit content, check which authoring pattern the page uses.

### Pattern 1. Structured page source

Edit the page source file directly when the file contains the actual copy and section data.

Examples:

- `content/pages/about-us/careers.yaml`
- `content/pages/about-us/culture.yaml`

These pages usually contain section objects with fields like:

- `heading`
- `paragraphs`
- `cards`
- `image`

### Pattern 2. Wrapper file plus `*.main.html`

Edit the sibling `*.main.html` file when the page source only points to `sourceHtmlFile`.

Example wrapper:

- `content/pages/gold-class.json`

Matching HTML fragment:

- `content/pages/gold-class.main.html`

Many pages in this repo currently follow this pattern. The `.json` or `.yaml` file is still the page entry point, but the actual page copy and markup live in the `*.main.html` file.

### Quick check

If you open a file in `content/pages/` and see:

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

edit the referenced `*.main.html` file, not just the wrapper.

## Typical Author Workflow

### If you are updating page copy or links

1. Open the matching file in `content/pages/`.
2. Check whether it is a structured page source or a wrapper that points to `sourceHtmlFile`.
3. Edit the real content source:
   - the `.json` or `.yaml` file for structured pages
   - the sibling `*.main.html` file for wrapper-based pages
4. Replace the existing content inside the current section structure.
5. Keep the section order and major content blocks unless there is a clear reason to change them.
6. Save the file and preview the resulting output as needed.
7. Run the build so the matching `cms/...` files refresh.

### If you are updating images

Update only the image URLs first:

- `img src`
- `img srcset`
- `source srcset`

Do not remove the existing `<picture>` pattern unless there is a clear reason.

### If you are creating a new page from an existing pattern

Start from the closest matching page source or template, not from scratch.

That usually gives you:

- the right layout
- the right responsive image structure
- the right button styles
- the right spacing classes
- the right CMS output behavior

## Important Editing Rules

These matter a lot on this project.

- Preserve the existing component structure when it already matches the approved source.
- Replace placeholder copy completely.
- Do not leave behind labels like `Section Headline`, `Card Title`, or lorem ipsum.
- Keep heading hierarchy intact unless there is a real structure problem.
- Keep on-page nav links pointed at real section IDs.
- If you rename a section ID, update any matching anchor links.
- Do not edit generated files in `cms/`.

## Copy Conventions Used In This Repo

### When editing raw HTML

- Write `I&#8209;CAR` in HTML text.
- Write `Gold&nbsp;Class` in HTML text.
- For body copy longer than 5 words, replace the space between the last two words with `&nbsp;` to reduce widows.
- Do not add widow protection to headings unless someone specifically wants that.
- If quote styling already supplies quotation marks, do not include literal quote marks in the text itself.
- Keep visible uppercase styling in the CSS. In the HTML source, write normal title case unless the content is a true acronym.

### When editing structured JSON or YAML

- Write normal readable text such as `I-CAR` and `Gold Class` in plain text fields unless the field explicitly expects HTML.
- Use `paragraphsHtml`, `quoteHtml`, `titleHtml`, or similar `*Html` fields only when you need exact inline markup.
- Keep HTML entities and inline tags out of plain text fields unless the page format already expects them there.

## What Gets Published To CMS

The build process renders `content/pages/**/*.{json,yaml,yml}` into CMS-ready HTML under `cms/`.

In general:

- CMS output is emitted as a paste-ready fragment in this order: external `<link>` tags, inline `<style>`, page section HTML, then `<script>`
- comments are stripped out
- attributes are normalized/sorted
- page-level `.css` and `.js` files are not emitted under `cms/`
- if a page opts into separate script handoff, those tags are emitted to a matching `.scripts.html` file

That means `content/pages/` is your working source of truth, `content/legacy/` preserves the old static references, `previews/` is local preview output, and `cms/` is publish output.

## Local Commands

If the project is already installed, these are the commands that matter most:

### Content author

```bash
npm run watch
```

Watches page source files and rebuilds:

- generated authoring pages
- CMS output

This is the best default command for a content author.

### Developer

```bash
npm run dev
```

Watches and rebuilds:

- generated authoring pages
- CSS
- JS
- CMS output

### Production

```bash
npm run build
```

Syncs templates, validates page source files, and creates production CSS, JS, and CMS output from `content/pages/`.

### Targeted helpers

```bash
npm run cms
```

Refreshes only the CMS output from `content/pages/`.

If you only changed page content and need updated CMS output, `npm run cms` is often enough.

```bash
npm run pages
```

Syncs template-managed files from `content/templates/` into `content/pages/`, then validates the resulting page authoring files.

Page source files can also include optional CMS handoff metadata:

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

Use that when a page needs Kentico-managed script markup delivered as a separate HTML fragment instead of being kept with the main authoring content.

Current supported section types:

- `hero`
- `pageNav`
- `cards`
- `text`
- `html`
- `statementList`
- `textMedia`
- `quote`
- `quoteGrid`
- `profileGrid`
- `mediaFeatureList`
- `iconCardGrid`
- `logoGrid`
- `stickyCards`
- `legal`
- `cta`
- `accordion`
- `embed`
- `mediaSlider`

Template files use this section format:

```json
{
  "slug": "about-demo",
  "title": "About Demo",
  "sections": [
    { "id": "hero", "type": "hero" },
    { "id": "page-nav", "type": "pageNav" },
    { "id": "overview", "type": "textMedia", "variant": "reverse" },
    { "id": "testimonials", "type": "quoteGrid", "variant": "static" },
    { "id": "next-step", "type": "cta" }
  ]
}
```

Template rules:

- Every section requires `id`
- Every section requires `type`
- `variant` is optional and defaults to `default`
- no additional top-level keys are allowed beyond `slug`, `title`, and `sections`
- no additional section keys are allowed beyond `id`, `type`, and optional `variant`
- templates are the source of truth for page structure
- `generate:templates` and `pages` both sync template structure into `content/pages/`
- `pageNav` links are auto-generated when not explicitly provided

Template authoring template:

```json
{
  "slug": "page-slug",
  "title": "Page Title",
  "sections": [
    { "id": "hero", "type": "hero" },
    { "id": "page-nav", "type": "pageNav" },
    { "id": "overview", "type": "textMedia" },
    { "id": "highlights", "type": "cards" },
    { "id": "quote", "type": "quote", "variant": "compact" },
    { "id": "next-step", "type": "cta" }
  ]
}
```

Template notes:

- If a section is retained and its template signature has not changed, content edits in `content/pages/` stay intact.
- If a section is new or its template signature changes, the page section is reset to the generated placeholder content for that section.
- After sync, continue editing the resulting page source file in `content/pages/`.
- Template-managed pages keep `__template` metadata so the sync process knows which template they came from.
- If a page no longer matches its template source metadata, the template sync treats it as custom and skips overwriting it.
- Do not remove `__template` metadata by accident on pages that are meant to stay template-managed.
- Keep sibling `*.main.html` files only for pages that actually reference them with `sourceHtmlFile`.

Current template variants:

- `hero`: `default`, `banner`, `split`
- `pageNav`: `default`
- `cards`: `default`
- `text`: `default`
- `statementList`: `default`, `start`
- `textMedia`: `default`, `reverse`
- `quote`: `default`, `side-by-side`, `compact`
- `quoteGrid`: `default`, `static`
- `profileGrid`: `default`
- `mediaFeatureList`: `default`
- `iconCardGrid`: `default`
- `logoGrid`: `default`
- `stickyCards`: `default`
- `legal`: `default`
- `cta`: `default`
- `accordion`: `default`
- `embed`: `default`
- `mediaSlider`: `default`

Useful authoring notes:

- Most section spacing can be adjusted with `spacing`, for example:
  - `spacing.paddingTop: "none"`
  - `spacing.paddingTop: "none-lg"`
  - `spacing.paddingBottom: "none"`
- `hero` sections support:
  - `variant: "banner"` for full-bleed banner heroes
  - `variant: "split"` for split text/image heroes
  - `headingTag` when a split hero needs a real `h1` or another heading element instead of the default paragraph-styled title
  - `imageStyle: "rounded"` or `imageStyle: "banner"` on split heroes
  - `image.loading` plus `image.output.imgWidth` and `image.output.srcWidth` when the emitted `<img>` should match a specific CMS/prod pattern
- `statementList` sections support `textAlignment: "center"` or `textAlignment: "start"`
- `mediaFeatureList` sections support `textAlignment: "center"` or `textAlignment: "start"` for the intro block above the cards
- `textMedia` sections support:
  - `reverse: true` or `variant: "reverse"`
  - `layout.imageStyle: "rounded"` or `layout.imageStyle: "cutout"`
  - `layout.imageRounded: false` when the image should keep its base layout class without `ic-image-rounded`
- `quote` sections support:
  - `quoteLayout: "stacked"` or `quoteLayout: "side-by-side"`
  - `centerIntro: true` when the intro copy above the quote should be centered
  - `cite.titleHtml` when the cite line needs exact inline markup such as `&nbsp;` instead of the default wrapped title span
- `stickyCards` can also render linked course/resource lists through `linkItems`
- `iconCardGrid` can render linked cards plus an optional centered footer block
- `embed` is the lightweight option for iframe, playlist, or other trusted embed markup

## Developer Notes

- The page pipeline supports `.json`, `.yaml`, and `.yml` page sources.
- `npm run pages` also performs template sync before preview generation.
- Custom HTML pages usually use an `html` section with `sourceHtmlFile` pointing to a sibling `*.main.html` fragment.
- CMS handoff can optionally split scripts into a matching `.scripts.html` file with `cms.scriptOutput: "separateHtmlFile"`.
- If you are adjusting shell-sensitive CMS spacing or wrapper behavior, also review `docs/cms-shell-reference.md`.

## Good Files To Learn From

If you are getting acquainted with the setup, start here:

- `previews/documentation/component-library.html`
- `previews/documentation/style-guide.html`
- `previews/about-us/careers.html`
- `previews/about-us/culture.html`
- `content/legacy/gold-class.html`

Together, those examples show both the newer and legacy page styles used in this repo.

## Practical Do / Don't

### Do

- Work in `content/pages/`
- Reuse existing page patterns
- Keep classes that are already in place
- Update links, copy, IDs, and image URLs carefully
- Check the page visually after edits

### Don't

- Edit generated files in `cms/` by hand
- Remove wrappers just because they seem repetitive
- Mix legacy classes and new `ic-*` components casually
- Rewrite approved copy without being asked
- Leave placeholder text or placeholder image URLs behind if real content exists

## When To Ask For Help

Ask before making a bigger structural change if you are unsure about:

- whether a page is legacy or newer
- whether a section is tied to JavaScript behavior
- whether a section should be rebuilt or only repopulated
- whether a CMS include file should be handed off after build

## Short Version

If you remember only five things, remember these:

1. Edit `content/pages/`, not `cms/`.
2. Reuse the existing layout before inventing a new one.
3. Use `previews/documentation/` as your visual reference.
4. Preserve project-specific copy conventions like `I&#8209;CAR` and `Gold&nbsp;Class`.
5. Rebuild CMS output after content changes when the handoff requires it.
