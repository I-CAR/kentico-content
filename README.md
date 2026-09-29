# Agent and Developer Workflow

This guide explains how work moves from a user request through implementation, validation, and approval. This guide describes the I-CAR Kentico Info workflow.

[AGENTS.md](AGENTS.md) is the authoritative workflow contract. It defines role permissions, ownership, required evidence, and approval gates. This README is a practical entry point, not a second policy source.

## Roles and Communication

Nine standing lanes support the workflow: PM, Workflow Architect, optional Lead Senior, two Team Seniors, two Mid Devs, and two Junior Devs. Team Seniors are Senior Dev - Content and Senior Dev - Infrastructure. Each Senior Dev has one Mid Dev and one Junior Dev. There is no separate QA Reviewer or additional implementation lane.

| Lane | Responsibility | Model | Reasoning | Access | Reports to |
| --- | --- | --- | --- | --- | --- |
| PM | Intake, scope, sequencing, cross-team coordination, acceptance QA, approval gates, and workflow review checkpoints | GPT-6 Astra | High | Read-only | User |
| Workflow Architect | Reviews accumulated process evidence; proposes and implements approved changes to workflow docs, prompts, templates, and supported agent configuration | GPT-5.6 Sol | High | Assigned workflow files only | PM |
| Lead Senior | Optional coordination of PM-approved cross-team dependencies and evidence; no additional acceptance gate | GPT-6 Astra | Medium | Read-only | PM |
| Senior Dev - Content | Plans content delivery, assigns developers, reviews handoffs, performs content/visual QA, and reports recurring workflow friction | GPT-5.6 Sol | High | Read-only | PM, through Lead Senior when assigned |
| Mid Dev - Content | Complex content mapping, responsive presentation, page-specific interactions, and developer verification | GPT-5.6 Terra | High | Assigned files | Senior Dev - Content |
| Junior Dev - Content | Approved copy, links, assets, precise presentation edits, and developer verification | GPT-5.6 Luna | Medium | Assigned files | Senior Dev - Content |
| Senior Dev - Infrastructure | Plans supporting systems, coordinates shared ownership, performs technical/regression QA, and reports recurring workflow friction | GPT-6 Astra | High | Read-only | PM, through Lead Senior when assigned |
| Mid Dev - Infrastructure | Templates, renderers, builds, integrations, complex corrections, and developer verification | GPT-5.6 Sol | High | Assigned files | Senior Dev - Infrastructure |
| Junior Dev - Infrastructure | Established patterns, mechanical updates, controlled generation, and developer verification | GPT-5.6 Luna | Medium | Assigned files/output | Senior Dev - Infrastructure |

These are agreed starting model settings, not automatic tool configuration or additional permissions. Model IDs are `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`. Lead Senior and Junior Dev lanes start at Medium; other lanes start at High. Keep roles stable if an approved model assignment changes.

The user owns product intent, final acceptance, and release authorization. Delegation means preparing a complete message for the owner to copy into an established lane. Parallel lanes are owner-operated threads. No lane may spawn, invoke, resume, or automatically dispatch subagents or agent teams. Ordinary non-agent tools remain available within role permissions. Not all lanes need to be active at once.

Delivery follows this chain:

```text
User → PM → optional Lead Senior → Team Senior → Mid/Junior
→ Team Senior QA → optional Lead Senior consolidation → PM acceptance → User
```

Ordinary single-team work routes directly from PM to its Team Senior and returns directly to PM after technical QA. Lead Senior coordinates only explicitly PM-approved work spanning Content and Infrastructure, sequences dependencies and exclusive ownership, and consolidates evidence without repeating accepted QA. It cannot assign developers directly, edit files, generate output, operate Git, alter configuration, start or stop servers, install targets, deploy, or mutate external systems. It replaces neither Team Senior QA nor PM acceptance QA.

Team Seniors may exchange bounded read-only consultations within approved scope. Findings return to the requesting Senior; the consulted Senior cannot activate developers or delegate the consultation. Implementation needs return as proposed scope for a distinct assignment through PM or an authorized Lead Senior.

The user may ask any lane directly for read-only work and receive a concise conversational answer. Such requests authorize no edits, generation, downstream assignments, runtime changes, Git/release actions, or scope expansion. They preserve existing delivery assignments unless the user explicitly cancels or replaces them. Calling a response a handoff does not confer implementation authority.

