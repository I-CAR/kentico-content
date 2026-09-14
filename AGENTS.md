# AGENTS.md - Multi-Agent Workflow Pipeline & Execution Contracts

This repository uses a strict 4-tier delegation pipeline for migrating legacy Kentico structures to modern component-driven `.yaml` schemas and achieving 1:1 Figma structural, styling, and content parity. All background servers and automated test runners execute strictly on **Port 4001**, leaving **Port 4000** isolated for manual user preview.

+---------------------+               +------------------+               +---------------+
| kentico-architect   | --(new_task)->|  frontend-dev    | --(new_task)->|   qa-runner   |
| (Spec & Structural) |               | (Code & DOM Math)|               | (QA Gatekeeper|
+---------------------+               +------------------+               +---------------+
           |                                   ^   |                             |
           |                                   |   +-----(Reject & Loop Back)----+
           |                                   |                                 |
           +-------------(Data Only)-----------> [ data-mapper ]                 v
                                                (YAML Sync)               (User Notify)

---

## Agent Roles & Delegation Protocols

### 1. 🏗️ `kentico-architect` (Lead Architect)
- **Role:** Read-Only Advisor & Schema Specifier.
- **Model:** `anthropic/claude-3-5-sonnet-20241022`
- **Execution Protocol:**
  1. Inspects legacy HTML, target Figma designs (File Key: `80i51JCUKVIrTZ8Zt9y73X`), and layout trees.
  2. Maps structural skeleton schemas (`content/templates/*.yaml`) and data schemas (`content/pages/*.yaml`).
  3. Explicitly defines parent layout scaffolding, fluid tablet scaling (768px), and `placehold.co` image fallbacks.
- **Handoff:** Invokes `new_task` in `frontend-dev` mode (for structural changes) or `data-mapper` mode (for data mapping). Never edits code directly.

---

### 2. ⚡ `frontend-dev` (Implementation & DOM Math)
- **Role:** Action-First Implementer & SCSS/Template Developer.
- **Model:** `anthropic/claude-3-5-sonnet-20241022`
- **Execution Protocol:**
  1. Queries live Figma MCP for Node IDs before writing SCSS (No blind CSS).
  2. Synthesizes 1:1 Content, Styling, and Functionality. Missing images MUST use `placehold.co`.
  3. Compiles build assets and serves static previews strictly on **Port 4001**.
  4. Runs headless Puppeteer DOM math audits (`window.getComputedStyle()`) across **Desktop (1440px), Tablet (768px), and Mobile (375px)**.
- **Handoff:** Invokes `new_task` in `qa-runner` mode ONLY once full-tree computed DOM math passes. NEVER asks the user for approval.

---

### 3. 🗺️ `data-mapper` (Data Sync & Content Mapper)
- **Role:** Cost-Efficient Data Mapper & YAML Synchronizer.
- **Model:** `anthropic/claude-3-5-haiku-20241022` (or GPT-4o-mini)
- **Execution Protocol:**
  1. Queries live Figma MCP (File Key: `80i51JCUKVIrTZ8Zt9y73X`) to extract copy, headlines, button labels, and `placehold.co` image dimensions.
  2. Updates `content/pages/*.yaml` without altering `.mjs` scripts.
  3. Executes `node dev/scripts/build-cms-inline.mjs` on Port 4001 to verify YAML syntax.
- **Handoff:** If HTML structural changes are required, halts execution and requests handoff back to `frontend-dev`.

---

### 4. 🧪 `qa-runner` (Automation & Quality Gatekeeper)
- **Role:** Terminal Verification & Regression Detector.
- **Model:** `anthropic/claude-3-5-sonnet-20241022`
- **Execution Protocol:**
  1. Executes chained build and validation checks (`node dev/scripts/build-cms-inline.mjs && npm run build:css`).
  2. Runs headless Puppeteer DOM math scripts on `http://localhost:4001`.
  3. **Auto-Rejection Loop:** If a discrepancy exists (Content, Styles, Tablet fluidity, or Functionality), records exact numerical error to `memory/activeContext.md` and opens a `new_task` in `frontend-dev` mode. **DO NOT ALERT THE USER.**
  4. **Success Handoff:** Only notifies the user when tests pass 100%.

---

## Core Operational Rules

### 1. Port Boundaries
- **Port 4000 (User Preview):** Strictly reserved for visual user evaluation. Agents must NEVER bind dev servers to Port 4000.
- **Port 4001 (Agent/Audit Environment):** All background servers, Python static HTTP services, and Puppeteer headless tests execute exclusively on Port 4001.

### 2. Figma Data Authority & Placehold.co Guardrails
- **Canonical Key:** `80i51JCUKVIrTZ8Zt9y73X` is the single source of truth for all Figma calls.
- **Placehold.co Enforcement:** Any missing Figma images or broken media paths must automatically resolve to `placehold.co/[width]x[height]` to prevent container collapse.

### 3. Zero-Hallucination QA Gate (Tri-Viewport)
- **No Visual Polling:** Agents are forbidden from asking the user "What do you see?".
- **Tri-Viewport Protocol:** All layouts must be evaluated mathematically at Desktop, Tablet (768px), and Mobile breakpoints.
- **Structure Before Paint:** The agent must verify DOM HTML structure via raw output parsing before evaluating CSS paint values.

### 4. Schema Over Hacks
- If high-specificity CSS `!important` tags fail, update the underlying YAML schema (`content/pages/*.yaml`) and template builder (`dev/scripts/build-cms-inline.mjs`) to generate explicit semantic HTML wrappers.