import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createTemplateSnapshot, syncTemplates } from "./generate-templates.mjs";

const watchMode = process.argv.includes("--watch");
const contentSourceDir = join("content", "pages");
const legacyGeneratedHtmlDir = join("html", "generated");
const isDirectRun = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

let buildQueued = false;
let buildRunning = false;
let queuedReason = null;
let watchDebounce = null;
let previousSnapshot = "";

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

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeContentText(value) {
  return value.replace(/I-CAR/g, "I&#8209;CAR").replace(/Gold Class/g, "Gold&nbsp;Class");
}

function applyWidowProtection(value) {
  const words = value.trim().split(/\s+/);

  if (words.length <= 5) {
    return value;
  }

  return value.replace(/\s+([^\s]+)\s*$/, "&nbsp;$1");
}

function renderText(value, { widowProtection = false } = {}) {
  const escapedValue = escapeHtml(value);
  const normalizedValue = normalizeContentText(escapedValue);
  return widowProtection ? applyWidowProtection(normalizedValue) : normalizedValue;
}

function normalizeHtmlBlocks(blocks) {
  if (!blocks) {
    return [];
  }

  return (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean);
}

function renderTrustedHtml(value) {
  return normalizeContentText(value);
}

function renderParagraphs(paragraphs, className = "") {
  return paragraphs
    .map((paragraph) => {
      const classAttribute = className ? ` class="${className}"` : "";
      return `                <p${classAttribute}>${renderText(paragraph, { widowProtection: true })}</p>`;
    })
    .join("\n\n");
}

function renderContentParagraphs(paragraphs = [], htmlParagraphs = [], className = "") {
  const classAttribute = className ? ` class="${className}"` : "";
  const plainMarkup = paragraphs.map(
    (paragraph) => `                <p${classAttribute}>${renderText(paragraph, { widowProtection: true })}</p>`,
  );
  const htmlMarkup = htmlParagraphs.map(
    (paragraph) => `                <p${classAttribute}>${renderTrustedHtml(paragraph)}</p>`,
  );

  return [...plainMarkup, ...htmlMarkup].join("\n\n");
}

function renderButtons(buttons, defaultClassName = "ic-btn ic-btn-primary") {
  if (!buttons?.length) {
    return "";
  }

  const buttonMarkup = buttons
    .map((button) => {
      const className = button.className || defaultClassName;
      return `                    <a href="${escapeHtml(button.href)}" class="${escapeHtml(className)}">${renderText(button.label)}</a>`;
    })
    .join("\n");

  return `                <p>\n${buttonMarkup}\n                </p>`;
}

function renderLinkList(links = [], className = "ic-menu mt-3") {
  if (!links.length) {
    return "";
  }

  const items = links
    .map(
      (link) =>
        `                                    <li><a href="${escapeHtml(link.href)}"${link.target ? ` target="${escapeHtml(link.target)}"` : ""}>${renderText(link.label)}</a></li>`,
    )
    .join("\n");

  return `                                <ul class="${escapeHtml(className)}">
${items}
                                </ul>`;
}