The Workflow Architect reports directly to PM and is activated only for a user-triggered workflow review or approved maintenance task. It is not part of routine page or infrastructure delivery.

## How Work Proceeds

1. **Intake:** PM records the outcome, concerns, scope, and existing decisions. If target installation is expected, record its page or route, installer, and rollback source early; leave unknown details as explicit gaps while local work continues.
2. **Baseline:** The responsible Senior Dev inventories sources, repository state, references, dependencies, and acceptance criteria.
3. **Assignment:** Senior Dev selects its Mid Dev or Junior Dev and defines bounded ownership. PM coordinates dependencies spanning both teams, optionally through an explicitly authorized Lead Senior.
4. **Implementation:** Developers complete assigned changes and verify them before returning to their Senior Dev.
5. **Integration:** Senior Devs review handoffs and coordinate one developer to generate shared output after dependent source work is ready.
6. **Technical QA:** Each Senior Dev directly checks its workstream and maps concerns to evidence and unresolved gaps.
7. **Acceptance QA:** Lead Senior consolidates Team Senior evidence when assigned, without adding an approval gate. PM reviews the combined result against the user's concerns and spot-checks the experience, evidence, and review instructions.
8. **User review:** PM provides a reproducible review path and the user accepts or requests corrections.
9. **Release:** PM prepares the scope. The user or an explicitly designated executor performs separately authorized Git and target operations.

A correction returns through the responsible Senior Dev with a bounded assignment. It does not restart unrelated accepted work. PM can include an exact, one-retry correction envelope in the original assignment. The developer corrects an owned, provably content- and metadata-preserving byte mismatch; the Senior verifies it before the generation owner retries, without another PM round trip. Cross-team ownership and stop conditions must be named in advance.

If Content needs a shared capability, Senior Dev - Content sends the prerequisite to PM or an authorized Lead Senior for a distinct Infrastructure assignment. The reviewed result returns through PM or the assigned Lead Senior to Senior Dev - Content. Independent work may continue; shared-file writes and generation stay coordinated.

Use Junior Dev for well-specified changes following established patterns. Use Mid Dev for ambiguity, complex behavior, and shared-contract changes. A Junior Dev escalates to its Senior Dev when the assignment needs clarification or reassignment; it does not dispatch another developer.

## Preparing an Assignment

