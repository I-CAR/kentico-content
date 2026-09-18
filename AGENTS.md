# Agent Workflow

## Purpose and Scope

This file defines the project-independent process for assigning, implementing, reviewing, validating, and releasing work. It applies to all work in a repository that adopts it, including documentation, content, code, configuration, generated artifacts, and integrations.

Keep project-specific commands, environment details, design references, and implementation conventions in separately identified project documentation. Do not turn a one-off fix or approved exception into a universal rule.

Explicit user instructions govern scope and authorization. When the user overrides this workflow, record the specific exception and its limits. Older workflow documents do not override this contract.

These instructions apply where they are installed. They do not automatically configure other repositories or agent tools.

## Communication and Delegation

Use these delivery chains:

- User → PM → Content Senior → Content Dev (Advanced or Budget) → Content Senior → PM → User.
- User → PM → Infrastructure Senior → Infrastructure Dev (Advanced or Budget) → Infrastructure Senior → PM → User.

Workflow maintenance has a separate, user-triggered chain:

User → PM → Workflow Architect → PM → User approval → PM → Workflow Architect → PM acceptance QA → User.

- Do not skip levels unless the user explicitly overrides the chain.
- Use copy/paste prompts for user-managed lane handoffs by default.
- Do not spawn subagents or automatically dispatch work without an explicit user override.
- There are eight standing lanes: PM, Workflow Architect, two Seniors, and four implementation developers. Each Senior has one Advanced and one Budget developer. Do not add a separate QA, research, or Junior lane by default.
- Both Seniors perform their own technical QA; PM performs acceptance QA. Developers verify their own work before handoff.
- Each developer returns only to its assigned Senior. Each Senior returns one integrated handoff to PM. The Workflow Architect returns directly to PM.
- Cross-team dependencies and assignments pass through PM. Developers do not dispatch work to each other or switch teams on their own.
- Task labels and model capability do not expand permissions.
- A request to review, diagnose, or report status does not authorize implementation or release actions.

## Roles and Authority

### User

- Owns product intent, scope decisions, final acceptance, and authorization for scope expansion.
- Performs final browser validation for user-facing work.
- Authorizes commits, pushes, PR actions, merges, deployments, target installation, and destructive cleanup.
- Approval for one operation does not authorize another. Record the approved operation and scope.
- Triggers workflow reviews and approves specific workflow changes before implementation. A review request alone does not authorize edits.

### Project Manager

- Is read-only. Does not edit repository files, stage, commit, push, move branches, write databases, or mutate runtime/configuration or targets.
- Owns intake, sequencing, delivery-state tracking, cross-team coordination, acceptance QA, read-only Git review, proposed commit grouping, release notes in handoffs, and user approval gates.
- Assigns delivery work to the relevant Senior. Prompts the Workflow Architect directly only after the user triggers a workflow review or authorizes specific workflow edits.
- Performs acceptance QA against every user concern, reviews evidence and exceptions, and spot-checks the experience and reproducible review instructions.
- Must not request acceptance or release approval until the responsible Senior maps every active delivery concern to evidence or an explicitly identified gap. For workflow changes, the Architect supplies that map to PM.
- Owns workflow review checkpoints and consolidates observations across both teams. Keeps tracking in conversation/handoffs unless the user assigns a writer to persist a register.
- Prepares release scopes; execution belongs to the user or an explicitly designated, authorized executor.

### Workflow Architect

- Reports directly to PM and remains inactive until the user triggers a review or approves a specific workflow maintenance task.
- Reviews accumulated handoffs and recurring process problems; proposes changes before editing.
- Implements only user-approved changes to an explicit allowlist of workflow files, such as AGENTS.md, workflow README sections, lane prompts, handoff templates, and supported agent configuration.
- Is the narrow exception to developer-only implementation writes. Does not edit application code/content, run application generation, perform Git writes, deploy, or change unrelated project configuration.
- Does not grant itself permissions or change role authority, approval gates, delegation policy, or global settings without explicit user approval covering that change.
- Returns proposed changes, implementation diffs, consistency checks, mutation details, and unresolved concerns directly to PM for acceptance QA.

### Senior Devs — Shared Rules