function indentBlock(block, spaces) {
  const prefix = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function renderPicture(image, imageClassName = "", defaultLoading = "lazy") {
  if (!image) {
    return "";
  }

  const sourceMarkup = image.mobileSrcset
    ? `\n                                <source media="(max-width: 768px)" width="${escapeHtml(image.width || "800")}" height="${escapeHtml(image.height || "450")}" sizes="${escapeHtml(image.sizes || "800px")}" srcset="${escapeHtml(image.mobileSrcset)}">`
    : "";
  const classAttribute = imageClassName ? ` class="${escapeHtml(imageClassName)}"` : "";
  const loading = image.loading || defaultLoading;

  return `<picture>${sourceMarkup}
                                <img alt="${escapeHtml(image.alt || "")}" loading="${escapeHtml(loading)}"${classAttribute} width="${escapeHtml(image.width || "")}" height="${escapeHtml(image.height || "")}" sizes="${escapeHtml(image.sizes || "")}" src="${escapeHtml(image.desktopSrc || "")}" srcset="${escapeHtml(image.desktopSrcset || image.desktopSrc || "")}">
                            </picture>`;
}

const iconSvgMap = {
  askICar: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M10.5 7.84668H49.5C53.075 7.84668 56 10.7717 56 14.3467V40.3467C56 43.9217 53.075 46.8467 49.5 46.8467H24.8L14.9506 53.882C13.9947 54.5648 12.6667 53.8814 12.6667 52.7065V46.8467H10.5C6.925 46.8467 4 43.9217 4 40.3467V14.3467C4 10.7717 6.925 7.84668 10.5 7.84668Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M27.0248 32.2439C27.0248 28.5051 29.156 27.1378 31.1257 25.8518C32.8145 24.7256 34.3823 23.7214 34.3823 21.349C34.3823 18.6559 32.5327 17.0873 29.8794 17.0873C27.3472 17.0873 25.3369 18.6559 25.3369 21.4293V21.7508H21.7588V21.3092C21.7588 16.5652 25.2565 13.5498 30.0004 13.5498C34.7842 13.5498 38.2412 16.4849 38.2412 21.3092C38.2412 25.5303 35.8697 26.8967 33.779 28.1429C32.0902 29.1481 30.5631 30.0729 30.5631 32.2439V32.7262H27.0248V32.2439ZM26.221 38.2341C26.221 36.7061 27.3471 35.5808 28.8743 35.5808C30.4023 35.5808 31.5276 36.7061 31.5276 38.2341C31.5276 39.7613 30.4023 40.8874 28.8743 40.8874C27.3471 40.8874 26.221 39.7613 26.221 38.2341Z" fill="#333538" />
  </svg>`,
  repairersRealm: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M24.7234 42.3714C24.4098 42.3714 24.0963 42.2884 23.8192 42.1253C23.275 41.8033 22.9417 41.2196 22.9417 40.5882V27.2436C22.9417 26.6136 23.275 26.0286 23.8192 25.7108C24.3578 25.3957 25.0342 25.3803 25.5842 25.684L37.7052 32.357C38.2762 32.6692 38.6292 33.2654 38.6292 33.918C38.6292 34.5676 38.2762 35.164 37.7052 35.4747L25.5842 42.1492C25.3142 42.2982 25.0188 42.3714 24.7234 42.3714Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M42.585 8.42432H51.7754C54.1099 8.42432 56 10.3173 56 12.6476V47.3527C56 49.6857 54.1099 51.5758 51.7754 51.5758H8.22458C5.89009 51.5758 4 49.6857 4 47.3527V12.6476C4 10.3173 5.89009 8.42432 8.22458 8.42432H42.585Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M4 18.2278H56" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="49.597" cy="13.5293" r="1.5" fill="#333538" />
    <circle cx="42.7637" cy="13.5293" r="1.5" fill="#333538" />
  </svg>`,
  justInTime: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M30 57C42.4264 57 52.5 46.9264 52.5 34.5C52.5 22.0736 42.4264 12 30 12C17.5736 12 7.5 22.0736 7.5 34.5C7.5 46.9264 17.5736 57 30 57Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 51.8571C39.586 51.8571 47.3571 44.086 47.3571 34.5C47.3571 24.9139 39.586 17.1428 30 17.1428C20.4139 17.1428 12.6428 24.9139 12.6428 34.5C12.6428 44.086 20.4139 51.8571 30 51.8571Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M47.2803 12.4153C47.2764 12.4114 47.2705 12.4114 47.2666 12.4153C47.2627 12.4192 48.3012 13.4635 48.3051 13.4674L49.662 14.8243L45.9028 18.5835C45.8989 18.5874 45.8989 18.5933 45.9028 18.5972C45.9048 18.5991 45.9072 18.6001 45.9097 18.6001C45.9121 18.6001 45.9146 18.5991 45.9165 18.5972L49.6757 14.838L52.0711 17.2334C52.073 17.2354 52.0755 17.2363 52.0779 17.2363C52.0803 17.2363 52.0828 17.2354 52.0847 17.2334C52.0887 17.2295 52.0887 17.2237 52.0847 17.2197L47.2803 12.4153Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M12.7334 12.429C12.7373 12.425 12.7373 12.4192 12.7334 12.4153C12.7295 12.4114 12.7237 12.4114 12.7198 12.4153L7.91529 17.2198C7.91138 17.2237 7.91138 17.2295 7.91529 17.2334C7.91725 17.2354 7.91969 17.2364 7.92213 17.2364C7.92457 17.2364 7.92701 17.2354 7.92897 17.2334L10.3244 14.838L14.0835 18.5972C14.0855 18.5992 14.0879 18.6001 14.0904 18.6001C14.0928 18.6001 14.0952 18.5992 14.0972 18.5972C14.1011 18.5933 14.1011 18.5874 14.0972 18.5835L10.338 14.8244L12.7334 12.429Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M32.5714 8.14282H27.4286V12H32.5714V8.14282Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M34.5 3H25.5C25.145 3 24.8572 3.28781 24.8572 3.64285V7.5C24.8572 7.85504 25.145 8.14285 25.5 8.14285H34.5C34.8551 8.14285 35.1429 7.85504 35.1429 7.5V3.64285C35.1429 3.28781 34.8551 3 34.5 3Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M28.1816 36.3281C28.1792 36.3281 28.1768 36.3272 28.1748 36.3252C28.1709 36.3213 28.1709 36.3154 28.1748 36.3115L37.7207 26.7656C37.7246 26.7617 37.7305 26.7617 37.7344 26.7656C37.7383 26.7695 37.7383 26.7754 37.7344 26.7793L28.1885 36.3252C28.1865 36.3272 28.1841 36.3281 28.1816 36.3281Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M31.8184 36.3281C31.8159 36.3281 31.8135 36.3272 31.8115 36.3252L24.9927 29.5063C24.9888 29.5025 24.9888 29.4966 24.9927 29.4927C24.9966 29.4888 25.0024 29.4888 25.0063 29.4927L31.8252 36.3115C31.8291 36.3154 31.8291 36.3213 31.8252 36.3252C31.8232 36.3272 31.8208 36.3281 31.8184 36.3281Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  adasNews: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" class="ic-card-icon" viewBox="0 0 60 60" fill="none">
    <path d="M57.5 45.5564V50.3767C57.5 51.5767 56.483 52.5568 55.2377 52.5568H4.77264C3.51696 52.5568 2.5 51.5767 2.5 50.3667V45.5564H20.7019C20.9198 46.6965 21.9472 47.5565 23.1924 47.5565H36.8075C38.0528 47.5565 39.0802 46.6965 39.2981 45.5564H57.5Z" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M14.5519 10.0098H5.05188V44.5564" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M45.4481 10.0098H54.9481V44.5565" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M32.75 36.9312V39.9117C32.75 40.4417 32.3164 40.8753 31.7864 40.8753H28.2136C27.6837 40.8753 27.25 40.4417 27.25 39.9117V36.9312" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M36.8762 27.8914C38.2257 26.2905 39.0263 24.2117 38.9878 21.9452C38.9082 17.2459 35.0645 13.3069 30.3682 13.1194C25.236 12.9145 21.0109 17.0144 21.0109 22.1012C21.0109 24.3058 21.8046 26.3251 23.1217 27.8888C23.92 28.8366 24.4255 29.9947 24.5358 31.2289L24.8839 35.1245C24.9752 36.1473 25.8322 36.9311 26.8591 36.9311H33.141C34.1679 36.9311 35.0249 36.1472 35.1162 35.1245L35.4748 31.1111C35.5817 29.9146 36.102 28.8098 36.8762 27.8914Z" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M24.3448 32.2505H34.9554" stroke="#333538" stroke-width="2.25" stroke-linejoin="round" />
    <path d="M39.6624 13.2808L41.3467 11.5964" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M33.5367 9.74397L34.1533 7.44312" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M26.4633 9.74397L25.8468 7.44312" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M20.3375 13.2808L18.6532 11.5964" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M16.8008 19.4066L14.5 18.79" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M16.8008 26.4797L14.5 27.0962" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M20.3375 32.6055L18.6532 34.2898" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M39.6624 32.6055L41.3467 34.2898" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M43.1991 26.4797L45.5 27.0962" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M43.1991 19.4066L45.5 18.79" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M28.2184 17.1428C28.2184 17.1428 24.8302 18.1128 24.8302 22.5564" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  totalCompensation: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M56.6399 16.3301H3.35986V23.0401H56.6399V16.3301Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M55.49 9.62012H4.52002V16.3301H55.49V9.62012Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M57.7997 23.04H2.19971V50.37H57.7997V23.04Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M46.3395 36.71H44.0195" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M15.9797 36.71H13.6597" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M25.8198 39.5503C25.8198 41.1203 27.0898 42.3903 28.6598 42.3903H31.3398C32.9098 42.3903 34.1798 41.1203 34.1798 39.5503C34.1798 37.9803 32.9098 36.7103 31.3398 36.7103H28.6598C27.0898 36.7103 25.8198 35.4403 25.8198 33.8703C25.8198 32.3003 27.0898 31.0303 28.6598 31.0303H31.3398C32.9098 31.0303 34.1798 32.3003 34.1798 33.8703" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M30 31.0301V27.8701" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M30 45.4901V42.3901" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M49.0103 23.04C49.0103 27.89 52.9503 31.83 57.8003 31.83V23.04H49.0103Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M57.8003 41.5898C52.9403 41.5898 49.0103 45.5298 49.0103 50.3798H57.8003V41.5898Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M10.9897 50.3798C10.9897 45.5298 7.04971 41.5898 2.19971 41.5898V50.3798H10.9897Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M2.19971 31.83C7.05971 31.83 10.9897 27.89 10.9897 23.04H2.19971V31.83Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
  </svg>`,
  hybridFlexibleWork: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M9.93006 55V29.85H2.31006L30.0001 5L57.6901 29.85H50.0701V55H9.93006Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M8.31055 24.47V9.95996H16.8405V16.81" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M43.4 37.5796V47.6796H16.6V37.5796" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M28.5403 40.58H21.9003C19.6503 40.58 17.6803 39.38 16.5903 37.58C16.0303 36.65 15.7103 35.55 15.7103 34.39V27.46H44.2803V34.39C44.2803 35.56 43.9603 36.65 43.3903 37.58C42.3103 39.38 40.3403 40.58 38.0803 40.58H31.4403" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30.6599 38.04H29.3399C28.8981 38.04 28.5399 38.3982 28.5399 38.84V42.36C28.5399 42.8019 28.8981 43.16 29.3399 43.16H30.6599C31.1017 43.16 31.4599 42.8019 31.4599 42.36V38.84C31.4599 38.3982 31.1017 38.04 30.6599 38.04Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M25.1903 27.4498C25.3003 24.8898 27.4103 22.8398 30.0003 22.8398C32.5903 22.8398 34.7003 24.8898 34.8103 27.4498" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  timeOff: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M22.64 26.5599C22.64 23.7099 25.26 21.3999 28.48 21.3999C31.7 21.3999 34.33 23.7099 34.33 26.5599C34.33 23.7099 36.95 21.3999 40.17 21.3999C43.39 21.3999 46.02 23.7099 46.02 26.5599C46.02 23.7099 48.64 21.3999 51.86 21.3999C55.08 21.3999 57.71 23.7099 57.71 26.5599H57.95C57.98 26.1299 58 25.6799 58 25.2299C58 13.6999 47.4 4.35986 34.33 4.35986C21.26 4.35986 10.67 13.6999 10.67 25.2299C10.67 25.6799 10.69 26.1299 10.72 26.5699H10.96C10.96 23.7099 13.58 21.3999 16.8 21.3999C20.02 21.3999 22.65 23.7099 22.65 26.5599C22.65 26.5599 19.31 12.2099 34.34 4.79986V26.5599" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M46.02 26.5598C46.02 26.5598 49.36 12.2098 34.33 4.7998" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M34.33 1.50977V45.9398" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M55.3399 51.8298H17.3399C15.2199 51.8298 13.2399 50.7298 12.1199 48.9298L2.38995 33.2498C1.61995 31.9998 1.99995 30.3598 3.24995 29.5898C4.49995 28.8198 6.13995 29.1998 6.90995 30.4498L16.6399 46.1298C16.7899 46.3698 17.0499 46.5198 17.3399 46.5198H55.3399C56.8099 46.5198 57.9999 47.7098 57.9999 49.1798C57.9999 50.6498 56.8099 51.8398 55.3399 51.8398V51.8298Z" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M34.3 51.8301V58.4901" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14.34 51.6099L10.6 58.4899" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M54.39 51.8501L58 58.4901" stroke="#3B383F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  healthBenefits: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M5.26997 27.63C2.98997 24.75 1.83997 20.93 2.46997 16.85C3.39997 10.8 8.40997 6.00002 14.49 5.29002C20.84 4.55002 27.65 8.86002 30.01 14.18C32.38 8.86002 39.19 4.55002 45.53 5.29002C51.61 6.00002 56.62 10.8 57.55 16.85C58.18 20.93 57.02 24.75 54.75 27.63L30.01 54.78L5.26997 27.63Z" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
    <path d="M52.76 30.2H40.98L37.47 37.04L34.29 23.31L28.21 38.41L23.1 19L19.97 30.2H7.84003" stroke="#3B383F" stroke-width="2" stroke-linejoin="round" />
  </svg>`,
  retirement: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M57.6903 57.6896H2.32031V2.30957" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.31 45.0401L27.31 19.8001L33.75 26.2501L57.69 2.31006" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M11.3897 38.6401V35.8701" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M21.08 38.6398V26.0898" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30.77 38.64V23.27" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M40.47 57.69V19.54" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M50.16 57.6898V9.83984" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.6897 8.26006V2.31006H51.7397" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M11.3895 38.6401V57.6901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M21.0797 38.6401V57.6901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30.77 38.6401V57.6901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  careerDevelopment: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M13.89 23.1201H2.29004" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.61 23.1201H46.01" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M5.70004 26.54L2.29004 23.12L5.70004 19.71" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M54.2 19.71L57.61 23.12L54.2 26.54" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.29004 3.56006L13.89 11.7701" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.89004 7.66984L2.29004 3.55984L6.39004 2.83984" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24.52 58.48H35.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24.52 58.48V35.04" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M35.48 35.04V58.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24.52 24.8099V35.0399H22.94C21.12 35.0399 19.65 32.7499 19.65 31.0999V22.5899C19.65 19.9999 21.77 17.7299 24.81 17.0599C28.92 16.1499 31.06 16.1499 35.17 17.0599C38.22 17.7299 40.33 19.9999 40.33 22.5899V31.0999C40.33 32.7599 38.86 35.0399 37.04 35.0399H35.46V24.8099" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 58.4802V38.7002" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.71 3.56006L46.11 11.7701" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.11 7.66984L57.71 3.55984L53.61 2.83984" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.29004 42.68L13.89 34.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.89004 38.5801L2.29004 42.6801L6.39004 43.4101" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.71 42.68L46.11 34.48" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M57.11 38.5801L57.71 42.6801L53.61 43.4101" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 13.1601C32.6509 13.1601 34.7999 11.011 34.7999 8.36006C34.7999 5.70909 32.6509 3.56006 30 3.56006C27.349 3.56006 25.2 5.70909 25.2 8.36006C25.2 11.011 27.349 13.1601 30 13.1601Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  disability: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M31.8791 35.9793H36.7891C38.6891 35.9793 40.2191 34.4393 40.2191 32.5493C40.2191 30.6493 38.6791 29.1193 36.7891 29.1193H29.7891C28.8591 29.1193 28.0491 28.4793 27.8291 27.5693C27.2491 25.1693 25.9991 20.2593 23.2991 17.7093C23.2991 17.7093 19.1691 13.7493 15.2091 17.5793C13.0191 19.9593 13.2891 23.2093 13.9491 26.1393L17.1991 39.8993C17.9391 42.5493 20.3491 44.3793 23.0891 44.3793H37.2291C37.6691 44.3793 38.0691 44.6093 38.2991 44.9893L45.0891 56.3293C46.0791 57.9793 48.2191 58.4893 49.8491 57.4793C51.3791 56.5293 51.9191 54.5493 51.0691 52.9493L43.4391 38.5393C42.5991 36.9593 40.9591 35.9693 39.1691 35.9693H27.3191C26.0891 35.9693 24.9591 35.3093 24.3491 34.2393C24.3491 34.2393 22.4291 31.3793 21.8791 27.2593" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M25.1177 8.73121C26.035 5.84126 24.4359 2.75486 21.5459 1.83756C18.656 0.920258 15.5696 2.51941 14.6523 5.40936C13.735 8.29932 15.3341 11.3857 18.2241 12.303C21.114 13.2203 24.2004 11.6212 25.1177 8.73121Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14.5394 28.6992C8.43943 30.7192 4.03943 36.4692 4.03943 43.2392C4.03943 51.7092 10.9094 58.5692 19.3694 58.5692C27.8294 58.5692 34.0494 52.3292 34.6494 44.4192" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M51.1102 9.72998L45.3202 16.27L41.3602 12.17" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M54.8097 5.59041C51.4197 5.35041 48.2797 3.85041 46.0997 1.42041C43.9197 3.85041 40.7797 5.36041 37.3897 5.59041L36.2297 5.67041V10.5904C36.2297 13.4304 37.1397 16.2004 38.8897 18.4104C40.9297 20.9904 43.3997 22.6304 46.0897 23.9104C48.7797 22.6404 51.2497 20.9904 53.2897 18.4104C55.0397 16.2004 55.9497 13.4204 55.9497 10.5904V5.67041L54.7897 5.59041H54.8097Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  lifeInsurance: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <g clip-path="url(#clip0_life_insurance)">
      <path d="M23.97 19.8598C29.1063 19.8598 33.27 15.696 33.27 10.5598C33.27 5.42352 29.1063 1.25977 23.97 1.25977C18.8338 1.25977 14.67 5.42352 14.67 10.5598C14.67 15.696 18.8338 19.8598 23.97 19.8598Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M40.2601 30.68C40.0601 30.46 39.8501 30.24 39.6301 30.03C35.6201 26.02 30.0801 23.54 23.9601 23.54C11.7301 23.54 1.81006 33.46 1.81006 45.69V49.27H31.4901" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M52.06 40.5103L44.74 48.7803L39.74 43.5903" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M56.72 35.29C52.44 34.99 48.48 33.09 45.72 30.02C42.97 33.09 39 34.99 34.72 35.29L33.26 35.39V41.6C33.26 45.18 34.41 48.69 36.62 51.48C39.2 54.74 42.32 56.81 45.72 58.42C49.12 56.81 52.24 54.74 54.82 51.48C57.03 48.69 58.18 45.18 58.18 41.6V35.39L56.72 35.29Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <defs>
      <clipPath id="clip0_life_insurance">
        <rect width="60" height="60" fill="white" />
      </clipPath>
    </defs>
  </svg>`,
  voluntaryBenefits: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M52.02 12.1298C43.46 11.5298 35.52 7.72982 30 1.56982C24.48 7.71982 16.54 11.5298 7.97999 12.1298L5.04999 12.3298V24.7698C5.04999 31.9398 7.34999 38.9598 11.78 44.5498C16.95 51.0698 23.19 55.2298 30 58.4498C36.81 55.2298 43.05 51.0798 48.22 44.5498C52.65 38.9598 54.95 31.9398 54.95 24.7698V12.3298L52.02 12.1298Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 42.77C37.0416 42.77 42.75 37.0616 42.75 30.02C42.75 22.9784 37.0416 17.27 30 17.27C22.9584 17.27 17.25 22.9784 17.25 30.02C17.25 37.0616 22.9584 42.77 30 42.77Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M22.57 30.02H37.43" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M30 37.4501V22.5801" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  icareWellbeingProgram: `<svg class="ic-card-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
    <path d="M49.58 28.7399L53.86 35.5699C54.85 37.1499 53.71 39.2099 51.85 39.2099H51.17C50.29 39.2099 49.58 39.9199 49.58 40.7999V45.9299C49.58 49.6199 46.33 52.4799 42.67 51.9999L39.74 51.6199C38.66 51.4799 37.71 52.3199 37.71 53.4099V58.6999H15.09V41.2099C15.09 41.2099 -4.08999 23.0399 12.58 7.35989C25.48 -4.77011 49.51 2.06989 49.51 21.1299L49.58 28.7399Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M16.55 16.6099C17.4 14.2099 19.2 12.8699 21.72 12.6299C25.58 12.2599 27.77 16.1399 27.77 16.1399C27.77 16.1399 29.96 12.2599 33.82 12.6299C36.33 12.8699 38.14 14.2099 38.99 16.6099C39.86 19.0699 39.22 21.9899 37.78 24.1599C35.25 27.9899 28.3 32.3299 27.77 32.6599C27.24 32.3299 20.29 27.9899 17.76 24.1599C16.33 21.9899 15.69 19.0699 16.55 16.6099Z" stroke="#333538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
};

function resolveIconSvg(card) {
  if (card.iconSvg) {
    return card.iconSvg;
  }

  if (card.iconKey && iconSvgMap[card.iconKey]) {
    return iconSvgMap[card.iconKey];
  }

  throw new Error(`Missing iconSvg or valid iconKey for card "${card.title || "unknown"}"`);
}

function renderHeroSection(section) {
  const bodyMarkup = renderContentParagraphs(section.body || [], section.bodyHtml || []);
  const buttonsMarkup = renderButtons(section.buttons);
  const imageMarkup = renderPicture(
    section.image,
    section.imageClassName || section.image?.className || "ic-image-banner",
    "eager",
  );
  const imageLinkHref = section.imageLink?.href || section.buttons?.[0]?.href || "";
  const imageLinkTitle = section.imageLink?.title || section.buttons?.[0]?.label || section.title;
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const heroContentClass = section.contentClassName || "col order-last order-md-first mt-2 pt-1 mt-md-0 pt-md-0";
  const heroMediaClass = section.mediaClassName || "col col-12 col-md col-lg-7 order-first order-md-last";
  const heroRowClassName = section.rowClassName || "row justify-content-center";
  const badgeMarkup = section.badgeImage
    ? `\n                    <div class="${escapeHtml(section.badgeColumnClass || "col col-auto order-first order-md-last mb-3 pb-3 mb-md-0 pb-md-0")}">
                        <img alt="${escapeHtml(section.badgeImage.alt || "")}" class="${escapeHtml(section.badgeImage.className || "ic-image-logo")}" loading="${escapeHtml(section.badgeImage.loading || "lazy")}" width="${escapeHtml(section.badgeImage.width || "")}" height="${escapeHtml(section.badgeImage.height || "")}" sizes="${escapeHtml(section.badgeImage.sizes || "")}" src="${escapeHtml(section.badgeImage.desktopSrc || "")}" srcset="${escapeHtml(section.badgeImage.desktopSrcset || section.badgeImage.desktopSrc || "")}">
                    </div>`
    : "";

  return `        <section id="${escapeHtml(section.id)}" class="ic-section ic-section-hero${backgroundClass}">
            <div class="container">
                <div class="${escapeHtml(heroRowClassName)}">

                    <div class="${escapeHtml(heroContentClass)}">
                        <div class="ic-box ic-box-mobile-collapse">
                            <h1 class="ic-section-title">${renderText(section.title)}</h1>
                            ${section.label ? `<p class="ic-label">${renderText(section.label)}</p>` : ""}
                            ${section.sublabel ? `<p class="ic-sublabel">${renderText(section.sublabel, { widowProtection: true })}</p>` : ""}
${bodyMarkup ? `${bodyMarkup}\n\n` : ""}${buttonsMarkup}
                        </div>
                    </div>

${badgeMarkup}

                    <div class="${escapeHtml(heroMediaClass)}">
                        ${imageLinkHref ? `<a href="${escapeHtml(imageLinkHref)}" title="${escapeHtml(imageLinkTitle)}">
                            ${imageMarkup}
                        </a>` : imageMarkup}
                    </div>

                </div>
            </div>
        </section>`;
}

function renderPageNavSection(section) {
  const linkMarkup = (section.links || [])
    .map(
      (link) =>
        `                            <li><a href="${escapeHtml(link.href)}" class="ic-btn ic-btn-primary ic-btn-outline">${renderText(link.label)}</a></li>`,
    )
    .join("\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section ic-section-nav ic-background-light">
            <div class="container">
                <div class="row justify-content-center">

                    <nav class="col col-12" aria-label="On-Page Navigation">
                        <ul class="ic-menu ic-menu-horizontal mt-0">
${linkMarkup}
                        </ul>
                    </nav>

                </div>
            </div>
        </section>`;
}

function renderCardsSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const introBodyMarkup = renderContentParagraphs(section.body || [], section.bodyHtml || []);
  const buttonsMarkup = renderButtons(section.buttons, "ic-btn ic-btn-primary ic-btn-outline");
  const cardColumnClass = section.cardColumnClass || "col col-12 col-md-6 col-xl-4 pt-3 mt-3";
  const introColumnClass = section.introColumnClass || "col col-md-10 col-lg-8 col-xl-6 text-md-center";
  const contentColumnClass = section.contentColumnClass || "col col-12 col-xl-9";
  const cardClassName = section.cardClassName || "ic-card";
  const cardBodyClassName = section.cardBodyClassName || "ic-card-body ic-card-body-indented";
  const imageClassName = section.imageClassName || "ic-card-image ic-image-rounded";
  const cardMarkup = (section.cards || [])
    .map(
      (card) => `                            <div class="${escapeHtml(cardColumnClass)}">
                                <div class="${escapeHtml(card.className || cardClassName)}">
                                    <div class="${escapeHtml(card.bodyClassName || cardBodyClassName)}">
${card.title ? `                                        <h3 class="ic-card-title">${renderText(card.title)}</h3>\n` : ""}                                        <p class="ic-card-text">${renderText(card.body, { widowProtection: true })}</p>
                                    </div>
${card.image ? `                                    <figure class="ic-card-media">
                                        ${renderPicture(card.image, card.imageClassName || imageClassName)}
                                    </figure>` : ""}
                                </div>
                            </div>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(introColumnClass)}">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${introBodyMarkup ? `\n${introBodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="${escapeHtml(contentColumnClass)}">
                        <div class="row justify-content-center">
${cardMarkup}
                        </div>
                    </div>
                </div>
${buttonsMarkup ? `\n\n                <div class="row justify-content-center mt-3 pt-3">
                    <div class="col">
                        <p class="text-md-center">
                            <a href="${escapeHtml(section.buttons[0].href)}" class="${escapeHtml(section.buttons[0].className || "ic-btn ic-btn-primary ic-btn-outline")}">${renderText(section.buttons[0].label)}</a>
                        </p>
                    </div>
                </div>` : ""}
            </div>
        </section>`;
}

function renderTextSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = renderContentParagraphs(section.body || [], section.bodyHtml || []);
  const buttonsMarkup = renderButtons(section.buttons, "ic-btn ic-btn-primary ic-btn-outline");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
${buttonsMarkup ? `\n\n${buttonsMarkup}` : ""}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderStatementListSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = renderContentParagraphs(section.body || [], section.bodyHtml || []);
  const statementsMarkup = (section.statements || [])
    .map(
      (statement) => `                        <h3>${renderText(statement.title)}</h3>

                        <p>${renderText(statement.body, { widowProtection: true })}</p>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}\n` : ""}
${statementsMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderCtaSection(section) {
  const bodyMarkup = renderContentParagraphs(section.body || [], section.bodyHtml || []);
  const buttonsMarkup = renderButtons(section.buttons, "ic-btn ic-btn-primary ic-btn-outline");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section ic-background-light">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
${buttonsMarkup ? `\n\n${buttonsMarkup}` : ""}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderTextMediaSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(
    renderContentParagraphs(section.body || [], section.bodyHtml || []),
    12,
  );
  const buttonsMarkup = indentBlock(
    renderButtons(section.buttons, "ic-btn ic-btn-primary ic-btn-outline"),
    12,
  );
  const linkListMarkup = section.links ? `${renderLinkList(section.links)}\n` : "";
  const textColumnClasses = section.textColumnClass || (section.reverse
    ? "col col-12 col-md-6 mt-3 mt-md-0 pl-lg-5"
    : "col col-12 col-md-6 mb-3 pb-3 mb-md-0 pb-md-0 pr-lg-5");
  const mediaColumnClasses = section.mediaColumnClass || (section.reverse
    ? "col col-12 col-md-6 mb-3 pb-3 mb-md-0 pb-md-0 pr-lg-5"
    : "col col-12 col-md-6 mt-3 mt-md-0");
  const contentColumnClass = section.contentColumnClass || "col col-12 col-xl-10";
  const rowClassName = section.rowClassName || "row justify-content-between align-items-center";
  const textColumn = `                            <div class="${escapeHtml(textColumnClasses)}">
                                <h2 class="${escapeHtml(section.titleClassName || "ic-section-title")}">${renderText(section.title)}</h2>
${section.label ? `                                <p class="ic-label">${renderText(section.label)}</p>\n` : ""}${section.sublabel ? `                                <p class="ic-sublabel">${renderText(section.sublabel, { widowProtection: true })}</p>\n` : ""}${bodyMarkup ? `${bodyMarkup}\n` : ""}${linkListMarkup}${buttonsMarkup ? `\n${buttonsMarkup}\n` : ""}                            </div>`;
  const pictureMarkup = section.mediaHtml
    ? renderTrustedHtml(section.mediaHtml)
    : renderPicture(section.image, section.imageClassName || "ic-section-image ic-image-rounded");
  const linkedPictureMarkup = section.mediaHtml
    ? `                                ${pictureMarkup}`
    : section.imageLink
      ? `                                <a href="${escapeHtml(section.imageLink.href)}" title="${escapeHtml(section.imageLink.title || section.title)}">
${indentBlock(pictureMarkup, 36)}
                                </a>`
      : `                                ${pictureMarkup}`;
  const mediaColumn = `                            <div class="${escapeHtml(mediaColumnClasses)}">
${linkedPictureMarkup}
                            </div>`;

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}${section.sectionClassName ? ` ${escapeHtml(section.sectionClassName)}` : ""}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="${escapeHtml(contentColumnClass)}">
                        <div class="${escapeHtml(rowClassName)}">
${section.reverse ? `${mediaColumn}\n\n${textColumn}` : `${textColumn}\n\n${mediaColumn}`}
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderQuoteGridSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8);
  const buttonsMarkup = renderButtons(section.buttons, "ic-btn ic-btn-primary ic-btn-outline");
  const useCarousel = section.carousel !== false;
  const slideClassName = useCarousel
    ? "swiper-slide col col-12 col-md-6 col-xl-3 pt-3 mt-1 mt-md-3"
    : "col col-12 col-md-6 col-xl-3 pt-3 mt-1 mt-md-3";
  const quoteMarkup = (section.quotes || [])
    .map(
      (quote) => `                            <div class="${slideClassName}">
                                <blockquote class="ic-card ic-background-white">
                                    <div class="ic-card-body">
                                        <p class="ic-card-text">${renderText(quote.quote, { widowProtection: true })}</p>
                                        <div class="ic-card-cite ic-cite">
                                            <img alt="${escapeHtml(quote.image?.alt || quote.name)}" loading="lazy" class="ic-cite-photo" width="${escapeHtml(quote.image?.width || "70")}" height="${escapeHtml(quote.image?.height || "70")}" sizes="${escapeHtml(quote.image?.sizes || "80px")}" src="${escapeHtml(quote.image?.desktopSrc || "")}" srcset="${escapeHtml(quote.image?.desktopSrcset || quote.image?.desktopSrc || "")}">
                                            <p>
                                                <cite>
                                                    <strong>${renderText(quote.name)}</strong><br>
                                                    ${renderText(quote.title, { widowProtection: true })}
                                                </cite>
                                            </p>
                                        </div>
                                    </div>
                                </blockquote>
                            </div>`,
    )
    .join("\n\n");

  const quotesWrapperMarkup = useCarousel
    ? `                        <div class="swiper ic-swiper js-ic-swiper">
                            <div class="swiper-wrapper row align-items-stretch">
${quoteMarkup}
                            </div>
                        </div>`
    : `                        <div class="row align-items-stretch">
${quoteMarkup}
                        </div>`;

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}${section.sectionClassName ? ` ${escapeHtml(section.sectionClassName)}` : ""}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12">
${quotesWrapperMarkup}
                    </div>
                </div>
${buttonsMarkup ? `\n\n                <div class="row justify-content-center mt-3 pt-3">
                    <div class="col">
${indentBlock(buttonsMarkup, 24)}
                    </div>
                </div>` : ""}
            </div>
        </section>`;
}

function renderQuoteSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const quoteClass = section.compact ? "ic-quote-text mb-3 pb-1" : "ic-quote-text";
  const quoteBody = (section.quoteHtml || [])
    .map((paragraph) => {
      const paragraphClass = section.compact ? ' class="text-md-center"' : "";
      return `                                <p${paragraphClass}>${renderTrustedHtml(paragraph)}</p>`;
    })
    .join("\n");

  if (section.compact) {
    return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6">
                        <h2 class="ic-section-title text-md-center">${renderText(section.title)}</h2>

                        <blockquote>
                            <div class="${quoteClass}">
${quoteBody}
                            </div>
                            <div class="ic-cite">
                                <img alt="${escapeHtml(section.cite.image.alt)}" class="ic-cite-photo" loading="lazy" width="${escapeHtml(section.cite.image.width)}" height="${escapeHtml(section.cite.image.height)}" sizes="${escapeHtml(section.cite.image.sizes)}" src="${escapeHtml(section.cite.image.desktopSrc)}" srcset="${escapeHtml(section.cite.image.desktopSrcset)}">
                                <p>
                                    <cite>
                                        <strong>${renderText(section.cite.name)}</strong><br>
                                        ${renderText(section.cite.title, { widowProtection: true })}
                                    </cite>
                                </p>
                            </div>
                        </blockquote>
                    </div>
                </div>
            </div>
        </section>`;
  }

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center mb-3 pb-3 mb-md-2 pb-md-0">
                    <div class="col col-md-10 col-lg-8 col-xl-6">
                        <h2 class="ic-section-title text-center">${renderText(section.title)}</h2>
${section.body || section.bodyHtml ? `\n${indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8)}\n` : ""}
                        <blockquote class="ic-card ic-card-lg ic-background-white">
                            <div class="ic-card-body">
                                <div class="${quoteClass}">
${quoteBody}
                                </div>
                            </div>
                            <div class="ic-card-media">
                                <div class="ic-card-cite ic-cite">
                                    <img alt="${escapeHtml(section.cite.image.alt)}" loading="lazy" class="ic-cite-photo" width="${escapeHtml(section.cite.image.width)}" height="${escapeHtml(section.cite.image.height)}" sizes="${escapeHtml(section.cite.image.sizes)}" src="${escapeHtml(section.cite.image.desktopSrc)}" srcset="${escapeHtml(section.cite.image.desktopSrcset)}">
                                    <p>
                                        <cite>
                                            <strong>${renderText(section.cite.name)}</strong><br>
                                            ${renderText(section.cite.title, { widowProtection: true })}
                                        </cite>
                                    </p>
                                </div>
                            </div>
                        </blockquote>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderProfileGridSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8);
  const profileMarkup = (section.profiles || [])
    .map(
      (profile) => `                            <li class="col-6 col-md-4 col-lg-3 col-xxl-5up mt-3 pt-3">
                                <div class="ic-card ic-card-column">
                                    <figure class="ic-card-media">
                                        <div class="ic-card-profile ic-profile ic-profile-stacked">
                                            <img alt="${escapeHtml(profile.image?.alt || profile.name)}" class="ic-profile-photo" loading="lazy" width="${escapeHtml(profile.image?.width || "100")}" height="${escapeHtml(profile.image?.height || "100")}" sizes="${escapeHtml(profile.image?.sizes || "100px")}" src="${escapeHtml(profile.image?.desktopSrc || "")}" srcset="${escapeHtml(profile.image?.desktopSrcset || profile.image?.desktopSrc || "")}">
                                            <p>
                                                <strong>${renderText(profile.name)}</strong><br>
                                                ${renderText(profile.title, { widowProtection: true })}
                                            </p>
                                        </div>
                                    </figure>
                                </div>
                            </li>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center mb-2">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12 col-xl-10">
                        <ul class="row justify-content-md-center">
${profileMarkup}
                        </ul>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderMediaFeatureListSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8);
  const featureMarkup = (section.cards || [])
    .map(
      (card) => `                            <div class="col col-12 mt-3 pt-3 mt-md-4">
                                <div class="ic-card">
                                    <div class="row">
                                        <div class="col col-12 col-md order-last mt-2 pt-1 mt-md-0 pt-md-0">
                                            <h3 class="mb-2">${renderText(card.title)}</h3>

                                            <p class="mb-1"><strong>${renderText(card.lead, { widowProtection: true })}</strong></p>

                                            <p>${renderText(card.body, { widowProtection: true })}</p>
                                        </div>

                                        <div class="col col-12 col-md order-first pr-lg-3">
                                            <figure class="ic-card-media">
                                                ${renderPicture(card.image, "ic-card-image ic-image-rounded")}
                                            </figure>
                                        </div>
                                    </div>
                                </div>
                            </div>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}${section.className ? ` ${escapeHtml(section.className)}` : ""}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-8">
                        <div class="row justify-content-center">
${featureMarkup}
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderIconCardGridSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8);
  const footerBodyMarkup = indentBlock(
    renderContentParagraphs(section.footerBody || [], section.footerBodyHtml || []),
    8,
  );
  const footerButtonsMarkup = renderButtons(section.footerButtons, "ic-btn ic-btn-primary ic-btn-outline");
  const cardMarkup = (section.cards || [])
    .map(
      (card) => `                    <div class="${escapeHtml(section.cardColumnClass || "col col-12 col-md-6 col-lg-4 col-xl-3 col-xxl-5up")}">
                        <div class="ic-card ic-card-horizontal-mobile ic-background-white">
                            <div class="ic-card-body">
${card.title ? `                                <h3 class="ic-card-title">${card.href ? `<a href="${escapeHtml(card.href)}" class="stretched-link"${card.target ? ` target="${escapeHtml(card.target)}"` : ""} title="${escapeHtml(card.linkTitle || card.title)}">${renderText(card.title)}</a>` : renderText(card.title)}</h3>\n` : ""}
                                <p class="ic-card-text">${renderText(card.body, { widowProtection: true })}</p>
                            </div>
                            <figure class="ic-card-media">
${indentBlock(resolveIconSvg(card).trim(), 32)}
                            </figure>
                        </div>
                    </div>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}${section.className ? ` ${escapeHtml(section.className)}` : ""}">
            <div class="container">
                <div class="row justify-content-center mb-3 pb-3">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-md-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row row_compact justify-content-center">
