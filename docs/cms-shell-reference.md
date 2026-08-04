# CMS Shell Reference

This file captures the current CMS shell context used around rendered page content.

It exists as a working reference snapshot for implementation decisions. The actual source of truth remains:

- [dev/scripts/cms-inline-utils.mjs](/Volumes/Sites/I-CAR/content/kentico/info/dev/scripts/cms-inline-utils.mjs) for injected CMS shell CSS
- the live shell snapshot provided in the attachment for the broader Kentico page wrapper structure

## Shell Structure Reference

The current shell snapshot includes these major regions around page content:

- `<head id="head">` with meta tags, canonical, favicon, vendor CSS, Kentico CSS, Google CSE assets, and inline Google CSE styles
- `<body>` containing `.pageWrap`
- `<header class="header">`
- `.header-inner`
- `.header-main`
- `.header-logo`
- `.c-search` with Google CSE injected markup and scripts
- `.header-login`
- `.c-nav__hold`
- `<nav class="c-nav--main">`
- `<main>`
- `.zoneMainContent`
- `.pdp.container`
- `#main > article`
- `.breadcrumb`
- `.content.no-right-rail`
- page content rows and sections
- `<footer class="footer">`
- `.footer-inner`
- `.footer-main`
- `.footer-links`
- `.footer-util`
- `.footer-social`

## Content Insertion Context

The CMS page content is effectively inserted inside this path:

```text
body
  .pageWrap
    main
      .zoneMainContent
        .pdp.container
          .row
            #main
              article
                .breadcrumb
                .content.no-right-rail
                  [rendered CMS sections]
```

That is why the current shell CSS focuses on:

- `.header .header-inner`
- `.footer .footer-inner`
- `#main`
- `#main > article`
- `.content.no-right-rail`
- `.breadcrumb`

## `cmsShellCss`

```css
:root{--shell-inline-padding:0;--shell-header-inline-padding:0;--shell-footer-inline-padding:0;--shell-breadcrumb-inline-padding:0;--shell-desktop-inline-offset:0px;--shell-max-width:var(--site-width)}@media screen and (min-width:1024.1px){:root{--shell-desktop-inline-offset:0}}.header .header-inner,.footer .footer-inner{max-width:100%;margin-left:auto;margin-right:auto}.header .header-inner{padding-left:calc(var(--shell-header-inline-padding) + var(--shell-desktop-inline-offset));padding-right:calc(var(--shell-header-inline-padding) + var(--shell-desktop-inline-offset))}.footer .footer-inner{padding-left:calc(var(--shell-footer-inline-padding) + var(--shell-desktop-inline-offset));padding-right:calc(var(--shell-footer-inline-padding) + var(--shell-desktop-inline-offset))}#main,#main>article{padding-left:0;padding-right:0}.zoneMainContent,.zoneMainContent>.pdp.container,.zoneMainContent .pdp.container{max-width:var(--shell-max-width)!important;width:100%;margin-left:auto;margin-right:auto;padding-left:0;padding-right:0}#main>article{padding:0}.content.no-right-rail{padding:0 calc(var(--space-8) + var(--shell-desktop-inline-offset))}.content.no-right-rail h1:only-child{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.breadcrumb{margin:calc(25rem / var(--rem-base)) auto;padding:0 calc(var(--shell-breadcrumb-inline-padding) + var(--shell-desktop-inline-offset))}.ic-section .container,.ic-header .container{padding-left:var(--space-15);padding-right:var(--space-15)}@media screen and (min-width:1440px){.ic-section .container,.ic-header .container,.breadcrumb,.header .header-inner,.footer .footer-inner{max-width:var(--shell-max-width)!important}}
```

## `cmsFormShellCss`

```css
.ic-section+.row.row--with-cols-padding,.section+.row.row--with-cols-padding{margin-top:var(--section-margin);background:var(--lightest)!important;padding:var(--section-padding) 0}.ic-section.ic-background-white+.row.row--with-cols-padding,.section.ic-background-white+.row.row--with-cols-padding,.section.bg-white+.row.row--with-cols-padding{background:var(--lightest)!important}.ic-section.ic-background-light+.row.row--with-cols-padding,.section.ic-background-light+.row.row--with-cols-padding,.section.bg-light+.row.row--with-cols-padding{margin-top:0;background:none!important}.ic-section+.row.row--with-cols-padding:last-child,.section+.row.row--with-cols-padding:last-child{padding-bottom:clamp(5rem,1.721rem + 9.697vw,7.5rem)}.ic-section+.row.row--with-cols-padding form,.section+.row.row--with-cols-padding form,.row--with-cols-padding form{max-width:100%}.row--with-cols-padding:has(form,.formwidget-submit-text){margin:0}.row--with-cols-padding:has(.formwidget-submit-text) .subhead,.row--with-cols-padding:has(.formwidget-submit-text) .disclaimer{display:none!important}
```

## Notes From The Full Shell Snapshot

- The shell already ships a large amount of head-level CSS and JavaScript, including Google CSE assets.
- The CMS content area sits inside legacy wrapper markup, so shell normalization should stay narrowly scoped.
- The Kentico `.pdp.container` wrapper now gets an explicit site-width cap so Bootstrap's default container behavior does not drift away from the shared shell width.
- The breadcrumb is outside the rendered section stream and needs its own spacing normalization.
- `.content.no-right-rail` is the key content wrapper that controls horizontal padding for injected section content.
- Header/footer shell padding and breadcrumb shell padding are now intentionally split, instead of sharing a single inline inset.
- Shared shell pieces and section containers now converge on `--site-width` from `1440px` up so the feature area, breadcrumb, and authored sections stay on the same width.
- From `1024.1px` up, the shell adds an extra `12px` of horizontal inset to the header, footer, breadcrumb, and content wrapper, while section containers keep their base inset.
