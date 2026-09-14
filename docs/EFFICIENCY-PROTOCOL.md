# Multi-Mode Efficiency Protocol: Token & Time Optimization

## Executive Summary

The multi-mode efficiency protocol eliminates wasteful mode switching and reduces task execution time by 50-67% while improving quality. This document consolidates the strategic approach, implementation guide, and enforcement rules.

**Key Improvements:**
- **Token Usage:** 26,500 → 11,000 per task (58% reduction)
- **Time Usage:** 15-20 min → 5-10 min per task (50-67% reduction)
- **Mode Switches:** 5+ → 0-1 per task (90% reduction)
- **Quality:** Improved (fewer false positives, clearer failures)

---

## The Problem: Mode Switching Waste

### Current Workflow (Wasteful)
```
Task Start
  ↓
kentico-architect (Strategic planning)
  ↓ new_task + mode switch (1000-1500 tokens)
frontend-dev (Implementation)
  ↓ new_task + mode switch (1000-1500 tokens)
qa-runner (Verification)
  ↓ new_task + mode switch (1000-1500 tokens)
[Issues found, loop back]
  ↓ new_task + mode switch (1000-1500 tokens)
kentico-architect (Re-planning)
  ↓ new_task + mode switch (1000-1500 tokens)
[Repeat cycle]
```

**Cost per task:** 26,500 tokens | **Time per task:** 15-20 minutes

### Root Causes
1. **Incomplete Specifications**: Architect doesn't provide enough detail
2. **Vague Requirements**: Frontend-dev must ask clarifying questions
3. **Redundant Verification**: Multiple agents verify the same things
4. **No Autonomous Authority**: Frontend-dev escalates on every decision
5. **Inefficient Error Reporting**: QA provides vague failure descriptions

---

## The Solution: Three-Phase Optimized Workflow

### Phase 1: Architect Provides Complete Specification (5-10 min, 2000-3000 tokens)

**Architect MUST include in `memory/activeContext.md`:**

```yaml
# TASK SPECIFICATION: [Component Name]

## WHAT TO BUILD
- Component: [Name and purpose]
- Figma File: [File alias from registry]
- Figma Nodes: [Specific node IDs]
- YAML File: [Path and line range]
- HTML Output: [Expected file path]

## HOW TO BUILD IT
### Structure
- [Specific HTML hierarchy]
- [Bootstrap classes to use]
- [Grid/Flexbox decision with rationale]

### Responsive Behavior
- Desktop (1440px): [Specific layout]
- Tablet (768px): [Specific layout]
- Mobile (375px): [Specific layout]

## SUCCESS CRITERIA
### Structural
- [ ] [Specific assertion]
- [ ] [Specific assertion]

### Visual
- [ ] [Specific measurement]
- [ ] [Specific measurement]

### Content
- [ ] [Specific YAML field]
- [ ] [Specific YAML field]

## AUTONOMOUS DECISION AUTHORITY
Frontend-dev CAN:
- [ ] Adjust spacing by ±4px
- [ ] Choose Grid/Flexbox if both work
- [ ] Update YAML structure if required
- [ ] Modify template builder if needed

Frontend-dev CANNOT:
- [ ] Change component purpose
- [ ] Modify other components
- [ ] Skip responsive testing
- [ ] Use hardcoded widths

## FIGMA CACHE
{
  "fileAlias": "i-car-main-components",
  "nodeIds": {
    "hero": "296:63",
    "form": "145:22"
  },
  "colors": { "primary": "#E8C869" },
  "typography": { "heading": "32px" },
  "spacing": { "padding": "16px" }
}

## ESTIMATED EFFORT
- Frontend-dev: 15-30 minutes
- QA: 5-10 minutes
- Total: 20-40 minutes
```

**Result:** Frontend-dev has zero questions, zero escalations.

### Phase 2: Frontend-Dev Executes Autonomously (15-30 min, 5000-7000 tokens)