${cardMarkup}
                </div>
${section.footerTitle || footerBodyMarkup || footerButtonsMarkup ? `\n\n                <div class="row justify-content-center pt-4 mt-3 pt-md-5 mt-md-2">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-center">
${section.footerTitle ? `                        <h3>${renderText(section.footerTitle)}</h3>\n` : ""}${footerBodyMarkup ? `${footerBodyMarkup}\n` : ""}                    </div>
                </div>
${footerButtonsMarkup ? `\n                <div class="row justify-content-center mt-3 pt-3">
                    <div class="col col-auto">
${indentBlock(footerButtonsMarkup, 24)}
                    </div>
                </div>` : ""}` : ""}
            </div>
        </section>`;
}

function renderLogoGridSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8);
  const logoMarkup = (section.logos || [])
    .map(
      (logo) => `                            <li class="${escapeHtml(section.logoColumnClass || "col-auto mt-3 pt-3 px-md-4")}">
                                ${logo.href ? `<a href="${escapeHtml(logo.href)}" class="stretched-link"${logo.title ? ` title="${escapeHtml(logo.title)}"` : ""}>` : ""}<img alt="${escapeHtml(logo.alt)}" class="${escapeHtml(logo.className || "ic-logo")}" height="${escapeHtml(logo.height)}" loading="lazy" src="${escapeHtml(logo.src)}" width="${escapeHtml(logo.width)}">${logo.href ? "</a>" : ""}
                            </li>`,
    )
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center mb-2">
                    <div class="col col-md-10 col-lg-8 col-xl-6 text-center">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-8">
                        <ul class="ic-logo-list row justify-content-center">
${logoMarkup}
                        </ul>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderStickyCardsSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const introButtonsMarkup = section.buttons?.length
    ? `                                ${renderButtons(section.buttons, "ic-btn ic-btn-primary ic-btn-outline").trim()}`
    : "";
  const introBodyMarkup = renderContentParagraphs(section.body || [], section.bodyHtml || []);
  const listMarkup = (section.cards || [])
    .map((card) => {
      const listMarkupInner = (card.listItems || [])
        .map((item) => `                                            <li>${renderText(item, { widowProtection: true })}</li>`)
        .join("\n");
      const linkListMarkupInner = (card.linkItems || [])
        .map(
          (item) => `                                            <li><a href="${escapeHtml(item.href)}"${item.target ? ` target="${escapeHtml(item.target)}"` : ""}>${renderText(item.label)}</a>${item.meta ? `<span>${renderText(item.meta)}</span>` : ""}</li>`,
        )
        .join("\n");

      return `                                <div class="ic-card ic-background-white">
                                    <div class="ic-card-body">
                                        <h3 class="ic-card-title${card.titleClassName ? ` ${escapeHtml(card.titleClassName)}` : ""}">${renderText(card.title)}</h3>
