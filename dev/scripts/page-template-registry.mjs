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
  mobileHeight = 450,
} = {}) {
  const isBanner = desktopWidth >= 3200;
  const desktopWidths = isBanner ? [800, 1600, 3200] : [400, 800, 1600];

  return {
    alt: alt || "Placeholder image",
    urls: {
      desktop: {
        ...(desktopWidths.includes(400) ? { "400w": `https://placehold.co/400x${desktopHeight}` } : {}),
        "800w": `https://placehold.co/800x${desktopHeight}`,
        "1600w": `https://placehold.co/1600x${desktopHeight}`,
        ...(desktopWidths.includes(3200) ? { "3200w": `https://placehold.co/3200x${desktopHeight}` } : {}),
      },
      mobile: {
        "400w": `https://placehold.co/400x${mobileHeight}`,
        "800w": `https://placehold.co/800x${mobileHeight}`,
        "1600w": `https://placehold.co/1600x${mobileHeight}`,
      },
    },
    height: {
      desktop: String(desktopHeight),
      mobile: String(mobileHeight),
    },
  };
}

function placeholderProfileImage(name = "Profile") {
  return {
    alt: name,
    urls: {
      desktop: {
        "100w": "https://placehold.co/100x100",
        "200w": "https://placehold.co/200x200",
      },
    },
    height: {
      desktop: "100",
    },
  };
}

function baseSection(id, type, heading = titleFromId(id)) {
  return { id, type, heading };
}