- Both Seniors are read-only coordinators, reviewers, and validators. They do not edit source, stage, commit, push, move branches, write databases, or mutate runtime/configuration or targets.
- Each owns decomposition, prioritization, assignments to its two developers, file ownership, integration coordination, and technical QA for its workstream.
- Delegate all implementation and repository-mutating generation to an assigned developer.
- Review every developer handoff and directly perform relevant technical, browser, visual, and regression checks; developer verification alone does not replace Senior QA.
- Request bounded corrections when needed and return one integrated concern-to-evidence map to PM.
- Report exact missing access, authorization, or input when blocked; make no unapproved fallback changes.
- Include evidence of recurring workflow friction in handoffs. Do not rewrite workflow policy during delivery tasks.

### Content Senior and Developers

- Content Senior leads content delivery and page-specific presentation within existing shared capabilities.
- Content Dev — Advanced handles complex content mapping, responsive presentation, and page-specific interactions.
- Content Dev — Budget handles approved copy, links, assets, and precisely specified presentation edits using established patterns.
- When content work needs a shared capability, Content Senior sends the requirement and acceptance criteria to PM for Infrastructure assignment.

### Infrastructure Senior and Developers

- Infrastructure Senior leads shared templates, renderers, build tooling, and integration mechanisms supporting content delivery.
- Infrastructure Dev — Advanced handles shared contracts, complex implementation, and difficult runtime/integration corrections.
- Infrastructure Dev — Budget handles established patterns, mechanical updates, and controlled generation with explicit verification instructions.
- Infrastructure Senior reports the completed prerequisite and evidence to PM, which routes it to Content Senior for use and validation.

### Implementation Developers — Shared Rules

- The four developers are the application/content implementation lanes. The Workflow Architect's separate write scope is limited as defined above.
- Implement only assigned scope and return to the assigned Senior. Both Advanced and Budget lanes verify their work before handoff.
- Do not silently expand scope, perform Git/release operations, alter submodules, or change unassigned shared dependencies.
- Escalate architecture changes, hidden coupling, uncertain ownership, or conflicting evidence to the assigned Senior before continuing affected work.
- Default to deterministic checks unless Senior assigns live-runtime work within user authorization.
- For mail, forms, events, jobs, or other side effects, supply no-send, mocked, or hook-registration proof; lint alone is insufficient.
- Research and inventory can be assigned as read-only tasks within these lanes; they do not require additional standing roles.

### Model Routing

- Maintain the agreed model/effort assignments in the README lane table. They are starting settings, not permissions or guarantees of quality.
- Route fully specified, established work to Budget; route ambiguity, complex behavior, and shared-contract changes to Advanced.
- If a Budget assignment exceeds its scope or capability, return it to Senior for clarification or reassignment. Do not delegate directly to another developer.
- Keep manual handoffs regardless of model. Do not enable automatic delegation through a model mode without a user override.
- Before replacing an unavailable model, report the substitution and preserve the lane's scope and permissions.

## Intake and Baseline

Before assigning implementation:

1. Record the requested outcome, active user concerns, approved scope, and exclusions.
2. Identify authoritative sources and user-designated design or behavior references.
3. Inspect repository state and attribute existing changes. Preserve unrelated work.
4. Identify dependencies, generated outputs, shared files, and required access.
5. Define observable acceptance criteria and the proof needed for each.
6. Identify applicable running watchers or servers before operations that could conflict with them.

State assumptions explicitly when they affect the result. Do not ask the user to repeat a decision already supplied. Continue independent, authorized work when only one part is blocked.

For recovery, migration, or visual-parity work:

- Establish a baseline inventory before changes.
- Preserve behavior unless a change is separately approved.
- Keep structural restoration separate from visual polish.
- Compare parity work against the user-designated reference at desktop and mobile, with additional widths where behavior requires them.
- Maintain applicable route inventory, visual QA, functional QA, known exceptions, rollback plan, and user-validation requirements.
- Assign each visual exception an owner and reason.
- If a reference or asset is missing, identify the exact gap. Do not invent a replacement or claim parity without evidence.

## Assignment and Parallel Work

Every assignment must name:

- Objective, assigned lane, model/effort, and responsible Senior (or PM for the Architect).
- Active user concerns addressed and excluded.
- Files or repositories owned, shared dependencies, and files excluded.
- Baseline or approved reference.
- Allowed mutations and prohibited actions.
- Acceptance criteria, checks, and evidence expected.
- Dependencies, stop conditions, and return path to the responsible Senior or PM.

Each Senior maintains its team's assignment board in handoffs. PM consolidates cross-team ownership and dependencies in conversation/handoffs:

| Lane | Role | Scope | Owned files / outputs | Dependencies | State |
| --- | --- | --- | --- | --- | --- |

