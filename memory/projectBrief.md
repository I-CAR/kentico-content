# Project Brief: Kentico Headless Component & Style Migration

## 1. Executive Objective
Migrate the legacy Kentico headless codebase (`I-CAR/kentico-content`, branch `content_cleanup`) from unformatted `main.html` + `.json` pairings to a strict, component-driven YAML architecture. Retire legacy CSS styling in favor of modern SCSS modules, and automate validation using a zero-hallucination DOM math verification suite on Port 3001.

## 2. Core Architecture Laws
- **Zero HTML in Content:** YAML data files (`content/pages/*.yaml`) MUST NOT contain raw HTML tags, `bodyHtml` strings, or inline styling. Layouts and variants are controlled strictly via structured YAML properties (e.g., `variant: "primary"`, `backgroundTheme: "dark"`).
- **Template Skeletons:** Template files (`content/templates/*.yaml`) define structural skeletons ONLY (`slug`, `title`, `sections`).
- **Component-Driven CMS:** Kentico content types are derived from frontend component requirements. UI schemas are established first, and CMS models map directly to them.
- **Style Modernization:** Legacy HTML classes are systematically mapped to modern SCSS equivalents via an Architect-maintained Style Dictionary.

## 3. High-Accuracy 5-Phase Migration Strategy
1. **Global Template Mapping & Style Baselining:** Convert `content/templates/*.json` to `.yaml` skeletons. Establish the Legacy-to-Modern Style Dictionary matrix.
2. **Component Renderer & Zod Validation Upgrades:** Extend `dev/scripts/build-pages.mjs` with Zod schema validation to throw fatal errors on unexpected HTML or unapproved keys.
3. **Programmatic Data Extraction:** Use Node.js/Cheerio scripts to translate legacy `main.html` content into validated `content/pages/*.yaml` files without manual copy-paste errors.
4. **SCSS Modernization & Milestone Verification:** Apply modern SCSS components and execute dual-viewport DOM math checks (`window.getComputedStyle()`) on Port 3001 at 1440px and 375px.
5. **Shadow DOM & QA Automation Gate:** Perform programmatic shadow diffing between legacy HTML and modern YAML output to confirm 100% content retention and visual fidelity.

## 4. Execution Environment & Safety
- **Target Repository:** `I-CAR/kentico-content` (`content_cleanup` branch).
- **Port Isolation:** Port 3000 = User Preview. Port 3001 = Agent Dev Server & Headless Testing.
- **Headless MCP Execution:** Puppeteer executes in silent background mode (`--headless=new`). `browser_action` is permanently disabled.
- **Token Efficiency:** Memory tracking files (`memory/activeContext.md`) store pointers only (URLs, Node IDs, file paths), updated exactly ONCE per task iteration.