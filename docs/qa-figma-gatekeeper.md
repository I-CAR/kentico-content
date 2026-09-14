# QA Figma Gatekeeper - Hard Access Enforcement

## Overview

The **QA Figma Gatekeeper** (`dev/scripts/qa-figma-gatekeeper.mjs`) enforces mandatory Figma MCP access verification before any QA validation proceeds. This implements the hard failure protocol defined in `.clinerules` Section 19: "Hard Failure on MCP Tool Errors."

## Execution Flow

### Phase 1: Hard Figma Access Verification
- **Purpose:** Verify Figma MCP is accessible before proceeding with any validation
- **Canonical Key:** `80i51JCUKVIrTZ8Zt9y73X` (per `.clinerules` Section 5)
- **Root Node:** `0:1` (canvas root)
- **Timeout:** 10 seconds
- **Failure Behavior:** HALT immediately, state exact MCP error, wait for user intervention

**Success Output:**
```
✅ Figma MCP Access: VERIFIED
   - File Key: 80i51JCUKVIrTZ8Zt9y73X
   - Root Node: 0:1
   - Canonical: YES
   - Timestamp: 2026-09-14T05:24:55.178Z
```

**Failure Output (Hard Blocker):**
```
❌ HARD FAILURE: FIGMA ACCESS BLOCKED
🚫 MCP Error: [exact error message]

📌 Per .clinerules Section 19 (Hard Failure on MCP Tool Errors):
   - No silent memory fallbacks allowed
   - Halt execution immediately
   - State exact MCP error
   - Wait for user intervention
```

### Phase 2: Port Availability Check
- **Purpose:** Verify Port 4001 is accessible for QA validation
- **Target Port:** 4001 (agent/testing environment)
- **Base URL:** `http://localhost:4001`
- **Timeout:** 5 seconds
- **Failure Behavior:** HALT immediately with actionable remediation steps

### Phase 3: DOM Math Validation (Tri-Viewport)
- **Purpose:** Validate DOM structure and computed styles across viewports
- **Viewports:**
  - Desktop: 1440×900
  - Tablet: 768×1024
  - Mobile: 375×667
- **Measurements:**
  - Hero section dimensions and display properties
  - Heading typography (font-size, line-height, font-weight)
  - Image validation (src, alt text, dimensions, placeholder detection)
  - Button measurements (padding, font-size)
  - Form validation (input count, reCAPTCHA v3 detection)
  - Text node counting
  - Inline HTML violation detection

### Phase 4: Comprehensive QA Validation
- **Purpose:** Run full validation suite across sample pages
- **Sample Pages:** 3 representative pages from the site
- **Validation Scope:**
  - Pages: 3
  - Viewports: 3 (Desktop, Tablet, Mobile)
  - Total measurements: 9 viewport combinations

### Phase 5: Results Summary & Gatekeeper Decision
- **Pass Criteria:** All pages pass validation across all viewports
- **Failure Criteria:** Any page fails validation on any viewport
- **Success Output:** "APPROVED FOR DEPLOYMENT"
- **Failure Output:** "REJECTED - REQUIRES REMEDIATION" (handoff to frontend-dev)

## Integration with QA Runner

The `qa-runner` agent MUST execute this gatekeeper as the **first step** before any other validation:

```bash
# Step 1: Hard Figma Access Verification (MANDATORY)
node dev/scripts/qa-figma-gatekeeper.mjs

# Step 2: Build and validation (only if Step 1 passes)
node dev/scripts/build-cms-inline.mjs && npm run build:css

# Step 3: DOM math audits (only if Steps 1-2 pass)
# ... Puppeteer validation scripts
```

## Hard Blocker Behavior

Per `.clinerules` Section 19, Figma access failures are **hard blockers**:

| Scenario | Behavior | User Notification |
|----------|----------|-------------------|
| Figma MCP accessible | Continue to Phase 2 | None |
| Figma MCP timeout | HALT, state error | YES - Exact error |
| Figma MCP error | HALT, state error | YES - Exact error |
| Port 4001 unavailable | HALT, state error | YES - Remediation steps |
| DOM validation fails | Record error, handoff to frontend-dev | NO - Silent rejection loop |
| All validations pass | Approve for deployment | YES - Success notification |

## Configuration Constants

