import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import postcss from "postcss";
import { parseStructuredAuthoringFile, stripAuthoringFileExtension } from "./authoring-format.mjs";
import {
  collectRenderableContentFiles,
  collectRenderedPageDocuments,
  createContentSnapshot,
  stripCmsFragmentMarkers,
} from "./build-pages.mjs";
import { pageUsesBootstrap, pageUsesJquery, pageUsesSwiper } from "./page-dependencies.mjs";

const outputDir = "cms";
const contentSourceDir = join("content", "pages");
const legacyOutputDirs = ["pages", "content", "css", "js", "includes", "_shared", "generated"].map((directory) =>
  join(outputDir, directory),
);
const htmlVoidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const defaultAttributePriority = [
  "id",
  "class",
  "href",
  "title",
  "src",
  "alt",
  "loading",
  "width",
  "height",
  "target",
  "rel",
  "type",
  "name",
  "value",
  "role",
];
const tagAttributePriority = {
  a: ["href", "title", "target", "rel", "class", "id"],
  button: ["class", "type", "aria-controls", "aria-expanded", "aria-label", "id"],
  div: ["id", "role", "class"],
  img: ["alt", "loading", "width", "height", "class", "src", "sizes", "srcset", "id"],
  input: ["type", "name", "value", "id", "class", "placeholder", "checked", "required"],
  link: ["href", "rel", "media", "type", "crossorigin", "as"],
  nav: ["id", "class", "aria-label", "role"],
  option: ["value", "selected"],
  script: ["src", "type", "async", "defer"],
  source: ["height", "media", "sizes", "srcset", "width", "type", "src"],
};
const cmsShellCss = `:root{--shell-inline-padding:var(--space-12);--shell-header-inline-padding:var(--shell-inline-padding);--shell-footer-inline-padding:var(--shell-inline-padding);--shell-breadcrumb-inline-padding:var(--shell-inline-padding);--shell-content-inline-padding:var(--space-8);--shell-section-inline-padding:var(--space-15);--shell-desktop-inline-offset:0px;--shell-max-width:var(--site-width)}@media screen and (min-width:1024.1px){:root{--shell-inline-padding:var(--space-8);--shell-content-inline-padding:var(--space-12);--shell-section-inline-padding:var(--space-12);--shell-desktop-inline-offset:var(--space-15)}}.header .header-inner,.footer .footer-inner{max-width:100%;margin-left:auto;margin-right:auto}.header .header-inner{padding-left:var(--shell-header-inline-padding);padding-right:var(--shell-header-inline-padding)}.footer .footer-inner{padding-left:var(--shell-footer-inline-padding);padding-right:var(--shell-footer-inline-padding)}#main,#main>article{padding-left:0;padding-right:0}.zoneMainContent,.zoneMainContent>.pdp.container,.zoneMainContent .pdp.container{max-width:none!important;width:100%;margin-left:auto;margin-right:auto;padding-left:0;padding-right:0}.pdp.container>.row{margin:0}#main>article{padding:0}.content.no-right-rail{padding:0 var(--shell-content-inline-padding)}.content.no-right-rail h1:only-child{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.breadcrumb{margin:calc(25rem / var(--rem-base)) auto;padding:0 var(--shell-breadcrumb-inline-padding)}.ic-section .container,.ic-header .container{padding-left:var(--shell-section-inline-padding);padding-right:var(--shell-section-inline-padding)}@media screen and (min-width:1440px){.ic-section .container,.ic-header .container,.breadcrumb,.header .header-inner,.footer .footer-inner{max-width:var(--shell-max-width)!important}}`;
const cmsFormShellCss = `.ic-section+.row.row--with-cols-padding,.section+.row.row--with-cols-padding{margin-top:var(--section-margin);background:var(--lightest)!important;padding:var(--section-padding) 0}.ic-section.ic-background-white+.row.row--with-cols-padding,.section.ic-background-white+.row.row--with-cols-padding,.section.bg-white+.row.row--with-cols-padding{background:var(--lightest)!important}.ic-section.ic-background-light+.row.row--with-cols-padding,.section.ic-background-light+.row.row--with-cols-padding,.section.bg-light+.row.row--with-cols-padding{margin-top:0;background:none!important}.ic-section+.row.row--with-cols-padding:last-child,.section+.row.row--with-cols-padding:last-child{padding-bottom:clamp(5rem,1.721rem + 9.697vw,7.5rem)}.ic-section+.row.row--with-cols-padding form,.section+.row.row--with-cols-padding form,.row--with-cols-padding form{max-width:100%}.row--with-cols-padding:has(form,.formwidget-submit-text){margin:0}.row--with-cols-padding:has(.formwidget-submit-text) .subhead,.row--with-cols-padding:has(.formwidget-submit-text) .disclaimer{display:none!important}`;
const aboutUsCmsLegacyCss = `
:where(body,.content)>section.section_hero {
  margin-top: calc(-30rem / 16);
}

:where(body,.content)>section.section_hero img,
:where(body,.content)>section.section_about-vision .rounded,
:where(body,.content)>section.section_about-technical .rounded {
  border-radius: calc(12rem / 16);
}

:where(body,.content)>section.section_programs {
  padding-bottom: 0;
}

.section_about-education .about-education-media,
.section_about-education .about-education-media img {
  display: block;
}

.section_about-education .about-education-copy {
  padding-top: calc(12rem / 16);
}

.section_about-education .about-education-title {
  margin-top: 0;
}

.section_about-vision h2+h3 {
  margin-top: var(--space-20);
}

.section_about-governance .card {
  --card-body-padding: calc(20rem / 16);
}

.section_about-governance .card-body {
  padding: var(--card-body-padding);
}

.section_programs+.section_logos {
  margin-top: 0 !important;
}

.section_international .col-sm-6.col-xl-4 {
  box-sizing: border-box;
}

.section_international .card {
  --card-body-padding: var(--space-20);
}

.section_international .card-body {
  padding: var(--card-body-padding);
}

.section_iacet {
  --section-padding: clamp(var(--space-40), 0.996rem + 4.449vw, var(--space-60));
  background-color: var(--lighter, #F7F7F7) !important;
}

.section_logos {
  background: var(--light);
}

.section_iacet .iacet-accreditations {
  box-sizing: border-box;
  width: 100%;
  max-width: calc(800rem / 16);
  margin-right: auto;
  margin-left: auto;
}

.section_iacet .iacet-accreditation-row {
  display: flex;
  flex-direction: column;
  align-items: stretch !important;
  box-sizing: border-box;
  width: 100%;
  margin-right: 0;
  margin-left: 0;
}

.section_iacet .iacet-accreditation-row+.iacet-accreditation-row {
  margin-top: var(--section-padding);
}

.section_iacet .iacet-accreditation-logo,
.section_iacet .iacet-accreditation-copy {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding-right: 0;
  padding-left: 0;
}

.section_iacet .iacet-accreditation-logo {
  display: flex;
  align-items: flex-start;
  overflow: visible;
  margin-bottom: calc(24rem / 16);
}

.section_iacet .iacet-accreditation-logo a {
  display: block;
  max-width: 100%;
  overflow: visible;
}

.section_iacet .iacet-accreditation-logo img {
  display: block;
  flex-shrink: 0;
  max-width: 100%;
  height: auto;
  overflow: visible;
  border-radius: 0 !important;
}

.section_iacet .iacet-accreditation-row--iacet .iacet-accreditation-logo img {
  width: calc(155rem / 16);
}

.section_iacet .iacet-accreditation-row--soc2 .iacet-accreditation-logo img {
  width: calc(116rem / 16);
}

.section_iacet .iacet-accreditation-copy {
  text-align: left;
}

.section_iacet .iacet-accreditation-copy h2 {
  margin-top: 0;
}

.section_iacet .iacet-accreditation-copy>:last-child {
  margin-bottom: 0;
}

.section_iacet .iacet-accreditation-row--iacet a:focus,
.section_iacet .iacet-accreditation-row--iacet a:focus-visible {
  outline: 3px solid var(--primary-color, #0045FF);
  outline-offset: 4px;
}

.row_logos .col-auto {
  flex: 0 0 calc(150rem / 16);
  max-width: calc(150rem / 16);
}

.embed-responsive-3by2 {
  padding-top: 0;
  aspect-ratio: 3 / 2;
  margin-bottom: 0;
}

@media screen and (min-width: 768px) {

  .section_iacet .iacet-accreditation-row {
    display: grid;
    grid-template-columns: calc(155rem / 16) minmax(0, 1fr);
    column-gap: calc(48rem / 16);
    align-items: start !important;
  }

  .section_iacet .iacet-accreditation-logo {
    width: calc(155rem / 16);
    max-width: calc(155rem / 16);
    margin-bottom: 0;
  }

  .section_iacet .iacet-accreditation-row--iacet .iacet-accreditation-logo img {
    max-width: calc(155rem / 16);
  }

  .section_iacet .iacet-accreditation-row--soc2 .iacet-accreditation-logo img {
    max-width: calc(116rem / 16);
  }

  .section_iacet .iacet-accreditation-copy {
    width: auto;
    max-width: none;
  }

  :where(body,.content)>section.section_hero,
  :where(body,.content)>section.section_about-vision,
  :where(body,.content)>section.section_about-education,
  :where(body,.content)>section.section_about-technical,
  :where(body,.content)>section.section_international {
    padding-top: calc(30rem / 16);
    padding-bottom: calc(30rem / 16);
  }

  :where(body,.content)>section.section_programs {
    padding-top: calc(30rem / 16);
  }

  :where(body,.content)>section.section_hero {
    margin-top: calc(-60rem / 16);
  }

  :where(body,.content)>section.section_hero img {
    border-radius: calc(20rem / 16);
  }

  :where(body,.content)>section.section_about-education .about-education-media img,
  :where(body,.content)>section.section_about-vision .rounded,
  :where(body,.content)>section.section_about-technical .rounded {
    border-radius: calc(20rem / 16) !important;
  }

  .section_logos img {
    max-width: 80%;
  }
}

@media screen and (max-width: 768px) {
  .section_logos .row_logos {
    width: 1100vw;
  }

  .section_logos .container-fluid {
    overflow: auto;
  }
}

@media screen and (max-width: 767.9px) {
  .section_international {
    padding-top: var(--space-60);
    padding-bottom: var(--space-60);
  }

  .section_international h2 {
    margin-top: 0 !important;
  }

  .section_international>.container-fluid>.row>:first-child {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }

  .section_international>.container-fluid>.row>:last-child {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }

  .section_international .col-sm-6.col-xl-4:last-child {
    padding-bottom: 0 !important;
  }

  .section_iacet .iacet-accreditation-logo {
    justify-content: flex-start !important;
  }

  .section_about-education,
  .section_programs {
    padding-top: calc(40rem / 16);
  }

  .section_hero:has(+.section_about-vision)>.container-fluid>.row>:last-child {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }

  .section_hero:has(+.section_about-vision) img,
  .section_about-vision img,
  .section_about-technical img {
    display: block;
  }

  .section_about-vision {
    padding-top: calc(40rem / 16);
    padding-bottom: calc(20rem / 16);
  }

  .section_about-vision>.container-fluid>.row>:first-child {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }

  .section_about-vision>.container-fluid>.row>:last-child {
    margin-bottom: calc(20rem / 16) !important;
    padding-bottom: 0 !important;
  }

  .section_about-education .about-education-media img,
  .section_about-vision img,
  .section_about-technical img {
    border-radius: calc(12rem / 16) !important;
  }

  .section_about-vision h2,
  .section_about-education h2,
  .section_about-technical h2,
  .section_programs h2,
  .section_logos h2,
  .section_about-governance h2 {
    margin-top: 0 !important;
  }

  .section_about-education {
    padding-bottom: calc(40rem / 16);
  }

  .section_about-education>.container-fluid {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding-top: 0 !important;
  }

  .section_about-education .about-education-text,
  .section_about-education .row>.col-md-6:last-child {
    margin-bottom: 0;
  }

  .section_about-education .row>.col-md-6:last-child {
    padding-bottom: 0 !important;
  }

  .section_about-technical,
  .section_logos {
    padding-top: calc(40rem / 16);
    padding-bottom: calc(40rem / 16);
  }

  .section_about-technical .col-12>.row>:last-child {
    margin-top: 0 !important;
    order: 1 !important;
    padding-top: 0 !important;
  }

  .section_about-technical .col-12>.row>:first-child {
    margin-bottom: 0 !important;
    order: 2 !important;
    padding-bottom: 0 !important;
  }

  .section_about-technical .col-12>.row>:first-child>:last-child {
    margin-bottom: 0;
  }

  .section_programs .col-md-10 {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }

  .section_logos>.container-fluid:first-child .row>:first-child {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }

  .section_logos .row_logos {
    margin-bottom: 0 !important;
  }

  .section_logos .row_logos>[class*="col"] {
    padding-bottom: 0 !important;
  }

  .section_about-governance>.container-fluid>.row:first-child>:first-child {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }
}
`;
const cmsHeadBootstrapSource = `(function(){var bootstrapScript=document.currentScript;var deferredScriptType='text/plain';var run=function(){if(!document.head||!document.body){bootstrapScript&&bootstrapScript.remove();return}var headNodes=Array.from(document.body.querySelectorAll('link,style'));var scriptNodes=Array.from(document.body.querySelectorAll('script[type="'+deferredScriptType+'"]'));var sameLink=function(node){var href=node.getAttribute('href')||'';var rel=node.getAttribute('rel')||'';var media=node.getAttribute('media')||'';var as=node.getAttribute('as')||'';if(!href)return false;return Array.from(document.head.querySelectorAll('link[href]')).some(function(existing){return existing!==node&&(existing.getAttribute('href')||'')===href&&(existing.getAttribute('rel')||'')===rel&&(existing.getAttribute('media')||'')===media&&(existing.getAttribute('as')||'')===as;});};var sameStyle=function(node){var css=(node.textContent||'').trim();if(!css)return false;return Array.from(document.head.querySelectorAll('style')).some(function(existing){return existing!==node&&(existing.textContent||'').trim()===css;});};headNodes.forEach(function(node){var duplicate=node.tagName.toLowerCase()==='link'?sameLink(node):sameStyle(node);if(duplicate){node.remove();return}document.head.appendChild(node)});scriptNodes.forEach(function(node){var script=document.createElement('script');Array.from(node.attributes).forEach(function(attribute){if(attribute.name==='type')return;script.setAttribute(attribute.name,attribute.value)});if(node.textContent)script.textContent=node.textContent;node.remove();document.body.appendChild(script)});bootstrapScript&&bootstrapScript.remove()};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run,{once:true})}else{run()}})();`;
const cmsFormShellClasses = [
  "breadcrumb",
  "btn",
  "btn-lg",
  "btn-primary",
  "cc-form",
  "c-nav--main",
  "control-label",
  "content",
  "disclaimer",
  "editing-form-control-nested-control",
  "explanation-text",
  "field-validation-error",
  "footer",
  "footer-inner",
  "form-control",
  "form-field",
  "form-label",
  "form-select",
  "formwidget-error",
  "formwidget-submit-text",
  "header",
  "header-inner",
  "input-validation-error",
  "ktc-default-section",
  "ktc-radio",
  "ktc-radio-list",
  "label",
  "optional",
  "pageWrap",
  "row",
  "row--with-cols-padding",
  "subhead",
  "textarea-validation-error",
  "ic-form",
  "ic-required",
];
const cmsFormShellTags = ["article", "button", "form", "input", "label", "main", "select", "textarea"];
const protectedContentTags = new Set(["code", "pre", "script", "style", "textarea"]);
const inlineSpacingTags = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "label",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
]);
const gtgcDynamicClasses = ["is-invalid"];
const cmsInlineUtilsProofMode = process.argv.includes("--proof-gtgc-invalid-css-filter");
const cmsStickyProofMode = process.argv.includes("--proof-cms-sticky");
const retainedCmsShellSelectors = new Set(["body>.pageWrap"]);
const isDirectRun = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

