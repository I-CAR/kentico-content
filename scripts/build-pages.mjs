import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

const watchMode = process.argv.includes("--watch");
const contentSourceDir = join("content", "pages");
const generatedHtmlDir = join(".cache", "generated-html");
const legacyGeneratedHtmlDir = join("html", "generated");

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

function ensureOutputDir() {
  mkdirSync(generatedHtmlDir, { recursive: true });
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
                                        <h3 class="ic-card-title">${renderText(card.title)}</h3>
                                        <p class="ic-card-text">${renderText(card.body, { widowProtection: true })}</p>
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
  const pictureMarkup = renderPicture(section.image, section.imageClassName || "ic-section-image ic-image-rounded");
  const linkedPictureMarkup = section.imageLink
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
  const cardMarkup = (section.cards || [])
    .map(
      (card) => `                    <div class="col col-12 col-md-6 col-lg-4 col-xl-3 col-xxl-5up">
                        <div class="ic-card ic-card-horizontal-mobile ic-background-white">
                            <div class="ic-card-body">
                                <h3 class="ic-card-title">${renderText(card.title)}</h3>
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
            </div>
        </section>`;
}

function renderLogoGridSection(section) {
  const backgroundClass = section.backgroundLight ? " ic-background-light" : "";
  const bodyMarkup = indentBlock(renderContentParagraphs(section.body || [], section.bodyHtml || []), 8);
  const logoMarkup = (section.logos || [])
    .map(
      (logo) => `                            <li class="col-auto mt-3 pt-3 px-md-4">
                                <img alt="${escapeHtml(logo.alt)}" class="ic-logo" height="${escapeHtml(logo.height)}" loading="lazy" src="${escapeHtml(logo.src)}" width="${escapeHtml(logo.width)}">
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

      return `                                <div class="ic-card ic-background-white">
                                    <div class="ic-card-body">
                                        <h3 class="ic-card-title${card.titleClassName ? ` ${escapeHtml(card.titleClassName)}` : ""}">${renderText(card.title)}</h3>
${card.body ? `                                        <p>${renderText(card.body, { widowProtection: true })}</p>\n` : ""}${card.bodyHtml ? `                                        <p>${renderTrustedHtml(card.bodyHtml)}</p>\n` : ""}${listMarkupInner ? `                                        <ul class="ic-card-list mt-0">
${listMarkupInner}
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
  const inlineCmsScriptHtml = page.cms?.scriptOutput === "separateHtmlFile" ? "" : renderPageCmsScriptHtml(page);

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

function toGeneratedHtmlPath(sourceFile, page) {
  const sourceRelativePath = relative(contentSourceDir, sourceFile);
  const sourceDirectory = dirname(sourceRelativePath);
  const fallbackName = basename(sourceRelativePath, extname(sourceRelativePath));
  const outputBaseName = page.slug || fallbackName;
  return join(generatedHtmlDir, sourceDirectory, `${outputBaseName}.html`);
}

function toGeneratedCmsOutputPath(sourceFile, page) {
  const sourceRelativePath = relative(contentSourceDir, sourceFile);
  const sourceDirectory = dirname(sourceRelativePath);
  const fallbackName = basename(sourceRelativePath, extname(sourceRelativePath));
  const outputBaseName = page.slug || fallbackName;
  return join("cms", "generated", sourceDirectory, `${outputBaseName}.html`);
}

function cleanupRemovedGeneratedPages(expectedOutputs) {
  if (!existsSync(generatedHtmlDir)) {
    return;
  }

  const existingOutputs = collectFiles(generatedHtmlDir, ".html");

  for (const filePath of existingOutputs) {
    if (!expectedOutputs.has(filePath)) {
      rmSync(filePath, { force: true });
    }
  }
}

async function buildPages() {
  ensureOutputDir();

  if (!existsSync(contentSourceDir)) {
    return false;
  }

  const jsonFiles = collectFiles(contentSourceDir, ".json");
  const outputMap = new Map();

  for (const sourceFile of jsonFiles) {
    const page = parseAuthoringFile(sourceFile);
    const outputFile = toGeneratedHtmlPath(sourceFile, page);
    outputMap.set(sourceFile, { outputFile, page });
  }

  cleanupRemovedGeneratedPages(
    new Set(outputMap.values().map(({ outputFile }) => outputFile)),
  );

  rmSync(legacyGeneratedHtmlDir, { recursive: true, force: true });

  for (const [sourceFile, { outputFile, page }] of outputMap.entries()) {
    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, renderDocument(page, outputFile));

    console.log(`[pages] Prepared ${toGeneratedCmsOutputPath(sourceFile, page)}`);
  }

  return jsonFiles.length > 0;
}

function createContentSnapshot() {
  if (!existsSync(contentSourceDir)) {
    return "";
  }

  return collectFiles(contentSourceDir, ".json")
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");
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
