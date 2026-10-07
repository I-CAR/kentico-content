# I-CAR Kentico Info — Agent Workflow

[AGENTS.md](AGENTS.md) governs roles, permissions, routing, evidence, and formatting; this guide is its entry point. Acronym: `IC`. Workspace: `/Volumes/Sites/I-CAR/content/kentico/info`.

## Start a Thread or Phase

An **initiation prompt** starts a thread's current project/phase; follow-ups do not restart it. Immediately after its header:

1. Read current AGENTS.md, README.md, the prompt, and applicable folder instructions.
2. Confirm role, authority, coordinator, ownership, exclusions, and return path.
3. Inspect the folders/artifacts relevant to that role and assignment, read-only.

Inspect assigned pages/templates/presentation for Content; scripts/shared assets/configuration/build contracts for Infrastructure; cross-team scope for PM/Lead; workflow materials for Architect. Orientation grants no write ownership.

PM's initiation response is conversational, even after a formatted prompt: ask for the current mission/goal unless already supplied. No header, footer, or progress block is required unless requested. On receiving the goal, PM audits relevant current state, then maps numbered phases and lanes with outcomes, dependencies, routing, acceptance units, and reviewers. One phase is still Phase 1; the initial prompt may provisionally use `Phase 1 · Intake and Planning`. Other lanes inherit PM's plan.

## Delivery Routes

| Scope | Route |
| --- | --- |
| One workstream | User → PM → Workstream Senior → Developers → Senior QA → PM QA → User |
| Multiple workstreams | User → PM → Lead Senior → Workstream Seniors → Developers → Senior QA → Lead QA → PM QA → User |
| Workflow maintenance | User → PM → Architect proposal → PM → User approval → Architect implementation through PM → PM QA → User |

PM selects the route; one workstream may have several developers. Cross-workstream needs return to PM for Lead activation. Senior consultations are read-only, without developer activation.

Users relay handoffs; agents never spawn/dispatch agents. Developers return only to their Senior. Formatting grants no authority.

## Roles and Names

| Role | Responsibility / authority |
| --- | --- |
| IC PM | Audits, planning, routing, acceptance, optional visual QA, local Git, user QA, pass completion; progress owner only without Lead |
| IC Lead Senior | Read-only multi-workstream coordination, nonvisual integration QA, and progress ownership when involved |
| IC Content Senior | Read-only content coordination and nonvisual technical QA |
| IC Infrastructure Senior | Read-only shared-system coordination and nonvisual technical QA |
| Mid developers | Assigned implementation involving complexity, behavior, or shared contracts; own verification and applicable visual QA |
| Junior developers | Very simple work with exact Senior instructions; own verification and applicable visual QA |
| IC Workflow Architect | User-triggered workflow review and approved workflow-file implementation; returns to PM |

Developer names: `[Acronym] [Workstream] [Level] [A, B, C...]`, e.g. `IC Content Mid A` or `IC Infrastructure Junior A`. No “Lane” or numeric suffix. Seniors may assign independent lettered threads; AGENTS.md defines role/model settings.

PM can directly make an explicitly authorized, named-file edit only if mechanical, unambiguous, and verifiable by focused inspection, without implementation/design decisions or behavior/layout/shared-dependency/generation/runtime changes. Beyond that threshold, PM explains the scope and asks about development routing unless it is already authorized. Work size and workstream count are separate decisions.

## Assign and Review

Only PM performs audits, on receiving a goal or an explicit audit request. Other lanes return audit requests to PM; assigned orientation, QA, consultations, and Architect workflow reviews remain scoped checks, not audit authority. Audits are read-only and bounded to the goal/request; findings inform planning, not automatic implementation.

Every assignment names its header ID, body-level version, purpose, authority, objective, ownership/exclusions, coordinator, dependencies, allowed mutations, expected returns, checks/evidence, stop conditions, and return destination. Junior instructions additionally specify the exact change, existing pattern, output, and verification steps. Issue only ready, authorized work.