function normalizeAssetPath(htmlFile, assetPath) {
  return join(dirname(htmlFile), assetPath).replace(/\\/g, "/");
}

function isBootstrapAsset(assetPath) {
  return /(^|\/)(?:node_modules\/bootstrap\/|dev\/assets\/css\/bootstrap-(?:subset|cms-compat)\.css$)/i.test(
    assetPath.replace(/\\/g, "/"),
  );
}

function isBootstrapSubsetAsset(assetPath) {
  return /(^|\/)(?:node_modules\/bootstrap\/dist\/css\/bootstrap(?:\.min)?\.css|dev\/assets\/css\/bootstrap-subset\.css)$/i.test(
    assetPath.replace(/\\/g, "/"),
  );
}

function getCmsBootstrapAssetPath(assetPath) {
  if (isBootstrapSubsetAsset(assetPath)) {
    return join("dev", "assets", "css", "bootstrap-cms-compat.css");
  }

  return assetPath;
}

function isSwiperAsset(assetPath) {
  return /(^|\/)node_modules\/swiper\//i.test(assetPath.replace(/\\/g, "/"));
}

function isJqueryAsset(assetPath) {
  return /(^|\/)node_modules\/jquery\//i.test(assetPath.replace(/\\/g, "/"));
}

function isCmsMainScriptAsset(assetPath) {
  return /(^|\/)dev\/assets\/js\/script\.js$/i.test(assetPath.replace(/\\/g, "/"));
}

function isCmsVendorStylesheet(assetPath) {
  return /(^|\/)dev\/assets\/css\/vendor\/cms-main-202106042\.css$/i.test(assetPath.replace(/\\/g, "/"));
}

function isSharedSiteStylesheet(assetPath) {
  return /(^|\/)dev\/assets\/css\/style(?:-cms(?:-swiper)?)?\.css$/i.test(assetPath.replace(/\\/g, "/"));
}

function isSwiperStylesheet(assetPath) {
  return /(^|\/)dev\/assets\/css\/style-cms-swiper\.css$/i.test(assetPath.replace(/\\/g, "/"));
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function pageUsesGtgcLeadForm(source = "") {
  return /\bdata-gtgc-lead-form\b/i.test(source);
}

function collectHtmlUsage(source, { includeCmsFormShell = false } = {}) {
  const classes = new Set();
  const ids = new Set(["main"]);
  const tags = new Set(["article"]);

  for (const match of source.matchAll(/\bclass=["']([^"']+)["']/gi)) {
    match[1]
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => classes.add(value));
  }

  for (const match of source.matchAll(/\bid=["']([^"']+)["']/gi)) {
    const value = match[1]?.trim();

    if (value) {
      ids.add(value);
    }
  }

  for (const match of source.matchAll(/<([a-z][\w-]*)\b/gi)) {
    tags.add(match[1].toLowerCase());
  }

  if (includeCmsFormShell) {
    cmsFormShellClasses.forEach((className) => classes.add(className));
    cmsFormShellTags.forEach((tagName) => tags.add(tagName));
  }

  if (pageUsesGtgcLeadForm(source)) {
    gtgcDynamicClasses.forEach((className) => classes.add(className));
  }

  if (classes.has("swiper") || classes.has("ic-swiper") || pageUsesSwiper(source)) {
    [
      "swiper-horizontal",
      "swiper-pagination-bullets",
      "swiper-pagination-horizontal",
      "swiper-pagination-lock",
      "swiper-slide-active",
      "swiper-slide-next",
      "swiper-slide-prev",
      "swiper-backface-hidden",
      "swiper-initialized",
    ].forEach((className) => classes.add(className));
  }

  return { classes, ids, tags };
}

