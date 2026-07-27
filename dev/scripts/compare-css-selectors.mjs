import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [, , baselinePath, candidatePath] = process.argv;

if (!baselinePath || !candidatePath) {
  console.error("Usage: node dev/scripts/compare-css-selectors.mjs <baseline.css> <candidate.css>");
  process.exit(1);
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, " ").trim();
}

function extractSelectors(css) {
  const selectors = new Set();
  const cleaned = stripComments(css);
  const rulePattern = /([^{}]+)\{/g;
  let match;

  while ((match = rulePattern.exec(cleaned)) !== null) {
    const selectorGroup = match[1].trim();

    if (!selectorGroup || selectorGroup.startsWith("@")) {
      continue;
    }

    for (const selector of selectorGroup.split(",")) {
      const normalized = normalizeSelector(selector);

      if (!normalized || normalized.startsWith("@")) {
        continue;
      }

      selectors.add(normalized);
    }
  }

  return selectors;
}

function classifySelector(selector) {
  const classMatch = selector.match(/\.([_a-zA-Z][\w-]*)/);

  if (classMatch) {
    const className = classMatch[1];

    if (className.startsWith("ic-")) {
      return "ic-*";
    }

    if (className.startsWith("section")) {
      return "section*";
    }

    if (className.startsWith("btn")) {
      return "btn*";
    }

    if (className.startsWith("card")) {
      return "card*";
    }

    if (className.startsWith("row") || className.startsWith("col")) {
      return "grid*";
    }

    return `.${className}`;
  }

  if (selector.startsWith(":")) {
    return "pseudo";
  }

  const tagMatch = selector.match(/^[a-z]+/i);
  return tagMatch ? tagMatch[0].toLowerCase() : "other";
}

function summarizeBuckets(selectors) {
  const buckets = new Map();

  for (const selector of selectors) {
    const bucket = classifySelector(selector);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}

const baselineCss = readFileSync(baselinePath, "utf8");
const candidateCss = readFileSync(candidatePath, "utf8");
const baselineSelectors = extractSelectors(baselineCss);
const candidateSelectors = extractSelectors(candidateCss);

const missingFromCandidate = [...baselineSelectors].filter((selector) => !candidateSelectors.has(selector));
const addedInCandidate = [...candidateSelectors].filter((selector) => !baselineSelectors.has(selector));
const sharedCount = baselineSelectors.size - missingFromCandidate.length;
const coverage = baselineSelectors.size === 0 ? 100 : (sharedCount / baselineSelectors.size) * 100;

console.log(`Baseline: ${basename(baselinePath)} (${baselineSelectors.size} selectors)`);
console.log(`Candidate: ${basename(candidatePath)} (${candidateSelectors.size} selectors)`);
console.log(`Shared selectors: ${sharedCount}`);
console.log(`Coverage: ${coverage.toFixed(1)}%`);
console.log(`Missing from candidate: ${missingFromCandidate.length}`);
console.log(`Added in candidate: ${addedInCandidate.length}`);

console.log("\nTop missing selector buckets:");
for (const [bucket, count] of summarizeBuckets(missingFromCandidate)) {
  console.log(`- ${bucket}: ${count}`);
}

console.log("\nSample missing selectors:");
for (const selector of missingFromCandidate.slice(0, 40)) {
  console.log(`- ${selector}`);
}