New production IDs use `[CLIENT]-P[PHASE]-[WORKSTREAM]-R[ROUND]`, e.g. `IC-P1-FE-R1`. Codes: FE = Frontend, CM = CMS, IN = Integration, PL = Platform. These classify assignments; existing Content/Infrastructure Seniors retain ownership and routing responsibilities. Seniors allocate unique rounds per client/phase/code; Lead coordinates shared-code allocation across teams. Each Senior → developer → Senior pass has one ID; parallel passes get distinct rounds, and subsequent correction passes get new rounds. Forwarding, QA, and clarification do not increment rounds.

Body-level versions (`v1`, `v2`) distinguish revised instructions within a round. Preserve active legacy IDs; new passes use the new scheme and reference predecessors. Use `Not assigned` for planning/workflow maintenance or unallocated production IDs; no WF or other extra code is implied. Consolidated headers list relevant IDs. The progress owner's assignment table tracks ID/version and ownership only inside its progress update; routine assignments/QA handoffs supply this information in concise text, without repeating the table. Required assignment details and technical evidence tables remain.

Keep one writer per shared file/output/runtime. Assign generation and preview startup to developers; inspect command effects before treating a command as read-only. One generation run is authorized at a time; use the exact deterministic retry contract in AGENTS.md when applicable. Batches of three or more similar pages use a rendered pilot, one remaining batch, per-page evidence, and one Senior review.

Each reviewer first checks readiness:

- Senior waits for all assigned developer returns for the review batch.
- Lead waits for all assigned Senior QA returns.
- PM waits for Lead's return, or the direct Senior return on the one-workstream route.

If prompted early, list the missing handoffs. Do not declare QA complete. Immediate implementation reporting and independent authorized work can continue while a review awaits returns.

Developers perform applicable visual QA plus implementation/tests. Seniors review technical correctness without visual verification. Lead checks integration, dependencies, and combined coverage without visual verification. PM checks user intent, acceptance, usability, and exceptions, and may verify visuals. Do not repeat an accepted full suite without changed evidence or a specific concern.

Use actual artifacts as evidence. Keep static, rendered, mocked, local-browser, target, external-confirmation, and user proof distinct. Schema success does not prove a renderer consumed content. New/converted content needs field-by-field rendered proof. Claims passed along without independent checking are `relayed, not verified`.

## Message Templates

Use the strict format except for conversational replies to unformatted user messages, PM initiation responses, and Architect responses unless requested. A request for a **prompt**, including `prompt` alone, produces formatted output at the thread's current phase/state without restarting, advancing, or expanding authority. Requested prompts/handoffs override exceptions; commentary/tool output stays unformatted. No Cc/Re; use one space after labels, hard breaks, and the footer blank line before Assignment/Status.

Heading:

```markdown
# [Sending Lane] → [Receiving Lane(s)]

**Workspace:** [Workspace Path]\
**Project:** [Project]\
**Assignment:** [Assignment ID]\
**Phase:** Phase [#] · [Phase Name]\
**Time:** [Month D, YYYY] · [h:mm:ss] [AM/PM] [EDT/EST]

--
```

For initiation prompts, place the three initiation tasks first after this header. For later prompts, remind the recipient to read current instructions. Assignment contains only the ID, no short title/version. Put versions and replacement explanations in the body; revised headings have identical structure. Recipients act only on the latest version and do not repeat duplicate ID/version assignments.

For multiple recipients, include a self-contained assignment for each and this body instruction:

> Act only on the assignment addressed to your established lane. Other assignments are coordination context. If your lane has no assignment, report that rather than choosing another role.

Lead Senior owns progress when involved; otherwise PM does. Only the owner publishes the following consolidated update before the footer on formatted messages; conversational exceptions remain. Seniors/developers report completed work, remaining work, QA, blockers, and assignment/ownership changes in concise text, without progress percentages or phase/assignment tables. PM does not duplicate Lead's updates. Route changes explicitly transfer the phase plan, estimates, assignments, and evidence to the new owner without resetting progress.

```markdown
--

**Project:** [Project]\
**Phase:** Phase [#] · [Phase Name]\
**Project Progress:** [#]% [character progress bar]

| Phase | Name / outcome | Responsible lanes | State | Estimated completion |
| --- | --- | --- | --- | --- |
| Phase 1 | [Name / outcome] | [Lane(s)] | [State] | [#]% |
| Phase 2 | [Name / outcome] | [Lane(s)] | [State] | [#]% |

| Assignment ID / version | Lane | Role | Scope | Owned files / outputs | Dependencies | State |
| --- | --- | --- | --- | --- | --- | --- |
| [ID / version] | [Lane] | [Role] | [Scope] | [Files / outputs] | [Dependencies] | [State] |

--
```