function splitSelectorList(selectorSource) {
  const selectors = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;

  for (const character of selectorSource) {
    if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (character === "(") {
      parenDepth += 1;
    } else if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    }

    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      if (current.trim()) {
        selectors.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    selectors.push(current.trim());
  }

  return selectors;
}

function selectorMatchesHtmlUsage(selector, usage) {
  if (retainedCmsShellSelectors.has(selector.replace(/\s+/g, ""))) {
    return true;
  }

  const normalized = selector
    .replace(/:not\(([^()]*)\)/g, "")
    .replace(/::?[\w-]+(?:\([^)]*\))?/g, "")
    .replace(/\[[^\]]*\]/g, "");

  if (!normalized.trim()) {
    return true;
  }

  const classMatches = [...normalized.matchAll(/\.(-?[_a-zA-Z]+[\w-]*)/g)].map((match) => match[1]);
  const idMatches = [...normalized.matchAll(/#([_a-zA-Z][\w-]*)/g)].map((match) => match[1]);
  const tagMatches = [...normalized.matchAll(/(^|[\s>+~])([a-z][\w-]*)/gi)]
    .map((match) => match[2].toLowerCase())
    .filter((tagName) => tagName !== "from" && tagName !== "to");

  if (classMatches.some((className) => !usage.classes.has(className))) {
    return false;
  }

  if (idMatches.some((id) => !usage.ids.has(id))) {
    return false;
  }

  if (tagMatches.some((tagName) => !usage.tags.has(tagName))) {
    return false;
  }

  return classMatches.length > 0 || idMatches.length > 0 || tagMatches.length > 0;
}

function filterSharedStylesheet(cssSource, htmlSource, { includeCmsFormShell = false } = {}) {
  const root = postcss.parse(cssSource);
  const usage = collectHtmlUsage(htmlSource, { includeCmsFormShell });

  function cloneMatchingNode(node) {
    if (node.type === "rule") {
      const selectors = splitSelectorList(node.selector).filter((selector) => selectorMatchesHtmlUsage(selector, usage));

      if (selectors.length === 0) {
        return null;
      }

      return node.clone({ selector: selectors.join(", ") });
    }

    if (node.type === "atrule") {
      if (node.name === "media" || node.name === "supports" || node.name === "layer" || node.name === "container") {
        const cloned = node.clone({ nodes: [] });

        for (const child of node.nodes ?? []) {
          const matchedChild = cloneMatchingNode(child);

          if (matchedChild) {
            cloned.append(matchedChild);
          }
        }

        return cloned.nodes.length > 0 ? cloned : null;
      }

      return node.clone();
    }

    return node.clone();
  }

  const filteredRoot = postcss.root();

  for (const node of root.nodes) {
    const matchedNode = cloneMatchingNode(node);

    if (matchedNode) {
      filteredRoot.append(matchedNode);
    }
  }

  return filteredRoot.toString().trim();
}

function getAboutUsCmsLegacyCss(sourceFile) {
  return toSourceRelativeHtmlPath(sourceFile) === "about-us.html" ? aboutUsCmsLegacyCss : "";
}

function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/# sourceMappingURL=.*$/gm, "")
    .trim();
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
}

function collectFiles(root, extension) {
  const files = [];

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

function toCmsHtmlOutputPath(sourceFile) {
  return join(outputDir, sourceFile);
}

function toSourceRelativeHtmlPath(sourceFile) {
  return sourceFile.replace(/\\/g, "/");
}

function toCmsScriptHtmlOutputPath(sourceFile) {
  return toCmsHtmlOutputPath(sourceFile).replace(/\.html$/i, ".scripts.html");
}

function toCmsFragmentHtmlOutputPath(sourceFile, fragmentName) {
  return toCmsHtmlOutputPath(sourceFile).replace(/\.html$/i, `.${fragmentName}.html`);
}

function toCmsFormHtmlOutputPath(sourceFile) {
  return toCmsHtmlOutputPath(sourceFile).replace(/\.html$/i, ".form.html");
}

function toCompanionScriptSourcePath(sourceFile) {
  return sourceFile.replace(/\.html$/i, ".scripts.html");
}

function toCompanionFormSourcePath(authoringSourceFile) {
  return `${stripAuthoringFileExtension(authoringSourceFile)}.form.html`;
}

function toContentHtmlRelativePath(sourceFile, page) {
  const sourceRelativePath = relative(contentSourceDir, sourceFile).replace(/\\/g, "/");
  const sourceDirectory = dirname(sourceRelativePath).replace(/\\/g, "/");
  const fallbackName = stripAuthoringFileExtension(sourceRelativePath.split("/").pop());
  const outputBaseName = page.slug || fallbackName;
  return join(sourceDirectory, `${outputBaseName}.html`).replace(/\\/g, "/");
}

function loadCmsScriptSplitPaths() {
  if (!existsSync(contentSourceDir)) {
    return new Set();
  }

  const splitPaths = new Set();

  for (const sourceFile of collectRenderableContentFiles()) {
    const page = parseStructuredAuthoringFile(sourceFile);

    if (page?.cms?.scriptOutput === "separateHtmlFile") {
      splitPaths.add(toContentHtmlRelativePath(sourceFile, page));
    }
  }

  return splitPaths;
}

function shouldSplitCmsScripts(sourceFile, splitPaths = loadCmsScriptSplitPaths()) {
  return splitPaths.has(toSourceRelativeHtmlPath(sourceFile));
}

function pageUsesCmsForm(page) {
  if (page?.cms?.hasForm === true) {
    return true;
  }

  if (page?.cms?.scriptOutput === "separateHtmlFile") {
    return true;
  }

  return normalizeCmsFragments(page).length > 0;
}

function normalizeCmsFragments(page) {
  const fragments = Array.isArray(page?.cms?.fragments) ? page.cms.fragments : [];

  return fragments
    .map((fragment) => ({
      name: typeof fragment?.name === "string" ? fragment.name.trim() : "",
      fromSectionId: typeof fragment?.fromSectionId === "string" ? fragment.fromSectionId.trim() : "",
      afterSectionId: typeof fragment?.afterSectionId === "string" ? fragment.afterSectionId.trim() : "",
      includeScripts: Boolean(fragment?.includeScripts),
    }))
    .filter((fragment) => fragment.name && (fragment.fromSectionId || fragment.afterSectionId));
}

function getExpectedCmsOutputPathsForPage(renderedPage, splitPaths) {
  const sourceFile = renderedPage.relativeOutputPath;
  const fragmentOutputs = normalizeCmsFragments(renderedPage.page).map((fragment) =>
    toCmsFragmentHtmlOutputPath(sourceFile, fragment.name),
  );
  const outputs = [toCmsHtmlOutputPath(sourceFile), ...fragmentOutputs];
  const companionFormSourceFile = renderedPage.sourceFile ? toCompanionFormSourcePath(renderedPage.sourceFile) : "";

  if (companionFormSourceFile && existsSync(companionFormSourceFile)) {
    outputs.push(toCmsFormHtmlOutputPath(sourceFile));
  }

  if (shouldSplitCmsScripts(sourceFile, splitPaths)) {
    outputs.push(toCmsScriptHtmlOutputPath(sourceFile));
  }

  return outputs;
}

function removeEmptyDirectories(root) {
  if (!existsSync(root)) {
    return;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = join(root, entry.name);
    removeEmptyDirectories(fullPath);

    if (readdirSync(fullPath).length === 0) {
      rmSync(fullPath, { recursive: true, force: true });
    }
  }
}

function cleanupRemovedCmsPages(renderedPages, splitPaths = loadCmsScriptSplitPaths()) {
  if (!existsSync(outputDir)) {
    return;
  }

  const expectedOutputs = new Set(renderedPages.flatMap((renderedPage) => getExpectedCmsOutputPathsForPage(renderedPage, splitPaths)));
  const existingOutputs = collectFiles(outputDir, ".html");
  const existingJsonOutputs = collectFiles(outputDir, ".json");
  const existingCssOutputs = collectFiles(outputDir, ".css");
  const existingJsOutputs = collectFiles(outputDir, ".js");

  for (const filePath of existingOutputs) {
    if (!expectedOutputs.has(filePath)) {
      rmSync(filePath, { force: true });
    }
  }

  for (const filePath of existingCssOutputs) {
    rmSync(filePath, { force: true });
  }

  for (const filePath of existingJsonOutputs) {
    rmSync(filePath, { force: true });
  }

  for (const filePath of existingJsOutputs) {
    rmSync(filePath, { force: true });
  }

  legacyOutputDirs.forEach((directory) => {
    rmSync(directory, { force: true, recursive: true });
  });
  removeEmptyDirectories(outputDir);
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}

function normalizeTextValue(value) {
  const collapsed = value.replace(/\s+/g, " ");

  if (collapsed.trim() === "") {
    return "";
  }

  let normalized = collapsed.trim();

  if (/^\s/.test(collapsed)) {
    normalized = ` ${normalized}`;
  }

  if (/\s$/.test(collapsed)) {
    normalized = `${normalized} `;
  }

  return normalized;
}

function parseTagToken(tagSource) {
  if (!tagSource.startsWith("<") || tagSource.startsWith("<!--") || tagSource.startsWith("<!")) {
    return null;
  }

  const closingMatch = tagSource.match(/^<\/\s*([^\s>\/]+)/);

  if (closingMatch) {
    return {
      tagName: closingMatch[1].toLowerCase(),
      closing: true,
      selfClosing: false,
    };
  }

  const openMatch = tagSource.match(/^<\s*([^\s/>]+)/);

  if (!openMatch) {
    return null;
  }

  const tagName = openMatch[1].toLowerCase();
  return {
    tagName,
    closing: false,
    selfClosing: /\/\s*>$/.test(tagSource) || htmlVoidElements.has(tagName),
  };
}

function getTagBoundary(source, startIndex) {
  let quote = null;

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === ">") {
      return index;
    }
  }

  return -1;
}

