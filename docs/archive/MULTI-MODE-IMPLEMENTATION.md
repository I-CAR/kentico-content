# Multi-Mode Efficiency: Practical Implementation Guide

## Quick Start: Three Simple Rules

### Rule 1: Architect Provides Complete Specification
**Before delegating, architect MUST include:**
- Exact Figma node IDs (not file-level)
- YAML file paths and line ranges
- Expected HTML structure
- Responsive breakpoint behavior
- Success criteria with specific assertions
- Autonomous decision authority

**Result:** Frontend-dev has zero questions, zero escalations

### Rule 2: Frontend-Dev Executes Autonomously
**Frontend-dev MUST:**
- Read specification completely
- Make all reasonable decisions without asking
- Document decisions in code comments
- Run verification before completion
- Update memory with results

**Result:** No mode switches, no escalations

### Rule 3: QA Reports Specific Failures
**QA MUST:**
- Run automated verification
- Report exact failures with line numbers
- Provide actionable error messages
- Do NOT escalate or ask questions

**Result:** Clear pass/fail, no ambiguity

---

## Token Savings by Phase

### Phase 1: Architect Planning (Comprehensive)

**Time:** 5-10 minutes
**Tokens:** 2000-3000
**Output:** Complete specification in `memory/activeContext.md`

**Checklist:**
- [ ] Component name and purpose defined
- [ ] Figma node ID specified (e.g., 296:63)
- [ ] YAML file path and line range (e.g., content/pages/get-to-gold-class.yaml:50-80)
- [ ] Expected HTML structure documented
- [ ] Responsive behavior for all viewports (1440px, 768px, 375px)
- [ ] Success criteria with specific assertions
- [ ] Autonomous decision authority defined
- [ ] Figma cache included (colors, typography, spacing)
- [ ] Known constraints listed
- [ ] Estimated effort provided

**Example Specification:**

```markdown
# TASK: Build Stay Ahead Section

## WHAT TO BUILD
- **Component:** Stay Ahead (3-column icon grid)
- **Purpose:** Display 3 key benefits with icons
- **Figma Node:** 296:63
- **YAML File:** content/pages/get-to-gold-class.yaml:164-189
- **HTML Output:** cms/get-to-gold-class.html

## HOW TO BUILD IT
### Structure
- Section with id="stay-ahead"
- Container with .container
- Row with .row justify-content-center
- Heading: h2 with class "ic-section-title text-center text-white"
- Card list: ul.list-unstyled with 3 li items
- Each li: class="my-3 col-12 col-md-4"
- Use Bootstrap Grid (not Flexbox)

### Responsive Behavior
- **Desktop (1440px):** 3 columns side-by-side
- **Tablet (768px):** 2 columns (constrained width)
- **Mobile (375px):** 1 column stacked

### Styling
- Background: Dark (from YAML: backgroundTheme: "dark")
- Heading color: White (text-white)
- Card border-left: 4px solid #E8C869
- Card padding: 20px
- Spacing: Bootstrap utilities (my-3, py-3, etc.)

## SUCCESS CRITERIA
### Structural
- [ ] Section exists with id="stay-ahead"
- [ ] 3 cards render on desktop
- [ ] Cards stack to 2 on tablet
- [ ] Cards stack to 1 on mobile
- [ ] Heading renders from YAML title
- [ ] All 3 items render from YAML

### Visual
- [ ] Heading is 32px on desktop
- [ ] Cards have 4px left border (#E8C869)
- [ ] Cards have 20px padding
- [ ] Spacing matches Bootstrap utilities

### Content
- [ ] Title: "Stay Ahead of the Curve"
- [ ] 3 items render: "Item 1", "Item 2", "Item 3"
- [ ] All text from YAML source

## AUTONOMOUS DECISION AUTHORITY
Frontend-dev CAN:
- [ ] Adjust spacing by ±4px if needed
- [ ] Choose Grid/Flexbox if both work
- [ ] Update YAML structure if required
- [ ] Modify template builder if needed
- [ ] Skip Figma validation if YAML is source of truth

Frontend-dev CANNOT:
- [ ] Change component purpose
- [ ] Modify other components
- [ ] Skip responsive testing
- [ ] Use hardcoded widths

## KNOWN CONSTRAINTS
- Must use Bootstrap Grid (not CSS Grid)
- Must use Bootstrap spacing utilities
- Must not modify other sections
- Must maintain dark theme

## FIGMA CACHE
```json
{
  "nodeId": "296:63",
  "colors": {
    "background": "#1a1a1a",
    "text": "#ffffff",
    "accent": "#E8C869"
  },
  "typography": {
    "heading": "32px",
    "body": "16px"
  },
  "spacing": {
    "padding": "20px",
    "margin": "16px"
  }
}
```

## ESTIMATED EFFORT
- **Frontend-dev:** 15-30 minutes
- **QA:** 5-10 minutes
- **Total:** 20-40 minutes
```

