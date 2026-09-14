# Figma File Management System

## Overview

The Figma Registry provides centralized management of all Figma files and node references used across the project. Instead of hardcoding file keys throughout the codebase, all Figma resources are registered in a single YAML file and accessed through a management utility.

**Benefits:**
- ✅ Scalable: Easy to add new Figma files without code changes
- ✅ Maintainable: Single source of truth for all Figma references
- ✅ Collaborative: Clear ownership and status tracking for each file
- ✅ Reliable: Validation catches broken references before runtime
- ✅ Efficient: Agents reference files by meaningful names instead of cryptic keys

---

## Quick Start

### Get Default File Key
```javascript
import { FigmaRegistry } from './dev/scripts/figma-registry.mjs';

const registry = new FigmaRegistry();
const fileKey = registry.getFileKey(); // Uses default file
```

### Get Specific File Key
```javascript
const fileKey = registry.getFileKey('i-car-marketing-pages');
```

### Get Node ID
```javascript
const nodeId = registry.getNodeId('hero-sections', 'i-car-main-components');
```

### CLI Commands
```bash
# List all available files
node dev/scripts/figma-registry.mjs list

# Get file key for specific alias
node dev/scripts/figma-registry.mjs get i-car-main-components

# Get detailed file information
node dev/scripts/figma-registry.mjs info i-car-main-components

# List all projects
node dev/scripts/figma-registry.mjs projects

# Show default file
node dev/scripts/figma-registry.mjs default

# Validate registry structure
node dev/scripts/figma-registry.mjs validate
```

---

## Registry Structure

### File Entry Format
```yaml
files:
  file-alias:
    key: "FIGMA_FILE_KEY_HERE"
    name: "Human Readable Name"
    description: "What this file contains"
    owner: "Team or person responsible"
    last_updated: "YYYY-MM-DD"
    status: "active|development|archived"
    project: "project-name"
    node_map:
      component-alias: "NODE_ID"
      another-component: "NODE_ID"
    notes: "Optional notes"
```

### Status Values
- **active**: File is in production use
- **development**: File is under active development
- **archived**: File is for reference only, do not use for new work

### Example Entry
```yaml
i-car-main-components:
  key: "80i51JCUKVIrTZ8Zt9y73X"
  name: "I-CAR Main Components"
  description: "Primary component library and page designs for Kentico CMS"
  owner: "Design Team"
  last_updated: "2024-09-14"
  status: "active"
  project: "kentico-cms"
  node_map:
    hero-sections: "296:63"
    form-components: "145:22"
    card-layouts: "189:45"
    navigation: "67:12"
  notes: "Primary design system for all CMS pages"
```

---

## Adding New Figma Files

### Step 1: Get File Information
From your Figma file:
1. Copy the file key from the URL: `figma.com/file/{FILE_KEY}/...`
2. Identify important component node IDs
3. Determine file owner and status

### Step 2: Add to Registry
Edit `config/figma-registry.yaml`:

```yaml
files:
  my-new-file:
    key: "YOUR_FIGMA_FILE_KEY"
    name: "My New File"
    description: "What this file contains"
    owner: "Your Name or Team"
    last_updated: "2024-09-14"
    status: "active"
    project: "project-name"
    node_map:
      important-component: "NODE_ID"
    notes: "Any relevant notes"
```

### Step 3: Create Project Mapping (if new project)
```yaml
projects:
  my-project:
    primary_file: "my-new-file"
    fallback_files: ["i-car-main-components"]
    description: "My project description"
```

### Step 4: Validate
```bash
node dev/scripts/figma-registry.mjs validate
```

### Step 5: Commit
```bash
git add config/figma-registry.yaml
git commit -m "Add Figma file: my-new-file"
```

---

## Agent Usage Patterns

### For Architects (Specifications)

When creating task specifications, reference Figma files by alias:

```yaml
# In memory/activeContext.md
figma_context:
  file: "i-car-main-components"
  nodes:
    hero_section: "hero-sections"
    form_layout: "form-components"
    card_grid: "card-layouts"
```

**Benefits:**
- Meaningful names instead of cryptic keys
- Easy to update if Figma file changes
- Clear which components are being referenced

### For Frontend-dev (Implementation)

Always use the registry when accessing Figma:

```javascript
import { FigmaRegistry } from './dev/scripts/figma-registry.mjs';

// Initialize registry
const registry = new FigmaRegistry();

// Get default file key
const fileKey = registry.getFileKey();

// Get specific file key
const marketingFileKey = registry.getFileKey('i-car-marketing-pages');

// Get node ID
const heroNodeId = registry.getNodeId('hero-sections', 'i-car-main-components');

// Use in MCP calls
const figmaData = await mcp_figma_get_figma_data({
    fileKey: fileKey,
    nodeId: heroNodeId
});
```

