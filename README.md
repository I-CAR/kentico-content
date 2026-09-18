# Agent and Developer Workflow

This guide explains how work moves from a user request through implementation, validation, and approval. The process is reusable across projects.

[AGENTS.md](AGENTS.md) is the authoritative workflow contract. It defines role permissions, ownership, required evidence, and approval gates. This README is a practical entry point, not a second policy source.

## Roles and Communication

User → Project Manager → Senior Dev → Mid-Level Dev / Junior Dev → Senior Dev → Project Manager → User

| Role | Responsibility |
| --- | --- |
| User | Product intent, scope decisions, final acceptance, and release authorization |
| Project Manager | Intake, sequencing, delivery tracking, Git/release preparation, and approval gates |
| Senior Dev | Decomposition, lane ownership, integration coordination, review, and validation |
| Mid-Level Dev | Bounded implementation and assigned generation |
| Junior Dev | Read-only inventories, tracing, and verification support |

Assignments are passed manually using copy/paste prompts unless the user explicitly authorizes automatic delegation. Functional lane names do not override role permissions.

## How Work Proceeds

1. **Intake:** PM records the outcome, concerns, scope, and existing decisions.
2. **Baseline:** Senior inventories sources, repository state, references, dependencies, and acceptance criteria.
3. **Assignment:** Senior defines bounded developer lanes and coordinates file ownership.
4. **Implementation:** Mid-Level completes assigned changes and checks; Junior supplies read-only evidence where useful.
5. **Integration:** Senior reviews lane handoffs and assigns a single generation owner when needed.
6. **Validation:** Senior maps every concern to the appropriate evidence and reports unresolved gaps.
7. **User review:** PM provides a reproducible review path and the user accepts or requests corrections.
8. **Release:** PM prepares and performs only the separately authorized Git and target operations.

A correction returns through Senior with a bounded assignment. It does not restart unrelated accepted work.

## Preparing an Assignment

Use this prompt structure:

```text
Objective:
Assigned role:
Approved scope and user concerns:
Excluded scope:
Authoritative source and reference:
Owned files and generated outputs:
Dependencies and sequencing:
Allowed mutations:
Acceptance criteria and required proof:
Stop conditions / escalation:
Return handoff to: Senior Dev
```

Before parallel work, identify each lane's files, dependencies, outputs, and state. Source edits can be independent while generation still shares the same output files. Keep shared writes sequential.

## Commands and Environments

Each adopting project should document its actual build, preview, lint, test, and serving commands separately.

For each command, identify:

- Purpose and prerequisites.
- Whether it changes source, metadata, generated output, runtime, or external systems.
- Expected output and verification limits.
- Process/port ownership when it starts a watcher or server.

A build can modify files even when invoked as a “check.” Read-only reviewers should inspect existing artifacts or ask Senior to assign generation to Mid-Level.

Before conflicting source work, identify active watchers and arrange for their owner to stop them. Do not stop unrelated processes. After integrated source changes, use one generation owner and review the resulting diff.

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

Developer lanes return to Senior. Senior consolidates findings for PM. Use the [required handoff checklist](AGENTS.md#required-developer-handoff).

A release request should identify the artifact, destination, evidence, exceptions, and rollback. Commit, push, PR actions, merge, deployment, and destructive cleanup require the user's applicable authorization. Approval for one action does not authorize the next.

Keep current delivery status in the task handoff. Avoid permanent statements that a repository is production-ready or has no regressions.

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
