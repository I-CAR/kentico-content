# Multi-Mode Efficiency Guide: Token & Time Optimization

## The Problem: Mode Switching Waste

Your current workflow likely looks like this:

```
Task Start
  ↓
kentico-architect (Strategic planning)
  ↓ new_task
frontend-dev (Implementation)
  ↓ new_task
qa-runner (Verification)
  ↓ new_task
[Back to architect if issues found]
  ↓ new_task
[Repeat cycle]
```

**Cost of Each Mode Switch:**
- Context reload: 500-1000 tokens
- Memory file reads: 200-500 tokens
- Task briefing: 300-800 tokens
- **Total per switch:** 1000-2300 tokens
- **With 5 switches per task:** 5000-11,500 tokens wasted

**Time Cost:**
- Mode switch overhead: 30-60 seconds per switch
- Context re-establishment: 20-40 seconds
- **Total per switch:** 50-100 seconds
- **With 5 switches per task:** 250-500 seconds (4-8 minutes)

---

## Root Cause Analysis

### Why You're Switching Modes Excessively

1. **Unclear Task Boundaries**
   - Architect doesn't fully specify what frontend-dev should do
   - Frontend-dev discovers issues mid-implementation
   - QA finds problems that require architect review

2. **Incomplete Handoff Documentation**
   - `memory/activeContext.md` lacks specific implementation details
   - Next agent has to re-read Figma, YAML, and code
   - Duplicate analysis across modes

3. **No Autonomous Decision-Making**
   - Frontend-dev escalates to architect for minor decisions
   - QA escalates to architect for style issues
   - Agents don't have authority to make reasonable decisions

4. **Redundant Verification**
   - Architect verifies design
   - Frontend-dev verifies implementation
   - QA verifies again
   - Three separate verification passes

---

## Solution: Single-Mode Task Execution

### Principle: Minimize Mode Switches

**Target:** 0-1 mode switches per task (vs current 5+)

**Strategy:**
1. **Architect** does complete upfront planning (no handoff needed)
2. **Frontend-dev** executes with full autonomy (no escalation)
3. **QA** validates with clear pass/fail criteria (no loops)

---

## Optimized Workflow

### Phase 1: Architect Planning (One-Time, Comprehensive)

**Duration:** 5-10 minutes
**Tokens:** 2000-3000
**Output:** Complete specification in `memory/activeContext.md`

```markdown
## COMPLETE TASK SPECIFICATION

### What to Build
- Exact component name and purpose
- Figma node IDs (specific, not file-level)
- YAML file paths and required fields
- Expected HTML structure

### How to Build It
- Template modifications needed
- SCSS changes required
- Responsive breakpoints (1440px, 768px, 375px)
- Bootstrap classes to use

### Success Criteria
- Structural: [specific assertions]
- Visual: [specific measurements]
- Content: [specific YAML fields]
- Responsive: [specific breakpoint behavior]

### Known Constraints
- Don't modify X file
- Must use Y pattern
- Avoid Z approach

### Autonomous Decision Authority
- Frontend-dev can adjust spacing by ±4px
- Frontend-dev can choose between Grid/Flexbox if both work
- Frontend-dev can update YAML if structure requires it
- Frontend-dev can skip Figma validation if YAML is source of truth
```

**Key:** Architect provides EVERYTHING frontend-dev needs. No follow-up questions.

### Phase 2: Frontend-Dev Execution (Autonomous, No Escalation)

**Duration:** 15-30 minutes
**Tokens:** 3000-5000
**Output:** Complete implementation + verification

**Rules:**
- ✅ Make all reasonable decisions autonomously
- ✅ Update `memory/activeContext.md` with progress
- ✅ Run verification before completion
- ❌ Do NOT escalate to architect
- ❌ Do NOT ask for clarification
- ❌ Do NOT switch modes

**If you encounter ambiguity:**
- Choose the most reasonable option
- Document your choice in code comments
- Proceed with implementation
- Let QA catch issues if needed

### Phase 3: QA Validation (Clear Pass/Fail)

**Duration:** 5-10 minutes
**Tokens:** 2000-3000
**Output:** Pass/Fail with specific error details

**Rules:**
- ✅ Run automated verification
- ✅ Report exact failures
- ✅ Provide actionable error messages
- ❌ Do NOT escalate to architect
- ❌ Do NOT ask for clarification
- ❌ Do NOT loop back to frontend-dev

**If QA fails:**
- Record exact error in `memory/activeContext.md`
- Invoke `new_task` in `frontend-dev` mode with error details
- Frontend-dev fixes and re-runs verification
- QA validates again

---

## Token Optimization Strategies

### Strategy 1: Comprehensive Upfront Specification

**Before (Wasteful):**
```
Architect: "Build a hero section"
  ↓ new_task
Frontend-dev: "What should it look like?"
  ↓ new_task
Architect: "Here's the Figma file..."
  ↓ new_task
Frontend-dev: "What about mobile?"
  ↓ new_task
Architect: "Stack vertically..."
```
**Tokens wasted:** 8000-12,000