${card.body ? `                                        <p>${renderText(card.body, { widowProtection: true })}</p>\n` : ""}${card.bodyHtml ? `                                        <p>${renderTrustedHtml(card.bodyHtml)}</p>\n` : ""}${listMarkupInner ? `                                        <ul class="ic-card-list mt-0">
${listMarkupInner}
                                        </ul>
` : ""}${linkListMarkupInner ? `                                        <ul class="${escapeHtml(card.linkListClassName || "ic-card-list ic-card-list-courses")}">
${linkListMarkupInner}
                                        </ul>
` : ""}${card.footer ? `                                        <p>${renderText(card.footer, { widowProtection: true })}</p>` : ""}${card.footerHtml ? `                                        <p>${renderTrustedHtml(card.footerHtml)}</p>` : ""}
                                    </div>
                                </div>`;
    })
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-9">
                        <div class="row justify-content-center">
                            <div class="col col-12 col-md-6 col-xl-5 mb-4 pr-md-4">
                                <div class="ic-sticky">
                                    <h2 class="ic-section-title">${renderText(section.title)}</h2>
${introBodyMarkup ? `${indentBlock(introBodyMarkup, 36)}\n` : ""}${introButtonsMarkup ? `${introButtonsMarkup}\n` : ""}                                </div>
                            </div>

                            <div class="col col-12 col-md-6 col-xl-7 pt-2 pt-md-0 pl-md-4">
${listMarkup}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderLegalSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = (section.paragraphs || [])
    .map((paragraph) => `                        <p><small>${renderTrustedHtml(paragraph)}</small></p>`)
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}${section.className ? ` ${escapeHtml(section.className)}` : ""}">
            <div class="container">
                <div class="row justify-content-center mb-3 pb-3 mb-md-2 pb-md-0">
                    <div class="col col-md-10 col-lg-8 col-xl-6">
${bodyMarkup}
                    </div>
                </div>
            </div>
        </section>`;
}