const sectionTemplateRegistry = {
  hero: {
    default: (id) => ({
      id,
      type: "hero",
      heading: titleFromId(id),
      label: "Section label",
      sublabel: "Section sublabel goes here.",
      paragraphs: [
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
        desktopWidth: 3200,
        desktopHeight: 580,
        mobileWidth: 400,
        mobileHeight: 300,
      }),
    }),
    banner: (id) => ({
      id,
      type: "hero",
      heading: titleFromId(id),
      variant: "banner",
      label: "Section label",
      sublabel: "Section sublabel goes here.",
      paragraphs: [
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
        desktopWidth: 3200,
        desktopHeight: 580,
        mobileWidth: 400,
        mobileHeight: 300,
      }),
    }),
    split: (id) => ({
      id,
      type: "hero",
      heading: titleFromId(id),
      variant: "split",
      imageStyle: "rounded",
      layout: { desktopSplit: "equal", desktopMediaPosition: "right", mobileMediaOrder: "below" },
      paragraphs: [
        "Add approved introductory copy for this hero section.",
        "Use this space for a second paragraph if the design calls for one.",
      ],
      image: placeholderImage({
        alt: `${titleFromId(id)} image`,
        desktopWidth: 1600,
        desktopHeight: 550,
        mobileWidth: 400,
        mobileHeight: 550,
      }),
      spacing: {
        paddingTop: "none",
      },
    }),
    split57: (id) => ({
      id,
      type: "hero",
      variant: "split",
      heading: titleFromId(id),
      layout: { desktopSplit: "text-5-media-7", desktopMediaPosition: "right", mobileMediaOrder: "above" },
      paragraphs: ["Use a 5/7 text-to-media split with media above the copy on mobile."],
      image: placeholderImage({ alt: `${titleFromId(id)} image`, desktopWidth: 1600, desktopHeight: 550, mobileHeight: 550 }),
    }),
    splitLargeScreen: (id) => ({
      id,
      type: "hero",
      variant: "split",
      heading: titleFromId(id),
      layout: { desktopSplit: "lg-5-7", desktopMediaPosition: "right", mobileMediaOrder: "below", boxStyle: "collapse", imageStyle: "banner" },
      paragraphs: ["Use the current large-screen split treatment with media below the copy on mobile."],
      image: placeholderImage({ alt: `${titleFromId(id)} image`, desktopWidth: 1600, desktopHeight: 550, mobileHeight: 550 }),
    }),
    video: (id) => ({
      ...baseSection(id, "hero"),
      video: {
        webm: "https://cdn.example.test/component-library/hero-video.webm",
        mp4: "https://cdn.example.test/component-library/hero-video.mp4",
        poster: "https://placehold.co/1600x900",
        width: "1600",
        height: "900",
      },
      paragraphs: ["Hero video presentation."],
    }),
    linkedImage: (id) => ({
      ...baseSection(id, "hero"),
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
      imageLink: { href: "https://www.i-car.com/", label: "View details" },
    }),
    inlineLinks: (id) => ({
      ...baseSection(id, "hero"),
      inlineLinkParagraphs: [{ segments: [{ type: "text", text: "Hero copy with a scoped " }, { type: "link", label: "inline link", href: "https://www.i-car.com/" }, { type: "text", text: "." }] }],
    }),
    background: (id) => ({
      ...baseSection(id, "hero"),
      imagePlacement: "background",
      backgroundColor: "light",
      paragraphs: ["Hero background image presentation."],
      image: placeholderImage({ alt: `${titleFromId(id)} background image`, desktopWidth: 3200, desktopHeight: 580, mobileHeight: 300 }),
    }),
    badge: (id) => ({
      ...baseSection(id, "hero"),
      badgeImage: { desktopSrc: "https://placehold.co/340x314", desktopSrcset: "https://placehold.co/170x157 170w, https://placehold.co/340x314 340w", alt: "Program badge", width: "170", height: "157", sizes: "170px" },
      paragraphs: ["Hero badge presentation."],
    }),
    form: (id) => ({
      ...baseSection(id, "hero"),
      variant: "splitForm",
      paragraphs: ["Request information.", "Complete the form to continue."],
      bullets: ["First benefit", "Second benefit"],
      image: placeholderImage({ alt: `${titleFromId(id)} image`, desktopWidth: 1600, desktopHeight: 900 }),
      form: { id: "hero-form", action: "#submit", method: "POST", fields: [{ key: "email", id: "hero-email", name: "email", label: "Email", type: "email" }], submitLabel: "Submit" },
    }),
    pathDropdown: (id) => ({
      id,
      type: "hero",
      heading: titleFromId(id),
      paragraphs: [
        "Add approved introductory copy for this hero section.",
      ],
      image: placeholderImage({
        alt: `${titleFromId(id)} image`,
        desktopWidth: 3200,
        desktopHeight: 580,
        mobileWidth: 400,
        mobileHeight: 300,
      }),
      pathDropdown: {
        label: "Choose Your Path",
        items: [
          { label: "Path One", href: "#path-one" },
          { label: "Path Two", href: "#path-two" },
          { label: "Path Three", href: "#path-three" },
        ],
      },
    }),
    labelAbove: (id) => ({
      id,
      type: "hero",
      heading: titleFromId(id),
      label: "Section Label",
      layout: { labelPosition: "above" },
      paragraphs: [
        "Add approved introductory copy for this hero section.",
      ],
      image: placeholderImage({
        alt: `${titleFromId(id)} image`,
        desktopWidth: 3200,
        desktopHeight: 580,
        mobileWidth: 400,
        mobileHeight: 300,
      }),
    }),
  },
  pageNav: {
    default: (id) => ({
      id,
      type: "pageNav",
      links: [
        { label: "Navigation and orientation", href: "#chapter-navigation-orientation" },
        { label: "Heroes", href: "#chapter-heroes" },
        { label: "Text and structured content", href: "#chapter-text-structured-content" },
        { label: "Text and media", href: "#chapter-text-media" },
        { label: "Cards and grids", href: "#chapter-cards-grids" },
        { label: "Logos", href: "#chapter-logos" },
        { label: "Rails and structured lists", href: "#chapter-rails-structured-lists" },
        { label: "Quotes and testimonials", href: "#chapter-quotes-testimonials" },
        { label: "Interactive media", href: "#chapter-interactive-media" },
        { label: "Actions and forms", href: "#chapter-actions-forms" },
        { label: "Exceptions", href: "#chapter-exceptions" },
      ],
    }),
  },
  cards: {
    assetDownloads: (id) => ({
      ...baseSection(id, "cards"),
      variant: "assetDownloads",
      heading: "Asset Downloads",
      cards: [
        { heading: "Asset One", paragraphs: ["Add a short description for this downloadable asset."], href: "#asset-one", label: "Download asset" },
        { heading: "Asset Two", paragraphs: ["Add a short description for this downloadable asset."], href: "#asset-two", label: "Download asset" },
      ],
    }),
    buttonSamples: (id) => ({
      ...baseSection(id, "cards", "Buttons"),
      variant: "buttonSamples",
      examples: ["primary", "gray", "white"].flatMap((tone) => [["solid",false,false],["solid",true,false],["outline",false,false],["outline",true,false],["solid",false,true],["solid",true,true],["outline",false,true],["outline",true,true]].map(([treatment,arrow,disabled]) => ({ tone, treatment, arrow, disabled, label: `${tone} ${treatment}${arrow ? " arrow" : ""}${disabled ? " disabled" : ""}`, ...(disabled ? {} : { href: "#buttons" }) }))).concat([
        { tone: "text", treatment: "solid", arrow: false, disabled: false, label: "Text Button", href: "#buttons" },
        { tone: "text", treatment: "solid", arrow: true, disabled: false, label: "Text Button Arrow", href: "#buttons" },
      ]),
    }),
    componentSamples: (id) => ({
      ...baseSection(id, "cards", "Cards"),
      variant: "componentSamples",
      groups: [["text", "Text Cards", "text-cards", ["linked", "quote", "detail"]], ["image", "Image Cards", "image-cards", ["unlinked-bottom", "linked-bottom", "linked-top"]], ["icon", "Icon Cards", "icon-cards", ["unlinked-bottom", "linked-bottom", "linked-top"]], ["logo", "Logo Cards", "logo-cards", ["linked-bottom", "linked-top"]], ["checkmark", "Checkmark Cards", "checkmark-cards", ["unlinked-bottom", "unlinked-top"]]].map(([kind, heading, anchor, patterns]) => ({
        kind, heading, anchor,
        cards: patterns.flatMap((pattern) => ["white", "light", "none"].map((background, index) => {
          const linked = pattern.startsWith("linked") || pattern === "detail";
          const backgroundLabel = background === "white" ? "White" : background === "light" ? "Light" : "No";
          const title = pattern === "quote"
            ? undefined
            : kind === "text"
              ? `${pattern === "detail" ? "Linked Card w/ Details and" : "Linked Card w/"} ${backgroundLabel} Background`
              : `${linked ? "Linked Card w/" : "Card w/"} ${backgroundLabel} Background and ${kind === "image" ? "Image" : kind === "icon" ? "Icon" : kind === "logo" ? "Logo" : "Checkmark"} on ${pattern === "unlinked-top" || pattern === "linked-top" ? "Left" : "Top"}`;
          const summaryRequired = kind === "text" || kind === "image" || kind === "checkmark" || (kind === "icon" && pattern === "unlinked-bottom") || (kind === "logo" && pattern === "linked-bottom") || pattern === "quote";
          return {
            pattern, background,
            cardKind: pattern === "quote" ? "quote" : "standard",
            mediaKind: kind === "text" ? "none" : kind,
            mediaPlacement: pattern.endsWith("top") ? "top" : "bottom",
            ...(title ? { heading: title } : {}),
            ...(summaryRequired ? { summary: pattern === "quote" ? "Card quote. Lorem ipsum dolor sit amet, simul recusabo evertitur ius an, ceteros civibus efficiendi no mea." : "Card summary. Lorem ipsum dolor sit amet, simul recusabo evertitur ius an, ceteros civibus efficiendi no mea." } : {}),
            ...(pattern === "quote" ? { summary: "Card quote. Lorem ipsum dolor sit amet, simul recusabo evertitur ius an, ceteros civibus efficiendi no mea.", citation: { name: "Cite Name", title: "Cite Title" } } : {}),
            ...(linked ? { href: "#cards" } : {}),
            ...(pattern === "detail" ? { detail: { heading: "Headline", items: ["Cu has veniam nonumy omittam", "Usu nisl etiam dicam eu", "Ut amet magna timeam qui, sapientem deterruisset id sed", "Te dico putant pertinax pro, nam mucius fuisset cu, vel alia vitae complectitur no"] }, action: { label: "Primary Outline", href: "#cards" } } : {}),
            ...(pattern === "linked" ? { action: { label: "Text Button", href: "#cards" } } : {}),
            ...(kind === "image" ? { image: { desktopSrc: "https://placehold.co/600x337?text=600w", desktopSrcset: "https://placehold.co/300x169?text=300w 300w, https://placehold.co/600x337?text=600w 600w, https://placehold.co/1200x675?text=1200w 1200w", sizes: "(max-width: 768px) 600px, (max-width: 991.9px) 300px, 600px", alt: "", decorative: true, width: "600", height: "337" } } : {}),
            ...(kind === "logo" ? { image: { desktopSrc: "https://placehold.co/150x100?text=150w", alt: "", decorative: true, width: "150", height: "100" } } : {}),
            ...(kind === "icon" ? { image: { desktopSrc: "https://placehold.co/100x100?text=100w", desktopSrcset: "https://placehold.co/100x100?text=100w 100w", alt: "", decorative: true, width: "100", height: "100" } } : {}),
          };
        })),
      })),
    }),
    default: (id) => ({
      ...baseSection(id, "cards"),
      paragraphs: [
        "Add a short introduction for this card group.",
      ],
      cards: [
        {
          heading: "Card One",
          paragraphs: ["Add supporting card copy here."],
          image: placeholderImage({ alt: "Card one image", desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
        },
        {
          heading: "Card Two",
          paragraphs: ["Add supporting card copy here."],
          image: placeholderImage({ alt: "Card two image", desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
        },
        {
          heading: "Card Three",
          paragraphs: ["Add supporting card copy here."],
          image: placeholderImage({ alt: "Card three image", desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
        },
      ],
    }),
    introLeft: (id) => ({
      ...baseSection(id, "cards"),
      paragraphs: [
        "Add an introductory paragraph. It sits to the left of the cards at xl and stacks above them on mobile.",
      ],
      layout: {
        introPosition: "left",
        verticalAlign: "center",
      },
      cards: [
        { heading: "Card One", paragraphs: ["Add supporting card copy here."] },
        { heading: "Card Two", paragraphs: ["Add supporting card copy here."] },
        { heading: "Card Three", paragraphs: ["Add supporting card copy here."] },
      ],
    }),
    panel: (id) => ({
      ...baseSection(id, "cards"),
      layout: { contentWidth: "ten", cardsPerRow: { md: 2, lg: 3 }, cardStyle: "panel", imageStyle: "standard" },
      paragraphs: ["Panel card treatment."],
      cards: [{ heading: "Panel Card", paragraphs: ["Panel card copy."] }, { heading: "Panel Card Two", paragraphs: ["Panel card copy."] }],
    }),
    centered: (id) => ({
      ...baseSection(id, "cards"),
      layout: { cardTextAlign: "center", cardTitleSize: "h3", contentWidth: "wider" },
      paragraphs: ["Centered card treatment."],
      cards: [{ heading: "Centered Card", paragraphs: ["Centered card copy."] }, { heading: "Centered Card Two", paragraphs: ["Centered card copy."] }],
    }),
    responsiveColumns: (id) => ({
      ...baseSection(id, "cards"),
      layout: { cardsPerRow: { base: 1, md: 2, lg: 3, xl: 4 } },
      paragraphs: ["Responsive four-column card treatment."],
      cards: [{ heading: "Card One", paragraphs: ["Card copy."] }, { heading: "Card Two", paragraphs: ["Card copy."] }, { heading: "Card Three", paragraphs: ["Card copy."] }, { heading: "Card Four", paragraphs: ["Card copy."] }],
    }),
    imageBoxSeparateLinks: (id) => ({
      ...baseSection(id, "cards"),
      paragraphs: [
        "Add a short introduction. Each card image and title link independently.",
      ],
      layout: {
        introPosition: "left",
        imageBox: "3x2",
        cardLinks: "separate",
      },
      cards: [
        {
          heading: "Australia",
          href: "https://i-car.com.au/",
          target: "_blank",
          paragraphs: ["Add supporting copy here."],
          image: {
            desktopSrc: "https://placehold.co/130x87",
            alt: "Australia flag",
            width: "130",
            height: "87",
            singleSource: true,
          },
        },
        {
          heading: "Canada",
          href: "https://www.i-car.ca/",
          target: "_blank",
          paragraphs: ["Add supporting copy here."],
          image: {
            desktopSrc: "https://placehold.co/130x87",
            alt: "Canada flag",
            width: "130",
            height: "87",
            singleSource: true,
          },
        },
        {
          heading: "New Zealand",
          href: "https://i-car.co.nz/",
          target: "_blank",
          paragraphs: ["Add supporting copy here."],
          image: {
            desktopSrc: "https://placehold.co/130x87",
            alt: "New Zealand flag",
            width: "130",
            height: "87",
            singleSource: true,
          },
        },
      ],
    }),
    pathDropdown: (id) => ({
      ...baseSection(id, "cards"),
      paragraphs: [
        "Add introductory copy above the card grid.",
      ],
      pathDropdown: {
        label: "Choose Your Path",
        variant: "outline",
        items: [
          { label: "Path One", href: "#path-one" },
          { label: "Path Two", href: "#path-two" },
          { label: "Path Three", href: "#path-three" },
        ],
      },
      cards: [
        { id: "card-1", heading: "Card One", paragraphs: ["Add card body copy."] },
        { id: "card-2", heading: "Card Two", paragraphs: ["Add card body copy."] },
        { id: "card-3", heading: "Card Three", paragraphs: ["Add card body copy."] },
      ],
    }),
  },
  text: {
    chapterIntro: (id) => ({
      ...baseSection(id, "text", ({
        "chapter-navigation-orientation": "Navigation and orientation",
        "chapter-heroes": "Heroes",
        "chapter-text-structured-content": "Text and structured content",
        "chapter-text-media": "Text and media",
        "chapter-cards-grids": "Cards and grids",
        "chapter-logos": "Logos",
        "chapter-rails-structured-lists": "Rails and structured lists",
        "chapter-quotes-testimonials": "Quotes and testimonials",
        "chapter-interactive-media": "Interactive media",
        "chapter-actions-forms": "Actions and forms",
        "chapter-exceptions": "Exceptions",
      }[id] || "Catalog orientation")),
      variant: "chapterIntro",
      paragraphs: [`${({
        "chapter-navigation-orientation": "Use page navigation to move between the production specimens and verify every link targets a rendered chapter.",
        "chapter-heroes": "Compare hero media, split layouts, specialized presentations, and link or form behavior against the fields consumed by the hero renderer.",
        "chapter-text-structured-content": "Use structured prose, lists, tables, and legal copy when the renderer can consume the authored field directly.",
        "chapter-text-media": "Pair text with image or typed embed media and keep split, position, width, mobile-order, and treatment fields explicit.",
        "chapter-cards-grids": "Choose the card or grid specimen that proves its layout, treatment, link mode, responsive columns, or footer action.",
        "chapter-logos": "Use logo records for logo behavior, including linked records, boxed layouts, fluid rows, and scroll-row thresholds.",
        "chapter-rails-structured-lists": "Use rails for sticky cards, typed lists, resource tables, locations, and structured progress content.",
        "chapter-quotes-testimonials": "Keep quote text, citations, grid mode, and media fields aligned with the quote consumers.",
        "chapter-interactive-media": "Use accordions, embeds, and sliders with their typed fields or preserve raw HTML only where production compatibility requires it.",
        "chapter-actions-forms": "Use typed CTA links, path dropdowns, and form contracts that can be validated and rendered without invented fields.",
        "chapter-exceptions": "Document compatibility debt as an explicit production exception; do not turn raw HTML into a reusable specimen.",
      }[id] || "Use the production fields consumed by the selected renderer.")}`],
    }),
    compatibilityDebt: (id) => ({
      ...baseSection(id, "text"),
      variant: "compatibilityDebt",
      heading: "Compatibility debt: raw HTML",
      paragraphs: ["The production corpus contains two html/default sections: about-us/awards/jeff-silver-platinum-award.yaml#form-copy and about-us/awards/russ-verona-gold-class-shop-award.yaml#form-copy. Raw HTML is not reusable catalog content. Closure owner: Content/Lead."],
    }),
    narrow: (id) => ({ ...baseSection(id, "text"), layout: { width: "narrow", align: "start" }, paragraphs: ["Narrow text content."] }),
    full: (id) => ({ ...baseSection(id, "text"), layout: { width: "full", align: "start" }, paragraphs: ["Full-width text content."] }),
    borderedCompact: (id) => ({ ...baseSection(id, "text"), sectionChrome: "bordered", sectionSpacing: "compact", paragraphs: ["Bordered compact text content."], table: { variant: "stats", leadText: "Compact table specimen", boxed: true, rows: [{ label: "First measure", value: "Approved" }, { label: "Second measure", value: "Required" }] } }),
    default: (id) => ({
      ...baseSection(id, "text"),
      paragraphs: [
        "Add body copy for this section.",
      ],
    }),
    stackedLinks: (id) => ({
      ...baseSection(id, "text"),
      layout: { width: "full", align: "start", actionsStyle: "linkList", actionsLayout: "stack", actionsVariant: "text" },
      paragraphs: ["Text with stacked text-link actions."],
      links: [{ label: "First action", href: "https://www.i-car.com/" }, { label: "Second action", href: "https://www.i-car.com/" }],
    }),
    colorTokens: (id) => ({
      ...baseSection(id, "text", "Colors"),
      variant: "colorTokens",
      colorGroups: [
        { key: "brand", label: "Brand Colors", tokens: [{ token: "primary", label: "Primary" }, { token: "secondary", label: "Secondary" }, { token: "tertiary", label: "Tertiary" }] },
        { key: "grayscale", label: "Grayscale", tokens: [{ token: "white", label: "White" }, { token: "gray-50", label: "Gray 50" }, { token: "gray-100", label: "Gray 100" }, { token: "gray-200", label: "Gray 200" }, { token: "gray-500", label: "Gray 500" }, { token: "gray-700", label: "Gray 700" }, { token: "gray-900", label: "Gray 900" }, { token: "black", label: "Black" }] },
        { key: "ui", label: "UI Colors", tokens: [{ token: "positive", label: "Positive" }, { token: "negative", label: "Negative" }] },
      ],
    }),
    typographySamples: (id) => ({
      ...baseSection(id, "text", "Typography"),
      variant: "typographySamples",
      headlineSamples: [1, 2, 3, 4, 5, 6].map((role) => ({ role, text: `Headline ${role}: Whereas disregard and contempt for human rights have resulted` })),
      paragraphSamples: [
        { role: "lead", segments: [{ type: "text", text: "Lead Paragraph: Lorem ipsum dolor sit amet. " }, { type: "link", label: "Facilisi cras fermentum odio eu", href: "#typography" }, { type: "text", text: ". Lacus viverra vitae congue eu consequat ac. " }, { type: "link", label: "Senectus et netus et malesuada fames ac turpis egestas integer", href: "#typography" }, { type: "text", text: "." }] },
        { role: "body", segments: [{ type: "text", text: "Paragraph: Lorem ipsum dolor sit amet. " }, { type: "link", label: "Facilisi cras fermentum odio eu", href: "#typography" }, { type: "text", text: ". Lacus viverra vitae congue eu consequat ac. " }, { type: "link", label: "Senectus et netus et malesuada fames ac turpis egestas integer", href: "#typography" }, { type: "text", text: "." }] },
        { role: "disclaimer", segments: [{ type: "text", text: "Disclaimer Paragraph: Lorem ipsum dolor sit amet, consectetur adipiscing elit." }] },
      ],
      lists: [
        { kind: "unordered", items: ["Unordered List: Lorem ipsum dolor sit amet, consectetur adipiscing elit", "Lacus viverra vitae congue eu consequat ac", "Senectus et netus et malesuada fames ac turpis egestas integer", "Vitae proin sagittis nisl rhoncus mattis rhoncus"] },
        { kind: "ordered", items: ["Ordered List: Lorem ipsum dolor sit amet, consectetur adipiscing elit", "Lacus viverra vitae congue eu consequat ac", "Senectus et netus et malesuada fames ac turpis egestas integer", "Vitae proin sagittis nisl rhoncus mattis rhoncus"] },
      ],
    }),
    roster: (id) => ({
      ...baseSection(id, "text"),
      heading: "Board Members",
      table: {
        variant: "roster",
        caption: "I‑CAR Board Roster",
        columns: [
          { key: "position", label: "Board Position" },
          { key: "name", label: "Name" },
          { key: "organization", label: "Organization" },
          { key: "segment", label: "Segment" },
          { key: "termEnds", label: "Term Ends" },
          { key: "eligible", label: "Incumbent Eligible for Re-Election", type: "boolean" },
        ],
        rows: [
          { position: "Chair", name: "Member Name", organization: "Organization", segment: "Segment", termEnds: "Q4 20XX", eligible: false },
        ],
      },
    }),
    stats: (id) => ({
      ...baseSection(id, "text"),
      heading: "Financial Recap",
      table: {
        variant: "stats",
        leadText: "For the year ended 12/31/20XX",
        boxed: true,
        rows: [
          { label: "Revenue", value: "$0M", emphasis: "total" },
          { label: "Direct Expense", value: "$0M" },
        ],
        footerRows: [
          { label: "Net Income", value: "$0M", emphasis: "total" },
        ],
      },
    }),
    listOrdered: (id) => ({
      ...baseSection(id, "text"),
      paragraphs: [
        "Add introductory copy above the ordered list.",
      ],
      list: {
        variant: "ordered",
        items: [
          { text: "First step or item." },
          { text: "Second step or item." },
          { text: "Third step or item." },
        ],
      },
    }),
    listChecks: (id) => ({
      ...baseSection(id, "text"),
      paragraphs: [
        "Add introductory copy above the check list.",
      ],
      list: {
        variant: "checks",
        heading: "Add a subheading (optional)",
        items: [
          { text: "First benefit or requirement." },
          { text: "Second benefit or requirement." },
          { text: "Third benefit or requirement." },
        ],
      },
    }),
    decorativeImageCover: (id) => ({
      ...baseSection(id, "text"),
      paragraphs: [
        "Add body copy. The decorative image sits behind the section content.",
      ],
      decorativeImage: {
        placement: "cover",
        image: {
          desktopSrc: "https://placehold.co/1440x600",
          width: "1440",
          height: "600",
          alt: "",
        },
      },
    }),
    decorativeImageBottom: (id) => ({
      ...baseSection(id, "text"),
      paragraphs: [
        "Add body copy. The decorative image appears below the content, full-width.",
      ],
      decorativeImage: {
        placement: "bottom",
        image: {
          desktopSrc: "https://placehold.co/1440x500",
          width: "1440",
          height: "500",
          alt: "",
        },
      },
    }),
    pathDropdown: (id) => ({
      ...baseSection(id, "text"),
      paragraphs: [
        "Add introductory copy above the path dropdown.",
      ],
      pathDropdown: {
        label: "Choose Your Path",
        variant: "outline",
        items: [
          { label: "Path One", href: "#path-one" },
          { label: "Path Two", href: "#path-two" },
          { label: "Path Three", href: "#path-three" },
        ],
      },
    }),
  },
  statementList: {
    default: (id) => ({
      ...baseSection(id, "statementList"),
      textAlignment: "center",
      body: [
        "Add a short introduction for these statements.",
      ],
      statements: [
        {
          heading: "Statement One",
          body: "Add supporting copy for the first statement.",
        },
        {
          heading: "Statement Two",
          body: "Add supporting copy for the second statement.",
        },
      ],
    }),
    start: (id) => ({
      ...baseSection(id, "statementList"),
      textAlignment: "start",
      body: [
        "Add a short introduction for these statements.",
      ],
      statements: [
        {
          heading: "Statement One",
          body: "Add supporting copy for the first statement.",
        },
        {
          heading: "Statement Two",
          body: "Add supporting copy for the second statement.",
        },
      ],
    }),
    pathDropdown: (id) => ({
      ...baseSection(id, "statementList"),
      textAlignment: "center",
      body: [
        "Add a short introduction for these statements.",
      ],
      statements: [
        { heading: "Statement One", body: "Add supporting copy for the first statement." },
        { heading: "Statement Two", body: "Add supporting copy for the second statement." },
      ],
      pathDropdown: {
        label: "Choose Your Path",
        variant: "outline",
        items: [
          { label: "Path One", href: "#path-one" },
          { label: "Path Two", href: "#path-two" },
          { label: "Path Three", href: "#path-three" },
        ],
      },
    }),
  },
  textMedia: {
    default: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add body copy that pairs with the supporting image.",
      ],
      buttons: [
        {
          label: "Learn More",
          href: "#next-step",
          variant: "outline",
        },
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    leftEqual: (id) => ({
      ...baseSection(id, "textMedia"),
      variant: "leftEqual",
      layout: { desktopSplit: "equal", desktopMediaPosition: "left", mobileMediaOrder: "below" },
      paragraphs: ["Text/media with an explicit equal split, left media position, and mobile order."],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    narrow: (id) => ({
      ...baseSection(id, "textMedia"),
      layout: { contentWidth: "narrow" },
      paragraphs: [
        "Add body copy that pairs with the supporting image.",
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    reverse: (id) => ({
      ...baseSection(id, "textMedia"),
      reverse: true,
      paragraphs: [
        "Add body copy that pairs with the supporting image.",
      ],
      buttons: [
        {
          label: "Learn More",
          href: "#next-step",
          variant: "outline",
        },
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    split57: (id) => ({ ...baseSection(id, "textMedia"), layout: { desktopSplit: "text-5-media-7", desktopMediaPosition: "right", mobileMediaOrder: "above" }, paragraphs: ["Text/media 5/7 split."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    split75: (id) => ({ ...baseSection(id, "textMedia"), layout: { desktopSplit: "text-7-media-5", desktopMediaPosition: "left", mobileMediaOrder: "below" }, paragraphs: ["Text/media 7/5 split."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    wide: (id) => ({ ...baseSection(id, "textMedia"), layout: { contentWidth: "wide" }, paragraphs: ["Wide text/media content."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    mediaAbove: (id) => ({ ...baseSection(id, "textMedia"), layout: { desktopMediaPosition: "left", mobileMediaOrder: "above" }, paragraphs: ["Media above on mobile."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    mediaBelow: (id) => ({ ...baseSection(id, "textMedia"), layout: { desktopMediaPosition: "left", mobileMediaOrder: "below" }, paragraphs: ["Media below on mobile."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    square: (id) => ({ ...baseSection(id, "textMedia"), imageStyle: "square", paragraphs: ["Square media treatment."], image: placeholderImage({ alt: `${titleFromId(id)} image`, desktopWidth: 600, desktopHeight: 600 }) }),
    rounded: (id) => ({ ...baseSection(id, "textMedia"), imageStyle: "rounded", paragraphs: ["Rounded media treatment."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    cutout: (id) => ({ ...baseSection(id, "textMedia"), layout: { imageStyle: "cutout" }, paragraphs: ["Cutout media treatment."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    compactMedia: (id) => ({ ...baseSection(id, "textMedia"), layout: { imageSize: "compact" }, paragraphs: ["Compact media treatment."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    buttons: (id) => ({ ...baseSection(id, "textMedia"), paragraphs: ["Text/media with buttons."], buttons: [{ label: "Learn More", href: "#next-step", variant: "outline" }], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    textLinks: (id) => ({ ...baseSection(id, "textMedia"), inlineLinkParagraphs: [{ segments: [{ type: "text", text: "Text/media with " }, { type: "link", label: "text link", href: "https://www.i-car.com/" }] }], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    imageLinks: (id) => ({ ...baseSection(id, "textMedia"), imageLink: { label: "View image", href: "https://www.i-car.com/" }, paragraphs: ["Text/media with image link."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    badgeImage: (id) => ({ ...baseSection(id, "textMedia"), badgeImage: { src: "https://placehold.co/160x100", alt: "Badge", width: "160", height: "100" }, paragraphs: ["Text/media with badge image."], image: placeholderImage({ alt: `${titleFromId(id)} image` }) }),
    componentLibraryTyped: (id) => ({
      ...baseSection(id, "textMedia"),
      variant: "componentLibraryTyped",
      reverse: true,
      inlineLinkParagraphs: [{ segments: [
        { type: "text", text: "Add body copy that pairs with the supporting media. " },
        { type: "link", label: "Explore Courses", href: `#${id}` },
      ] }],
      media: {
        src: "https://players.brightcove.net/1862663934001/default_default/index.html?videoId=6389084042112",
        title: "Training video",
        allow: ["autoplay", "encrypted-media", "fullscreen"],
        fullscreen: true,
        loading: "lazy",
        referrerPolicy: "strict-origin-when-cross-origin",
        width: "616",
        height: "450",
        aspectRatio: "616/450",
        link: { label: "Explore Courses", href: `#${id}` },
      },
      buttons: [{ label: "Learn More", href: "#next-step", variant: "outline" }],
    }),
    withLinkedItems: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add introductory copy. The linked items appear below, each with a logo, heading, body, and link.",
      ],
      linkedItems: [
        {
          logo: {
            src: "https://www.i-car.com/getmedia/placeholder/Logo_100w.svg",
            alt: "Partner logo",
            width: "100",
            height: "47",
          },
          heading: "Partner Program Name",
          body: "Brief description of the program and its purpose.",
          link: {
            label: "Learn More",
            href: "https://www.i-car.com/",
          },
        },
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    withSubsections: (id) => ({
      ...baseSection(id, "textMedia"),
      layout: {
        copyFlow: "block",
      },
      paragraphs: [
        "Add optional introductory copy above the subsections.",
      ],
      subsections: [
        {
          heading: "First Subsection Heading",
          body: "Add body copy for this subsection.",
        },
        {
          heading: "Second Subsection Heading",
          body: "Add body copy for this subsection.",
        },
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    labelAbove: (id) => ({
      ...baseSection(id, "textMedia"),
      label: "Section Label",
      layout: { labelPosition: "above" },
      paragraphs: [
        "Add body copy that pairs with the supporting image.",
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    listLabeled: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add introductory copy above the labeled list.",
      ],
      list: {
        variant: "labeled",
        columns: 2,
        items: [
          { label: "Label One", value: "Value or description for this item." },
          { label: "Label Two", value: "Value or description for this item." },
          { label: "Label Three", value: "Value or description for this item." },
          { label: "Label Four", value: "Value or description for this item." },
        ],
      },
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    listOrdered: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add introductory copy above the ordered list.",
      ],
      list: {
        variant: "ordered",
        items: [
          { text: "First step or item." },
          { text: "Second step or item." },
          { text: "Third step or item." },
        ],
      },
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    listChecks: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add introductory copy above the check list.",
      ],
      list: {
        variant: "checks",
        heading: "Add a subheading (optional)",
        items: [
          { text: "First benefit or requirement." },
          { text: "Second benefit or requirement." },
          { text: "Third benefit or requirement." },
        ],
      },
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
    }),
    decorativeImageBottom: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add body copy. The decorative image appears below the content, full-width.",
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
      decorativeImage: {
        placement: "bottom",
        image: {
          desktopSrc: "https://placehold.co/1440x500",
          width: "1440",
          height: "500",
          alt: "",
        },
      },
    }),
    decorativeImageCover: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add body copy. The decorative image sits behind the section content.",
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
      decorativeImage: {
        placement: "cover",
        image: {
          desktopSrc: "https://placehold.co/1440x600",
          width: "1440",
          height: "600",
          alt: "",
        },
      },
    }),
    pathDropdown: (id) => ({
      ...baseSection(id, "textMedia"),
      paragraphs: [
        "Add body copy that pairs with the supporting image.",
      ],
      image: placeholderImage({ alt: `${titleFromId(id)} image` }),
      pathDropdown: {
        label: "Choose Your Path",
        variant: "outline",
        items: [
          { label: "Path One", href: "#path-one" },
          { label: "Path Two", href: "#path-two" },
          { label: "Path Three", href: "#path-three" },
        ],
      },
    }),
  },
  quote: {
    default: (id) => ({
      ...baseSection(id, "quote"),
      paragraphs: [
        "Add an optional introduction to frame this quote.",
      ],
      quoteParagraphs: [
        "Add approved quote copy here.",
      ],
      cite: {
        name: "Person Name",
        title: "Person Title",
        image: placeholderProfileImage("Person Name"),
      },
    }),
    "side-by-side": (id) => ({
      ...baseSection(id, "quote"),
      variant: "side-by-side",
      paragraphs: [
        "Add an optional introduction to frame this quote.",
      ],
      quoteParagraphs: [
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
      variant: "compact",
      quoteParagraphs: [
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
      paragraphs: [
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
      paragraphs: [
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
      paragraphs: [
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
      paragraphs: [
        "Add a short introduction for these featured items.",
      ],
      cards: Array.from({ length: 3 }, (_, index) => ({
        title: `Feature ${index + 1}`,
        lead: "Add a strong lead-in sentence.",
        paragraphs: ["Add supporting body copy for this feature."],
        image: placeholderImage({ alt: `Feature ${index + 1} image`, desktopWidth: 400, desktopHeight: 220, mobileHeight: 200 }),
      })),
    }),
  },
  iconCardGrid: {
    withFooterCta: (id) => ({
      ...baseSection(id, "iconCardGrid"),
      layout: { cardsPerRow: 3 },
      paragraphs: ["Icon cards with a footer CTA."],
      cards: [{ heading: "Icon Card", paragraphs: ["Supporting copy."], iconSvg: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"60\" height=\"60\" viewBox=\"0 0 60 60\"><circle cx=\"30\" cy=\"30\" r=\"20\" stroke=\"#333538\" stroke-width=\"2\"/></svg>" }],
      buttons: [{ label: "View all", href: "#all", variant: "outline" }],
    }),
    withoutFooterCta: (id) => ({
      ...baseSection(id, "iconCardGrid"),
      layout: { cardsPerRow: 4, cardTextAlign: "center" },
      paragraphs: ["Icon cards without a footer CTA."],
      cards: [{ heading: "Icon Card", paragraphs: ["Supporting copy."], iconSvg: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"60\" height=\"60\" viewBox=\"0 0 60 60\"><circle cx=\"30\" cy=\"30\" r=\"20\" stroke=\"#333538\" stroke-width=\"2\"/></svg>" }],
    }),
    default: (id) => ({
      ...baseSection(id, "iconCardGrid"),
      paragraphs: [
        "Add a short introduction for these icon cards.",
      ],
      cards: Array.from({ length: 4 }, (_, index) => ({
        heading: `Icon Card ${index + 1}`,
        paragraphs: ["Add supporting body copy for this icon card."],
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none">
  <path d="M10.5 7.84668H49.5C53.075 7.84668 56 10.7717 56 14.3467V40.3467C56 43.9217 53.075 46.8467 49.5 46.8467H24.8L14.9506 53.882C13.9947 54.5648 12.6667 53.8814 12.6667 52.7065V46.8467H10.5C6.925 46.8467 4 43.9217 4 40.3467V14.3467C4 10.7717 6.925 7.84668 10.5 7.84668Z" stroke="#333538" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M27.0248 32.2439C27.0248 28.5051 29.156 27.1378 31.1257 25.8518C32.8145 24.7256 34.3823 23.7214 34.3823 21.349C34.3823 18.6559 32.5327 17.0873 29.8794 17.0873C27.3472 17.0873 25.3369 18.6559 25.3369 21.4293V21.7508H21.7588V21.3092C21.7588 16.5652 25.2565 13.5498 30.0004 13.5498C34.7842 13.5498 38.2412 16.4849 38.2412 21.3092C38.2412 25.5303 35.8697 26.8967 33.779 28.1429C32.0902 29.1481 30.5631 30.0729 30.5631 32.2439V32.7262H27.0248V32.2439ZM26.221 38.2341C26.221 36.7061 27.3471 35.5808 28.8743 35.5808C30.4023 35.5808 31.5276 36.7061 31.5276 38.2341C31.5276 39.7613 30.4023 40.8874 28.8743 40.8874C27.3471 40.8874 26.221 39.7613 26.221 38.2341Z" fill="#333538" />
</svg>`,
      })),
    }),
  },
  logoGrid: {
    default: (id) => ({
      ...baseSection(id, "logoGrid"),
      paragraphs: [
        "Add a short introduction for this logo group.",
      ],
      logos: Array.from({ length: 4 }, (_, index) => ({
        alt: `Logo ${index + 1}`,
        src: "https://placehold.co/180x60",
        width: "180",
        height: "60",
      })),
    }),
    decorativeBottom: (id) => ({
      ...baseSection(id, "logoGrid"),
      variant: "decorativeBottom",
      decorativeImage: { placement: "bottom", image: { alt: "", decorative: true, desktopSrc: "https://placehold.co/1400x500", desktopSrcset: "https://placehold.co/1200x430 1200w, https://placehold.co/1400x500 1400w, https://placehold.co/2400x860 2400w, https://placehold.co/2800x1000 2800w", sizes: "(max-width: 1199.9px) 1200px, (max-width: 1919.9px) 1400px, 2800px", width: "1400", height: "500", sources: [{ maxWidth: 768, srcset: "https://placehold.co/400x300 400w, https://placehold.co/800x450 800w, https://placehold.co/1600x900 1600w", width: "800", height: "450" }] } },
      logos: [],
    }),
    withLinks: (id) => ({
      ...baseSection(id, "logoGrid"),
      paragraphs: [
        "Add a short introduction for this logo group.",
      ],
      logos: Array.from({ length: 4 }, (_, index) => ({
        alt: `Logo ${index + 1}`,
        src: "https://placehold.co/180x60",
        width: "180",
        height: "60",
        href: "https://www.i-car.com/",
        target: "_blank",
      })),
    }),
    relatedLinks: (id) => ({
      ...baseSection(id, "logoGrid"),
      links: { layout: "horizontal", align: "center", items: [{ label: "Related resource", href: "https://www.i-car.com/" }] },
      paragraphs: ["Logos with a related-links block."],
      logos: [{ alt: "Logo 1", src: "https://placehold.co/180x60", width: "180", height: "60" }],
    }),
    box: (id) => ({
      ...baseSection(id, "logoGrid"),
      logoStyle: "box",
      paragraphs: [
        "Add a short introduction for this logo group.",
      ],
      logos: [
        { alt: "Logo 1", src: "https://placehold.co/150x79",  width: "150", height: "79"  },
        { alt: "Logo 2", src: "https://placehold.co/150x92",  width: "150", height: "92"  },
        { alt: "Logo 3", src: "https://placehold.co/150x36",  width: "150", height: "36"  },
        { alt: "Logo 4", src: "https://placehold.co/150x60",  width: "150", height: "60"  },
        { alt: "Logo 5", src: "https://placehold.co/150x44",  width: "150", height: "44"  },
        { alt: "Logo 6", src: "https://placehold.co/150x100", width: "150", height: "100" },
      ],
    }),
    scrollBox: (id) => ({
      ...baseSection(id, "logoGrid"),
      logoStyle: "box",
      logoScrollRows: 3,
      paragraphs: [
        "Add a short introduction. The grid scrolls after 3 rows.",
      ],
      logos: Array.from({ length: 20 }, (_, i) => {
        const heights = [79, 92, 36, 60, 44, 100, 55, 80];
        const h = heights[i % heights.length];
        return { alt: `Logo ${i + 1}`, src: `https://placehold.co/150x${h}`, width: "150", height: String(h) };
      }),
    }),
    fluid: (id) => ({
      ...baseSection(id, "logoGrid"),
      layout: { logoContainer: "fluid" },
      paragraphs: [
        "Add a short introduction. The logo row uses the full page width.",
      ],
      logos: Array.from({ length: 12 }, (_, index) => ({
        alt: `Logo ${index + 1}`,
        src: "https://placehold.co/180x60",
        width: "180",
        height: "60",
      })),
    }),
    compactBox: (id) => ({
      ...baseSection(id, "logoGrid"),
      logoStyle: "box",
      logoScrollRows: 3,
      layout: { logoContainer: "fluid", logoBoxSize: "compact" },
      paragraphs: [
        "Add a short introduction. The compact box grid fits 10 logos per row at 1440 px.",
      ],
      logos: Array.from({ length: 20 }, (_, i) => {
        const heights = [60, 79, 44, 92, 36, 60, 80, 55, 100, 60];
        const h = heights[i % heights.length];
        return { alt: `Logo ${i + 1}`, src: `https://placehold.co/120x${h}`, width: "120", height: String(h) };
      }),
    }),
  },
  stickyCards: {
    default: (id) => ({
      ...baseSection(id, "stickyCards"),
      paragraphs: [
        "Add introductory copy for this sticky card section.",
      ],
      cards: Array.from({ length: 3 }, (_, index) => ({
        title: `Sticky Card ${index + 1}`,
        paragraphs: ["Add supporting body copy here."],
        listItems: [
          "First supporting point",
          "Second supporting point",
        ],
      })),
    }),
    typedListItems: (id) => ({
      ...baseSection(id, "stickyCards"),
      variant: "typedListItems",
      heading: "Typed List Items",
      cards: [{
        heading: "Collision Requirements",
        listItems: [
          { segments: [{ type: "link", label: "Estimator", href: "https://www.i-car.com/estimator-platinum-path" }] },
          { segments: [{ type: "link", label: "Refinish", href: "https://www.i-car.com/refinish-technician-platinum-path" }] },
          { segments: [{ type: "link", label: "Structural", href: "https://www.i-car.com/structural-technician-platinum-path" }] },
          { segments: [{ type: "link", label: "Nonstructural", href: "https://www.i-car.com/nonstructural-technician-platinum-path" }] },
          { segments: [{ type: "link", label: "Location courses", href: "https://info.i-car.com/I-CAR/media/ICarMain/PDF/Location-Level-Courses.pdf" }] },
          { segments: [{ type: "link", label: "Vehicle technology", href: "https://www.i-car.com/vehicle-technology-specific-training" }] },
          { segments: [{ type: "link", label: "Industry training alliance", href: "https://info.i-car.com/training/industry-training-alliance" }] },
        ],
      }],
    }),
    goldClassPaths: (id) => ({
      ...baseSection(id, "stickyCards"),
      variant: "goldClassPaths",
      cards: [{ heading: "Program one", paragraphs: ["Program copy."], subheading: "Benefits", listItems: ["Benefit"] }, { heading: "Program two", paragraphs: ["Program copy."], subheading: "Benefits", listItems: ["Benefit"] }],
    }),
    resourceTables: (id) => ({
      ...baseSection(id, "stickyCards"),
      variant: "resourceTables",
      cards: [{ heading: "Welding", groups: [{ heading: "Checklists", tableLabel: "Checklists", paragraphs: ["Add explanatory copy."], columns: ["Resource"], rows: [["Resource"]], disclaimer: "Add disclaimer copy." }, { heading: "Additional Resources", tableLabel: "Additional Resources", paragraphs: ["Add explanatory copy."], columns: ["Resource"], rows: [["Resource"]] }] }, { heading: "Hands-On", groups: [{ heading: "Hands-On Resources", tableLabel: "Hands-On Resources", paragraphs: ["Add explanatory copy."], columns: ["Resource"], rows: [["Resource"]] }] }],
    }),
    itemCards: (id) => ({
      ...baseSection(id, "stickyCards"),
      variant: "itemCards",
      heading: "Section Heading",
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50" fill="none"><title></title><circle cx="25" cy="25" r="22" stroke="#333538" stroke-width="2.25"/></svg>`,
      items: Array.from({ length: 3 }, (_, index) => ({
        name: `Item ${index + 1}`,
        addressLines: ["City, ST"],
        distance: "0.0 miles",
        links: [
          {
            label: "Directions",
            href: "https://maps.google.com",
            target: "_blank",
          },
        ],
      })),
    }),
    embed: (id) => ({
      ...baseSection(id, "stickyCards"),
      variant: "embed",
      heading: "Section Heading",
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50" fill="none"><title></title><circle cx="25" cy="25" r="22" stroke="#333538" stroke-width="2.25"/></svg>`,
      address: { text: "City, ST 00000", href: "https://maps.google.com", target: "_blank" },
      embed: {
        src: "https://www.google.com/maps/embed?pb=example",
        title: "I-CAR technical center map",
        allow: ["fullscreen"],
        fullscreen: true,
        loading: "lazy",
        referrerPolicy: "no-referrer-when-downgrade",
        width: "616",
        height: "450",
        aspectRatio: "616/450",
      },
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
      paragraphs: [
        "Add closing copy that supports the final call to action.",
      ],
      buttons: [
        {
          label: "Primary Action",
          href: "#hero",
          variant: "outline",
        },
      ],
    }),
    pathDropdown: (id) => ({
      ...baseSection(id, "cta"),
      paragraphs: [
        "Add closing copy that supports the final call to action.",
      ],
      pathDropdown: {
        label: "Choose Your Path",
        variant: "outline",
        items: [
          { label: "Path One", href: "#path-one" },
          { label: "Path Two", href: "#path-two" },
          { label: "Path Three", href: "#path-three" },
        ],
      },
    }),
    inlineLinks: (id) => ({
      ...baseSection(id, "cta"),
      inlineLinkParagraphs: [{ segments: [
        { type: "text", text: "Questions? Contact " },
        { type: "link", label: "insurance@i-car.com", href: "mailto:insurance@i-car.com" },
        { type: "text", text: " for more information." },
      ] }],
    }),
  },
  accordion: {
    "desktop-split": (id) => ({
      ...baseSection(id, "accordion"),
      layout: { desktopSplit: "text-5-media-7" },
      heading: "Section Heading",
      paragraphs: [
        "Add introductory copy for this accordion.",
      ],
      items: Array.from({ length: 3 }, (_, index) => ({
        title: `Accordion Item ${index + 1}`,
        paragraphs: [
          "Add supporting copy for this accordion item.",
        ],
      })),
    }),
    default: (id) => ({
      ...baseSection(id, "accordion"),
      paragraphs: [
        "Add introductory copy for this accordion.",
      ],
      items: Array.from({ length: 3 }, (_, index) => ({
        title: `Accordion Item ${index + 1}`,
        paragraphs: [
          "Add supporting copy for this accordion item.",
        ],
      })),
    }),
  },
  embed: {
    default: (id) => ({
      ...baseSection(id, "embed"),
      paragraphs: [
        "Add introductory copy for this embedded content.",
      ],
      embed: {
        src: "https://players.brightcove.net/1862663934001/default_default/index.html?videoId=6363935215112",
        title: "Embedded training video",
        allow: ["encrypted-media", "fullscreen"],
        fullscreen: true,
        loading: "lazy",
        referrerPolicy: "strict-origin-when-cross-origin",
        width: "616",
        height: "450",
        aspectRatio: "16/9",
      },
    }),
    componentLibraryTyped: (id) => ({
      ...baseSection(id, "embed"),
      variant: "componentLibraryTyped",
      inlineLinkParagraphs: [{ segments: [
        { type: "text", text: "Add introductory copy for this embedded content. " },
        { type: "link", label: "Learn more", href: "https://www.i-car.com/" },
      ] }],
      embed: {
        src: "https://players.brightcove.net/1862663934001/default_default/index.html?videoId=6363935215112",
        title: "Embedded training video",
        allow: ["encrypted-media", "fullscreen"],
        fullscreen: true,
        loading: "lazy",
        referrerPolicy: "strict-origin-when-cross-origin",
        width: "616",
        height: "450",
        aspectRatio: "16/9",
      },
    }),
    pathDropdown: (id) => ({
      ...baseSection(id, "embed"),
      paragraphs: ["Embedded media with a path selector."],
      pathDropdown: { label: "Choose Your Path", variant: "outline", items: [{ label: "Path One", href: "#path-one" }, { label: "Path Two", href: "#path-two" }] },
      embed: {
        src: "https://players.brightcove.net/1862663934001/default_default/index.html?videoId=6363935215112",
        title: "Embedded training video with path selector",
        allow: ["encrypted-media", "fullscreen"],
        fullscreen: true,
        loading: "lazy",
        referrerPolicy: "strict-origin-when-cross-origin",
        width: "616",
        height: "450",
        aspectRatio: "16/9",
      },
    }),
  },
  mediaSlider: {
    courses: (id) => ({
      ...baseSection(id, "mediaSlider"),
      variant: "courses",
      slides: Array.from({ length: 4 }, (_, index) => ({
        title: `Course Title ${index + 1}`,
        href: "https://www.i-car.com/product/course-slug/salesforce-id",
        linkTitle: "View course details",
        image: {
          src: "/getmedia/placeholder/Course-Image.webp",
          alt: `Course ${index + 1} image`,
          width: 491,
          height: 327,
        },
      })),
    }),
    default: (id) => ({
      ...baseSection(id, "mediaSlider"),
      paragraphs: [
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
          variant: "outline",
        },
      ],
    }),
  },
  progressList: {
    default: (id) => ({
      ...baseSection(id, "progressList"),
      paragraphs: ["Add an introduction for these standards."],
      groups: [{
        heading: "Year one",
        paragraphs: ["Add context for this standards group."],
        measures: [
          { label: "Standard one", percent: 0 },
          { label: "Standard two", unavailable: "N/A" },
        ],
      }],
    }),
  },
  leadForm: {
    default: (id) => ({
      ...baseSection(id, "leadForm"),
      paragraphs: ["Add approved introductory copy for this general lead form."],
      list: ["Add a benefit or supporting point."],
      form: {
        wrapperId: "lead-form-wrapper",
        id: "lead-form",
        prefix: "lead-form",
        action: "#submit",
        method: "POST",
        fields: [
          { key: "first_name", id: "lead-first-name", name: "first_name", type: "text", label: "First Name", placeholder: "First Name" },
          { key: "last_name", id: "lead-last-name", name: "last_name", type: "text", label: "Last Name", placeholder: "Last Name" },
          { key: "email", id: "lead-email", name: "email", type: "email", label: "Email", placeholder: "Email" },
        ],
        submitLabel: "Submit",
      },
    }),
    kenticoAjaxSplit: (id) => ({
      ...baseSection(id, "leadForm"),
      variant: "kenticoAjaxSplit",
      paragraphs: ["Add approved introductory copy for this Kentico form."],
      list: ["Add a benefit or supporting point."],
      image: {
        desktopSrc: "https://placehold.co/800x600",
        alt: `${titleFromId(id)} image`,
        width: "800",
        height: "600",
      },
      form: {
        wrapperId: "kentico-form-wrapper",
        id: "kentico-form",
        prefix: "kentico-form",
        action: "/Kentico.Components/en-US/Kentico.FormWidget/KenticoFormWidget/FormSubmit?formName=Example&prefix=kentico-form&displayValidationErrors=False",
        method: "POST",
        ajaxUpdate: "#kentico-form-wrapper",
        submitHandler: "window.kentico.updatableFormHelper.submitForm(event)",
        registration: { formId: "kentico-form", targetAttributeName: "data-ktc-ajax-update", unobservedAttributeName: "data-ktc-notobserved-element" },
        fields: [
          { key: "organization", id: "kentico-organization", name: "kentico-form.organization.Value", type: "text", label: "Organization", placeholder: "Organization" },
          { key: "first_name", id: "kentico-first-name", name: "kentico-form.first_name.Value", type: "text", label: "First Name", placeholder: "First Name" },
          { key: "last_name", id: "kentico-last-name", name: "kentico-form.last_name.Value", type: "text", label: "Last Name", placeholder: "Last Name" },
          { key: "phone_number", id: "kentico-phone", name: "kentico-form.phone_number.PhoneNumber", type: "tel", label: "Phone", placeholder: "Phone", phoneMask: { wrapperId: "kentico-phone-mask", pattern: "(999) 999-9999" } },
          { key: "email", id: "kentico-email", name: "kentico-form.email.Email", type: "email", label: "Email (optional)", placeholder: "Email" },
          { key: "benefits_drop_down", id: "kentico-benefits", name: "kentico-form.benefits_drop_down.SelectedValue", type: "select", label: "Benefits", placeholder: "Select an option", options: [{ value: "Accelerated Path to Gold Class", label: "Accelerated Path to Gold Class" }, { value: "Value of Gold Class", label: "Value of Gold Class" }, { value: "Discount", label: "Discount" }, { value: "Payment Plan", label: "Payment Plan" }, { value: "OEM Network", label: "OEM Network" }, { value: "Insurance Network", label: "Insurance Network" }] },
        ],
        runtimeToken: { name: "__RequestVerificationToken" },
        submitLabel: "Submit",
        privacy: { text: "Review the", href: "/about-us/governance/policies/privacy", label: "Privacy Policy" },
        success: { title: "Request Submitted", body: "Confirmation copy goes here." },
      },
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
  anchor: { default: (id) => ({ id, type: "anchor" }) },
  accreditation: {
    default: (id) => ({
      ...baseSection(id, "accreditation"),
      rows: [
        {
          logo: {
            src: "https://placehold.co/155x93",
            alt: "Accreditation logo 1",
            width: "155",
            height: "93",
          },
          heading: "Accreditation Row 1",
          paragraphs: [
            "Add copy describing this accreditation.",
          ],
        },
        {
          logo: {
            src: "https://placehold.co/116x140",
            alt: "Accreditation logo 2",
            width: "116",
            height: "140",
          },
          heading: "Accreditation Row 2",
          paragraphs: [
            "Add copy describing this accreditation.",
          ],
        },
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