**After (Efficient):**
```
Architect: "Build hero section. Figma node 296:63. 
Desktop: 2-column (content left, image right). 
Tablet: 2-column, constrained width. 
Mobile: 1-column stacked. 
Use Bootstrap grid. 
YAML: content/pages/get-to-gold-class.yaml:50-80. 
Success: Columns render correctly on all viewports."
  ↓ new_task
Frontend-dev: [Executes with full context, no questions]
```
**Tokens saved:** 6000-10,000

### Strategy 2: Autonomous Decision Authority

**Before (Escalation Loop):**
```
Frontend-dev: "Should I use Grid or Flexbox?"
  ↓ new_task
Architect: "Use Grid for this layout"
  ↓ new_task
Frontend-dev: "What about spacing?"
  ↓ new_task
Architect: "Use Bootstrap spacing utilities"
```
**Tokens wasted:** 4000-6000

**After (Autonomous):**
```
Frontend-dev: [Reads specification]
"Architect says: 'Frontend-dev can choose Grid/Flexbox if both work'"
[Chooses Grid, implements, verifies]
[No escalation needed]
```
**Tokens saved:** 4000-6000

### Strategy 3: Cached Verification Results

**Before (Redundant):**
```
Architect: "Verify this matches Figma"
  ↓ new_task
Frontend-dev: "Running Figma verification..."
  ↓ new_task
QA: "Running Figma verification again..."
```
**Tokens wasted:** 3000-5000

**After (Cached):**
```
Architect: "Figma verification cached in memory/figma-cache.json"
Frontend-dev: [Uses cached data, no API calls]
QA: [Uses cached data, no API calls]
```
**Tokens saved:** 3000-5000

### Strategy 4: Structured Error Reporting

**Before (Vague):**
```
QA: "Verification failed"
  ↓ new_task
Frontend-dev: "What failed?"
  ↓ new_task
QA: "The layout is wrong"
  ↓ new_task
Frontend-dev: "Where?"
  ↓ new_task
QA: "On mobile, columns don't stack"
```
**Tokens wasted:** 5000-8000

**After (Specific):**
```
QA: "FAILED: Mobile layout. Expected 1 column, got 2. 
File: cms/get-to-gold-class.html:145. 
CSS: .col-md-6 should be .col-12 on mobile. 
Fix: Update dev/scripts/build-pages.mjs:2409"
  ↓ new_task
Frontend-dev: [Fixes exact issue, re-verifies]
```
**Tokens saved:** 5000-8000

---

## Implementation: Optimized Task Template

### For Architect: Complete Specification Template

```markdown
# TASK SPECIFICATION: [Component Name]

## WHAT TO BUILD
- **Component:** [Name and purpose]
- **Figma Node:** [Specific node ID, e.g., 296:63]
- **YAML File:** [Path and line range, e.g., content/pages/get-to-gold-class.yaml:50-80]
- **HTML Output:** [Expected file path, e.g., cms/get-to-gold-class.html]

## HOW TO BUILD IT
### Structure
- [Specific HTML hierarchy needed]
- [Bootstrap classes to use]
- [CSS Grid/Flexbox decision]

### Responsive Behavior
- **Desktop (1440px):** [Specific layout]
- **Tablet (768px):** [Specific layout]
- **Mobile (375px):** [Specific layout]

### Styling
- [Color tokens from Figma]
- [Typography from Figma]
- [Spacing from Figma]

## SUCCESS CRITERIA
### Structural
- [ ] [Specific assertion, e.g., "3 columns render on desktop"]
- [ ] [Specific assertion, e.g., "Columns stack on mobile"]

### Visual
- [ ] [Specific measurement, e.g., "Heading is 32px on desktop"]
- [ ] [Specific measurement, e.g., "Cards have 16px padding"]

### Content
- [ ] [Specific YAML field, e.g., "Title renders from YAML"]
- [ ] [Specific YAML field, e.g., "All 3 items render"]

## AUTONOMOUS DECISION AUTHORITY
Frontend-dev can:
- [ ] Adjust spacing by ±4px if needed
- [ ] Choose Grid/Flexbox if both work
- [ ] Update YAML structure if required
- [ ] Skip Figma validation if YAML is source of truth
- [ ] Modify template builder if needed

Frontend-dev CANNOT:
- [ ] Change component purpose
- [ ] Modify other components
- [ ] Skip responsive testing
- [ ] Use hardcoded widths

## KNOWN CONSTRAINTS
- [Constraint 1]
- [Constraint 2]
- [Constraint 3]

## FIGMA CACHE
```json
{
  "nodeId": "296:63",
  "colors": { "primary": "#E8C869" },
  "typography": { "heading": "32px" },
  "spacing": { "padding": "16px" }
}
```

## ESTIMATED EFFORT
- **Frontend-dev:** 15-30 minutes
- **QA:** 5-10 minutes
- **Total:** 20-40 minutes
```

### For Frontend-Dev: Autonomous Execution

**Rules:**
1. Read specification completely before starting
2. Make all reasonable decisions autonomously
3. Document decisions in code comments
4. Run verification before completion
5. Update `memory/activeContext.md` with results
6. Do NOT escalate or ask questions