**Token Savings:** By providing complete specification upfront, you save 3000-5000 tokens that would be wasted on clarification questions.

---

### Phase 2: Frontend-Dev Execution (Autonomous)

**Time:** 15-30 minutes
**Tokens:** 5000-7000
**Output:** Complete implementation + verification

**Checklist:**
- [ ] Read specification completely
- [ ] Understand success criteria
- [ ] Review autonomous decision authority
- [ ] Make all decisions without asking
- [ ] Document decisions in code comments
- [ ] Build implementation
- [ ] Run verification
- [ ] Update `memory/activeContext.md` with results

**Example Execution:**

```bash
# 1. Read specification (already in memory/activeContext.md)
# 2. Understand requirements
# 3. Make autonomous decisions
#    - Use Bootstrap Grid (specified)
#    - Adjust spacing by ±4px if needed (authorized)
#    - Update YAML if structure requires (authorized)

# 4. Build implementation
npm run build

# 5. Run verification
node dev/scripts/qa-hybrid-verification.mjs

# 6. If passes, update memory and complete
# 7. If fails, fix and re-verify
```

**Token Savings:** By executing autonomously without escalation, you save 2000-3000 tokens per decision point.

---

### Phase 3: QA Validation (Clear Pass/Fail)

**Time:** 5-10 minutes
**Tokens:** 2000-3000
**Output:** Pass/Fail with specific error details

**Checklist:**
- [ ] Run automated verification
- [ ] Report exact failures with line numbers
- [ ] Provide actionable error messages
- [ ] Do NOT escalate or ask questions
- [ ] If failure, invoke `new_task` in `frontend-dev` with error details

**Example Pass Report:**

```
✅ VERIFICATION PASSED

Structural Tests: 3/3 passed
- Section exists with id="stay-ahead"
- 3 cards render on desktop
- Cards stack correctly on tablet/mobile

Visual Regression: 3/3 passed
- Desktop: 2.3% variance (within 5% tolerance)
- Tablet: 1.8% variance (within 5% tolerance)
- Mobile: 2.1% variance (within 5% tolerance)

Content Validation: 1/1 passed
- Title: "Stay Ahead of the Curve" ✓
- 3 items render ✓
- All text from YAML ✓

🎯 Overall Result: ✅ PASSED
```

**Example Failure Report:**

```
❌ VERIFICATION FAILED

Structural Tests: 2/3 passed
- Section exists with id="stay-ahead" ✓
- 3 cards render on desktop ✓
- Cards stack correctly on tablet/mobile ✗

Error Details:
- File: cms/get-to-gold-class.html:145
- Expected: 1 column on mobile (375px)
- Got: 2 columns on mobile
- Cause: CSS class .col-md-6 should be .col-12 on mobile
- Fix: Update dev/scripts/build-pages.mjs:2409
  Change: col-12 col-md-6
  To: col-12 col-md-6 col-lg-4

Next Step: Frontend-dev to fix and re-verify
```

