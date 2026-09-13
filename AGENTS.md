# Multi-Agent Workflow Pipeline & Execution Contracts

This repository uses a strict 3-tier delegation pipeline for migrating legacy Kentico `main.html` + `.json` pairings to modern component-driven `.yaml` schemas. All operations are initiated by the Lead Architect and executed across background processes isolated to **Port 3001**.

[ kentico-architect ] --(new_task)--> [ frontend-dev ] --(new_task)--> [ qa-runner ]
(Spec & Schema)                       (Build & Math)                   (Gatekeeper)

---

## Agent Roles & Delegation Protocols

### 1. 🏗️ `kentico-architect` (Lead Architect)
- **Role:** Read-Only Advisor & Schema Specifier.
- **Allowed Groups:** `read`, `mcp`
- **Execution Protocol:**
  1. Inspects legacy `main.html` files, legacy CSS, and target Figma designs.
  2. Maps legacy HTML structures to modern SCSS class equivalents in the Style Dictionary.
  3. Formulates structural skeleton schemas (`content/templates/*.yaml`) and content page data schemas (`content/pages/*.yaml`).
  4. Writes programmatic Cheerio/Node extraction specs for data migration.
  5. Updates `memory/activeContext.md` with ultra-concise pointers (file paths, node IDs, URLs).
- **Handoff:** Invokes `new_task` in `frontend-dev` mode with subtask objective and asset pointers. Never edits implementation files directly.

---

### 2. ⚡ `frontend-dev` (Implementation & DOM Math)
- **Role:** Action-First Implementer & Automated Translator.
- **Allowed Groups:** `read`, `edit`, `mcp`, `command`
- **Execution Protocol:**
  1. Writes Node.js extraction scripts to programmatically convert legacy `main.html` into structured YAML without manual copy-paste errors.
  2. Extends `dev/scripts/build-pages.mjs` with Zod schema validation to reject inline HTML or unapproved keys.
  3. Writes modular SCSS components under `dev/assets/css/scss/`.
  4. Runs build scripts and serves local previews strictly on **Port 3001** (Port 3000 is reserved for user previews).
  5. Executes `puppeteer_navigate` and `puppeteer_evaluate` at major milestones to measure computed CSS (`window.getComputedStyle()`) at Desktop (1440px) and Mobile (375px) against design AST math.
- **Handoff:** Invokes `new_task` in `qa-runner` mode once all DOM math validations pass on Port 3001.

---

### 3. 🧪 `qa-runner` (Automation & Quality Gatekeeper)
- **Role:** Terminal Verification & Regression Detector.
- **Allowed Groups:** `read`, `edit`, `command`, `mcp`
- **Execution Protocol:**
  1. Executes chained build and validation checks (`node dev/scripts/build-pages.mjs && npm run build`).
  2. Serves previews on **Port 3001**.
  3. Executes shadow DOM diffing, programmatically comparing legacy HTML text nodes and computed box models against updated YAML outputs.
  4. Performs dual-viewport DOM math verification via headless Puppeteer.
- **Handoff:** If a defect or schema violation is detected, logs exact discrepancies to `memory/activeContext.md` and opens a `new_task` to `frontend-dev`. If perfect, updates `memory/progress.md` and completes the task.

---

## Execution Guardrails

- **Zero Hallucination Policy:** Screenshots and visual estimations are banned. UI verification relies strictly on computed DOM math (`window.getComputedStyle()`).
- **Tool Ban:** The built-in `browser_action` tool is strictly forbidden. All browser automation must run silently via the Puppeteer MCP server (`--headless=new`).
- **Port Safety:** Agents must never touch Port 3000. All dev servers and Puppeteer evaluations run on Port 3001.
- **Token Discipline:** Memory updates occur exactly ONCE per task iteration, immediately prior to handoff. Memory files contain pointers only (URLs, file paths, node IDs).