function getClosingTagRange(source, tagName, startIndex) {
  const lowerSource = source.toLowerCase();
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}`;
  let depth = 0;
  let index = startIndex;

  while (index < source.length) {
    const nextOpen = lowerSource.indexOf(openNeedle, index);
    const nextClose = lowerSource.indexOf(closeNeedle, index);

    if (nextClose === -1) {
      return null;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const openEnd = getTagBoundary(source, nextOpen);

      if (openEnd === -1) {
        return null;
      }

      const openTag = source.slice(nextOpen, openEnd + 1);
      const selfClosing = /\/\s*>$/.test(openTag) || htmlVoidElements.has(tagName);

      if (!selfClosing) {
        depth += 1;
      }

      index = openEnd + 1;
      continue;
    }

    const closeEnd = getTagBoundary(source, nextClose);

    if (closeEnd === -1) {
      return null;
    }

    depth -= 1;
    index = closeEnd + 1;

    if (depth === 0) {
      return {
        start: nextClose,
        end: closeEnd + 1,
      };
    }
  }

  return null;
}

function getClosingTagEnd(source, tagName, startIndex) {
  return getClosingTagRange(source, tagName, startIndex)?.end ?? -1;
}

function extractSection(source, tagName) {
  const pattern = new RegExp(`<${tagName}\\b`, "i");
  const match = pattern.exec(source);

  if (!match) {
    return "";
  }

  const startIndex = match.index;
  const endIndex = getClosingTagEnd(source, tagName.toLowerCase(), startIndex);

  if (endIndex === -1) {
    throw new Error(`Missing closing </${tagName}> tag`);
  }

  return source.slice(startIndex, endIndex);
}

function extractLinkTags(source) {
  return Array.from(source.matchAll(/<link\b[\s\S]*?>/gi), (match) => match[0]);
}

function toOutputAssetPath(sourceFile, outputFile, assetPath, assetBaseFile = sourceFile) {
  if (
    !assetPath ||
    /^[a-z]+:/i.test(assetPath) ||
    assetPath.startsWith("//") ||
    assetPath.startsWith("/") ||
    assetPath.startsWith("#")
  ) {
    return assetPath;
  }

  return relative(dirname(outputFile), normalizeAssetPath(assetBaseFile, assetPath)).replace(/\\/g, "/");
}

function rewriteSrcsetValue(sourceFile, outputFile, srcsetValue, assetBaseFile = sourceFile) {
  return srcsetValue
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();

      if (!trimmed) {
        return trimmed;
      }

      const [url, ...descriptorParts] = trimmed.split(/\s+/);
      const rewrittenUrl = toOutputAssetPath(sourceFile, outputFile, url, assetBaseFile);
      return [rewrittenUrl, ...descriptorParts].filter(Boolean).join(" ");
    })
    .join(", ");
}

function rewriteLocalAssetPaths(sourceFile, outputFile, source, assetBaseFile = sourceFile) {
  return source
    .replace(/\b(href|src)=["']([^"']+)["']/gi, (match, attributeName, assetPath) => {
      const rewrittenPath = toOutputAssetPath(sourceFile, outputFile, assetPath, assetBaseFile);
      return `${attributeName}="${escapeAttribute(rewrittenPath)}"`;
    })
    .replace(/\bsrcset=["']([^"']+)["']/gi, (match, srcsetValue) => {
      const rewrittenValue = rewriteSrcsetValue(sourceFile, outputFile, srcsetValue, assetBaseFile);
      return `srcset="${escapeAttribute(rewrittenValue)}"`;
    });
}

function extractLocalAssetPaths(sourceFile, source, { tagName, extension, assetBaseFile = sourceFile }) {
  const pattern =
    tagName === "link"
      ? /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi
      : /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  const assets = [];
  const seen = new Set();

  for (const match of source.matchAll(pattern)) {
    const assetPath = match[1];

    if (!assetPath.endsWith(extension) || /^[a-z]+:/i.test(assetPath) || assetPath.startsWith("//")) {
      continue;
    }

    const normalizedPath = normalizeAssetPath(assetBaseFile, assetPath);

    if (seen.has(normalizedPath) || !existsSync(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    assets.push(normalizedPath);
  }

  return assets;
}

function extractHeadFontLinks(source) {
  const headMatch = source.match(/<head\b[\s\S]*?<\/head>/i);

  if (!headMatch) {
    return [];
  }

  return extractLinkTags(headMatch[0]).filter((link) =>
    /href=["']https:\/\/fonts\.googleapis\.com\//i.test(link),
  );
}

function extractHeadExternalLinks(source) {
  const headMatch = source.match(/<head\b[\s\S]*?<\/head>/i);

  if (!headMatch) {
    return [];
  }

  return extractLinkTags(headMatch[0]).filter((link) => /href=["'](?:[a-z]+:)?\/\//i.test(link));
}

function extractCmsHeadStyleCss(page) {
  const headHtml = Array.isArray(page?.cms?.headHtml) ? page.cms.headHtml : [];
  const cssParts = [];

  for (const entry of headHtml) {
    if (typeof entry !== "string") {
      continue;
    }

    for (const match of entry.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      const css = (match[1] ?? "").trim();

      if (css) {
        cssParts.push(css);
      }
    }
  }

  return cssParts;
}

function extractCmsMain(source) {
  const bodyMatch = source.match(/<body\b[\s\S]*?<\/body>/i);

  if (!bodyMatch) {
    throw new Error("Missing <body> in HTML source");
  }

  const body = bodyMatch[0];
  const main = extractSection(body, "main");
  return main;
}

function extractMainInner(source) {
  const mainMatch = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

  if (!mainMatch) {
    throw new Error("Missing <main> in HTML source");
  }

  return mainMatch[1];
}

function extractTopLevelSections(mainInnerSource) {
  const sections = [];
  const lowerSource = mainInnerSource.toLowerCase();
  let index = 0;

  while (index < mainInnerSource.length) {
    const nextOpen = lowerSource.indexOf("<section", index);

    if (nextOpen === -1) {
      break;
    }

    const openEnd = getTagBoundary(mainInnerSource, nextOpen);

    if (openEnd === -1) {
      throw new Error("Malformed <section> tag in <main>");
    }

    const blockEnd = getClosingTagEnd(mainInnerSource, "section", nextOpen);

    if (blockEnd === -1) {
      throw new Error("Missing closing </section> tag in <main>");
    }

    const sectionHtml = mainInnerSource.slice(nextOpen, blockEnd);
    const idMatch = sectionHtml.match(/\bid=["']([^"']+)["']/i);

    sections.push({
      id: idMatch?.[1] ?? "",
      start: nextOpen,
      end: blockEnd,
      html: sectionHtml,
    });

    index = blockEnd;
  }

  return sections;
}

function normalizeMainFragment(source) {
  return stripCmsFragmentMarkers(source).trim();
}

function extractMarkedSections(source) {
  const sections = [];
  const pattern = /<!--cms-section-start:([^>]+?)-->([\s\S]*?)<!--cms-section-end:\1-->/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    sections.push({
      id: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length,
      html: match[2],
    });
  }

  return sections;
}

function splitMainByCmsFragments(mainSource, page) {
  const fragments = normalizeCmsFragments(page);

  if (fragments.length === 0) {
    return [{ name: "", mainSource: normalizeMainFragment(extractMainInner(mainSource)) }];
  }

  const mainInnerSource = extractMainInner(mainSource);
  const sections = extractMarkedSections(mainInnerSource);
  const fragmentSections = sections.length > 0 ? sections : extractTopLevelSections(mainInnerSource);
  const fragmentBoundaries = fragments
    .map((fragment) => {
      let sectionIndex = -1;

      if (fragment.fromSectionId) {
        sectionIndex = fragmentSections.findIndex((section) => section.id === fragment.fromSectionId);
      } else if (fragment.afterSectionId) {
        const afterIndex = fragmentSections.findIndex((section) => section.id === fragment.afterSectionId);
        sectionIndex = afterIndex === -1 ? -1 : afterIndex + 1;
      }

      if (sectionIndex === -1 || sectionIndex > fragmentSections.length) {
        throw new Error(
          `Unable to resolve CMS fragment "${fragment.name}" on page "${page.slug || page.title || "unknown"}"`,
        );
      }

      return {
        ...fragment,
        sectionIndex,
      };
    })
    .sort((left, right) => left.sectionIndex - right.sectionIndex);

  const outputs = [];
  let previousStart = 0;

  for (const fragment of fragmentBoundaries) {
    const boundaryOffset =
      fragment.sectionIndex >= fragmentSections.length
        ? mainInnerSource.length
        : fragmentSections[fragment.sectionIndex].start;
    const primaryInner = mainInnerSource.slice(previousStart, boundaryOffset).trim();

    if (outputs.length === 0) {
      outputs.push({
        name: "",
        mainSource: normalizeMainFragment(primaryInner),
        includeScripts: false,
      });
    }

    previousStart = boundaryOffset;
  }

  for (let index = 0; index < fragmentBoundaries.length; index += 1) {
    const fragment = fragmentBoundaries[index];
    const startOffset =
      fragment.sectionIndex >= fragmentSections.length
        ? mainInnerSource.length
        : fragmentSections[fragment.sectionIndex].start;
    const nextFragment = fragmentBoundaries[index + 1];
    const endOffset = nextFragment
      ? nextFragment.sectionIndex >= fragmentSections.length
        ? mainInnerSource.length
        : fragmentSections[nextFragment.sectionIndex].start
      : mainInnerSource.length;
    const fragmentInner = mainInnerSource.slice(startOffset, endOffset).trim();

    outputs.push({
      name: fragment.name,
      mainSource: normalizeMainFragment(fragmentInner),
      includeScripts: fragment.includeScripts,
    });
  }

  if (outputs.length === 0) {
    return [{ name: "", mainSource }];
  }

  return outputs;
}

function extractInlineScriptSource(source) {
  return Array.from(
    source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
    (match) => {
      const attributeSource = match[1] ?? "";

      if (/\bsrc=["']/i.test(attributeSource)) {
        return "";
      }

      return stripJsComments(match[2] ?? "");
    },
  )
    .filter(Boolean)
    .join("\n");
}

function detectPageDependencies(source) {
  const dependencySource = [extractCmsMain(source), extractInlineScriptSource(source)].filter(Boolean).join("\n");

  return {
    bootstrap: pageUsesBootstrap(dependencySource),
    jquery: pageUsesJquery(dependencySource),
    swiper: pageUsesSwiper(dependencySource),
  };
}

function pageUsesBootstrapJs(source) {
  return /\bdata-bs-(?:toggle|target|parent|ride|slide|dismiss)\s*=/i.test(source);
}

function pageUsesCmsBaseJs(source) {
  return (
    /\bjs-ic-dropdown-container\b/.test(source) ||
    /\bjs-ic-btn-dropdown\b/.test(source) ||
    /\bjs-ic-dropdown\b/.test(source) ||
    /\bdata-runtime-iframe-embed\b/.test(source) ||
    /\bdata-iframe-src\b/.test(source) ||
    /\bg-recaptcha\b/.test(source) ||
    /\bcaptcha_settings\b/.test(source) ||
    /\bg-recaptcha-response\b/.test(source) ||
    /\bjs-ic-swatch\b/.test(source)
  );
}

function detectPageScriptDependencies(source) {
  const dependencySource = [extractCmsMain(source), extractInlineScriptSource(source)].filter(Boolean).join("\n");

  return {
    base: pageUsesCmsBaseJs(dependencySource),
    bootstrap: pageUsesBootstrapJs(dependencySource),
    jquery: pageUsesJquery(dependencySource),
    swiper: pageUsesSwiper(dependencySource),
  };
}

function getCmsBundleScriptPaths(source) {
  const dependencies = detectPageScriptDependencies(source);
  const assetPaths = [];

  if (dependencies.jquery) {
    assetPaths.push(join("node_modules", "jquery", "dist", "jquery.min.js"));
  }

  if (dependencies.base) {
    assetPaths.push(join("dev", "assets", "js", "script-cms.js"));
  }

  if (dependencies.bootstrap) {
    assetPaths.push(join("dev", "assets", "js", "script-cms-bootstrap.js"));
  }

  if (dependencies.swiper) {
    assetPaths.push(join("dev", "assets", "js", "script-cms-swiper.js"));
  }

  return [...new Set(assetPaths)];
}

function filterCmsAssetPaths(assetPaths, dependencies, { forceBootstrap = false } = {}) {
  return assetPaths.filter((assetPath) => {
    if (isBootstrapAsset(assetPath)) {
      return forceBootstrap || dependencies.bootstrap;
    }

    if (isSwiperAsset(assetPath)) {
      return dependencies.swiper;
    }

    if (isJqueryAsset(assetPath)) {
      return dependencies.jquery;
    }

    return true;
  });
}

function extractCmsCssPaths(sourceFile, source, { forceBootstrap = false, assetBaseFile = sourceFile } = {}) {
  return filterCmsAssetPaths(
    extractLocalAssetPaths(sourceFile, source, { tagName: "link", extension: ".css", assetBaseFile }).filter(
      (assetPath) => !isCmsVendorStylesheet(assetPath),
    ),
    detectPageDependencies(source),
    { forceBootstrap },
  );
}

async function renderCmsStyleTag(
  sourceFile,
  source,
  page,
  { forceBootstrap = false, assetBaseFile = sourceFile, usageSource = source } = {},
) {
  const includeCmsFormShell = pageUsesCmsForm(page);
  const cssParts = extractCmsCssPaths(sourceFile, usageSource, { forceBootstrap, assetBaseFile })
    .map((assetPath) => {
      const resolvedAssetPath = getCmsBootstrapAssetPath(assetPath);
      const cssSource = stripCssComments(readFileSync(resolvedAssetPath, "utf8"));

      if (!cssSource) {
        return "";
      }

      if (isSwiperStylesheet(resolvedAssetPath)) {
        return cssSource;
      }

      if (isSharedSiteStylesheet(resolvedAssetPath)) {
        return filterSharedStylesheet(cssSource, usageSource, { includeCmsFormShell });
      }

      return cssSource;
    })
    .filter(Boolean);

  const aboutUsCmsLegacyCss = getAboutUsCmsLegacyCss(sourceFile);

  if (aboutUsCmsLegacyCss) {
    cssParts.push(aboutUsCmsLegacyCss);
  }

  cssParts.push(cmsShellCss);

  if (includeCmsFormShell) {
    cssParts.push(cmsFormShellCss);
  }

  cssParts.push(...extractCmsHeadStyleCss(page));

  if (cssParts.length === 0) {
    return "";
  }

  const css = await minifyCss(cssParts.join("\n\n"));
  return css ? `<style>${css}</style>` : "";
}

function renderCmsLinkTags(source, page) {
  const links = [...extractHeadExternalLinks(source), ...extractHeadFontLinks(source)];

  return links
    .filter((link, index, links) => links.indexOf(link) === index)
    .map((link) => rebuildTag(link))
    .join("\n");
}

async function renderCmsHeadBootstrapScript() {
  const minifiedJs = await minifyJs(cmsHeadBootstrapSource);
  return minifiedJs ? `<script>${minifiedJs}</script>` : "";
}

function toInactiveCmsScriptTag(tagSource) {
  if (/^<script\b[^>]*\bsrc=["']https:\/\/players\.brightcove\.net\/[^"']+["']/i.test(tagSource)) {
    return tagSource;
  }

  const markedTag = tagSource.replace(/^<script(?=[\s>])/i, '<script type="text/plain"');
  return markedTag.replace(/\stype="[^"]*"/i, ' type="text/plain"');
}

function removeScriptTags(source) {
  return source.replace(/<script\b[\s\S]*?<\/script>\s*/gi, "");
}

function extractCmsScriptBlocks(sourceFile, source, assetBaseFile = sourceFile) {
  const companionSourceFile = toCompanionScriptSourcePath(sourceFile);
  const companionSource = existsSync(companionSourceFile) ? readFileSync(companionSourceFile, "utf8") : "";
  const dependencies = detectPageDependencies([source, companionSource].filter(Boolean).join("\n"));
  const blocks = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const sources = [source, companionSource].filter(Boolean);

  for (const currentSource of sources) {
    for (const match of currentSource.matchAll(pattern)) {
      const attributeSource = match[1] ?? "";
      const inlineSource = match[2] ?? "";
      const srcMatch = attributeSource.match(/\bsrc=["']([^"']+)["']/i);
      const src = srcMatch?.[1] ?? null;

      if (src) {
        if (/^[a-z]+:/i.test(src) || src.startsWith("//")) {
          blocks.push({ type: "external", tag: rebuildExternalScriptTag(match[0]) });
          continue;
        }

        const assetPath = normalizeAssetPath(assetBaseFile, src);
        const assetPaths = [assetPath];

        for (const currentAssetPath of assetPaths) {
          if (!existsSync(currentAssetPath)) {
            continue;
          }

          if (isCmsMainScriptAsset(currentAssetPath)) {
            continue;
          }

          if (isBootstrapAsset(currentAssetPath) && !dependencies.bootstrap) {
            continue;
          }

          if (isSwiperAsset(currentAssetPath) && !dependencies.swiper) {
            continue;
          }

          if (isJqueryAsset(currentAssetPath) && !dependencies.jquery) {
            continue;
          }

          blocks.push({
            type: "inline",
            source: stripJsComments(readFileSync(currentAssetPath, "utf8")),
          });
        }

        continue;
      }

      const inlineJs = stripJsComments(inlineSource);

      if (!inlineJs) {
        continue;
      }

      blocks.push({
        type: "inline",
        source: inlineJs,
      });
    }
  }

  return blocks;
}

export async function renderCmsHtmlParts(
  sourceFile,
  outputFile,
  source,
  page,
  { minify = false, minifyHtml = minify, assetBaseFile = sourceFile, authoringSourceFile = "" } = {},
) {
  const splitScripts = shouldSplitCmsScripts(sourceFile);
  const companionFormSourceFile = authoringSourceFile ? toCompanionFormSourcePath(authoringSourceFile) : "";
  const companionFormSource = page?.cms?.hasForm === true && companionFormSourceFile && existsSync(companionFormSourceFile)
    ? readFileSync(companionFormSourceFile, "utf8").trim()
    : "";
  const styleUsageSource = [source, companionFormSource].filter(Boolean).join("\n");
  const styleTag = await renderCmsStyleTag(sourceFile, source, page, {
    forceBootstrap: minify,
    assetBaseFile,
    usageSource: styleUsageSource,
  });
  const linkTags = renderCmsLinkTags(source, page);
  const headBootstrapScript = linkTags || styleTag ? await renderCmsHeadBootstrapScript() : "";
  const scriptBlocks = extractCmsScriptBlocks(sourceFile, source, assetBaseFile);
  const bundleScriptPaths = getCmsBundleScriptPaths(source);
  const scriptParts = [];

  for (const block of scriptBlocks) {
    if (block.type === "external") {
      scriptParts.push(toInactiveCmsScriptTag(block.tag));
      continue;
    }

    const minifiedJs = await minifyJs(block.source);

    if (!minifiedJs) {
      continue;
    }

    scriptParts.push(`<script type="text/plain">${minifiedJs}</script>`);
  }

  for (const bundleScriptPath of bundleScriptPaths) {
    if (!existsSync(bundleScriptPath)) {
      continue;
    }

    const minifiedJs = await minifyJs(stripJsComments(readFileSync(bundleScriptPath, "utf8")));

    if (!minifiedJs) {
      continue;
    }

    scriptParts.push(`<script type="text/plain">${minifiedJs}</script>`);
  }

  const inlineScripts = scriptParts.join("\n\n").trim();
  const mainFragments = splitMainByCmsFragments(extractCmsMain(source), page);
  const files = mainFragments.map((fragment) => {
    const fragmentOutputFile = fragment.name ? toCmsFragmentHtmlOutputPath(sourceFile, fragment.name) : outputFile;
    const rewrittenMain = rewriteLocalAssetPaths(sourceFile, fragmentOutputFile, fragment.mainSource, assetBaseFile);
    const mainOutput = removeCommentsAndSortAttributes(rewrittenMain);
    const htmlParts = [fragment.name ? "" : linkTags, fragment.name ? "" : styleTag, mainOutput.trim()];

    if (fragment.includeScripts && inlineScripts) {
      htmlParts.push(inlineScripts);
    } else if (!splitScripts && !fragment.name && inlineScripts) {
      htmlParts.push(inlineScripts);
    }

    if (!fragment.name && headBootstrapScript) {
      htmlParts.push(headBootstrapScript);
    }

    const html = htmlParts.filter(Boolean).join(minifyHtml ? "" : "\n\n").trim();
    return {
      name: fragment.name,
      outputFile: fragmentOutputFile,
      html: minifyHtml ? minifyFragment(html) : html,
    };
  });

  if (companionFormSource) {
    const formOutputFile = toCmsFormHtmlOutputPath(sourceFile);
    const rewrittenForm = rewriteLocalAssetPaths(
      companionFormSourceFile,
      formOutputFile,
      companionFormSource,
      companionFormSourceFile,
    );
    const formHtml = removeCommentsAndSortAttributes(rewrittenForm);
    files.push({
      name: "form",
      outputFile: formOutputFile,
      html: (minifyHtml ? minifyFragment(formHtml) : formHtml).trim(),
    });
  }

  return {
    files,
    scripts: splitScripts ? (minifyHtml ? minifyFragment(inlineScripts) : inlineScripts) : "",
  };
}

function sortAttributes(tagName, attributes) {
  const priorities = new Map();
  const orderedAttributes = [...(tagAttributePriority[tagName] ?? []), ...defaultAttributePriority];

  orderedAttributes.forEach((attributeName, index) => {
    if (!priorities.has(attributeName)) {
      priorities.set(attributeName, index);
    }
  });

  const attributeRank = (attributeName) => {
    if (priorities.has(attributeName)) {
      return priorities.get(attributeName);
    }

    if (attributeName.startsWith("aria-")) {
      return 100;
    }

    if (attributeName.startsWith("data-")) {
      return 200;
    }

    return 300;
  };

  return [...attributes].sort((left, right) => {
    const leftRank = attributeRank(left.name);
    const rightRank = attributeRank(right.name);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.name.localeCompare(right.name);
  });
}

function parseAttributes(source) {
  const attributes = [];
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match = pattern.exec(source);

  while (match) {
    attributes.push({
      name: match[1],
      value: match[2] ?? match[3] ?? match[4] ?? null,
    });
    match = pattern.exec(source);
  }

  return attributes;
}

function normalizeAttributeValue(value) {
  return value.replace(/\s+/g, " ").trim();
}

function rebuildTag(tagSource) {
  if (!tagSource.startsWith("<") || tagSource.startsWith("</") || tagSource.startsWith("<!")) {
    return tagSource;
  }

  const selfClosing = /\/\s*>$/.test(tagSource);
  const inner = tagSource.slice(1, tagSource.length - 1).replace(/\/\s*$/, "").trim();
  const tagNameMatch = inner.match(/^([^\s/>]+)/);

  if (!tagNameMatch) {
    return tagSource;
  }

  const tagName = tagNameMatch[1];
  const attributeSource = inner.slice(tagName.length).trim();
  const attributes = parseAttributes(attributeSource);
  const sortedAttributes = sortAttributes(tagName.toLowerCase(), attributes)
    .map((attribute) => {
      if (attribute.value === null) {
        return attribute.name;
      }

      return `${attribute.name}="${escapeAttribute(normalizeAttributeValue(attribute.value))}"`;
    })
    .join(" ");

  const attributeSuffix = sortedAttributes ? ` ${sortedAttributes}` : "";
  const isVoidElement = htmlVoidElements.has(tagName.toLowerCase());
  return `<${tagName}${attributeSuffix}${selfClosing && !isVoidElement ? " />" : ">"}`;
}

function rebuildExternalScriptTag(tagSource) {
  const openTagMatch = tagSource.match(/<script\b[^>]*>/i);

  if (!openTagMatch) {
    return tagSource;
  }

  return `${rebuildTag(openTagMatch[0])}</script>`;
}

function rebuildTagWithAttributes(tagName, attributes, { selfClosing = false } = {}) {
  const sortedAttributes = sortAttributes(tagName.toLowerCase(), attributes)
    .map((attribute) => {
      if (attribute.value === null) {
        return attribute.name;
      }

      return `${attribute.name}="${escapeAttribute(normalizeAttributeValue(attribute.value))}"`;
    })
    .join(" ");

  const attributeSuffix = sortedAttributes ? ` ${sortedAttributes}` : "";
  const isVoidElement = htmlVoidElements.has(tagName.toLowerCase());
  return `<${tagName}${attributeSuffix}${selfClosing && !isVoidElement ? " />" : ">"}`;
}

function normalizeFormFragmentTag(tagSource) {
  if (!tagSource.startsWith("<") || tagSource.startsWith("</") || tagSource.startsWith("<!")) {
    return tagSource;
  }

  const selfClosing = /\/\s*>$/.test(tagSource);
  const inner = tagSource.slice(1, tagSource.length - 1).replace(/\/\s*$/, "").trim();
  const tagNameMatch = inner.match(/^([^\s/>]+)/);

  if (!tagNameMatch) {
    return tagSource;
  }

  const tagName = tagNameMatch[1];
  const lowerTagName = tagName.toLowerCase();

  if (lowerTagName !== "h2" && lowerTagName !== "p") {
    return rebuildTag(tagSource);
  }

  const attributeSource = inner.slice(tagName.length).trim();
  const attributes = parseAttributes(attributeSource)
    .filter((attribute) => attribute.name.toLowerCase() !== "class");

  if (lowerTagName === "h2") {
    attributes.push({ name: "class", value: "ic-section-title" });
  }

  return rebuildTagWithAttributes(tagName, attributes, { selfClosing });
}

function normalizeFormFragmentMarkup(fragment) {
  let output = "";

  for (let index = 0; index < fragment.length;) {
    if (fragment.startsWith("<!--", index)) {
      const commentEnd = fragment.indexOf("-->", index + 4);
      index = commentEnd === -1 ? fragment.length : commentEnd + 3;
      continue;
    }

    if (fragment[index] === "<") {
      const tagEnd = getTagBoundary(fragment, index);

      if (tagEnd === -1) {
        output += fragment.slice(index);
        break;
      }

      output += normalizeFormFragmentTag(fragment.slice(index, tagEnd + 1));
      index = tagEnd + 1;
      continue;
    }

    const nextTag = fragment.indexOf("<", index);
    output += fragment.slice(index, nextTag === -1 ? fragment.length : nextTag);
    index = nextTag === -1 ? fragment.length : nextTag;
  }

  return output.trim();
}

function tokenizeFragment(fragment) {
  const tokens = [];

  for (let index = 0; index < fragment.length;) {
    if (fragment.startsWith("<!--", index)) {
      const commentEnd = fragment.indexOf("-->", index + 4);
      index = commentEnd === -1 ? fragment.length : commentEnd + 3;
      continue;
    }

    if (fragment[index] === "<") {
      const tagEnd = getTagBoundary(fragment, index);

      if (tagEnd === -1) {
        tokens.push({ type: "text", source: fragment.slice(index) });
        break;
      }

      const tagSource = fragment.slice(index, tagEnd + 1);
      const tagToken = parseTagToken(tagSource);

      if (tagToken && !tagToken.closing && !tagToken.selfClosing && protectedContentTags.has(tagToken.tagName)) {
        const closingRange = getClosingTagRange(fragment, tagToken.tagName, index);

        if (closingRange) {
          tokens.push({
            type: "protected",
            tagName: tagToken.tagName,
            openTag: tagSource,
            content: fragment.slice(tagEnd + 1, closingRange.start),
            closeTag: fragment.slice(closingRange.start, closingRange.end),
          });
          index = closingRange.end;
          continue;
        }
      }

      tokens.push({
        type: "tag",
        source: tagSource,
        tagName: tagToken?.tagName ?? "",
        closing: tagToken?.closing ?? false,
        selfClosing: tagToken?.selfClosing ?? false,
      });
      index = tagEnd + 1;
      continue;
    }

    const nextTag = fragment.indexOf("<", index);
    tokens.push({
      type: "text",
      source: fragment.slice(index, nextTag === -1 ? fragment.length : nextTag),
    });
    index = nextTag === -1 ? fragment.length : nextTag;
  }

  return tokens;
}

function findAdjacentNonEmptyToken(tokens, startIndex, direction) {
  for (let index = startIndex + direction; index >= 0 && index < tokens.length; index += direction) {
    const token = tokens[index];

    if (token.type === "text" && token.source === "") {
      continue;
    }

    return token;
  }

  return null;
}

function tokenAllowsInlineSpacing(token, side) {
  if (!token) {
    return false;
  }

  if (token.type === "protected") {
    return inlineSpacingTags.has(token.tagName);
  }

  if (token.type !== "tag" || !inlineSpacingTags.has(token.tagName)) {
    return false;
  }

  if (token.selfClosing) {
    return true;
  }

  return side === "left" ? token.closing : !token.closing;
}

function shouldPreserveInterTagSpace(previousToken, nextToken) {
  return tokenAllowsInlineSpacing(previousToken, "left") && tokenAllowsInlineSpacing(nextToken, "right");
}

function transformFragment(fragment, transformText) {
  const tokens = tokenizeFragment(fragment);
  let output = "";

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "tag") {
      output += rebuildTag(token.source);
      continue;
    }

    if (token.type === "protected") {
      output += `${rebuildTag(token.openTag)}${token.content}${token.closeTag}`;
      continue;
    }

    output += transformText(token.source, {
      previousToken: findAdjacentNonEmptyToken(tokens, index, -1),
      nextToken: findAdjacentNonEmptyToken(tokens, index, 1),
    });
  }

  return output.trim();
}

function preserveText(text) {
  return text;
}

function minifyText(text, { previousToken = null, nextToken = null } = {}) {
  if (text.trim() === "") {
    return shouldPreserveInterTagSpace(previousToken, nextToken) ? " " : "";
  }

  return normalizeTextValue(text);
}

function removeCommentsAndSortAttributes(fragment) {
  return transformFragment(fragment, preserveText);
}

function minifyFragment(fragment) {
  return transformFragment(fragment, minifyText);
}

async function minifyJs(source) {
  if (!source) {
    return "";
  }

  const result = await esbuild.transform(source, {
    loader: "js",
    minify: true,
    legalComments: "none",
  });

  return result.code.trim();
}

async function minifyCss(source) {
  if (!source) {
    return "";
  }

  const result = await esbuild.transform(source, {
    loader: "css",
    minify: true,
    legalComments: "none",
  });

  return result.code.trim();
}

export async function buildCmsPages({ minify = false, minifyHtml = minify } = {}) {
  const renderedPages = collectRenderedPageDocuments();
  const htmlFiles = renderedPages.map((page) => page.relativeOutputPath);

  if (htmlFiles.length === 0) {
    return false;
  }

  ensureOutputDir();
  const configuredSplitPaths = loadCmsScriptSplitPaths();
  const actualSplitPaths = new Set();
  cleanupRemovedCmsPages(renderedPages, configuredSplitPaths);

  for (const renderedPage of renderedPages) {
    const sourceFile = renderedPage.relativeOutputPath;
    const assetBaseFile = join("html", renderedPage.relativeOutputPath);
    const outputFile = join(outputDir, renderedPage.relativeOutputPath);
    const scriptOutputFile = toCmsScriptHtmlOutputPath(sourceFile);
    const output = await renderCmsHtmlParts(sourceFile, outputFile, renderedPage.html, renderedPage.page, {
      assetBaseFile,
      authoringSourceFile: renderedPage.sourceFile,
      minify,
      minifyHtml,
    });
    const shouldWriteSplitScript = shouldSplitCmsScripts(sourceFile, configuredSplitPaths) && Boolean(output.scripts);

    for (const file of output.files) {
      mkdirSync(dirname(file.outputFile), { recursive: true });
      writeFileSync(file.outputFile, `${file.html}\n`);
      console.log(`[cms] Built ${file.outputFile}${minify ? " [minified]" : ""}`);
    }

    if (shouldWriteSplitScript) {
      actualSplitPaths.add(toSourceRelativeHtmlPath(sourceFile));
      writeFileSync(scriptOutputFile, `${output.scripts}\n`);
    } else {
      rmSync(scriptOutputFile, { force: true });
    }
    if (shouldWriteSplitScript) {
      console.log(`[cms] Built ${scriptOutputFile}${minify ? " [minified]" : ""}`);
    }
  }

  cleanupRemovedCmsPages(renderedPages, actualSplitPaths);

  return htmlFiles.length > 0;
}

export async function buildCmsAssets({ minify = false, minifyHtml = minify } = {}) {
  const builtPages = await buildCmsPages({ minify, minifyHtml });
  return builtPages;
}

export function createHtmlSnapshot() {
  const assetSnapshot = [
    ...(existsSync("dev/assets/css") ? collectFiles("dev/assets/css", ".css") : []),
    ...(existsSync("dev/assets/css") ? collectFiles("dev/assets/css", ".map") : []),
    ...(existsSync("dev/assets/js") ? collectFiles("dev/assets/js", ".js") : []),
    ...(existsSync("dev/assets/js") ? collectFiles("dev/assets/js", ".map") : []),
  ]
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");

  return [createContentSnapshot(), assetSnapshot].filter(Boolean).join("|");
}

function assertCmsStickyProof(condition, message) {
  if (!condition) {
    throw new Error(`[cms-sticky-proof] ${message}`);
  }
}

async function runCmsStickyProof() {
  const fixtureCss = `