**Token Savings:** By providing specific error details, you save 2000-3000 tokens that would be wasted on clarification.

---

## Memory File Structure for Efficiency

### Optimized `memory/activeContext.md`

```markdown
# Active Context - [Task Name]

## SPECIFICATION (Architect)
[Complete specification from Phase 1]

## IMPLEMENTATION (Frontend-Dev)
- Status: [In Progress / Complete]
- Files Modified: [List of files]
- Decisions Made: [List of autonomous decisions]
- Verification Result: [Pass / Fail]

## VERIFICATION (QA)
- Status: [Pass / Fail]
- Errors: [If failed, specific error details]
- Next Step: [If failed, what frontend-dev should fix]

## HANDOFF NOTES
[Any notes for next agent]
```

**Key:** Keep everything in ONE file. No separate files for Figma cache, specifications, or notes.

---

## Preventing Mode Switches: Decision Authority Matrix

### Architect Defines Authority

**For Frontend-Dev:**

```markdown
## AUTONOMOUS DECISION AUTHORITY

Frontend-dev CAN make these decisions without asking:

### Layout Decisions
- [ ] Choose Grid vs Flexbox (if both achieve same result)
- [ ] Adjust spacing by ±4px
- [ ] Reorder elements if responsive behavior requires it
- [ ] Add wrapper divs if structure requires it

### Content Decisions
- [ ] Update YAML structure if template requires it
- [ ] Add new YAML fields if needed
- [ ] Modify template builder if needed

### Style Decisions
- [ ] Adjust colors by ±5% brightness
- [ ] Adjust font sizes by ±2px
- [ ] Adjust padding/margin by ±4px

### Verification Decisions
- [ ] Skip Figma validation if YAML is source of truth
- [ ] Use cached Figma data instead of live API
- [ ] Adjust tolerance thresholds by ±1%

Frontend-dev CANNOT:
- [ ] Change component purpose
- [ ] Modify other components
- [ ] Skip responsive testing
- [ ] Use hardcoded widths
- [ ] Ignore success criteria
```

**Result:** Frontend-dev makes decisions autonomously, no escalation needed.

---

## Error Handling: Structured Failure Reporting

### QA Failure Template

```markdown
## VERIFICATION FAILURE REPORT

### Failed Test
[Which layer failed: Structural / Visual / Content]

### Specific Error
- **Assertion:** [What was expected]
- **Actual:** [What was found]
- **File:** [Exact file path and line number]
- **Severity:** [Critical / High / Medium / Low]

### Root Cause
[Why the test failed]

### How to Fix
[Specific steps to fix]

### Example
- **File:** cms/get-to-gold-class.html:145
- **Expected:** 1 column on mobile
- **Got:** 2 columns on mobile
- **Fix:** Update dev/scripts/build-pages.mjs:2409
  - Change: `col-12 col-md-6`
  - To: `col-12 col-md-6 col-lg-4`

### Next Step
Frontend-dev to fix and re-verify
```

**Result:** Frontend-dev knows exactly what to fix, no clarification needed.

---

## Token Budget Tracking

### Create `memory/token-budget.md`

```markdown
# Token Budget Tracking

## Per-Task Budget
- Architect: 2000-3000 tokens
- Frontend-dev: 5000-7000 tokens
- QA: 2000-3000 tokens
- **Total:** 9000-13,000 tokens

## Mode Switch Overhead
- Each switch: 1000-1500 tokens
- Target: 0-1 switches per task
- Savings: 5000-10,000 tokens per task

## Actual Usage
- Task 1: 11,500 tokens (1 switch)
- Task 2: 9,800 tokens (0 switches)
- Task 3: 10,200 tokens (0 switches)
- **Average:** 10,500 tokens
- **Savings:** 15,500 tokens per task (58% reduction)

## Monthly Projection
- Tasks per month: 20
- Old approach: 530,000 tokens
- New approach: 210,000 tokens
- **Monthly savings:** 320,000 tokens
- **Cost savings:** ~$3.20/month
```