Use the [assignment contract](AGENTS.md#assignment-and-parallel-work) and [message format](AGENTS.md#message-format-and-routing). Distinguish implementation assignments, read-only consultations, QA returns, decisions needed, generation assignments, and correction assignments. Status reviews remain read-only.

Every formal assignment or consultation identifies its sender, recipient, return destination, existing authorization, and whether developer activation is authorized. Define scope, owned and excluded files or outputs, dependencies, and stop conditions. Include an assignment only when its recipient can act immediately within existing authority; otherwise describe the deferred work and missing prerequisite.

For application/content implementation or corrections, PM addresses both `To` and `Send to` to Lead Senior or the responsible Team Senior, never directly to Mid or Junior developers. Lead Senior assigns delivery only to Team Seniors; Team Seniors assign their developers and receive their returns. Workflow Architect assignments retain their separate, user-triggered PM route.

The following is a template for a single ready assignment. Replace placeholders and send the entire message as rendered Markdown, without enclosing code fences or a separate preface:

```markdown
# I-CAR agents — [short assignment or handoff title]

**To:** [receiving lane]
**From:** [sending lane]
**Project:** I-CAR Kentico Info
**Workspace:** `/Volumes/Sites/I-CAR/content/kentico/info`

Reread current AGENTS.md, README.md, and this prompt before acting.

Purpose / request type:
Objective and current state:
Existing authorization and authority source:
Developer activation authorized:
Assigned lane, model/effort, and responsible coordinator:
Approved scope and user concerns:
Excluded scope:
Baseline / authoritative reference:
Owned files, outputs, and shared dependencies:
Dependencies and sequencing:
Allowed mutations and prohibited actions:
Preauthorized deterministic correction and retry (if applicable):
Preview server owner and restoration scope (if applicable):
Acceptance criteria, checks, and required evidence:
Stop conditions / escalation:
Return destination:

---

**Status:** [verified outcome and material incomplete, uncommitted or unpublished state]\
**Your action:** [the user’s exact next step, or No action needed]\
**Send to:** [ready receiving lane names, or None]

**Time:** [measured duration] · [full end timestamp with timezone]

---
```

For ready parallel assignments, begin with:

> Act only on the assignment addressed to your established lane. Other assignments are coordination context. If your lane has no assignment, report that rather than choosing another role.

Follow with the project header, shared context, and one self-contained section per receiving lane. Supply one complete response safe to paste into each named thread. Name exclusive ownership for files, outputs, and runtimes; serialize shared-file, generated-output, runtime, and target mutations.

## Messages and Timing

Conversational answers to the owner’s questions, status requests, explanations, or completed tasks are short and natural. They carry no receiving-lane label or formal header/footer unless a prompt, forwardable message, or lane handoff was requested. Keep relevant changes, checks, limitations, and Git/release state. A possible next lane does not automatically make a reply a handoff.

Requested prompts and formal developer or Architect returns use the complete project header and exact four-field footer shown above. Include all necessary context in the final response, without relying on collapsed commentary. Keep footer field order and horizontal rules, values on the same line as labels, hard line breaks after `Status` and `Your action`, and a blank line before `Time`. Do not add model, reasoning, confidence, or extra footer fields. `Your action` addresses the human user: for a ready handoff, ask them to copy the entire message to the named lane. List only ready recipients in `Send to`, or `None` when no recipient is ready. Use `No action needed` where appropriate, without inventing an action or repeating approval already granted.

At the start of every response, read the clock before substantive work or other tool calls and retain the start time internally; do not display it or create a timing file. Read the clock again immediately before the final response. Measure elapsed time across tools and waits in that response. Formal footers show minutes and seconds, adding hours when needed, or `Not available` if measurement is unreliable. End timestamps include the full date and year, the user’s timezone, and its current daylight-saving abbreviation. Start a fresh measurement for every response. Conversational replies, commentary, and tool output remain footer-free.

## Commands and Environments

Each adopting project should document its actual build, preview, lint, test, and serving commands separately.

For each command, identify:

- Purpose and prerequisites.
- Whether it changes source, metadata, generated output, runtime, or external systems.
- Expected output and verification limits.
- Process/port ownership when it starts a watcher or server.

A build can modify files even when invoked as a “check.” PM and Seniors inspect existing artifacts; the responsible Senior assigns generation to a developer.

Before conflicting source work, identify active watchers and arrange for their owner to stop them. Do not stop unrelated processes. After integrated source changes, use one generation owner and review the resulting diff.

When browser review needs a local server, the assignment can give one developer ownership through QA and permission to restore the same server if it exits. The developer checks the approved document root, loopback host, and free port before restoration and reports the new process. PM and Seniors remain read-only.

PM and Senior read-only QA may capture temporary screenshots/reports in a designated evidence location. That exception does not permit editing repository files, building fixtures, starting servers, changing Git state, or modifying external data. Assign the required setup to a developer. Enforce these boundaries through tool permissions where supported.

## Reviewing Evidence

A handoff should answer:

- Which user concern was addressed?
- What changed, and where?
- Which artifact and environment were tested?
- What did the evidence prove?
- What remains unverified?
- Did any direct or indirect mutation occur?
- What is the next action and rollback approach?

For a bounded correction after a full map has been accepted, the developer can reference the prior artifact and handoff, then report the changed concern, attributable diff, affected checks, mutations, and remaining gap. The Senior still maps every active concern for PM and carries forward only evidence that the correction cannot affect.

Static, mocked, local-browser, target-environment, external-system, and user evidence are separate proof levels. See [Validation and Evidence](AGENTS.md#validation-and-evidence).

For user-facing changes, provide a working review route and instructions to reproduce the relevant states. Screenshots support review, but temporary files should not be the only way the user can inspect the result.

When target behavior differs from local behavior, compare the artifact as authored, generated, installed, and executed before assigning a fix. Report causes separately from hypotheses.

## Delivery States

| State | Meaning |
| --- | --- |
| Planned | Scope and next assignment are identified |
| In Progress | Authorized work is underway |
| Needs Fix | Evidence identifies an unmet requirement |
| Ready for User Validation | Required pre-review checks passed; user acceptance is pending |
| Complete | The declared scope and its acceptance requirements are satisfied |
| Deferred | Work is explicitly postponed with a reason |
| Blocked | A named dependency, access requirement, or authorization prevents progress |

Developer outcomes are `planned`, `implemented`, `locally verified`, `target verified`, and `blocked`.

Always name the scope. A visual pass can be ready for review while an integration remains blocked. A local pass is not a deployment approval.

Authorized work stays active until completed, explicitly paused, cancelled, replaced, or blocked by a concrete external prerequisite. Developers continue authorized implementation, verification, and routine corrections within ownership and stop conditions without repeated permission requests. Continue independent authorized work when only one part is blocked.

Setup, acknowledgments, and progress updates are not completion. Progress belongs in commentary. Remaining effort, response length, and anticipated context limits are not external blockers. A final response ends the execution turn; do not imply work continues afterward. For an observed tool or execution interruption, report completed work, current artifacts, checks, remaining work, the limitation, and next action.

Developers normally return completed work, an explicitly assigned checkpoint, or a concrete blocker. Checkpoints are partial evidence, not milestone acceptance. Before acting on incomplete returns, Seniors inspect current artifacts and worktree state. After two incomplete returns of the same kind, reassess scope, contract clarity, and checkpoint boundaries instead of issuing another generic continuation.

## Handoffs and Approval

Developer lanes return only to their assigned Team Senior; the Workflow Architect returns directly to PM. Team Seniors return integrated concern-to-evidence maps to PM, through Lead Senior consolidation when assigned. If a developer report reaches PM without Senior QA, route that existing result to the responsible Senior rather than repeat implementation.

Developer and Architect returns are directly copyable final responses with the formal project header and four-field footer. Identify delivery state, lane outcome, return destination, scope and exclusions, inspected and changed files, checks and evidence, limitations and unverified claims, mutation accounting, rollback, proposed commit scope, and next action. Do not add conversational material outside the handoff. Use the [required handoff checklist](AGENTS.md#required-developer-handoff).

A release request should identify the artifact, destination, evidence, exceptions, and rollback. Commit, push, PR actions, merge, deployment, and destructive cleanup require the user's applicable authorization. Approval for one action does not authorize the next.

PM, Lead Senior, and both Team Seniors remain read-only. Git writes belong to the user or an explicitly authorized executor for the named operation. The Workflow Architect may stage, commit, and push user-authorized files within its approved workflow-file allowlist after verifying the exact staged scope; it may not include application files or unrelated changes.

Keep current delivery status in the task handoff. Avoid permanent statements that a repository is production-ready or has no regressions.

## Improving the Workflow

PM owns the review checkpoint. Seniors supply examples of recurring friction through normal handoffs, including the issue, frequency, and impact. PM consolidates observations in conversation/handoffs; no routine policy rewrite or new tracking file is required.

At a meaningful milestone or roughly 20–30 substantive handoffs across both teams, PM assesses whether a review would help. The count is a reminder, not a quota or automatic change trigger. PM may recommend an earlier review for repeated problems or report that no changes are warranted.

```text
Handoffs and observations accumulate
    → PM assesses patterns and recommends review when useful
    → User manually triggers review
    → PM prompts Workflow Architect with evidence and scope
    → Architect returns findings and proposed edits without changes
    → PM reviews proposal → User approves specific edits
    → PM assigns Architect to implement those edits
    → Architect returns diff and consistency checks
    → PM acceptance QA → User
```

The Architect can update only the approved workflow file allowlist. Changes to role authority, approval gates, delegation, model assignments, or global configuration must be covered by the user's approval. A review trigger does not authorize implementation, and implementation approval does not authorize a commit.

## Adopting This Process

- Install AGENTS.md where the selected agent tool discovers repository instructions.
- Keep project-specific commands and technical conventions in separate project documentation.
- Identify older workflow documents as historical wherever they conflict with AGENTS.md.
- Do not assume these files configure other repositories automatically.
- Share updates through an agreed template or supported instruction mechanism; avoid divergent copies of the policy.

## Ignore Files and Agent Configuration

Use `.gitignore` for repository tracking exclusions appropriate to each project. It does not stop an agent from reading ignored files.

Add indexing or agent ignore files only when the selected tool documents support for them. Such exclusions are not access controls.

Use supported agent configuration for concrete settings when needed. A generic `.agentconfig` or `.ignore` has no universal effect, and neither should duplicate the role/workflow contract.

Keep credentials and other secrets out of documentation and handoffs. Use the project's approved secret-management mechanism.
