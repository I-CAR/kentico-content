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
- **Model:** `anthropic/claude-haiku-4.5` (default) / `anthropic/claude-sonnet-4` (strategic)
- **Dynamic Switching:** Uses `switch_mode` to `kentico-architect-strategic` for complex architectural decisions requiring deep analysis (cross-system dependencies, major refactoring, design conflicts).
- **Execution Protocol:**
  1. Inspects legacy HTML, target Figma designs (File Key: `80i51JCUKVIrTZ8Zt9y73X`), and layout trees.
  2. Maps structural skeleton schemas (`content/templates/*.yaml`) and data schemas (`content/pages/*.yaml`).
  3. Explicitly defines parent layout scaffolding, fluid tablet scaling (768px), and `placehold.co` image fallbacks.
  4. Maintains strategic memory (`memory/projectBrief.md`) and task execution state (`memory/activeContext.md`).
- **Handoff:** Invokes `new_task` in `frontend-dev` mode (for structural changes) or `data-mapper` mode (for data mapping). Never edits code directly.

---

### 2. ⚡ `frontend-dev` (Implementation & DOM Math)
- **Role:** Action-First Implementer & SCSS/Template Developer.
- **Model:** `anthropic/claude-haiku-4.5` (default) / `anthropic/claude-sonnet-4` (intensive)
- **Dynamic Switching:** Uses `switch_mode` to `frontend-dev-intensive` for complex architectural refactoring, multi-component restructuring, advanced Puppeteer audits, or intricate schema-to-DOM mapping challenges.
- **Execution Protocol:**
  1. Queries live Figma MCP for Node IDs before writing SCSS (No blind CSS).
  2. Synthesizes 1:1 Content, Styling, and Functionality. Missing images MUST use `placehold.co`.
  3. Compiles build assets and serves static previews strictly on **Port 4001**.
  4. Runs headless Puppeteer DOM math audits (`window.getComputedStyle()`) across **Desktop (1440px), Tablet (768px), and Mobile (375px)**.
- **Handoff:** Invokes `new_task` in `qa-runner` mode ONLY once full-tree computed DOM math passes. NEVER asks the user for approval.

---

### 3. 🗺️ `data-mapper` (Data Sync & Content Mapper)
- **Role:** Cost-Efficient Data Mapper & YAML Synchronizer.
- **Model:** `anthropic/claude-haiku-4.5` (cost-efficient for deterministic YAML mapping)
- **Execution Protocol:**
  1. Queries live Figma MCP (File Key: `80i51JCUKVIrTZ8Zt9y73X`) to extract copy, headlines, button labels, and `placehold.co` image dimensions.
  2. Updates `content/pages/*.yaml` without altering `.mjs` scripts.
  3. Executes `node dev/scripts/build-cms-inline.mjs` on Port 4001 to verify YAML syntax.
- **Handoff:** If HTML structural changes are required, halts execution and requests handoff back to `frontend-dev`.

---

### 4. 🧪 `qa-runner` (Automation & Quality Gatekeeper)
- **Role:** Terminal Verification & Regression Detector.
- **Model:** `anthropic/claude-sonnet-4` (structured test execution and complex validation logic)
- **Execution Protocol:**
  1. Executes chained build and validation checks (`node dev/scripts/build-cms-inline.mjs && npm run build:css`).
  2. Runs headless Puppeteer DOM math scripts on `http://localhost:4001`.
  3. **Auto-Rejection Loop:** If a discrepancy exists (Content, Styles, Tablet fluidity, or Functionality), records exact numerical error to `memory/activeContext.md` and opens a `new_task` in `frontend-dev` mode. **DO NOT ALERT THE USER.**
  4. **Success Handoff:** Only notifies the user when tests pass 100%.

---

## Cost-Optimized Model Switching Architecture

This repository implements a **dynamic model switching strategy** to balance cost efficiency with task complexity. All agents default to `anthropic/claude-haiku-4.5` for routine operations, with explicit escalation to `anthropic/claude-sonnet-4` when architectural complexity demands deeper reasoning.

### Model Assignment by Agent

