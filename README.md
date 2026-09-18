# Agent and Developer Workflow

This guide explains how work moves from a user request through implementation, validation, and approval. The process is reusable across projects.

[AGENTS.md](AGENTS.md) is the authoritative workflow contract. It defines role permissions, ownership, required evidence, and approval gates. This README is a practical entry point, not a second policy source.

## Roles and Communication

Eight lanes support the workflow: PM, Workflow Architect, two Senior Devs, two Mid Devs, and two Junior Devs. Each Senior Dev has one Mid Dev and one Junior Dev. There is no separate QA Reviewer or additional implementation lane.

| Lane | Responsibility | Model | Reasoning | Access | Reports to |
| --- | --- | --- | --- | --- | --- |
| PM | Intake, scope, sequencing, cross-team coordination, acceptance QA, approval gates, and workflow review checkpoints | GPT-6 Astra | High | Read-only | User |
| Workflow Architect | Reviews accumulated process evidence; proposes and implements approved changes to workflow docs, prompts, templates, and supported agent configuration | GPT-5.6 Sol | High | Assigned workflow files only | PM |
| Senior Dev - Content | Plans content delivery, assigns developers, reviews handoffs, performs content/visual QA, and reports recurring workflow friction | GPT-5.6 Sol | High | Read-only | PM |
| Mid Dev - Content | Complex content mapping, responsive presentation, page-specific interactions, and developer verification | GPT-5.6 Terra | High | Assigned files | Senior Dev - Content |
| Junior Dev - Content | Approved copy, links, assets, precise presentation edits, and developer verification | GPT-5.6 Luna | Medium | Assigned files | Senior Dev - Content |
| Senior Dev - Infrastructure | Plans supporting systems, coordinates shared ownership, performs technical/regression QA, and reports recurring workflow friction | GPT-6 Astra | High | Read-only | PM |
| Mid Dev - Infrastructure | Templates, renderers, builds, integrations, complex corrections, and developer verification | GPT-5.6 Sol | High | Assigned files | Senior Dev - Infrastructure |
| Junior Dev - Infrastructure | Established patterns, mechanical updates, controlled generation, and developer verification | GPT-5.6 Luna | Medium | Assigned files/output | Senior Dev - Infrastructure |

These are agreed starting model settings, not automatic tool configuration or additional permissions. Model IDs are `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`. High is used for coordinating, reviewing, and complex implementation lanes; Medium is the balanced setting for narrow, established Junior Dev work. Keep roles stable if an approved model assignment changes. Avoid modes that automatically spawn agents unless the user explicitly authorizes that behavior.

Only the final agent-authored message that closes a turn or handoff to the user or another lane ends with the timestamp, active model, and active reasoning level as its final nonblank line:

```text
[YYYY-MM-DDTHH:MM:SS±HH:MM | Model | Reasoning]
```

Use the send-time RFC 3339 timestamp with local offset and the settings actually active for that final message. Do not add the footer to interim progress updates, non-final questions, tool output, or system-generated interface messages. Use `Unknown` rather than guessing metadata that is not available.

The user owns product intent, final acceptance, and release authorization. Assignments are passed manually using copy/paste prompts. Not all lanes need to be active at once.

Normal delivery follows two paths:

```text
User → PM → Senior Dev - Content → Mid Dev - Content or Junior Dev - Content
                                   ← Developer handoff
          ← Senior Dev technical/visual QA

User → PM → Senior Dev - Infrastructure → Mid Dev - Infrastructure or Junior Dev - Infrastructure
                                          ← Developer handoff
          ← Senior Dev technical/regression QA

Both Senior Devs → PM acceptance QA → User review
```

The Workflow Architect reports directly to PM and is activated only for a user-triggered workflow review or approved maintenance task. It is not part of routine page or infrastructure delivery.

## How Work Proceeds

1. **Intake:** PM records the outcome, concerns, scope, and existing decisions.
2. **Baseline:** The responsible Senior Dev inventories sources, repository state, references, dependencies, and acceptance criteria.
3. **Assignment:** Senior Dev selects its Mid Dev or Junior Dev and defines bounded ownership. PM coordinates dependencies spanning both teams.
4. **Implementation:** Developers complete assigned changes and verify them before returning to their Senior Dev.
5. **Integration:** Senior Devs review handoffs and coordinate one developer to generate shared output after dependent source work is ready.
6. **Technical QA:** Each Senior Dev directly checks its workstream and maps concerns to evidence and unresolved gaps.
7. **Acceptance QA:** PM reviews the combined result against the user's concerns and spot-checks the experience, evidence, and review instructions.
8. **User review:** PM provides a reproducible review path and the user accepts or requests corrections.
9. **Release:** PM prepares the scope. The user or an explicitly designated executor performs separately authorized Git and target operations.

A correction returns through the responsible Senior Dev with a bounded assignment. It does not restart unrelated accepted work.

If Content needs a shared capability, Senior Dev - Content sends the prerequisite to PM. PM assigns it to Senior Dev - Infrastructure. The reviewed result returns through PM to Senior Dev - Content. Independent work may continue; shared-file writes and generation stay coordinated.

Use Junior Dev for well-specified changes following established patterns. Use Mid Dev for ambiguity, complex behavior, and shared-contract changes. A Junior Dev escalates to its Senior Dev when the assignment needs clarification or reassignment; it does not dispatch another developer.

## Preparing an Assignment

Use this prompt structure:

```text
Objective:
Assigned lane and responsible Senior Dev (or PM for Workflow Architect):
Model and reasoning effort:
Approved scope and user concerns:
Excluded scope:
Authoritative source and reference:
Owned files and generated outputs:
Dependencies and sequencing:
Allowed mutations:
Acceptance criteria and required proof:
Required final-message footer: `[YYYY-MM-DDTHH:MM:SS±HH:MM | Model | Reasoning]`
Stop conditions / escalation:
Return handoff to: Assigned Senior Dev / PM for Workflow Architect
```

Before parallel work, identify each lane's files, dependencies, outputs, and state. Source edits can be independent while generation still shares the same output files. Keep shared writes sequential.

## Commands and Environments

Each adopting project should document its actual build, preview, lint, test, and serving commands separately.

For each command, identify:

- Purpose and prerequisites.
- Whether it changes source, metadata, generated output, runtime, or external systems.
- Expected output and verification limits.
- Process/port ownership when it starts a watcher or server.

A build can modify files even when invoked as a “check.” PM and Seniors inspect existing artifacts; the responsible Senior assigns generation to a developer.

Before conflicting source work, identify active watchers and arrange for their owner to stop them. Do not stop unrelated processes. After integrated source changes, use one generation owner and review the resulting diff.

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

## Handoffs and Approval

Developer lanes return to their assigned Senior; the Workflow Architect returns directly to PM. Seniors consolidate delivery findings for PM. Use the [required handoff checklist](AGENTS.md#required-developer-handoff).

A release request should identify the artifact, destination, evidence, exceptions, and rollback. Commit, push, PR actions, merge, deployment, and destructive cleanup require the user's applicable authorization. Approval for one action does not authorize the next.

PM and both Seniors remain read-only. Git writes belong to the user or an explicitly authorized executor for the named operation. The Workflow Architect may stage, commit, and push user-authorized files within its approved workflow-file allowlist after verifying the exact staged scope; it may not include application files or unrelated changes.

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
