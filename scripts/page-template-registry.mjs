function titleFromId(id) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function placeholderImage({
  alt,
  desktopWidth = 800,
  desktopHeight = 550,
  mobileWidth = 400,
  mobileHeight = 450,
  sizes = "800px",
  loading,
} = {}) {
  const desktopSrc = `https://placehold.co/${desktopWidth}x${desktopHeight}`;
  const mobileSrc = `https://placehold.co/${mobileWidth}x${mobileHeight}`;

  return {
    alt: alt || "Placeholder image",
    desktopSrc,
    desktopSrcset: `${desktopSrc} ${desktopWidth}w`,
    mobileSrcset: `${mobileSrc} ${mobileWidth}w`,
    width: String(desktopWidth),
    height: String(desktopHeight),
    sizes,
    ...(loading ? { loading } : {}),
  };
}

function placeholderProfileImage(name = "Profile") {
  return {
    alt: name,
    desktopSrc: "https://placehold.co/100x100",
    desktopSrcset: "https://placehold.co/100x100 100w, https://placehold.co/200x200 200w",
    width: "100",
    height: "100",
    sizes: "100px",
  };
}

function baseSection(id, type, title = titleFromId(id)) {
  return { id, type, title };
}

const sectionTemplateRegistry = {
  hero: {
    default: (id) => ({
      ...baseSection(id, "hero"),
      label: "Section label",
      sublabel: "Section sublabel goes here.",
      body: [
        "Add approved introductory copy for this hero section.",
        "Use this space for a second paragraph if the design calls for one.",
      ],
      buttons: [
        {
          label: "Primary Action",
          href: "#next-step",
        },
      ],
      image: placeholderImage({
        alt: `${titleFromId(id)} image`,
        desktopWidth: 1600,
        desktopHeight: 580,
        mobileWidth: 400,
        mobileHeight: 300,
        sizes: "(max-width: 1024px) 800px, 1600px",
        loading: "eager",
      }),
    }),
  },
  pageNav: {
    default: (id) => ({
      id,
      type: "pageNav",
      links: [],
    }),
  },
  cards: {
    default: (id) => ({
      ...baseSection(id, "cards"),
      body: [
        "Add a short introduction for this card group.",
      ],
      cards: [
        {
          title: "Card One",
          body: "Add supporting card copy here.",
          image: placeholderImage({ alt: "Card one image", desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
        },
        {
          title: "Card Two",
          body: "Add supporting card copy here.",
          image: placeholderImage({ alt: "Card two image", desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
        },
        {
          title: "Card Three",
          body: "Add supporting card copy here.",
          image: placeholderImage({ alt: "Card three image", desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
        },
      ],
    }),
  },
  text: {
    default: (id) => ({
      ...baseSection(id, "text"),
      body: [
        "Add body copy for this section.",
      ],
    }),
  },
  statementList: {
    default: (id) => ({
      ...baseSection(id, "statementList"),
      body: [
        "Add a short introduction for these statements.",
      ],
      statements: [
        {
          title: "Statement One",
          body: "Add supporting copy for the first statement.",
        },
        {
          title: "Statement Two",
          body: "Add supporting copy for the second statement.",
        },
      ],
    }),
  },
  textMedia: {
    default: (id) => ({
      ...baseSection(id, "textMedia"),
      body: [
        "Add body copy that pairs with the supporting image.",
      ],
      buttons: [
        {
          label: "Learn More",
          href: "#next-step",
          className: "ic-btn ic-btn-primary ic-btn-outline",
        },
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    reverse: (id) => ({
      ...baseSection(id, "textMedia"),
      reverse: true,
      body: [
        "Add body copy that pairs with the supporting image.",
      ],
      buttons: [
        {
          label: "Learn More",
          href: "#next-step",
          className: "ic-btn ic-btn-primary ic-btn-outline",
        },
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
  },
  quote: {
    default: (id) => ({
      ...baseSection(id, "quote"),
      body: [
        "Add an optional introduction to frame this quote.",
      ],
      quoteHtml: [
        "Add approved quote copy here.",
      ],
      cite: {
        name: "Person Name",
        title: "Person Title",
        image: placeholderProfileImage("Person Name"),
      },
    }),
    compact: (id) => ({
      ...baseSection(id, "quote"),
      compact: true,
      quoteHtml: [
        "Add approved quote copy here.",
      ],
      cite: {
        name: "Person Name",
        title: "Person Title",
        image: placeholderProfileImage("Person Name"),
      },
    }),
  },
  quoteGrid: {
    default: (id) => ({
      ...baseSection(id, "quoteGrid"),
      body: [
        "Add a short introduction for this quote collection.",
      ],
      quotes: Array.from({ length: 4 }, (_, index) => ({
        quote: `Add approved quote copy for testimonial ${index + 1}.`,
        name: `Person ${index + 1}`,
        title: "Person Title",
        image: {
          alt: `Person ${index + 1}`,
          desktopSrc: "https://placehold.co/70x70",
          desktopSrcset: "https://placehold.co/70x70 70w, https://placehold.co/140x140 140w",
          width: "70",
          height: "70",
          sizes: "80px",
        },
      })),
    }),
    static: (id) => ({
      ...baseSection(id, "quoteGrid"),
      carousel: false,
      body: [
        "Add a short introduction for this quote collection.",
      ],
      quotes: Array.from({ length: 4 }, (_, index) => ({
        quote: `Add approved quote copy for testimonial ${index + 1}.`,
        name: `Person ${index + 1}`,
        title: "Person Title",
        image: {
          alt: `Person ${index + 1}`,
          desktopSrc: "https://placehold.co/70x70",
          desktopSrcset: "https://placehold.co/70x70 70w, https://placehold.co/140x140 140w",
          width: "70",
          height: "70",
          sizes: "80px",
        },
      })),
    }),
  },
  profileGrid: {
    default: (id) => ({
      ...baseSection(id, "profileGrid"),
      body: [
        "Add a short introduction for this profile grid.",
      ],
      profiles: Array.from({ length: 4 }, (_, index) => ({
        name: `Person ${index + 1}`,
        title: "Person Title",
        image: placeholderProfileImage(`Person ${index + 1}`),
      })),
    }),
  },
  mediaFeatureList: {
    default: (id) => ({
      ...baseSection(id, "mediaFeatureList"),
      body: [
        "Add a short introduction for these featured items.",
      ],
      cards: Array.from({ length: 3 }, (_, index) => ({
        title: `Feature ${index + 1}`,
        lead: "Add a strong lead-in sentence.",
        body: "Add supporting body copy for this feature.",
        image: placeholderImage({ alt: `Feature ${index + 1} image`, desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
      })),
    }),
  },
  iconCardGrid: {
    default: (id) => ({
      ...baseSection(id, "iconCardGrid"),
      body: [
        "Add a short introduction for these icon cards.",
      ],
      cards: Array.from({ length: 4 }, (_, index) => ({
        title: `Icon Card ${index + 1}`,
        body: "Add supporting body copy for this icon card.",
        iconKey: "askICar",
      })),
    }),
  },
  logoGrid: {
    default: (id) => ({
      ...baseSection(id, "logoGrid"),
      body: [
        "Add a short introduction for this logo group.",
      ],
      logos: Array.from({ length: 4 }, (_, index) => ({
        alt: `Logo ${index + 1}`,
        src: "https://placehold.co/180x60",
        width: "180",
        height: "60",
      })),
    }),
  },
  stickyCards: {
    default: (id) => ({
      ...baseSection(id, "stickyCards"),
      body: [
        "Add introductory copy for this sticky card section.",
      ],
      cards: Array.from({ length: 3 }, (_, index) => ({
        title: `Sticky Card ${index + 1}`,
        body: "Add supporting body copy here.",
        listItems: [
          "First supporting point",
          "Second supporting point",
        ],
      })),
    }),
  },
  legal: {
    default: (id) => ({
      id,
      type: "legal",
      paragraphs: [
        "Add approved legal or disclaimer copy here.",
      ],
    }),
  },
  cta: {
    default: (id) => ({
      ...baseSection(id, "cta"),
      body: [
        "Add closing copy that supports the final call to action.",
      ],
      buttons: [
        {
          label: "Primary Action",
          href: "#hero",
          className: "ic-btn ic-btn-primary ic-btn-outline",
        },
      ],
    }),
  },
  accordion: {
    default: (id) => ({
      ...baseSection(id, "accordion"),
      body: [
        "Add introductory copy for this accordion.",
      ],
      items: Array.from({ length: 3 }, (_, index) => ({
        title: `Accordion Item ${index + 1}`,
        body: [
          "Add supporting copy for this accordion item.",
        ],
      })),
    }),
  },
  embed: {
    default: (id) => ({
      ...baseSection(id, "embed"),
      body: [
        "Add introductory copy for this embedded content.",
      ],
      embedHtml: `<div class="ratio ratio-16x9"><div class="d-flex align-items-center justify-content-center border rounded">Replace this placeholder with approved embed HTML.</div></div>`,
    }),
  },
  mediaSlider: {
    default: (id) => ({
      ...baseSection(id, "mediaSlider"),
      body: [
        "Add introductory copy for this media slider.",
      ],
      slides: Array.from({ length: 3 }, (_, index) => ({
        image: placeholderImage({
          alt: `Slide ${index + 1}`,
          desktopWidth: 800,
          desktopHeight: 604,
          mobileWidth: 400,
          mobileHeight: 302,
          sizes: "(max-width: 450px) 400px, (max-width: 768px) 800px, (max-width: 991px) 400px, 800px",
          loading: index === 0 ? "eager" : "lazy",
        }),
      })),
      buttons: [
        {
          label: "Learn More",
          href: "#next-step",
          className: "ic-btn ic-btn-primary ic-btn-outline",
        },
      ],
    }),
  },
  html: {
    default: (id) => ({
      id,
      type: "html",
      html: [
        `<!-- Replace with approved HTML for the "${id}" section. -->`,
      ],
    }),
  },
};

export function getSupportedTemplateTypes() {
  return Object.keys(sectionTemplateRegistry).sort();
}

export function getSupportedVariantsByType() {
  return Object.fromEntries(
    Object.entries(sectionTemplateRegistry).map(([type, variants]) => [type, Object.keys(variants).sort()]),
  );
}

export function createTemplateSection(type, variant = "default", id) {
  const typeRegistry = sectionTemplateRegistry[type];

  if (!typeRegistry) {
    throw new Error(`Unsupported template section type "${type}"`);
  }

  const templateFactory = typeRegistry[variant];

  if (!templateFactory) {
    throw new Error(`Unsupported template variant "${variant}" for section type "${type}"`);
  }

  return templateFactory(id);
}