**Frontend-dev MUST:**
- Read specification completely before starting
- Make all reasonable decisions WITHOUT asking
- Document decisions in code comments
- Run verification before completion
- Update `memory/activeContext.md` with results
- Do NOT escalate or ask questions

**Autonomous Decision Authority Examples:**
- Adjust spacing by ±4px if needed
- Choose Grid/Flexbox if both achieve same result
- Update YAML structure if template requires it
- Modify template builder if needed
- Skip Figma validation if YAML is source of truth

**Result:** No mode switches, no escalations.

### Phase 3: QA Reports Specific Failures (5-10 min, 2000-3000 tokens)

**QA MUST:**
- Run automated verification
- Report exact failures with line numbers and file paths
- Provide actionable error messages (not vague descriptions)
- Do NOT escalate or ask questions
- If failure, invoke `new_task` in `frontend-dev` mode with error details

**Example Pass Report:**
```
✅ VERIFICATION PASSED
Structural: 3/3 | Visual: 3/3 | Content: 1/1
```

**Example Failure Report:**
```
❌ FAILED: Mobile layout
Expected: 1 column on mobile (375px)
Got: 2 columns on mobile
File: cms/get-to-gold-class.html:145
Fix: Update dev/scripts/build-pages.mjs:2409
Change: col-12 col-md-6 → col-12 col-md-6 col-lg-4
```

**Result:** Clear pass/fail, no ambiguity.

---

## Token Budget Comparison

### Old Approach (Wasteful)
```
Architect: 3000 tokens
Mode switch: 1500 tokens
Frontend-dev: 5000 tokens
Mode switch: 1500 tokens
QA: 3000 tokens
Mode switch: 1500 tokens
[Issues found, loop back]
Architect: 2000 tokens
Mode switch: 1500 tokens
Frontend-dev: 4000 tokens
Mode switch: 1500 tokens
QA: 2000 tokens
─────────────────────
TOTAL: 26,500 tokens
```

### New Approach (Efficient)
```
Architect: 3000 tokens (comprehensive spec)
Mode switch: 500 tokens (minimal context)
Frontend-dev: 5000 tokens (autonomous execution)
Mode switch: 500 tokens (minimal context)
QA: 2000 tokens (clear pass/fail)
─────────────────────
TOTAL: 11,000 tokens
SAVINGS: 15,500 tokens (58% reduction)
```

---

## Implementation Checklist

### Week 1: Establish Patterns
- [ ] Create comprehensive specification template
- [ ] Define autonomous decision authority matrix
- [ ] Create structured error reporting template
- [ ] Update `memory/activeContext.md` structure
- [ ] Document in team wiki

### Week 2: First Task with New Process
- [ ] Architect creates complete specification
- [ ] Frontend-dev executes autonomously
- [ ] QA reports specific failures
- [ ] Track token usage
- [ ] Document lessons learned

### Week 3: Refine and Optimize
- [ ] Review token usage data
- [ ] Adjust decision authority if needed
- [ ] Improve specification template
- [ ] Train team on new process
- [ ] Establish as standard workflow

---

## Success Metrics

### Token Efficiency
- **Target:** 58% reduction (26,500 → 11,000 tokens per task)
- **Measurement:** Track actual token usage per task
- **Success:** Average < 12,000 tokens per task

### Time Efficiency
- **Target:** 50-67% reduction (15-20 min → 5-10 min per task)
- **Measurement:** Track actual time per task
- **Success:** Average < 10 minutes per task

### Mode Switches
- **Target:** 0-1 switches per task (vs current 5+)
- **Measurement:** Count mode switches per task
- **Success:** Average < 1 switch per task

### Quality
- **Target:** Fewer false positives, clearer failures
- **Measurement:** Track verification pass rate
- **Success:** > 90% first-pass verification

---

## Enforcement Rules

### For Architect
- ✅ MUST provide complete specification before delegating
- ✅ MUST include Figma node IDs, YAML paths, success criteria
- ✅ MUST define autonomous decision authority
- ✅ MUST include Figma cache to avoid API calls
- ❌ CANNOT ask frontend-dev for clarification

