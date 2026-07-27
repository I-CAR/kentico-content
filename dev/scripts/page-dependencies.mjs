export function pageUsesSwiper(source = "") {
  return (
    /\bSwiper\s*\(/.test(source) ||
    /\bjs-ic-swiper(?:-[\w-]+)?\b/.test(source) ||
    /\bic-swiper(?:-[\w-]+)?\b/.test(source) ||
    /\bswiper(?:-wrapper|-slide|-pagination|-button-next|-button-prev)?\b/.test(source)
  );
}

export function pageUsesBootstrap(source = "") {
  const bootstrapClassPattern =
    /\b(?:container(?:-fluid)?|row|col(?:-(?:auto|\d+|sm-\d+|md-\d+|lg-\d+|xl-\d+|xxl-\d+))?|g[xy]?-\d+|gap-\d+|d-(?:none|block|inline|inline-block|flex|grid)|d-(?:sm|md|lg|xl|xxl)-(?:none|block|inline|inline-block|flex|grid)|justify-content-(?:start|end|center|between|around|evenly)|align-items-(?:start|end|center|baseline|stretch)|align-self-(?:start|end|center|baseline|stretch)|flex-(?:row|column|wrap|nowrap|fill|grow-\d|shrink-\d)|order-(?:first|last|\d+|sm-\d+|md-\d+|lg-\d+|xl-\d+|xxl-\d+)|offset-(?:\d+|sm-\d+|md-\d+|lg-\d+|xl-\d+|xxl-\d+)|m[trblxyse]?-(?:auto|\d+)|p[trblxyse]?-\d+|text-(?:start|end|center|uppercase|lowercase|capitalize)|fw-(?:normal|bold|semibold|light)|w-\d+|h-\d+|btn(?:-[\w-]+)?|accordion(?:-[\w-]+)?|collapse|show|card(?:-[\w-]+)?|ratio(?:-\d+x\d+)?|img-fluid)\b/;

  return /\bdata-bs-[\w-]+=/i.test(source) || /\bbootstrap\./.test(source) || bootstrapClassPattern.test(source);
}

export function sourceReferencesJqueryAsset(source = "") {
  return /\bjquery(?:\.min)?\.js\b/i.test(source) || /node_modules\/jquery\//i.test(source);
}

export function pageUsesJquery(source = "") {
  return (
    sourceReferencesJqueryAsset(source) ||
    /\b(?:window\.)?jQuery\b/.test(source) ||
    /\b(?:window\.)?\$\b/.test(source) ||
    /\$\s*\(/.test(source) ||
    /\$\.[A-Za-z_]/.test(source)
  );
}

export function pageUsesLegacyCss(source = "") {
  return (
    /\bsection_hero\b/.test(source) ||
    /\bimg_rounded\b/.test(source) ||
    /\bcheckmark\b/.test(source) ||
    /\btable-stack\b/.test(source) ||
    /\bsubhead\b/.test(source) ||
    /\bbtn btn-primary\b/.test(source)
  );
}
