import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const pagesSourceDir = join("content", "pages");
const templateSourceDir = join("content", "templates");

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

function detectVariant(section) {
  if (section.type === "textMedia" && section.reverse) {
    return "reverse";
  }

  if (section.type === "quote" && section.compact) {
    return "compact";
  }

  if (section.type === "quoteGrid" && section.carousel === false) {
    return "static";
  }

  return "default";
}
function createTemplateSectionEntry(section) {
  const variant = detectVariant(section);
  return {
    id: section.id,
    type: section.type,
    ...(variant !== "default" ? { variant } : {}),
  };
}

function backfillTemplateForPage(pageFile) {
  const page = JSON.parse(readFileSync(pageFile, "utf8"));
  const relativeFile = relative(pagesSourceDir, pageFile);
  const templateFile = join(templateSourceDir, relativeFile);
  const alreadyExists = existsSync(templateFile);

  const template = {
    slug: page.slug,
    title: page.title,
    sections: (page.sections || []).map((section) => createTemplateSectionEntry(section)),
  };

  mkdirSync(dirname(templateFile), { recursive: true });
  writeFileSync(templateFile, `${JSON.stringify(template, null, 2)}\n`);

  return { status: alreadyExists ? "updated" : "created", templateFile };
}

function backfillTemplates() {
  const pageFiles = collectFiles(pagesSourceDir, ".json");
  let createdCount = 0;
  let updatedCount = 0;

  for (const pageFile of pageFiles) {
    const result = backfillTemplateForPage(pageFile);

    if (result.status === "created") {
      createdCount += 1;
      console.log(`[templates:backfill] Created ${result.templateFile}`);
    } else {
      updatedCount += 1;
      console.log(`[templates:backfill] Updated ${result.templateFile}`);
    }
  }

  console.log(`[templates:backfill] Summary: ${createdCount} created, ${updatedCount} updated`);
}

backfillTemplates();