function renderAccordionItemBody(item) {
  const paragraphs = (item.body || [])
    .map((paragraph) => `                                                <p>${renderText(paragraph, { widowProtection: true })}</p>`)
    .join("\n");
  const htmlParagraphs = (item.bodyHtml || [])
    .map((paragraph) => `                                                <p>${renderTrustedHtml(paragraph)}</p>`)
    .join("\n");
  const listIntro = item.listIntro
    ? `                                                <p class="my-0">${renderText(item.listIntro, { widowProtection: true })}</p>\n`
    : "";
  const listMarkup = item.listItems?.length
    ? `                                                <ul class="${escapeHtml(item.listClassName || "my-1 pl-3 ml-5")}">
${item.listItems
  .map((listItem) => `                                                    <li>${renderTrustedHtml(listItem)}</li>`)
  .join("\n")}
                                                </ul>\n`
    : "";
  const closingText = item.closingText
    ? `                                                <p class="my-0">${renderText(item.closingText, { widowProtection: true })}</p>`
    : "";

  return [paragraphs, htmlParagraphs, listIntro, listMarkup, closingText].filter(Boolean).join("\n");
}

function renderAccordionSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const introBodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 32);
  const accordionId = escapeHtml(section.accordionId || `${section.id}Accordion`);
  const itemsMarkup = (section.items || [])
    .map((item, index) => {
      const itemNumber = index + 1;
      const headingId = `${section.id}-heading-${itemNumber}`;
      const collapseId = `${section.id}-collapse-${itemNumber}`;

      return `                                <div class="ic-card ic-background-white accordion-item mb-2">
                                    <h3 class="ic-card-title accordion-header" id="${escapeHtml(headingId)}">
                                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${escapeHtml(collapseId)}" aria-expanded="false" aria-controls="${escapeHtml(collapseId)}">
                                            ${renderText(item.title)}
                                        </button>
                                    </h3>
                                    <div id="${escapeHtml(collapseId)}" class="accordion-collapse collapse" aria-labelledby="${escapeHtml(headingId)}"${section.accordionId ? ` data-bs-parent="#${accordionId}"` : ""}>
                                        <div class="accordion-body">
${renderAccordionItemBody(item)}
                                        </div>
                                    </div>
                                </div>`;
    })
    .join("\n\n");

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-8">
                        <div class="row justify-content-center">

                            <div class="${escapeHtml(section.introColumnClass || "col col-12 col-md-6 col-xl")}">
                                <h2 class="${escapeHtml(section.titleClassName || "ic-section-title ic-sticky")}">${renderText(section.title)}</h2>
