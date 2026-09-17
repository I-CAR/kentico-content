# AGENTS.md

## Purpose
This file defines repo-local instructions for populating and refining marketing/content HTML pages in this project.

These rules are intentionally narrow. They do not apply to every possible file change in the repo.

## Applies When
Follow these instructions when all of the following are true:

- You are editing a file under `content/legacy/` or a custom `content/pages/**/*.main.html` source fragment.
- The task is primarily content population, copy replacement, template cleanup, or page assembly.
- The page is a marketing, informational, landing, or brand/content page rather than application logic.

Typical examples:

- Replacing placeholder copy in an HTML template
- Rebuilding a page from a screenshot, PDF, approved mockup, or written source copy
- Updating quote sections, CTA copy, benefit lists, legal copy, or section headlines
- Wiring in-section navigation for a content page
- Cleaning presentation-only HTML left in a scaffolded template

## Does Not Apply When
These instructions should not be treated as global rules for unrelated work such as:

- Editing JavaScript application logic
- Refactoring CSS or design system code without page-copy work
- Backend, API, data, or build tooling changes
- Utility scripts, tests, or infrastructure updates
- Changes outside `content/legacy/` and `content/pages/**/*.main.html` unless the task explicitly says to reuse these content rules

## Primary Goal
Preserve the existing component structure while replacing scaffold content with approved copy and production-ready HTML.

Unless explicitly requested:

- Do not redesign the layout
- Do not invent new copy
- Do not restructure sections that already map well to the approved source

## Copy Rules
- Replace all placeholder copy with approved source copy.
- Remove placeholder labels such as `Section Headline`, `Card Title`, `Section Button`, `Section Link`, `Cite Name`, `Cite Title`, and lorem ipsum text.
- Keep the existing heading hierarchy unless there is a clear structural problem.
- Use approved source copy exactly as written unless the user asks for editorial changes.
- Treat mockups, approved screenshots, and user-provided text as the source of truth for wording, punctuation, capitalization, dashes, quotation marks, and formatting-sensitive phrasing.
- Do not rewrite, normalize, simplify, “clean up,” or optimize approved copy on your own.
- If source text appears unusual but is clearly intentional in the approved reference, preserve it.
- If the source is ambiguous or unreadable, ask or flag the ambiguity instead of inventing a cleaned-up version.

## Typography Rules
- For non-heading copy longer than 5 words, replace the space between the last two words with `&nbsp;` to prevent widows.
- Do not apply widow protection to headings unless specifically requested.
- Do not use HTML entity codes in plain-language HTML attributes such as `alt`, `title`, `aria-label`, and similar human-readable attribute text; write those attribute values as plain readable text.
- If text is visually uppercased by CSS, write it in title case in the HTML source.
- Remove literal quotation marks from quote text when quote styling is handled by CSS.

## Text Normalization Rules
- Always write `I&#8209;CAR` for I-CAR in HTML text.
- Always write `Gold&nbsp;Class` for Gold Class in HTML text.
- Preserve legitimate acronyms such as `CEO`, `FSA`, `HSA`, and `401(k)`.

## HTML Cleanup Rules
- Remove presentation-only scaffold metadata such as inline section `--name` variables unless explicitly needed.
- Keep meaningful section IDs.
- If a section ID no longer matches the section content, rename it to something accurate and update any related anchor links.
- Keep existing design system classes unless there is a specific reason to change them.
- Do not add unnecessary wrapper markup.
- When editing a file under `content/legacy/` or `content/pages/**/*.main.html`, re-scan the current file contents immediately before making changes so any recent user edits in the same file are accounted for.

## Markup Ordering Rules
- When a `section` element has an `id`, place the `id` attribute first.
- For the first major layout column wrappers in a section, order classes as:
  1. column responsive classes
  2. order responsive classes
  3. spacing classes
- For `img`, order attributes as:
  `alt`, `loading`, `class`, `width`, `height`, `sizes`, `src`, `srcset`
- For `source`, order attributes as:
  `width`, `height`, `media`, `sizes`, `srcset`

## Navigation Rules
- On-page navigation must point to real section anchors.
- Nav labels should match visible section names.

## Quote Rules
- Quote copy should not include literal opening or closing quotation marks if CSS supplies them.
- Keep attribution within the existing cite structure when one already exists.

## Images and Assets
- If final assets are not provided, leave image placeholders or existing asset references in place and update only the copy.
- If assets are provided, map them to the correct section based on the approved reference.
- When requested to use placeholders on inventory/demo pages, prefer `placehold.co` URLs without `?text`.
- If replacing one media type with another inside an existing section, preserve the surrounding section layout and markup unless explicitly asked to redesign it.
- Keep placeholder media structurally compatible with the component they replace so existing JavaScript behaviors can still initialize.

## Scoped Image Placement Rules
Apply these rules only when:

- editing files under `content/legacy/` or `content/pages/**/*.main.html`
- placing designer-provided image URLs into marketing/content page templates
- the task includes populating image `src` and `srcset` values