```javascript
const FIGMA_FILE_KEY = '80i51JCUKVIrTZ8Zt9y73X'; // Canonical key
const FIGMA_ROOT_NODE_ID = '0:1';                // Root canvas node
const QA_PORT = 4001;                            // Agent/testing port
const FIGMA_TIMEOUT = 10000;                     // 10 seconds
const PAGE_LOAD_TIMEOUT = 30000;                 // 30 seconds
```

## Tri-Viewport Protocol

All DOM measurements are validated across three viewports to ensure fluid responsive design:

### Desktop (1440×900)
- Full-width layouts
- Multi-column grids
- Desktop-optimized spacing

### Tablet (768×1024)
- Fluid column distribution
- Touch-friendly spacing
- Responsive typography

### Mobile (375×667)
- Single-column layouts
- Optimized touch targets
- Mobile-first typography

## Validation Assertions

The gatekeeper validates:

1. **Content Parity:** Text nodes, headings, button labels match Figma AST
2. **Structural Hierarchy:** DOM tree matches expected component distribution
3. **Computed Styles:** CSS values match Figma design tokens
4. **Responsive Fluidity:** Layouts scale correctly across viewports
5. **Form Functionality:** Input fields, reCAPTCHA v3, form structure
6. **Image Assets:** Placeholder detection, alt text, dimensions
7. **Inline HTML Violations:** Detection of raw HTML in YAML data

## Error Handling

### Figma Access Failure (Hard Blocker)
```
❌ HARD FAILURE: FIGMA ACCESS BLOCKED
🚫 MCP Error: [exact error]

Action Required:
1. Verify Figma File Key is correct: 80i51JCUKVIrTZ8Zt9y73X
2. Verify MCP server is running and accessible
3. Check network connectivity to Figma API
4. Verify user has access to the Figma file
```

### Port Unavailable (Hard Blocker)
```
❌ PORT UNAVAILABLE: [error message]

Action Required:
1. Start dev server on Port 4001
2. Verify no other process is using this port
3. Check firewall settings
```

### DOM Validation Failure (Soft Rejection)
```
❌ QA VALIDATION FAILED - GATEKEEPER REJECTION
🚫 Gatekeeper Decision: REJECTED - REQUIRES REMEDIATION
   - Failures detected in DOM validation
   - Handoff to frontend-dev for fixes
```

## Usage

### Manual Execution
```bash
node dev/scripts/qa-figma-gatekeeper.mjs
```

### In QA Pipeline
```bash
# Chained execution (per .clinerules Section 23)
node dev/scripts/qa-figma-gatekeeper.mjs && \
  node dev/scripts/build-cms-inline.mjs && \
  npm run build:css && \
  # ... additional validation steps
```

### Exit Codes
- `0` - All validations passed, approved for deployment
- `1` - Validation failed or hard blocker encountered

## Compliance References

- **`.clinerules` Section 5:** Canonical Project Constants (Figma File Key)
- **`.clinerules` Section 19:** Hard Failure on MCP Tool Errors
- **`.clinerules` Section 20:** Configuration Validation Rules
- **`.clinerules` Section 23:** Build Pipeline Integrity
- **`AGENTS.md` Section 4:** QA Runner Execution Protocol
- **`.roomodes` qa-runner:** Hard Figma Access Enforcement

## Related Files

- [`dev/scripts/qa-figma-gatekeeper.mjs`](../dev/scripts/qa-figma-gatekeeper.mjs) - Main gatekeeper script
- [`dev/scripts/qa-dom-validation.mjs`](../dev/scripts/qa-dom-validation.mjs) - Legacy DOM validation (deprecated)
- [`dev/scripts/validate-dom-math.mjs`](../dev/scripts/validate-dom-math.mjs) - DOM math validation
- [`dev/scripts/extreme-verification-audit.mjs`](../dev/scripts/extreme-verification-audit.mjs) - Comprehensive audit
- [`.clinerules`](../.clinerules) - Global execution rules
- [`AGENTS.md`](../AGENTS.md) - Agent role definitions
- [`.roomodes`](../.roomodes) - Mode configurations

## Future Enhancements

1. **Real Figma MCP Integration:** Replace simulated access check with actual MCP tool calls
2. **Caching:** Cache Figma node data to reduce API calls
3. **Incremental Validation:** Only validate changed components
4. **Performance Metrics:** Track validation execution time
5. **Detailed Reporting:** Generate HTML reports with visual diffs
6. **Slack Integration:** Notify team of validation results