${introBodyMarkup ? `${introBodyMarkup}\n` : ""}                            </div>

                            <div class="${escapeHtml(section.accordionColumnClass || "col col-12 col-md-6 col-xl-auto pt-2 pt-md-0 pl-md-4")}">
                                <div class="${escapeHtml(section.accordionClassName || "accordion py-0")}" id="${accordionId}">
${itemsMarkup}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderEmbedSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8);

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">

                <div class="row justify-content-center${section.introRowClassName ? ` ${escapeHtml(section.introRowClassName)}` : " mb-3 pb-3"}">
                    <div class="${escapeHtml(section.introColumnClass || "col col-md-10 col-lg-8 col-xl-6 text-md-center")}">
                        <h2 class="ic-section-title">${renderText(section.title)}</h2>
${bodyMarkup ? `\n${bodyMarkup}` : ""}
                    </div>
                </div>

                <div class="row justify-content-center${section.embedRowClassName ? ` ${escapeHtml(section.embedRowClassName)}` : " pt-2"}">
                    <div class="${escapeHtml(section.embedColumnClass || "col col-12 col-lg-10 col-xl-8")}">
${indentBlock(renderTrustedHtml(section.embedHtml || ""), 24)}
                    </div>
                </div>

            </div>
        </section>`;
}

function renderMediaSliderSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const introBodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 32);
  const slidesMarkup = (section.slides || [])
    .map(
      (slide, index) => `                                        <div class="${escapeHtml(section.slideClassName || "swiper-slide col col-12")}">
                                            ${slide.link?.href ? `<a href="${escapeHtml(slide.link.href)}"${slide.link.title ? ` title="${escapeHtml(slide.link.title)}"` : ""}>` : ""}<img alt="${escapeHtml(slide.image.alt || "")}" loading="${escapeHtml(slide.image.loading || (index === 0 ? "eager" : "lazy"))}" class="${escapeHtml(slide.image.className || "ic-image-rounded")}" width="${escapeHtml(slide.image.width || "")}" height="${escapeHtml(slide.image.height || "")}" sizes="${escapeHtml(slide.image.sizes || "")}" src="${escapeHtml(slide.image.desktopSrc || "")}" srcset="${escapeHtml(slide.image.desktopSrcset || slide.image.desktopSrc || "")}">${slide.link?.href ? "</a>" : ""}
                                        </div>`,
    )
    .join("\n\n");
  const buttonsMarkup = section.buttons?.length
    ? `\n                                ${renderButtons(section.buttons, "ic-btn ic-btn-primary ic-btn-outline").trim()}`
    : "";

  return `        <section id="${escapeHtml(section.id)}" class="ic-section${backgroundClass}">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col col-12 col-lg-10 col-xl-9">
                        <div class="row justify-content-between align-items-center">

                            <div class="${escapeHtml(section.introColumnClass || "col col-11 col-md-5 col-lg-4 mb-3 mb-md-0")}">
                                <h2 class="ic-section-title">${renderText(section.title)}</h2>