| Agent | Default Model | Intensive Model | Trigger for Switch |
|-------|---------------|-----------------|-------------------|
| `kentico-architect` | `claude-haiku-4.5` | `claude-sonnet-4` | Complex architectural decisions, cross-system dependencies, major refactoring, design conflicts |
| `frontend-dev` | `claude-haiku-4.5` | `claude-sonnet-4` | Complex architectural refactoring, multi-component restructuring, advanced Puppeteer audits, intricate schema-to-DOM mapping |
| `data-mapper` | `claude-haiku-4.5` | N/A | Deterministic YAML mapping (no escalation needed) |
| `qa-runner` | `claude-sonnet-4` | N/A | Structured test execution and complex validation logic (always uses Sonnet-4) |

### Dynamic Switching Protocol

**When to Switch:**
1. **kentico-architect** → `kentico-architect-strategic`: Use `switch_mode` when facing architectural decisions that require deep cross-system analysis or strategic refactoring.
2. **frontend-dev** → `frontend-dev-intensive`: Use `switch_mode` when implementing complex multi-component restructuring, advanced DOM math audits, or intricate schema-to-DOM mapping challenges.
3. **data-mapper**: No switching required. Haiku-4.5 is sufficient for deterministic YAML operations.
4. **qa-runner**: Always uses Sonnet-4 for structured test execution and complex validation logic.

**Cost Optimization Principle:**
- Default to Haiku-4.5 for routine component updates, simple SCSS modifications, straightforward template changes, and standard DOM audits.
- Escalate to Sonnet-4 ONLY when task complexity exceeds Haiku-4.5's reasoning capacity.
- Sonnet-4 is reserved for strategic decisions, complex refactoring, and structured validation requiring multi-step reasoning.

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

---

## Triple-Brief Memory Architecture (Strategic vs. Task vs. Historical)

This repository uses a three-tier memory system to maintain strategic context, track task execution state, and preserve historical progress without token bloat.

### Strategic Charter (`memory/projectBrief.md`)
- **Scope:** Long-term migration strategy, architectural laws, 5-phase roadmap, execution environment constants
- **Audience:** All agents at task start (mandatory read per Section 1)
- **Update Frequency:** Rarely (only when strategic direction changes)
- **Content:** Executive objectives, core architecture laws, high-level phases, port isolation rules, token efficiency guidelines
- **Immutability:** Represents the canonical project charter. Changes require architect review.

### Task Execution State (`memory/activeContext.md`)
- **Scope:** Current task execution state, Figma node IDs, file paths modified, validation gates, handoff checkpoints
- **Audience:** Current agent + next agent in handoff chain
- **Update Frequency:** Exactly ONCE per task (at completion, before `attempt_completion` or `new_task`)
- **Content:** Phase name, agent responsible, completion status, critical file paths, next handoff target, blocking issues
- **Format:** Concise pointers only (URLs, node IDs, file paths). Max 5 lines per checkpoint.

### Historical Progress Log (`memory/progress.md`)
- **Scope:** Completed phases, milestone achievements, major deliverables, project timeline
- **Audience:** Reference for project status and completed work
- **Update Frequency:** At major phase completions or significant milestones
- **Content:** Phase summaries, completion status, deliverable tracking, project timeline
- **Purpose:** Historical record and project status dashboard

### Triple-Brief Protocol Rules
- **Mandatory Reads:** At task start, read BOTH `memory/projectBrief.md` (strategic context) AND `memory/activeContext.md` (task state)
- **Optional Reference:** Read `memory/progress.md` for historical context when needed
- **No Duplication:** Strategic content → `projectBrief.md`. Task-specific data → `activeContext.md`. Historical data → `progress.md`.
- **Handoff Clarity:** When invoking `new_task`, the outgoing agent MUST ensure `activeContext.md` contains: (1) completed steps, (2) exact file paths, (3) next agent's required inputs, (4) any blocking issues
- **Token Efficiency:** Keep `activeContext.md` under 50 lines total. Use abbreviations and pointers, never full code blocks or raw AST data.
- **Architect Review:** `kentico-architect` maintains `projectBrief.md` accuracy and updates `progress.md` at major milestones. All strategic changes require architect sign-off.