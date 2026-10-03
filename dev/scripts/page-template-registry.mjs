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
      links: [],
    }),
  },
  cards: {
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
  },
  text: {
    default: (id) => ({
      ...baseSection(id, "text"),
      paragraphs: [
        "Add body copy for this section.",
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
  },
  quote: {
    default: (id) => ({
      ...baseSection(id, "quote"),
      paragraphs: [
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
    "side-by-side": (id) => ({
      ...baseSection(id, "quote"),
      quoteLayout: "side-by-side",
      centerIntro: true,
      paragraphs: [
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
    withLinks: (id) => ({
      ...baseSection(id, "logoGrid"),
      paragraphs: [
        "Add a short introduction for this logo group.",
      ],
      links: {
        layout: "horizontal",
        align: "center",
        items: [
          { label: "First Related Link", href: "https://www.i-car.com/" },
          { label: "Second Related Link", href: "https://www.i-car.com/" },
        ],
      },
      logos: Array.from({ length: 4 }, (_, index) => ({
        alt: `Logo ${index + 1}`,
        src: "https://placehold.co/180x60",
        width: "180",
        height: "60",
      })),
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
      addressHtml: `<a href="https://maps.google.com" target="_blank" rel="noopener">City, ST 00000</a>`,
      embedHtml: `<iframe src="" width="616" height="450" style="aspect-ratio:616/450" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="ic-rounded"></iframe>`,
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
      embedHtml: `<div class="ratio ratio-16x9"><div class="d-flex align-items-center justify-content-center border rounded">Replace this placeholder with approved embed HTML.</div></div>`,
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
  html: {
    default: (id) => ({
      id,
      type: "html",
      html: [
        `<!-- Replace with approved HTML for the "${id}" section. -->`,
      ],
    }),
  },
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