:root {
  --space-30: 30px;
  --header-height-mobile: 137px;
  --header-height-desktop: 97px;
}
body {
  margin: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.header {
  position: relative;
  height: 72px;
}
.ic-header {
  position: sticky;
  z-index: 2;
  top: 0;
  height: var(--header-height-mobile);
}
@media (min-width: 1024.1px) {
  .ic-header {
    height: var(--header-height-desktop);
  }
}
body>.pageWrap {
  overflow-x: clip !important;
  overflow-y: visible !important;
}
#main>article {
  padding: 0;
}
@media (max-width: 768px) {
  #main>article {
    overflow-x: clip;
    overflow-y: visible;
  }
  .ic-section .row>.col:has(>.ic-sticky) {
    display: contents;
  }
  .ic-section .row>.col:has(>.ic-sticky)>.ic-sticky {
    box-sizing: border-box;
    flex: 0 0 100%;
    width: 100%;
  }
}
.ic-sticky {
  position: sticky;
  top: var(--space-30);
}
body:has(.ic-header) .ic-sticky {
  top: var(--header-height-mobile);
}
@media (min-width: 1024.1px) {
  body:has(.ic-header) .ic-sticky {
    top: var(--header-height-desktop);
  }
}
.fixture-header {
  background: #eee;
}
.ic-section {
  padding: 40px 0;
}
.container {
  width: min(100% - 48px, 1120px);
  margin: 0 auto;
}
.row {
  display: flex;
  flex-flow: row wrap;
  align-items: stretch;
}
.col {
  min-width: 0;
}
.sticky-column {
  flex: 0 0 34%;
}
.content-column {
  flex: 1 1 66%;
}
.ic-sticky {
  margin: 0;
  background: white;
}
.sticky-copy {
  margin: 8px 0 0;
}
.heading-content {
  height: 1280px;
}
.wrapper-content {
  height: 1520px;
}
.horizontal-probe {
  width: calc(100vw + 240px);
  height: 1px;
}
.fixture-tail {
  height: 1100px;
}
.unused-route-specific-selector {
  color: red;
}
`;
  const fixtureFragment = `
