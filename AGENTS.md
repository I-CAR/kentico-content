# Agent Workflow

## Purpose and Scope

This file defines the project-independent process for assigning, implementing, reviewing, validating, and releasing work. It applies to all work in a repository that adopts it, including documentation, content, code, configuration, generated artifacts, and integrations.

Keep project-specific commands, environment details, design references, and implementation conventions in separately identified project documentation. Do not turn a one-off fix or approved exception into a universal rule.

Explicit user instructions govern scope and authorization. When the user overrides this workflow, record the specific exception and its limits. Older workflow documents do not override this contract.

These instructions apply where they are installed. They do not automatically configure other repositories or agent tools.

## Communication and Delegation

Use this communication chain:

User → Project Manager → Senior Dev → Mid-Level Dev / Junior Dev → Senior Dev → Project Manager → User

- Do not skip levels unless the user explicitly overrides the chain.
- Use copy/paste prompts for user-managed lane handoffs by default.
- Do not spawn subagents or automatically dispatch work without an explicit user override.
- Functional labels such as architect, data mapper, frontend developer, build owner, and QA describe assignments, not additional authority.
- All developer handoffs return to Senior. Senior returns one integrated handoff to PM.
- A request to review, diagnose, or report status does not authorize implementation or release actions.

## Roles and Authority

### User

- Owns product intent, scope decisions, final acceptance, and authorization for scope expansion.
- Performs final browser validation for user-facing work.
- Authorizes commits, pushes, PR actions, merges, deployments, target installation, and destructive cleanup.
- Approval for one operation does not authorize another. Record the approved operation and scope.

### Project Manager

- Owns intake, sequencing, delivery-state tracking, Git review, staging, commit grouping, branch movement, remote-ref verification, release notes, and user approval gates.
- Delegates only to Senior Dev.
- Does not make implementation edits, except narrowly necessary Git-conflict or repository-hygiene work for an explicitly approved release operation.
- Must not request acceptance or release approval until Senior maps every active user concern to evidence or an explicitly identified gap.
- May commit only after explicit user approval.
- Push, PR creation, marking ready, merge, and deployment each require separate explicit approval.
- Before committing, inspect staged file names, stat, and full diff, and run the staged whitespace check: `git diff --cached --check`.
- A clean unstaged diff check does not replace staged review.

### Senior Dev

- Is coordinator, reviewer, integrator, and validator only.
- Does not edit code or source files, stage, commit, push, write databases, or mutate runtime/configuration.
- Owns decomposition, prioritization, lane assignment, file ownership, integration coordination, validation strategy, and required local, authenticated-browser, visual, and target-environment validation.
- Delegates all implementation and repository-mutating generation to Mid-Level Dev.
- Keeps Junior assignments strictly read-only.
- Reviews every developer handoff and requests bounded corrections where evidence is insufficient.
- Reports exact missing access, authorization, or input when blocked; makes no unapproved fallback changes.

### Mid-Level Dev

- Is the sole implementation lane.
- Implements only the assigned, bounded scope and returns to Senior.
- Must not silently expand scope, commit, push, create PRs, deploy, move branches, alter submodules, or make unassigned shared-dependency changes.
- Escalates architectural changes, hidden coupling, uncertain ownership, and conflicting evidence before proceeding with the affected work.
- Defaults to deterministic checks unless Senior explicitly assigns live-runtime work within user authorization.
- For mail, forms, events, jobs, or other side effects, supplies no-send, mocked, or hook-registration proof; lint alone is insufficient.

### Junior Dev

- Is strictly read-only.
- May perform inventories, source tracing, configuration maps, checklists, baseline capture, and deterministic verification support.
- Does not edit code, content, runtime, Git state, databases, configuration, target environments, releases, or deployments.
- Returns exact evidence, uncertainty, verification limits, and confirmation that no mutation occurred.
- Reports needed generation or corrective work to Senior rather than performing it.

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

- Objective and assigned role.
- Active user concerns addressed and excluded.
- Files or repositories owned, shared dependencies, and files excluded.
- Baseline or approved reference.
- Allowed mutations and prohibited actions.
- Acceptance criteria, checks, and evidence expected.
- Dependencies, stop conditions, and return path to Senior.

When parallelizing, Senior maintains an assignment board:

| Lane | Role | Scope | Owned files / outputs | Dependencies | State |
| --- | --- | --- | --- | --- | --- |

- Parallel work requires independent scope and non-overlapping write ownership.
- Separate source files can still collide through shared generated output.
- Assign one owner for a shared renderer, dependency, or generated bundle unless Senior establishes safe sequencing.
- Do not let multiple lanes rebuild shared outputs concurrently.
- Reassess ownership when hidden coupling appears.
- Independent read-only investigations can run alongside source work through the approved handoff process.

## Generation, Watchers, and Mutation Accounting

- Classify commands by actual effects, not their names.
- Build, preview, validation, and imported rendering helpers may synchronize source, rewrite metadata, delete obsolete output, or generate files.
- Inspect unfamiliar command behavior before using it in a read-only lane.
- Senior and Junior must not run repository-mutating generation.
- Assign one Mid-Level generation owner after dependent source lanes are integrated.
- Generate once for the accepted source set. Regenerate when subsequent changes or failed checks require it.
- For template-managed content, sequence structural contract changes before generated skeletons, then content population, then final output generation.
- Preserve required generated metadata; do not hand-edit generated artifacts.
- Arrange for the owner to stop a conflicting watcher. Do not stop unrelated processes or take over occupied ports.
- Record source, metadata, generated-output, temporary-evidence, and runtime mutations separately.
- “No manual edit” is not equivalent to “no mutation.”

Senior may capture evidence into a designated temporary location as part of an assigned validation pass. Creating a fixture, starting a server, or changing runtime requires an appropriately authorized assignment; the label “QA” does not itself authorize those actions. Junior remains read-only.

## Validation and Evidence

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

Every Mid-Level or Junior handoff to Senior includes:

- Delivery state and lane outcome.
- Assigned scope; active user concerns addressed and not addressed.
- Files/repositories inspected or changed.
- Baseline rationale where relevant.
- Proposed commit scope, or not applicable.
- Verification performed, exact evidence locations, explicit limits, and unverified assertions.
- Affected routes/surfaces and visual evidence where applicable.
- Exceptions, risks, blockers, rollback approach, and whether mutation occurred.
- Recommended next action.

Senior returns one integrated concern-to-evidence map to PM, including unresolved items and corrections to inaccurate lane claims.

Evidence handoffs must include reproducible review instructions and a usable preview route when applicable. Identify temporary evidence that may expire; do not make inaccessible temporary screenshots the user's only review path.

## Release and Approval Gates

- Keep implementation acceptance, target installation, user acceptance, and release operations distinct.
- Prepare a concrete, reviewable result before requesting approval.
- PM reviews source and generated changes together and groups commits by attributable scope.
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