${introBodyMarkup ? `${introBodyMarkup}\n` : ""}${buttonsMarkup}
                            </div>

                            <div class="${escapeHtml(section.sliderColumnClass || "col col-12 col-md-7 col-lg-8 mt-3 mt-md-0")}">
                                <div class="${escapeHtml(section.sliderClassName || "swiper ic-swiper js-ic-swiper")}" aria-label="${escapeHtml(section.ariaLabel || `${section.title} slider`)}">
                                    <div class="${escapeHtml(section.wrapperClassName || "swiper-wrapper row flex-nowrap")}">
${slidesMarkup}
                                    </div>

                                    <div class="swiper-pagination"></div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </section>`;
}

function renderSection(section) {
  switch (section.type) {
    case "hero":
      return renderHeroSection(section);
    case "pageNav":
      return renderPageNavSection(section);
    case "cards":
      return renderCardsSection(section);
    case "text":
      return renderTextSection(section);
    case "statementList":
      return renderStatementListSection(section);
    case "textMedia":
      return renderTextMediaSection(section);
    case "quote":
      return renderQuoteSection(section);
    case "quoteGrid":
      return renderQuoteGridSection(section);
    case "profileGrid":
      return renderProfileGridSection(section);
    case "mediaFeatureList":
      return renderMediaFeatureListSection(section);
    case "iconCardGrid":
      return renderIconCardGridSection(section);
    case "logoGrid":
      return renderLogoGridSection(section);
    case "stickyCards":
      return renderStickyCardsSection(section);
    case "legal":
      return renderLegalSection(section);
    case "cta":
      return renderCtaSection(section);
    case "accordion":
      return renderAccordionSection(section);
    case "embed":
      return renderEmbedSection(section);
    case "mediaSlider":
      return renderMediaSliderSection(section);
    default:
      throw new Error(`Unsupported section type "${section.type}" in "${section.id || "unknown"}"`);
  }
}

function renderDocument(page, outputFile) {
  const pageTitle = escapeHtml(page.title || page.slug || "Generated Page");
  const stylesheetHref = toPosixPath(relative(dirname(outputFile), "css/vendor/cms-main-202106042.css"));
  const bootstrapCssHref = toPosixPath(relative(dirname(outputFile), "node_modules/bootstrap/dist/css/bootstrap.min.css"));
  const swiperCssHref = toPosixPath(relative(dirname(outputFile), "node_modules/swiper/swiper-bundle.min.css"));
  const mainCssHref = toPosixPath(relative(dirname(outputFile), "css/style.css"));
  const jqueryHref = toPosixPath(relative(dirname(outputFile), "node_modules/jquery/dist/jquery.min.js"));
  const scriptHref = toPosixPath(relative(dirname(outputFile), "js/script.js"));
  const sectionMarkup = (page.sections || []).map((section) => renderSection(section)).join("\n\n");
  const inlineCmsScriptHtml = renderPageCmsScriptHtml(page);

  return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${stylesheetHref}">
    <link rel="stylesheet" href="${bootstrapCssHref}">
    <link rel="stylesheet" href="${swiperCssHref}">
    <link rel="stylesheet" href="${mainCssHref}">
    <script src="${jqueryHref}"></script>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&amp;display=swap" rel="stylesheet" />
</head>

<body>

    <main>

${sectionMarkup}

    </main>

${inlineCmsScriptHtml ? `${inlineCmsScriptHtml}\n\n` : ""}    <script src="${scriptHref}"></script>
</body>

</html>
`;
}