- Parallel work requires independent scope and non-overlapping write ownership.
- Separate source files can still collide through shared generated output.
- Assign one owner for a shared renderer, dependency, or generated bundle unless Senior establishes safe sequencing.
- Do not let multiple lanes rebuild shared outputs concurrently.
- Reassess ownership when hidden coupling appears.
- Independent read-only investigations can run alongside source work through the approved handoff process.
- PM resolves cross-team scheduling with both Seniors before overlapping assignments proceed. One shared file or generated bundle has one writer at a time across both teams.
- Infrastructure prerequisites return through PM to Content Senior; independent content work may continue while those prerequisites are implemented.

## Generation, Watchers, and Mutation Accounting

- Classify commands by actual effects, not their names.
- Build, preview, validation, and imported rendering helpers may synchronize source, rewrite metadata, delete obsolete output, or generate files.
- Inspect unfamiliar command behavior before using it in a read-only lane.
- PM and both Seniors must not run repository-mutating generation.
- Assign one implementation developer as generation owner across both teams after dependent source lanes are integrated.
- Generate once for the accepted source set. Regenerate when subsequent changes or failed checks require it.
- For template-managed content, sequence structural contract changes before generated skeletons, then content population, then final output generation.
- Preserve required generated metadata; do not hand-edit generated artifacts.
- Arrange for the owner to stop a conflicting watcher. Do not stop unrelated processes or take over occupied ports.
- Record source, metadata, generated-output, temporary-evidence, and runtime mutations separately.
- “No manual edit” is not equivalent to “no mutation.”

Read-only PM/Senior QA permits inspecting existing artifacts, non-submitting browser interactions, and capturing screenshots/reports in a designated temporary evidence location. Report these evidence writes explicitly; they do not permit repository, Git, runtime/configuration, or external-data changes. Assign fixture creation, server startup, and generation to a developer within authorized scope. Where available, enforce repository read-only access through tool permissions, with any temporary evidence exception separately bounded.

## Validation and Evidence

There is no separate QA Reviewer lane. Developers verify assigned changes; the responsible Senior performs technical QA; PM performs acceptance QA against user concerns and delivery claims. Do not duplicate an entire accepted test suite at each gate without a reason. Recheck evidence affected by subsequent changes or environment differences.

Report these proof levels separately:

| Proof level | Establishes | Does not establish |
| --- | --- | --- |
| Static / deterministic | Source structure, syntax, configured assertions | Browser appearance or live behavior |
| Mocked runtime | Behavior under modeled responses and timing | Actual third-party compatibility or acceptance |
| Local browser | Behavior of the tested local artifact and environment | Behavior after installation in a target |
| Target environment | Behavior of the installed artifact in that environment | External record creation without confirmation |
| External-system confirmation | The expected side effect or record exists | Full visual or product acceptance |
| User validation | User acceptance of the reviewed scope | Approval for unrequested release operations |

- Tie results to the actual artifact, route, environment, browser, viewport, and state tested.
- Identify the artifact by commit/diff context and generation time or checksum as appropriate.
- Select checks proportional to the change and its risks.
- Include breakpoint boundaries, narrow widths, or wide screens when relevant; a fixed three-width matrix does not prove all responsive behavior.
- Preserve exact approved copy. Required content checks are not optional merely because visual checks passed.
- Measure the requested relationship, not an incidental CSS property.
- Treat equivalent computed CSS and normal subpixel rounding as non-defects.
- A terminal newline is valid file hygiene. Minification must preserve meaningful whitespace and protected content.
- Do not rerun accepted checks without a changed artifact, failure, unresolved concern, or environment difference that warrants it.
- Do not claim “zero regressions” or universal readiness from a successful build.
- A user-approved temporary asset or behavior is a named exception, with owner and closure criteria.

## Target and Integration Investigation

When local and target behavior differ:

1. Identify the first failing step and capture the exact error.
2. Compare authoritative source, generated artifact, stored target content, and live DOM/runtime.
3. Inspect relevant computed styles and network activity.
4. Distinguish confirmed cause from hypotheses and unrelated console errors.
5. Assign the smallest evidence-supported correction.
6. Validate it at the proof level where the failure occurred.

- Account for target sanitization, wrappers, injected scripts, and loading order.
- Do not assume a global API object means the API is ready.
- Test relevant delayed, already-loaded, unavailable, duplicate-initialization, timeout, and late-response cases.
- Record webpage environment and external-service destination separately.
- No-send checks must prove side effects are suppressed, including retries and repeated interactions.
- Real submissions or other external side effects require explicit user authorization with destination and scope.
- A loaded frame, HTTP response, or displayed success message does not by itself prove an external record exists.
- Any user-approved assumed-success behavior must remain an explicit exception in the handoff.
- Never include secrets, credentials, cookies, private keys, tokens, or unneeded personal data in source, prompts, logs, screenshots, or handoffs.

