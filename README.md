# I-CAR Kentico Info Pages

This repo is set up for building and maintaining structured content pages that are later prepared for Kentico CMS.

If you are a content author with basic HTML and CSS skills, the main thing to know is:

- Edit files in `content/pages/`
- Use `html/` as a reference library for legacy/source markup
- Do not hand-edit files in `cms/`
- Use the existing content structure and swap in approved copy, links, and image URLs

## What Lives Where

- `html/`
  Preserved reference pages and component examples. These are kept for source comparison and pattern lookup.
- `content/pages/`
  Structured JSON source of truth for CMS-ready page generation.
- `content/templates/`
  Lightweight template JSON source used to define page structure for `content/pages/`.
  See `content/templates/template-demo.json` for a catalog demo.
- `cms/`
  Generated CMS-ready HTML output that mirrors the rendered `content/pages/` tree. Pages that opt into separate script handoff also get a matching `.scripts.html` file.
- `css/scss/`
  Source styles for the newer page system.
- `css/legacy/style-legacy.css`
  Styles used by older legacy pages.
- `html/documentation/component-library.html`
  A live reference of reusable section patterns for newer pages.
- `html/documentation/style-guide.html`
  A live reference for typography, buttons, colors, and common styling.

## The Two Page Systems

This repo currently contains two kinds of pages.

### 1. Newer component pages

These usually use classes like:

- `ic-section`
- `ic-btn`
- `ic-card`
- `ic-box`

They usually load `css/style.css`.

Example:

- `html/about-us/careers.html`

For these pages, the component library at `html/documentation/component-library.html` is the best reference.

### 2. Legacy pages

These usually use classes like:

- `section`
- `section_hero`
- `box`
- `btn btn-primary`

They usually load `css/legacy/style-legacy.css`.

Examples:

- `html/gold-class.html`
- `html/industries-served/insurance.html`

For legacy pages, the safest workflow is to copy nearby patterns from an existing page instead of mixing in newer `ic-*` components unless someone has asked for a rebuild.

## Typical Author Workflow

### If you are updating page copy or links

1. Open the matching file in `content/pages/`.
2. Replace the existing content inside the current section structure.
3. Keep the section order and major content blocks unless there is a clear reason to change them.
4. Save the file and preview the resulting output as needed.
5. Run the build so the matching `cms/...` files refresh.

### If you are updating images

Update only the image URLs first:

- `img src`
- `img srcset`
- `source srcset`

Do not remove the existing `<picture>` pattern unless there is a clear reason.

### If you are creating a new page from an existing pattern

Start from the closest matching page JSON or template, not from scratch.

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

- Write `I&#8209;CAR` in HTML text.
- Write `Gold&nbsp;Class` in HTML text.
- For body copy longer than 5 words, replace the space between the last two words with `&nbsp;` to reduce widows.
- Do not add widow protection to headings unless someone specifically wants that.
- If quote styling already supplies quotation marks, do not include literal quote marks in the text itself.
- Keep visible uppercase styling in the CSS. In the HTML source, write normal title case unless the content is a true acronym.

## What Gets Published To CMS

The build process renders `content/pages/**/*.json` into CMS-ready HTML under `cms/`.

In general:

- CMS output is emitted as a paste-ready fragment in this order: inline `<style>`, external `<link>` tags, `<main>`, then `<script>`
- comments are stripped out
- attributes are normalized/sorted
- page-level `.css` and `.js` files are not emitted under `cms/`
- if a page opts into separate script handoff, those tags are emitted to a matching `.scripts.html` file

That means `content/pages/` is your working source of truth, `html/` is preserved for reference, and `cms/` is output.

## Local Commands

If the project is already installed, these are the commands that matter most:

### Content author

```bash
npm run watch
```

Watches page JSON and rebuilds:

- generated authoring pages
- CMS output

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

Syncs templates, validates page JSON, and creates production CSS, JS, and CMS output from `content/pages/`.

### Targeted helpers

```bash
npm run cms
```

Refreshes only the CMS output from `content/pages/`.

If you only changed page JSON content and need updated CMS output, `npm run cms` is often enough.

```bash
npm run pages
```

Syncs `content/templates/*.json` into `content/pages/*.json`, then validates the resulting page authoring files.

If you want a real example, compare `content/templates/template-demo.json` with `content/pages/template-demo.json`.

Page JSON can also include optional CMS handoff metadata:

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

- Use `content/templates/template-demo.json` as the catalog example for every supported section type and current variant.
- Compare `content/templates/template-demo.json` with `content/pages/template-demo.json` to see the template input and generated output side by side.
- If a section is retained and its template signature has not changed, content edits in `content/pages/` stay intact.
- If a section is new or its template signature changes, the page section is reset to the generated placeholder content for that section.
- After sync, continue editing the resulting page JSON in `content/pages/`.

Current template variants:

- `hero`: `default`
- `pageNav`: `default`
- `cards`: `default`
- `text`: `default`
- `statementList`: `default`
- `textMedia`: `default`, `reverse`
- `quote`: `default`, `compact`
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

- `stickyCards` can also render linked course/resource lists through `linkItems`
- `iconCardGrid` can render linked cards plus an optional centered footer block
- `embed` is the lightweight option for iframe, playlist, or other trusted embed markup

## Good Files To Learn From

If you are getting acquainted with the setup, start here:

- `html/documentation/component-library.html`
- `html/documentation/style-guide.html`
- `html/about-us/careers.html`
- `html/about-us/culture.html`
- `html/gold-class.html`

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
3. Use `html/documentation/` as your visual reference.
4. Preserve project-specific copy conventions like `I&#8209;CAR` and `Gold&nbsp;Class`.
5. Rebuild CMS output after content changes when the handoff requires it.