**Benefits:**
- No hardcoded keys in code
- Easy to switch between files
- Automatic validation of references

### For QA (Validation)

Validate registry before running tests:

```bash
# Validate registry structure
node dev/scripts/figma-registry.mjs validate

# List available files
node dev/scripts/figma-registry.mjs list

# Get file info
node dev/scripts/figma-registry.mjs info i-car-main-components
```

---

## Common Tasks

### Switch Default File
Edit `config/figma-registry.yaml`:
```yaml
default: i-car-marketing-pages  # Changed from i-car-main-components
```

### Update File Key
If a Figma file is moved or recreated:
```yaml
i-car-main-components:
  key: "NEW_FILE_KEY_HERE"  # Update this
  # ... rest of config
```

### Add Node to Node Map
If you discover a new important component:
```yaml
i-car-main-components:
  node_map:
    hero-sections: "296:63"
    new-component: "NEW_NODE_ID"  # Add this
```

### Archive Old File
When a file is no longer needed:
```yaml
i-car-legacy-archive:
  status: "archived"  # Change from "active"
  notes: "Archived on 2024-09-14 - use i-car-main-components instead"
```

### Change File Owner
When responsibility changes:
```yaml
i-car-main-components:
  owner: "New Team Name"  # Update this
```

---

## Validation Rules

The registry validates:
- ✅ Default file exists
- ✅ All project references point to existing files
- ✅ No duplicate Figma file keys
- ✅ All fallback files exist

Run validation:
```bash
node dev/scripts/figma-registry.mjs validate
```

**Example output (success):**
```
✅ Registry validation passed
```

**Example output (failure):**
```
❌ Registry validation failed:

   - Default file 'i-car-main-components' not found
   - Project 'kentico-cms' references missing file 'i-car-marketing-pages'
   - Duplicate Figma keys found: 80i51JCUKVIrTZ8Zt9y73X
```

---

## Integration with Build Scripts

### In `dev/scripts/build-pages.mjs`
```javascript
import { FigmaRegistry } from './figma-registry.mjs';

const registry = new FigmaRegistry();

// Validate registry before building
const errors = registry.validate();
if (errors.length > 0) {
    throw new Error(`Figma registry validation failed:\n${errors.join('\n')}`);
}

// Get file key for Figma operations
const figmaFileKey = registry.getFileKey();
```

### In `dev/scripts/qa-figma-gatekeeper.mjs`
```javascript
import { FigmaRegistry } from './figma-registry.mjs';

const registry = new FigmaRegistry();
const FIGMA_FILE_KEY = registry.getFileKey();

console.log(`🔍 Testing Figma MCP Access...`);
console.log(`   File: ${registry.getFile().name}`);
console.log(`   Key: ${FIGMA_FILE_KEY}`);
```

---

## Troubleshooting

### Error: "Figma file 'X' not found in registry"
**Solution:** Check the file alias spelling in `config/figma-registry.yaml`

### Error: "Node 'X' not found in file 'Y'"
**Solution:** Add the node to the `node_map` section for that file

### Error: "Registry validation failed"
**Solution:** Run `node dev/scripts/figma-registry.mjs validate` to see specific errors

### File key changed in Figma
**Solution:** Update the `key` field in `config/figma-registry.yaml` and commit

### Need to use different file for a project
**Solution:** Update the `primary_file` in the project mapping

---

## Best Practices

1. **Use meaningful aliases**: `i-car-main-components` instead of `figma-file-1`
2. **Keep node_map updated**: Add important components as you discover them
3. **Document ownership**: Always specify the `owner` field
4. **Validate regularly**: Run validation before commits
5. **Use project mappings**: Group related files by project
6. **Archive old files**: Don't delete, mark as archived for reference
7. **Update timestamps**: Keep `last_updated` current
8. **Add notes**: Document why files exist and how they're used

---

## Reference

### FigmaRegistry API

```javascript
import { FigmaRegistry } from './dev/scripts/figma-registry.mjs';

const registry = new FigmaRegistry();

// Get file key
registry.getFileKey(alias)           // Returns: string

// Get node ID
registry.getNodeId(nodeAlias, fileAlias)  // Returns: string

// Get file info
registry.getFile(alias)              // Returns: object

// List files
registry.listFiles(includeArchived)  // Returns: array

// Get project file
registry.getProjectFile(projectName) // Returns: object

// Get all project files
registry.getProjectFiles(projectName) // Returns: array

// List projects
registry.listProjects()              // Returns: array

// Validate registry
registry.validate()                  // Returns: array of errors

// Get default file
registry.getDefaultFile()            // Returns: object
```

---

## Questions?

For issues or questions about the Figma Registry:
1. Check this documentation
2. Run `node dev/scripts/figma-registry.mjs validate`
3. Review `config/figma-registry.yaml` structure
4. Check agent specifications in `memory/activeContext.md`