### Image Mapping Rules
- Prefer mapping assets by filename/section-name when the designer names files after page headlines or card titles.
- Assume filenames such as `Hero`, `Hiring-Process`, `Employee-Benefits`, `Work-That-Works-For-You`, or `Drive-Meaningful-Impact` correspond to the matching visible section or card headline.
- Before asking for clarification, attempt to map assets to template slots using:
  1. section headline
  2. card headline
  3. quote attribution name
  4. image placement in the template

### Responsive URL Rules
- Only update image `src` and `srcset` values unless the task explicitly asks for more.
- If a slot uses `<picture>`, populate:
  - `source srcset`
  - `img src`
  - `img srcset`
- If a slot uses only `<img>`, populate:
  - `img src`
  - `img srcset`
- Do not remove or simplify an existing responsive image pattern unless explicitly requested.

### Desktop / Mobile Naming Rules
- When filenames include `-D` and `-M`, treat:
  - `-M` as the mobile `source srcset`
  - `-D` as the default `img src` and `img srcset`
- When only one responsive set exists and there is no `-D` / `-M` split, use that set in the existing `img src` and `img srcset` fields.

### Headshot Rules
- Map person-named assets to matching quote/headshot slots by surname or full name.
- For small profile images, use the smaller file as `src` and include the larger companion file in `srcset`.

### Missing Asset Rules
- After mapping, explicitly identify any gaps by slot name, not just by count.
- Report missing assets in a checklist format.
- If all visible template image slots are covered, state that no asset gaps remain.

### Placeholder Replacement Rules
- Replace placeholder image URLs when real assets are available for that slot.
- Before finishing, confirm there are no remaining placeholder image URLs.

## Legal Copy
- Replace placeholder legal/disclaimer copy with approved legal copy exactly.
- Apply text normalization rules to legal copy unless doing so would alter a required official string.

## CMS And Build Rules
- Do not hand-edit generated files under `previews/`; treat that tree as local preview output.
- For CMS-targeted output, prefer build output that does not rely on external imports at runtime when the target environment cannot import dependencies directly.
- `cms/` output should mirror the `previews/` tree directly.
- Do not generate or rely on `cms/includes/`, `cms/_shared/`, page-level `index.css`, or page-level `index.js` outputs.
- Prefer CMS output that a content author can copy and paste directly from a single HTML file.
- For template-managed pages under `content/pages/`, keep the page data file as the source of truth. Do not create or retain a sibling `*.main.html` file unless the page explicitly uses a `sourceHtmlFile` section.
- Do not treat a JSON-to-YAML or YAML-to-JSON conversion as complete if the page still depends on `sourceHtmlFile` or a sibling `*.main.html`, unless the user explicitly asks to keep custom HTML authoring.
- When converting an HTML-wrapper page to structured authoring, prefer native page-data sections and explicit options over preserving raw HTML/CSS/class authoring in page data.
- When migrating a page from custom HTML authoring to template-managed JSON or YAML, delete any now-unused sibling `*.main.html` file in the same change so orphaned page sources do not linger.
- When a page is meant to stay template-managed, preserve or restore the page-level `__template.source` metadata so `npm run pages` does not treat it as skipped custom content.
- If a page is intentionally custom and should no longer follow its template, make that an explicit decision rather than an accidental side effect of removing template metadata or editing generated artifacts directly.
- Preferred CMS fragment order is:
  1. external `<link>` tags such as Google Fonts
  2. inline `<style>`
  3. page section HTML
  4. inline `<script>`
- CSS and JavaScript emitted for CMS usage should be minified in production builds.
- Include third-party assets such as Bootstrap and Swiper only when the specific page actually needs them.
- When a page does not use a dependency, do not emit that dependency into the CMS output.
- Prefer author-friendly source formats such as `content/pages/` over intermediate metadata files that are not useful to content authors.
- Prefer author-facing option names and values that describe intent in plain language rather than implementation details.
- Avoid exposing raw measurements, CSS terminology, or developer-centric phrasing to content authors when a semantic option such as `default`, `compact`, or `roomy` can express the same choice.
- For dev/watch workflows started by `npm run dev`, generated output in `dev/assets/js/` should remain unminified for readability, while CMS HTML fragments should still be minified.
- Strip emitted JavaScript comments from development bundle output, including bundler-added module/file annotations and sourcemap footer comments.
- Keep development output readable when possible, but comment-free CMS output takes priority.
- Production builds should apply comment removal and minification for generated JS output.
- Remove comments from generated CMS HTML fragments in both dev and production output.

## Final Check For Scoped Page Work
Before finishing a scoped content-page task, confirm:

- No lorem ipsum or placeholder labels remain
- `I-CAR` is normalized to `I&#8209;CAR`
- `Gold Class` is normalized to `Gold&nbsp;Class`
- Non-heading copy over 5 words uses widow protection
- Quote text does not include literal quotation marks when CSS handles them
- Display-uppercase text is title case in source
- On-page nav links target real section IDs