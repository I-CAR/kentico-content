# AGENTS.md

## Purpose
This file defines repo-local instructions for populating and refining marketing/content HTML pages in this project.

These rules are intentionally narrow. They do not apply to every possible file change in the repo.

## Applies When
Follow these instructions when all of the following are true:

- You are editing a file under `html/`.
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
- Changes outside `html/` unless the task explicitly says to reuse these content rules

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
- Use approved source copy as written unless the user asks for editorial changes.

## Typography Rules
- For non-heading copy longer than 5 words, replace the space between the last two words with `&nbsp;` to prevent widows.
- Do not apply widow protection to headings unless specifically requested.
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

## Navigation Rules
- On-page navigation must point to real section anchors.
- Nav labels should match visible section names.

## Quote Rules
- Quote copy should not include literal opening or closing quotation marks if CSS supplies them.
- Keep attribution within the existing cite structure when one already exists.

## Images and Assets
- If final assets are not provided, leave image placeholders or existing asset references in place and update only the copy.
- If assets are provided, map them to the correct section based on the approved reference.

## Legal Copy
- Replace placeholder legal/disclaimer copy with approved legal copy exactly.
- Apply text normalization rules to legal copy unless doing so would alter a required official string.

## Final Check For Scoped Page Work
Before finishing a scoped content-page task, confirm:

- No lorem ipsum or placeholder labels remain
- `I-CAR` is normalized to `I&#8209;CAR`
- `Gold Class` is normalized to `Gold&nbsp;Class`
- Non-heading copy over 5 words uses widow protection
- Quote text does not include literal quotation marks when CSS handles them
- Display-uppercase text is title case in source
- On-page nav links target real section IDs