function renderPageCmsScriptHtml(page) {
  return normalizeHtmlBlocks(page.cms?.scriptHtml)
    .map((block) => renderTrustedHtml(block).trim())
    .filter(Boolean)
    .join("\n\n");
}

function parseAuthoringFile(sourceFile) {
  const page = JSON.parse(readFileSync(sourceFile, "utf8"));

  if (!page || typeof page !== "object") {
    throw new Error(`Expected an object in ${sourceFile}`);
  }

  if (!Array.isArray(page.sections)) {
    throw new Error(`Expected "sections" array in ${sourceFile}`);
  }

  return page;
}

function toContentHtmlRelativePath(sourceFile, page) {
  const sourceRelativePath = relative(contentSourceDir, sourceFile).replace(/\\/g, "/");
  const sourceDirectory = dirname(sourceRelativePath).replace(/\\/g, "/");
  const fallbackName = sourceRelativePath.split("/").pop().replace(/\.json$/i, "");
  const outputBaseName = page.slug || fallbackName;
  return join(sourceDirectory, `${outputBaseName}.html`).replace(/\\/g, "/");
}

function toVirtualHtmlSourcePath(sourceFile, page) {
  return join("html", toContentHtmlRelativePath(sourceFile, page)).replace(/\\/g, "/");
}

export function collectRenderedPageDocuments() {
  const templateSyncResult = syncTemplates();

  if (templateSyncResult.failures.length > 0) {
    throw new Error("Template sync failed");
  }

  if (!existsSync(contentSourceDir)) {
    return [];
  }

  return collectFiles(contentSourceDir, ".json").map((sourceFile) => {
    const page = parseAuthoringFile(sourceFile);
    const relativeOutputPath = toContentHtmlRelativePath(sourceFile, page);
    const virtualSourcePath = toVirtualHtmlSourcePath(sourceFile, page);

    return {
      sourceFile,
      page,
      relativeOutputPath,
      virtualSourcePath,
      html: renderDocument(page, virtualSourcePath),
    };
  });
}

async function buildPages() {
  const renderedPages = collectRenderedPageDocuments();
  rmSync(legacyGeneratedHtmlDir, { recursive: true, force: true });

  for (const renderedPage of renderedPages) {
    console.log(`[pages] Validated ${renderedPage.sourceFile}`);
  }

  return renderedPages.length > 0;
}

export function createContentSnapshot() {
  const pageSnapshot = existsSync(contentSourceDir)
    ? collectFiles(contentSourceDir, ".json")
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|")
    : "";
  const templateSnapshot = createTemplateSnapshot();

  return [pageSnapshot, templateSnapshot].filter(Boolean).join("|");
}

async function build(reason = "manual") {
  if (buildRunning) {
    buildQueued = true;
    queuedReason = reason;
    return;
  }

  buildRunning = true;

  try {
    await buildPages();

    if (watchMode) {
      console.log(`[pages] Build complete (${reason})`);
    }
  } catch (error) {
    console.error(`[pages] Build failed${watchMode ? ` (${reason})` : ""}`);
    console.error(error instanceof Error ? error.message : error);

    if (!watchMode) {
      process.exitCode = 1;
    }
  } finally {
    buildRunning = false;

    if (buildQueued) {
      buildQueued = false;
      const nextReason = queuedReason ?? "queued change";
      queuedReason = null;
      queueMicrotask(() => {
        void build(nextReason);
      });
    }
  }
}

function scheduleBuild(reason) {
  clearTimeout(watchDebounce);
  watchDebounce = setTimeout(() => {
    void build(reason);
  }, 75);
}

if (isDirectRun) {
  await build();

  if (watchMode) {
    console.log("[pages] Watching content/pages/**/*.json");
    previousSnapshot = createContentSnapshot();

    setInterval(() => {
      const nextSnapshot = createContentSnapshot();

      if (nextSnapshot === previousSnapshot) {
        return;
      }

      previousSnapshot = nextSnapshot;
      scheduleBuild("polling change");
    }, 250);
  }
}