<main id="main">
  <article>
    <div class="horizontal-probe"></div>
    <section class="ic-section" data-sticky-section="heading">
      <div class="container">
        <div class="row">
          <div class="col sticky-column">
            <h2 class="ic-sticky" data-sticky-fixture="heading">Sticky heading</h2>
          </div>
          <div class="col content-column"><div class="heading-content"></div></div>
        </div>
      </div>
    </section>
    <section class="ic-section" data-sticky-section="wrapper">
      <div class="container">
        <div class="row">
          <div class="col sticky-column">
            <div class="ic-sticky" data-sticky-fixture="wrapper">
              <h2>Sticky wrapper</h2>
              <p class="sticky-copy">Heading and supporting copy.</p>
            </div>
          </div>
          <div class="col content-column"><div class="wrapper-content"></div></div>
        </div>
      </div>
    </section>
    <div class="fixture-tail"></div>
  </article>
</main>`;
  const usageSource = `<body><header class="header ic-header fixture-header"></header>${fixtureFragment}</body>`;
  const filteredCss = filterSharedStylesheet(fixtureCss, usageSource);

  assertCmsStickyProof(/body\s*>\s*\.pageWrap\s*\{[^}]*overflow-x:\s*clip\s*!important[^}]*overflow-y:\s*visible\s*!important/i.test(filteredCss), "filtered CSS dropped the CMS pageWrap overflow correction");
  assertCmsStickyProof(/#main\s*>\s*article\s*\{[^}]*overflow-x:\s*clip[^}]*overflow-y:\s*visible/i.test(filteredCss), "filtered CSS dropped the narrow article overflow correction");
  assertCmsStickyProof(filteredCss.includes(".ic-section .row>.col:has(>.ic-sticky)"), "filtered CSS dropped the stacked sticky containing-range correction");
  assertCmsStickyProof(!filteredCss.includes("unused-route-specific-selector"), "filter retained an unrelated selector");

  const fixtureHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8"><style>${filteredCss}\n${cmsShellCss}</style></head>
  <body>
    <header class="header fixture-header">Legacy header</header>
    <div class="pageWrap">${fixtureFragment}</div>
  </body>
</html>`;
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "boundary-992", width: 992, height: 900 },
    { name: "boundary-991", width: 991, height: 900 },
    { name: "mobile", width: 375, height: 667 },
  ];
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const results = [];

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage();

      try {
        await page.setViewport({ width: viewport.width, height: viewport.height });
        await page.setContent(fixtureHtml, { waitUntil: "domcontentloaded" });
        const headerOffsets = await page.evaluate(() => {
          const header = document.querySelector(".fixture-header");
          const stickies = [...document.querySelectorAll("[data-sticky-fixture]")];
          const legacy = {
            position: getComputedStyle(header).position,
            stickyTops: stickies.map((sticky) => Number.parseFloat(getComputedStyle(sticky).top)),
          };
          header.className = "ic-header fixture-header";
          const configured = {
            position: getComputedStyle(header).position,
            height: Number.parseFloat(getComputedStyle(header).height),
            stickyTops: stickies.map((sticky) => Number.parseFloat(getComputedStyle(sticky).top)),
          };
          header.className = "header fixture-header";
          return { legacy, configured };
        });
        const expectedHeaderOffset = viewport.width > 1024 ? 97 : 137;

        assertCmsStickyProof(headerOffsets.legacy.position === "relative", `${viewport.name}: legacy header is not relative`);
        assertCmsStickyProof(headerOffsets.legacy.stickyTops.every((top) => top === 30), `${viewport.name}: relative legacy header changed the 30px sticky offset`);
        assertCmsStickyProof(headerOffsets.configured.position === "sticky", `${viewport.name}: ic-header is not actually sticky`);
        assertCmsStickyProof(Math.abs(headerOffsets.configured.height - expectedHeaderOffset) <= 0.5, `${viewport.name}: ic-header height does not match its configured offset`);
        assertCmsStickyProof(headerOffsets.configured.stickyTops.every((top) => top === expectedHeaderOffset), `${viewport.name}: sticky ic-header offset was not preserved`);

        const shell = await page.evaluate(() => {
          const pageWrap = document.querySelector(".pageWrap");
          const article = document.querySelector("#main>article");
          const pageWrapStyle = getComputedStyle(pageWrap);
          const articleStyle = getComputedStyle(article);
          return {
            pageWrap: { overflowX: pageWrapStyle.overflowX, overflowY: pageWrapStyle.overflowY },
            article: { overflowX: articleStyle.overflowX, overflowY: articleStyle.overflowY },
            viewportWidth: innerWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
          };
        });

        assertCmsStickyProof(shell.pageWrap.overflowX === "clip" && shell.pageWrap.overflowY === "visible", `${viewport.name}: pageWrap overflow correction is not active`);
        if (viewport.width <= 768) {
          assertCmsStickyProof(shell.article.overflowX === "clip" && shell.article.overflowY === "visible", `${viewport.name}: article overflow correction is not active`);
        }
        assertCmsStickyProof(shell.documentScrollWidth <= shell.viewportWidth + 1, `${viewport.name}: horizontal clipping no longer contains overflow`);

        const stickyResults = [];

        for (const fixtureName of ["heading", "wrapper"]) {
          await page.evaluate(() => scrollTo(0, 0));
          const base = await page.evaluate((name) => {
            const sticky = document.querySelector(`[data-sticky-fixture="${name}"]`);
            const section = sticky.closest("[data-sticky-section]");
            const associatedContent = sticky.closest(".row");
            const stickyRect = sticky.getBoundingClientRect();
            const sectionRect = section.getBoundingClientRect();
            const associatedContentRect = associatedContent.getBoundingClientRect();
            const ancestors = [];
            let ancestor = sticky.parentElement;

            while (ancestor && ancestor !== document.documentElement) {
              const style = getComputedStyle(ancestor);
              ancestors.push({
                tag: ancestor.tagName.toLowerCase(),
                className: ancestor.className,
                overflowX: style.overflowX,
                overflowY: style.overflowY,
              });
              ancestor = ancestor.parentElement;
            }

            return {
              position: getComputedStyle(sticky).position,
              top: Number.parseFloat(getComputedStyle(sticky).top),
              naturalTop: stickyRect.top + scrollY,
              height: stickyRect.height,
              sectionTop: sectionRect.top + scrollY,
              sectionBottom: sectionRect.bottom + scrollY,
              associatedContentBottom: associatedContentRect.bottom + scrollY,
              ancestors,
            };
          }, fixtureName);
          const activeStart = base.naturalTop - base.top;
          const releaseStart = base.associatedContentBottom - base.height - base.top;
          const samples = [
            { name: "entry", scrollY: activeStart + 10, expectedSticky: true },
            { name: "midpoint", scrollY: (activeStart + releaseStart) / 2, expectedSticky: true },
            { name: "near-end", scrollY: releaseStart - 10, expectedSticky: true },
            { name: "released", scrollY: releaseStart + 40, expectedSticky: false },
          ];
          const measurements = [];

          for (const sample of samples) {
            await page.evaluate((scrollY) => {
              scrollTo(0, Math.max(0, scrollY));
            }, sample.scrollY);
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const measurement = await page.evaluate((name) => {
              const sticky = document.querySelector(`[data-sticky-fixture="${name}"]`);
              const rect = sticky.getBoundingClientRect();
              return { scrollY, stickyTop: rect.top, stickyBottom: rect.bottom };
            }, fixtureName);
            measurements.push({ ...sample, ...measurement });
          }

          assertCmsStickyProof(base.position === "sticky" && base.top === 30, `${viewport.name}/${fixtureName}: base sticky contract changed`);
          assertCmsStickyProof(measurements.slice(0, 3).every((sample) => Math.abs(sample.stickyTop - 30) <= 1), `${viewport.name}/${fixtureName}: sticky element did not hold at 30px through its section`);
          assertCmsStickyProof(measurements[3].stickyTop < 29, `${viewport.name}/${fixtureName}: sticky element did not release at associated-content end`);
          const conflictingAncestors = base.ancestors.filter((ancestor) => ancestor.tag !== "body" && ancestor.overflowY !== "visible");
          assertCmsStickyProof(conflictingAncestors.length === 0, `${viewport.name}/${fixtureName}: conflicting vertical overflow ancestor remains`);
          stickyResults.push({ fixture: fixtureName, base, samples: measurements });
        }

        results.push({ viewport, headerOffsets, shell, stickies: stickyResults });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  results.forEach((result) => console.log(`[cms-sticky-proof] ${JSON.stringify(result)}`));
  console.log("[cms-sticky-proof] filtered shell retention, 30px hold/release, overflow constraints, horizontal clipping, and legacy/sticky header offsets verified");
}

