# I-CAR Kentico Info Pages

This repo is set up for building and maintaining HTML pages that are later prepared for Kentico CMS.

If you are a content author with basic HTML and CSS skills, the main thing to know is:

- Edit files in `html/`
- Preview the page from `html/`
- Do not hand-edit files in `cms/`
- Use the existing page structure and swap in approved copy, links, and image URLs

## What Lives Where

- `html/`
  Source pages. This is where you will do most of your work.
- `content/pages/`
  Structured JSON source for generated authoring pages.
- `cms/`
  Generated CMS-ready HTML output that mirrors the `html/` tree. Pages that opt into separate script handoff also get a matching `.scripts.html` file.
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

1. Open the matching file in `html/`.
2. Replace the existing content inside the current structure.
3. Keep the section order and major wrappers unless there is a clear reason to change them.
4. Save the file and preview it.
5. If the CMS output is needed, run the build so the matching `cms/.../index.*` files refresh.

### If you are updating images

Update only the image URLs first:

- `img src`
- `img srcset`
- `source srcset`

Do not remove the existing `<picture>` pattern unless there is a clear reason.

### If you are creating a new page from an existing pattern

Start from the closest matching page in `html/`, not from scratch.

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

The build process turns each file in `html/` into a mirrored CMS-ready folder under `cms/`.

In general:

- CMS output is emitted as a paste-ready fragment in this order: inline `<style>`, external `<link>` tags, `<main>`, then `<script>`
- comments are stripped out
- attributes are normalized/sorted
- page-level `.css` and `.js` files are not emitted under `cms/`
- if a page opts into separate script handoff, those tags are emitted to a matching `.scripts.html` file

That means the `html/` files are your working source, and `cms/` is output.

## Local Commands

If the project is already installed, these are the most useful commands:

```bash
npm start
```

Runs the watchers for:

- generated authoring pages
- CSS
- JS
- CMS output

```bash
npm run build
```

Creates generated authoring pages plus production-style output for CSS, JS, and CMS files.

```bash
npm run build:pages
```

Prepares `content/pages/*.json` for CMS output under `cms/generated/*.html`.

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

```bash
npm run build:cms:dev
```

Refreshes the CMS output without doing a full production build.

If you only changed HTML content and need updated CMS output, `npm run build:cms:dev` is often enough.

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

- Work in `html/`
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

1. Edit `html/`, not `cms/`.
2. Reuse the existing layout before inventing a new one.
3. Use `html/documentation/` as your visual reference.
4. Preserve project-specific copy conventions like `I&#8209;CAR` and `Gold&nbsp;Class`.
5. Rebuild CMS output after HTML changes when the handoff requires it.