One row per planned phase. The progress owner estimates overall completion, including required review, and reassesses after substantive returns. Explain changed or unchanged estimates against remaining work. Closed acceptance units are not required for movement; inherited percentages, round counts, and QA/generation blockers do not automatically increase or freeze progress. Regressions may lower it. Future phases start at 0%; completed phases reach 100%. Report acceptance gates/blockers separately.

Project Progress equally averages all planned phases: 100% + 0% gives 50%; 100% + 50% gives 75%. Round the mean to a whole percent, half up; use 20 cells at 5% each, rounding the unrounded mean to the nearest cell, half up: `75% [███████████████░░░░░]`. Explain material estimate/scope changes; do not omit blocked/deferred phases. Unknown estimates mean N/A, not a partial average. Progress never substitutes for acceptance/release gates.

Footer:

```markdown
--

**Time:** [Month D, YYYY] · [h:mm:ss] [AM/PM] [EDT/EST]\
**Duration:** [Minutes]m [Seconds]s\
**From:** [Sending Lane]\
**To:** [Receiving Lane(s)]

**Assignment:** [One sentence describing this thread's assignment.]\
**Status:** [One sentence describing the assignment's outcome.]
```

Print the shared progress/footer separator once. Append `--` only for additional expected review returns; name them in the body. Match heading/footer participants. Preserve unfinished, uncommitted, and unpushed state. Two-hyphen separators are intentional.

Read the clock at response start and immediately before final output. Both header and footer display only the identical final reading: `January 1, 2027 · 9:32:10 AM EST` (full month, unpadded day/hour, 12-hour time, two-digit minutes/seconds, actual Eastern EDT/EST). Duration uses actual elapsed time between both reads in total minutes/seconds, including midnight/DST crossings. No displayed start/range, estimated timing, or timing files. Follow AGENTS.md for unavailable clocks; do not invent phases.

## Finish a Pass

Returns identify scope, assignment ID/version (or `Not assigned`), files, evidence and limits, relevant routes/visual proof, mutations, exceptions, rollback, proposed commit scope, and next action. Seniors integrate concern-to-evidence maps; Lead consolidates multi-workstream results; PM checks every active concern. Keep source, metadata, output, temporary evidence, and runtime changes distinct.

Use Planned, In Progress, Needs Fix, Ready for User Validation, Complete, Deferred, or Blocked, with explicit scope. Checkpoints and progress updates are not completion. A final message ends the execution turn. Report a concrete interruption and remaining work accurately; continue authorized independent work where possible.

After PM QA, PM gives the user a concrete punchlist with route/artifact, steps, expected results, applicable viewports/interactions, exceptions, and failure-reporting instructions. On user approval, PM reviews the staged names/stat/full diff, runs `git diff --cached --check`, commits the accepted pass, reports Git state, and asks whether to push unless that exact push is already authorized.

PM has local Git authority within approved scope. Reading remote information is allowed; changing remote state requires explicit approval. This includes push, remote branch/tag deletion, and remote history replacement. PR/external release actions, deployment, and target installation also need approval. Preserve unrelated work and never infer cleanup authority from a request for a clean repository.

PM supplies a next-PM initiation/completion prompt carrying phases, completed scope, evidence, acceptance, Git/runtime state, remaining work, dependencies, and authorization boundaries. PM also supplies read-only efficiency-feedback prompts to the involved Seniors/Lead, addressing time, credits, redundant checks/handoffs, clarity, batching, and rework. Omit unused roles.

Feedback does not trigger policy edits. User-triggered workflow reviews follow the separate Architect route; active workflow changes require specific approval and a file allowlist. Keep observations in handoffs, not new tracking files by default.

## Project Documentation

Separately document commands, mutation effects, verification limits, environments, and preview ownership. Historical workflows defer to AGENTS.md. Configuration and ignore files grant no authority or access guarantees. Require no absent memory files or unsupported tools. Keep secrets out of prompts, logs, artifacts, and handoffs.