function assertGtgcInvalidCssProof(condition, message) {
  if (!condition) {
    throw new Error(`[gtgc-invalid-css-proof] ${message}`);
  }
}

function runGtgcInvalidCssFilterProof() {
  const css = `
.gtgc-page .gtgc-lead-form .gtgc-form-field input.is-invalid[aria-invalid=true] { border-color: #FF7070; }
.gtgc-page .gtgc-lead-form .gtgc-form-field input.is-invalid[aria-invalid=true]:focus { border-color: #FF7070; }
.gtgc-page .gtgc-lead-form .gtgc-form-field select.is-invalid[aria-invalid=true] { border-color: #FF7070; }
.gtgc-page .gtgc-lead-form .gtgc-form-field select.is-invalid[aria-invalid=true]:focus { border-color: #FF7070; }
.gtgc-page .gtgc-lead-form .gtgc-form-field label.is-invalid { color: #FF7070; }
.other-page input.is-invalid { border-color: red; }
.other-page select.is-invalid { border-color: red; }
.unused-selector { color: red; }
`;
  const gtgcHtml = `
<section class="gtgc-page">
  <form class="gtgc-lead-form" data-gtgc-lead-form>
    <div class="gtgc-form-field">
      <label for="first_name">First Name</label>
      <input id="first_name" name="first_name" type="text" aria-invalid="false">
    </div>
    <div class="gtgc-form-field">
      <label for="state">State</label>
      <select id="state" name="state" required aria-invalid="false">
        <option value="" selected>Choose a state</option>
        <option value="CA">California</option>
      </select>
    </div>
  </form>
</section>`;
  const nonGtgcHtml = `
<section class="other-page">
  <form>
    <label for="first_name">First Name</label>
    <input id="first_name" name="first_name" type="text" aria-invalid="false">
  </form>
</section>`;
  const gtgcFiltered = filterSharedStylesheet(css, gtgcHtml);
  const nonGtgcFiltered = filterSharedStylesheet(css, nonGtgcHtml);

  assertGtgcInvalidCssProof(
    gtgcFiltered.includes(".gtgc-page .gtgc-lead-form .gtgc-form-field input.is-invalid[aria-invalid=true]"),
    "GTGC invalid input selector was removed",
  );
  assertGtgcInvalidCssProof(
    gtgcFiltered.includes(".gtgc-page .gtgc-lead-form .gtgc-form-field input.is-invalid[aria-invalid=true]:focus"),
    "GTGC focused invalid input selector was removed",
  );
  assertGtgcInvalidCssProof(
    gtgcFiltered.includes(".gtgc-page .gtgc-lead-form .gtgc-form-field select.is-invalid[aria-invalid=true]"),
    "GTGC invalid select selector was removed",
  );
  assertGtgcInvalidCssProof(
    gtgcFiltered.includes(".gtgc-page .gtgc-lead-form .gtgc-form-field select.is-invalid[aria-invalid=true]:focus"),
    "GTGC focused invalid select selector was removed",
  );
  assertGtgcInvalidCssProof(
    gtgcFiltered.includes(".gtgc-page .gtgc-lead-form .gtgc-form-field label.is-invalid"),
    "GTGC invalid label selector was removed",
  );
  assertGtgcInvalidCssProof(!gtgcFiltered.includes(".other-page input.is-invalid"), "GTGC page retained unrelated invalid selector");
  assertGtgcInvalidCssProof(!gtgcFiltered.includes(".other-page select.is-invalid"), "GTGC page retained unrelated invalid select selector");
  assertGtgcInvalidCssProof(!nonGtgcFiltered.includes(".gtgc-page"), "non-GTGC page gained GTGC selectors");
  assertGtgcInvalidCssProof(!nonGtgcFiltered.includes(".other-page input.is-invalid"), "non-GTGC page gained unconditional is-invalid safelist");
  assertGtgcInvalidCssProof(!nonGtgcFiltered.includes(".other-page select.is-invalid"), "non-GTGC page gained unconditional select is-invalid safelist");

  console.log("[gtgc-invalid-css-proof] GTGC invalid input/select/focus selectors retained only for GTGC lead-form pages");
}

if (isDirectRun) {
  if (cmsStickyProofMode) {
    await runCmsStickyProof();
  } else if (cmsInlineUtilsProofMode) {
    runGtgcInvalidCssFilterProof();
  }
}
