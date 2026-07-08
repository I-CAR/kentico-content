import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createTemplateSection,
  getSupportedTemplateTypes,
  getSupportedVariantsByType,
} from "./page-template-registry.mjs";

const templateSourceDir = join("content", "templates");
const outputSourceDir = join("content", "pages");

function collectFiles(root, extension) {
  const files = [];

  if (!existsSync(root)) {
    return files;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") {
      continue;
    }

    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, extension));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function toSlug(sourceFile, template) {
  if (typeof template.slug === "string" && template.slug.trim()) {
    return template.slug.trim();
  }

  return basename(sourceFile, ".json");
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sectionTitleFromId(id) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseTemplateFile(sourceFile) {
  const template = JSON.parse(readFileSync(sourceFile, "utf8"));

  if (!template || typeof template !== "object" || Array.isArray(template)) {
    throw new Error(`Expected an object in ${sourceFile}`);
  }

  const allowedTemplateKeys = new Set(["slug", "title", "sections"]);
  const unexpectedTemplateKeys = Object.keys(template).filter((key) => !allowedTemplateKeys.has(key));

  if (unexpectedTemplateKeys.length > 0) {
    throw new Error(`Unexpected top-level key(s) in ${sourceFile}: ${unexpectedTemplateKeys.join(", ")}`);
  }

  if (!Array.isArray(template.sections)) {
    throw new Error(`Expected "sections" array in ${sourceFile}`);
  }

  return template;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, itemValue]) => `${JSON.stringify(key)}:${stableSerialize(itemValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function createSignature(value) {
  return createHash("sha1").update(stableSerialize(value)).digest("hex");
}

function normalizeSectionEntry(entry, sourceFile, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Expected section ${index + 1} in ${sourceFile} to be an object`);
  }

  const allowedSectionKeys = new Set(["id", "type", "variant"]);
  const unexpectedSectionKeys = Object.keys(entry).filter((key) => !allowedSectionKeys.has(key));

  if (unexpectedSectionKeys.length > 0) {
    throw new Error(
      `Unexpected key(s) on section ${index + 1} in ${sourceFile}: ${unexpectedSectionKeys.join(", ")}`,
    );
  }

  const { id, type, variant = "default" } = entry;

  if (typeof id !== "string" || !id.trim()) {
    throw new Error(`Expected section ${index + 1} in ${sourceFile} to include a non-empty "id"`);
  }

  if (typeof type !== "string" || !type.trim()) {
    throw new Error(`Expected section "${id}" in ${sourceFile} to include a non-empty "type"`);
  }

  if (typeof variant !== "string" || !variant.trim()) {
    throw new Error(`Expected section "${id}" in ${sourceFile} to use a non-empty "variant" when provided`);
  }

  return {
    id: id.trim(),
    type: type.trim(),
    variant: variant.trim(),
  };
}

function createSectionFromTemplate(entry, sourceFile, index) {
  const normalized = normalizeSectionEntry(entry, sourceFile, index);
  const generatedSection = createTemplateSection(normalized.type, normalized.variant, normalized.id);
  const templateEntry = {
    id: normalized.id,
    type: normalized.type,
    variant: normalized.variant,
  };
  const signature = createSignature(templateEntry);

  return {
    section: {
      ...generatedSection,
      id: normalized.id,
      type: normalized.type,
    },
    metadata: {
      ...templateEntry,
      signature,
    },
  };
}

function shouldIncludeInPageNav(section) {
  if (section.type === "pageNav" || section.type === "hero") {
    return false;
  }

  if (section.type === "legal" && !section.title) {
    return false;
  }

  return true;
}

function createPageNavLinks(sections) {
  return sections
    .filter(shouldIncludeInPageNav)
    .map((section) => ({
      label: section.title || sectionTitleFromId(section.id),
      href: `#${section.id}`,
    }));
}

function applyPageNavDefaults(sections) {
  const generatedLinks = createPageNavLinks(sections);

  return sections.map((section) => {
    if (section.type !== "pageNav") {
      return section;
    }

    if (Array.isArray(section.links) && section.links.length > 0) {
      return section;
    }

    return {
      ...section,
      links: generatedLinks,
    };
  });
}