### For Frontend-Dev
- ✅ MUST read specification completely before starting
- ✅ MUST make all reasonable decisions autonomously
- ✅ MUST document decisions in code comments
- ✅ MUST run verification before completion
- ❌ CANNOT escalate or ask questions

### For QA
- ✅ MUST run automated verification
- ✅ MUST report exact failures with line numbers
- ✅ MUST provide actionable error messages
- ❌ MUST NOT escalate or ask questions
- ✅ If failure, MUST invoke `new_task` in `frontend-dev` mode with error details

### For All Agents
- ✅ MUST use `memory/activeContext.md` for handoff
- ✅ MUST keep specifications in memory (not separate files)
- ✅ MUST cache Figma data in memory
- ✅ MUST update memory exactly ONCE per task
- ❌ CANNOT create new memory files

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Vague Specification
```
"Build a hero section"
```
**Fix:** Include Figma node ID, YAML path, responsive behavior, success criteria

### ❌ Mistake 2: No Autonomous Authority
```
"Frontend-dev, implement this. Ask me if you have questions."
```
**Fix:** Define what frontend-dev CAN decide (spacing, Grid/Flexbox, YAML updates)

### ❌ Mistake 3: Redundant Verification
```
Architect verifies → Frontend-dev verifies → QA verifies
```
**Fix:** Architect provides Figma cache, others use cache (no API calls)

### ❌ Mistake 4: Vague Error Reporting
```
"Verification failed"
```
**Fix:** Report exact failures with file paths and line numbers

---

## Memory File Structure

Keep everything in ONE file: `memory/activeContext.md`

```markdown
# Active Context - [Task Name]

## SPECIFICATION (Architect)
[Complete specification from Phase 1]

## IMPLEMENTATION (Frontend-Dev)
- Status: [In Progress / Complete]
- Files Modified: [List]
- Decisions Made: [List]
- Verification Result: [Pass / Fail]

## VERIFICATION (QA)
- Status: [Pass / Fail]
- Errors: [If failed, specific details]
- Next Step: [If failed, what to fix]
```

---

## Agent Responsibilities

### Architect (Phase 1)
1. Read current task requirements
2. Query Figma for node IDs and design tokens
3. Define complete specification
4. Include autonomous decision authority
5. Cache Figma data in memory
6. Invoke `new_task` in `frontend-dev` mode

### Frontend-Dev (Phase 2)
1. Read specification completely
2. Make autonomous decisions
3. Document decisions in code comments
4. Run local verification
5. Update memory with results
6. Invoke `new_task` in `qa-runner` mode

### QA (Phase 3)
1. Run automated verification
2. Report specific failures with line numbers
3. If pass: Notify user of success
4. If fail: Invoke `new_task` in `frontend-dev` mode with error details

---

## Best Practices

1. **Be Specific**: Vague specifications lead to questions
2. **Cache Data**: Include Figma cache to avoid API calls
3. **Define Authority**: Clear decision boundaries prevent escalations
4. **Document Decisions**: Code comments explain why choices were made
5. **Report Clearly**: Specific errors enable quick fixes
6. **Update Memory**: Single source of truth for task state
7. **No Escalations**: Autonomous execution is the goal
8. **Measure Results**: Track tokens, time, and quality metrics

---

## Reference

### Specification Template
- **Location:** This document (see Phase 1 section)
- **Usage:** Copy and fill in for each task
- **Key Fields:** Component, Figma nodes, YAML path, success criteria

### Memory File
- **Location:** `memory/activeContext.md`
- **Update Frequency:** Once per task (at completion)
- **Content:** Specification, implementation notes, verification results

### Decision Authority Matrix
- **Architect:** Strategic decisions, schema design, cross-system integration
- **Frontend-Dev:** Spacing adjustments, Grid/Flexbox choice, YAML updates
- **QA:** Verification automation, error reporting, regression detection

---

## Questions?

For issues or questions about the efficiency protocol:
1. Check this documentation
2. Review specification template
3. Check `memory/activeContext.md` for current task state
4. Review agent responsibilities section