### For QA: Clear Pass/Fail

**Rules:**
1. Run automated verification
2. Report exact failures with line numbers
3. Provide actionable error messages
4. Do NOT escalate or ask questions
5. If failure, invoke `new_task` in `frontend-dev` with error details

---

## Token Savings Calculator

### Current Workflow (Wasteful)
```
Architect: 3000 tokens
  ↓ Mode switch: 1500 tokens
Frontend-dev: 5000 tokens
  ↓ Mode switch: 1500 tokens
QA: 3000 tokens
  ↓ Mode switch: 1500 tokens
[Issues found, loop back]
Architect: 2000 tokens
  ↓ Mode switch: 1500 tokens
Frontend-dev: 4000 tokens
  ↓ Mode switch: 1500 tokens
QA: 2000 tokens

TOTAL: 26,500 tokens
TIME: 15-20 minutes
```

### Optimized Workflow (Efficient)
```
Architect: 3000 tokens (comprehensive spec)
  ↓ Mode switch: 500 tokens (minimal context)
Frontend-dev: 5000 tokens (autonomous execution)
  ↓ Mode switch: 500 tokens (minimal context)
QA: 2000 tokens (clear pass/fail)

TOTAL: 11,000 tokens
TIME: 5-10 minutes

SAVINGS: 15,500 tokens (58% reduction)
TIME SAVED: 10 minutes per task
```

---

## Implementation Checklist

### For Architect
- [ ] Create comprehensive specification before delegating
- [ ] Include all Figma node IDs and YAML paths
- [ ] Define autonomous decision authority clearly
- [ ] Provide success criteria with specific assertions
- [ ] Include Figma cache to avoid API calls
- [ ] Do NOT ask frontend-dev for clarification

### For Frontend-Dev
- [ ] Read specification completely before starting
- [ ] Make all reasonable decisions autonomously
- [ ] Document decisions in code comments
- [ ] Run verification before completion
- [ ] Update `memory/activeContext.md` with results
- [ ] Do NOT escalate or ask questions

### For QA
- [ ] Run automated verification
- [ ] Report exact failures with line numbers
- [ ] Provide actionable error messages
- [ ] Do NOT escalate or ask questions
- [ ] If failure, invoke `new_task` in `frontend-dev` with error details

### For All Agents
- [ ] Use `memory/activeContext.md` for handoff
- [ ] Keep specifications in `memory/activeContext.md` (not separate files)
- [ ] Cache Figma data in `memory/activeContext.md`
- [ ] Update memory exactly ONCE per task
- [ ] Do NOT create new memory files

---

## Expected Results

### Token Efficiency
- **Before:** 26,500 tokens per task
- **After:** 11,000 tokens per task
- **Savings:** 58% reduction

### Time Efficiency
- **Before:** 15-20 minutes per task
- **After:** 5-10 minutes per task
- **Savings:** 50-67% reduction

### Quality
- **Before:** Multiple verification passes, high false positives
- **After:** Single verification pass, clear pass/fail
- **Quality:** Improved (fewer false positives)

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Vague Specifications
```
"Build a hero section"
```
**Problem:** Frontend-dev has to ask questions, causing mode switches

**Fix:**
```
"Build hero section. Figma node 296:63. 
Desktop: 2-column (content left, image right). 
Tablet: 2-column, constrained width. 
Mobile: 1-column stacked. 
YAML: content/pages/get-to-gold-class.yaml:50-80"
```

### ❌ Mistake 2: No Autonomous Authority
```
"Frontend-dev, implement this. Ask me if you have questions."
```
**Problem:** Frontend-dev escalates for every decision

**Fix:**
```
"Frontend-dev can:
- Adjust spacing by ±4px
- Choose Grid/Flexbox if both work
- Update YAML if structure requires it"
```

### ❌ Mistake 3: Redundant Verification
```
Architect verifies → Frontend-dev verifies → QA verifies
```
**Problem:** Three verification passes waste tokens

**Fix:**
```
Architect: Provides Figma cache
Frontend-dev: Uses cache, no API calls
QA: Uses cache, no API calls
```

### ❌ Mistake 4: Vague Error Reporting
```
"Verification failed"
```
**Problem:** Frontend-dev has to ask what failed

**Fix:**
```
"FAILED: Mobile layout. Expected 1 column, got 2. 
File: cms/get-to-gold-class.html:145. 
CSS: .col-md-6 should be .col-12 on mobile."
```

---

## Summary

**Key Principle:** Minimize mode switches by maximizing upfront specification and autonomous decision-making.

**Implementation:**
1. Architect provides complete specification (no follow-up needed)
2. Frontend-dev executes autonomously (no escalation)
3. QA validates with clear pass/fail (no loops)

**Results:**
- 58% token reduction
- 50-67% time reduction
- Improved quality (fewer false positives)

**Next Steps:**
1. Adopt comprehensive specification template
2. Define autonomous decision authority clearly
3. Implement structured error reporting
4. Cache Figma data to avoid API calls
5. Monitor token usage and adjust as needed