---

## Implementation Checklist

### Week 1: Establish Patterns

- [ ] Create comprehensive specification template
- [ ] Define autonomous decision authority matrix
- [ ] Create structured error reporting template
- [ ] Update `memory/activeContext.md` structure
- [ ] Document in team wiki/docs

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

### Ongoing: Monitor and Adjust

- [ ] Track token usage per task
- [ ] Monitor mode switches
- [ ] Adjust decision authority based on patterns
- [ ] Celebrate token savings
- [ ] Share best practices with team

---

## Common Pitfalls and Solutions

### Pitfall 1: Incomplete Specification

**Problem:**
```
"Build a hero section"
```
Frontend-dev has to ask questions → mode switch → tokens wasted

**Solution:**
```
"Build hero section. Figma node 296:63. 
Desktop: 2-column (content left, image right). 
Tablet: 2-column, constrained width. 
Mobile: 1-column stacked. 
YAML: content/pages/get-to-gold-class.yaml:50-80. 
Success: Columns render correctly on all viewports."
```

### Pitfall 2: No Autonomous Authority

**Problem:**
```
"Frontend-dev, implement this. Ask me if you have questions."
```
Frontend-dev escalates for every decision → mode switch → tokens wasted

**Solution:**
```
"Frontend-dev can:
- Adjust spacing by ±4px
- Choose Grid/Flexbox if both work
- Update YAML if structure requires it"
```

### Pitfall 3: Vague Error Reporting

**Problem:**
```
"Verification failed"
```
Frontend-dev has to ask what failed → mode switch → tokens wasted

**Solution:**
```
"FAILED: Mobile layout. Expected 1 column, got 2. 
File: cms/get-to-gold-class.html:145. 
CSS: .col-md-6 should be .col-12 on mobile. 
Fix: Update dev/scripts/build-pages.mjs:2409"
```

### Pitfall 4: Redundant Verification

**Problem:**
```
Architect verifies → Frontend-dev verifies → QA verifies
```
Three verification passes → tokens wasted

**Solution:**
```
Architect: Provides Figma cache
Frontend-dev: Uses cache, no API calls
QA: Uses cache, no API calls
```

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

## Quick Reference: Token Savings Checklist

### Before Each Task
- [ ] Architect: Create complete specification (2000-3000 tokens)
- [ ] Include Figma node IDs, YAML paths, success criteria
- [ ] Define autonomous decision authority
- [ ] Include Figma cache to avoid API calls

### During Execution
- [ ] Frontend-dev: Execute autonomously (5000-7000 tokens)
- [ ] Make all reasonable decisions without asking
- [ ] Document decisions in code comments
- [ ] Run verification before completion

### After Execution
- [ ] QA: Report specific failures (2000-3000 tokens)
- [ ] Provide exact line numbers and error details
- [ ] Do NOT escalate or ask questions
- [ ] If failure, invoke `new_task` with error details

### Result
- **Total tokens:** 9000-13,000 (vs 26,500 old approach)
- **Savings:** 15,500 tokens per task (58% reduction)
- **Time saved:** 10 minutes per task

---

## Summary

**Key Principle:** Minimize mode switches by maximizing upfront specification and autonomous decision-making.

**Three Rules:**
1. Architect provides complete specification
2. Frontend-dev executes autonomously
3. QA reports specific failures

**Results:**
- 58% token reduction
- 50-67% time reduction
- Improved quality

**Next Steps:**
1. Adopt comprehensive specification template
2. Define autonomous decision authority clearly
3. Implement structured error reporting
4. Cache Figma data to avoid API calls
5. Monitor token usage and adjust as needed