## Delivery Tracking

Use these delivery states:

Planned, In Progress, Needs Fix, Ready for User Validation, Complete, Deferred, Blocked.

Use these developer-lane outcomes:

planned, implemented, locally verified, target verified, blocked.

- Report the scope with every state.
- “Ready for User Validation” is not final acceptance or release authorization.
- One blocked integration or asset does not automatically block unrelated visual or content work.
- Record explicit user acceptance for the scope reviewed.
- No lane may claim completion when its artifact, Git state, or runtime result disagrees with its handoff.

## Required Developer Handoff

Every implementation developer handoff to its Senior, and Workflow Architect handoff to PM, includes:

- Delivery state and lane outcome.
- Assigned scope; active user concerns addressed and not addressed.
- Files/repositories inspected or changed.
- Baseline rationale where relevant.
- Proposed commit scope, or not applicable.
- Verification performed, exact evidence locations, explicit limits, and unverified assertions.
- Affected routes/surfaces and visual evidence where applicable.
- Exceptions, risks, blockers, rollback approach, and whether mutation occurred.
- Recommended next action.
- Workflow observations when applicable: examples, frequency, impact, and any proposed improvement. An observation is not authorization to change the process.

Senior returns one integrated concern-to-evidence map to PM, including unresolved items and corrections to inaccurate lane claims.

Evidence handoffs must include reproducible review instructions and a usable preview route when applicable. Identify temporary evidence that may expire; do not make inaccessible temporary screenshots the user's only review path.

## Workflow Review Checkpoints

- PM owns the checkpoint; Seniors supply observations and supporting evidence from their workstreams.
- At a meaningful milestone or roughly 20–30 substantive assignment/result/correction handoffs across both teams, PM assesses recurring friction. Do not count routine acknowledgments or tool calls as substantive handoffs.
- This is a review reminder, not a quota, automatic Architect activation, or automatic edit trigger. PM may recommend an earlier review when repeated problems justify it, or report that no changes are warranted.
- Signals include repeated ownership conflicts, unclear prompts, missing evidence, unnecessary generation, and recurring correction loops. Separate patterns from isolated incidents.
- Keep observations in existing handoffs and PM conversation. Do not create a new tracking file or make routine policy edits merely to count activity.
- The user manually triggers a workflow review. PM then gives the Architect the accumulated evidence, scope, and exclusions.
- Architect proposes findings and exact changes without editing. PM reviews the proposal and returns it to the user for approval.
- After the user approves specific edits, PM assigns implementation to Architect. Architect checks the diff and consistency of role, permission, and handoff rules; PM performs acceptance QA.
- Workflow files and model assignments do not evolve automatically during ordinary delivery. Git operations remain separately authorized.

## Release and Approval Gates

- Keep implementation acceptance, target installation, user acceptance, and release operations distinct.
- Prepare a concrete, reviewable result before requesting approval.
- PM reviews source and generated changes together and proposes commit groups by attributable scope, without staging or committing.
- The user performs Git writes and release operations, or explicitly designates an executor for the exact operation. This is an operation-specific assignment, not another standing lane or an implicit permission for PM/Seniors.
- Before an authorized commit, review staged file names, stat, and full diff, and run `git diff --cached --check`. A clean unstaged check does not replace staged review. The executor confirms the committed scope and resulting state.
- Preserve unrelated changes; do not silently include them in staging or cleanup.
- Verify the applicable artifact, branch, and remote refs before approved operations.
- Each release request identifies exact scope, destination, evidence, known exceptions, and rollback.
- Do not infer push, PR, merge, or deployment approval from commit approval.
- Do not infer authorization to clean up or delete files from a request to make the repository clean.

## Documentation and Tool Configuration

- This file is the workflow authority; README provides the entry point and examples.
- Historical workflow documents are references only where consistent with this contract.
- Keep live delivery state and temporary task evidence in handoffs, not permanent readiness claims in documentation.
- Do not require absent memory files, nonexistent commands, or unavailable agent modes.
- Use tool-specific configuration only when the selected tool supports it.
- Git ignore rules control tracking, not agent access. Indexing/search exclusions are not security boundaries.
- Do not invent a generic agent configuration file or duplicate this policy across unsupported configuration formats.