function mergeSectionWithExisting(generatedSection, metadata, existingSection) {
  if (!existingSection || typeof existingSection !== "object") {
    return {
      section: {
        ...generatedSection,
        __template: metadata,
      },
      status: "new",
    };
  }

  const existingTemplateMetadata = existingSection.__template;
  const matchesIdentity = (
    existingSection.id === generatedSection.id &&
    existingSection.type === generatedSection.type
  );

  if (!matchesIdentity) {
    return {
      section: {
        ...generatedSection,
        __template: metadata,
      },
      status: "reset",
    };
  }

  if (!existingTemplateMetadata) {
    return {
      section: {
        ...existingSection,
        __template: metadata,
      },
      status: "adopted",
    };
  }

  if (existingTemplateMetadata.signature !== metadata.signature) {
    return {
      section: {
        ...generatedSection,
        __template: metadata,
      },
      status: "reset",
    };
  }

  return {
    section: {
      ...existingSection,
      __template: metadata,
    },
    status: "retained",
  };
}

function buildPageFromTemplate(template, sourceFile, existingPage = null) {
  const slug = toSlug(sourceFile, template);
  const title = typeof template.title === "string" && template.title.trim()
    ? template.title.trim()
    : titleFromSlug(slug);
  const generatedSections = template.sections.map((section, index) => createSectionFromTemplate(section, sourceFile, index));
  const withPageNavDefaults = applyPageNavDefaults(generatedSections.map((entry) => entry.section));
  const generatedById = new Map(generatedSections.map((entry) => [entry.section.id, entry.metadata]));
  const existingById = new Map((existingPage?.sections || []).map((section) => [section.id, section]));
  const mergedSections = withPageNavDefaults.map((section) => {
    const metadata = generatedById.get(section.id);
    return mergeSectionWithExisting(section, metadata, existingById.get(section.id));
  });
  const templateSignature = createSignature({
    slug,
    title,
    sections: generatedSections.map((entry) => entry.metadata),
  });

  return {
    page: {
      slug,
      title,
      sections: mergedSections.map((entry) => entry.section),
      ...(existingPage?.cms ? { cms: existingPage.cms } : {}),
      __template: {
        source: relative(templateSourceDir, sourceFile),
        signature: templateSignature,
      },
    },
    sectionStatuses: mergedSections.map((entry) => entry.status),
  };
}

function syncGeneratedPage(sourceFile, page) {
  const relativeFile = relative(templateSourceDir, sourceFile);
  const outputFile = join(outputSourceDir, relativeFile);
  const nextContents = `${JSON.stringify(page, null, 2)}\n`;

  if (!existsSync(outputFile)) {
    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, nextContents);

    return {
      status: "created",
      outputFile,
    };
  }

  const previousContents = readFileSync(outputFile, "utf8");

  if (previousContents === nextContents) {
    return {
      status: "unchanged",
      outputFile,
    };
  }

  writeFileSync(outputFile, nextContents);

  return {
    status: "updated",
    outputFile,
  };
}

function logSupportedVariants() {
  const variantsByType = getSupportedVariantsByType();

  console.error("[templates] Supported template section types and variants:");

  for (const type of getSupportedTemplateTypes()) {
    console.error(`- ${type}: ${variantsByType[type].join(", ")}`);
  }
}

export function createTemplateSnapshot() {
  const roots = [templateSourceDir, outputSourceDir];

  return roots
    .flatMap((root) => collectFiles(root, ".json"))
    .map((file) => {
      const contents = readFileSync(file, "utf8");
      return `${file}:${contents.length}:${stableSerialize(contents)}`;
    })
    .join("|");
}

export function syncTemplates() {
  const templateFiles = collectFiles(templateSourceDir, ".json");

  if (templateFiles.length === 0) {
    console.log("[templates] No template files found under content/templates");
    return { createdCount: 0, updatedCount: 0, unchangedCount: 0, failures: [] };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const failures = [];

  for (const sourceFile of templateFiles) {
    try {
      const template = parseTemplateFile(sourceFile);
      const outputFile = join(outputSourceDir, relative(templateSourceDir, sourceFile));
      const existingPage = existsSync(outputFile)
        ? JSON.parse(readFileSync(outputFile, "utf8"))
        : null;
      const { page } = buildPageFromTemplate(template, sourceFile, existingPage);
      const result = syncGeneratedPage(sourceFile, page);

      if (result.status === "created") {
        createdCount += 1;
        console.log(`[templates] Created ${result.outputFile}`);
      } else if (result.status === "updated") {
        updatedCount += 1;
        console.log(`[templates] Updated ${result.outputFile}`);
      } else {
        unchangedCount += 1;
        console.log(`[templates] Unchanged ${result.outputFile}`);
      }
    } catch (error) {
      failures.push({
        sourceFile,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`[templates] Summary: ${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[templates] Failed ${failure.sourceFile}`);
      console.error(failure.message);
    }

    logSupportedVariants();
  }

  return {
    createdCount,
    updatedCount,
    unchangedCount,
    failures,
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const result = syncTemplates();

  if (result.failures.length > 0) {
    process.exitCode = 1;
  }
}
