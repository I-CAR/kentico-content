#!/usr/bin/env python3

from __future__ import annotations

import re
from collections import OrderedDict, defaultdict
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
HTML_ROOT = REPO_ROOT / "html"
OUTPUT_PATH = HTML_ROOT / "documentation" / "component-library.html"
EXCLUDED_PATHS = {
    Path("documentation/component-library.html"),
    Path("documentation/style-guide.html"),
}


GROUP_ORDER = [
    "Hero Sections",
    "In-Page Navigation",
    "Overview / Explainer Sections",
    "Education / Training / Program Sections",
    "Requirements / Benefits / Process Sections",
    "Resources / Tools Sections",
    "Media / Quote / Testimonial Sections",
    "Partner / Trust / Governance Sections",
    "CTA / Form Sections",
    "Utility / Travel / Marketing Sections",
    "General Content Sections",
]

HERO_STAPLE_ORDER = [
    "Careers Hero",
    "Culture Hero",
    "High Voltage Safety Hero",
    "Course Updates Hero",
]

HERO_VARIANT_NAMES = {
    "Careers Hero": "Overview Hero",
    "Culture Hero": "50/50 Hero",
    "High Voltage Safety Hero": "40/60 Hero",
    "Course Updates Hero": "60/40 Hero",
}

CULTURE_HERO_IMAGE_TEMPLATE = """<picture>
                                    <source media="(max-width: 768px)" width="800" height="450" sizes="800px"
                                        srcset="https://placehold.co/400x450 400w, https://placehold.co/800x450 800w, https://placehold.co/1600x450 1600w">
                                    <img alt="{alt}"
                                        class="ic-section-image ic-image-rounded" loading="lazy" width="800" height="550"
                                        sizes="800px"
                                        src="https://placehold.co/800x550"
                                        srcset="https://placehold.co/400x550 400w, https://placehold.co/800x550 800w, https://placehold.co/1600x550 1600w">
                                </picture>"""

GROUP_SECTION_NAMES = {
    "Hero Sections": [
        "Awards Hero — Jeff Silver Platinum",
        "Awards Hero — Russ Verona Gold Class Shop",
        "Careers Hero",
        "Culture Hero",
        "ADAS Education Hero",
        "What Is ADAS Hero",
        "ADAS Overview Hero",
        "Course Updates Hero",
        "CTC Travel Hero",
        "EV Education Hero",
        "High Voltage Safety Hero",
        "EV Repair Hero",
        "Facilities Best Practice Access Hero",
        "Facilities and Equipment Hero",
        "Board Member Application Hero",
        "Industry Reinvestment Hero",
        "Welding Event Resources Hero",
        "Welding Training and Certification Hero",
        "Welding Overview Hero",
    ],
    "In-Page Navigation": [
        "Careers Page Navigation",
    ],
    "Overview / Explainer Sections": [
        "Culture Recognition Overview",
        "Culture Purpose and Impact",
        "Culture Core Beliefs and Values",
        "ADAS Basics Overview",
        "Industry Reinvestment Overview",
    ],
    "Education / Training / Program Sections": [
        "Career Paths Overview",
        "Benefits Package Overview",
        "ADAS Gold Class Update",
        "ADAS Education CTA",
        "ADAS Training Overview",
        "Upcoming Courses",
        "New Training Formats",
        "Recently Launched Courses",
        "EV and Hybrid Course Options",
        "OEM Required EV Hybrid Training",
        "EV Courses Coming Soon",
        "EV Safety Education Overview",
        "EV and Hybrid Benefits Overview",
        "High Voltage Safety Resources Overview",
        "Brand Logos Library",
        "Impact Fund Active Projects",
        "Welding Training Benefits",
        "Welding Training Preparation",
    ],
    "Requirements / Benefits / Process Sections": [
        "Hiring Process Overview",
        "Employee Benefits Summary",
        "Industry Future Focus",
        "ADAS Professional Tools",
        "Welding Certification Requirements",
        "Welding Certification Path",
        "Welding Network Requirements",
    ],
    "Resources / Tools Sections": [
        "ADAS Platinum Path",
        "Airport Travel Options",
        "EV Professional Tools",
        "Facilities Event Preparation",
        "Welding Event Preparation Resources",
        "RTS Welding Resources",
    ],
    "Media / Quote / Testimonial Sections": [
        "Workplace Experience Spotlight",
        "CEO Culture Message",
        "Team Testimonial Grid",
        "Benefits Testimonial Grid",
        "CEO Culture Video",
        "ADAS Courses Media",
        "ADAS Lab Gallery",
        "ADAS Learner Stories",
        "ADAS Video Playlist",
        "EV Lab Gallery",
        "EV Safety Video Playlist",
        "Board Seats Table",
        "Impact Report Feature",
    ],
    "Partner / Trust / Governance Sections": [
        "Industry Trust Overview",
        "Board Terms and Expectations",
    ],
    "CTA / Form Sections": [
        "Jeff Silver Nomination Form",
        "Russ Verona Nomination Form",
        "Join the I-CAR Team",
        "Leadership Impact CTA",
        "Career Impact CTA",
        "ADAS FAQ Accordion",
        "Course Updates FAQ",
        "EV Safety FAQ",
        "Start Welding Certification CTA",
    ],
    "Utility / Travel / Marketing Sections": [
        "Hotel Travel Options",
        "Gold Class Marketing Kit Overview",
        "Social Media Assets",
        "Gold Class Messaging Assets",
        "In-Shop Display Assets",
        "Financial Recap",
        "Reserves Recap",
    ],
    "General Content Sections": [
        "Careers Flexibility Overview",
        "Careers Equal Opportunity Disclaimer",
        "CTC Location Details",
        "High Voltage Safety Guides",
        "Equipment Readiness Benefits",
        "Facilities Form Intro",
        "Facilities Form Spacer",
        "Board Milestones Timeline",
        "Welding Event Preparation CTA",
        "Welding Certification Types",
    ],
}


@dataclass
class ExtractedSection:
    source: str
    original_id: str
    classes: str
    html: str
    display_name: str
    heading: str
    label: str
    summary: str
    group: str


class SectionMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.headings: list[str] = []
        self.labels: list[str] = []
        self.paragraphs: list[str] = []
        self._capture: tuple[str, str] | None = None
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag in {"h1", "h2", "h3", "h4"}:
            self._capture = ("heading", tag)
            self._buffer = []
            return

        if tag != "p":
            return

        classes = attrs_dict.get("class", "") or ""
        if "section-label" in classes and len(self.labels) < 2:
            self._capture = ("label", tag)
            self._buffer = []
            return

        if len(self.paragraphs) < 2:
            self._capture = ("paragraph", tag)
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        if not self._capture or tag != self._capture[1]:
            return

        text = normalize_text("".join(self._buffer))
        if text:
            kind = self._capture[0]
            if kind == "heading":
                self.headings.append(text)
            elif kind == "label":
                self.labels.append(text)
            else:
                self.paragraphs.append(text)

        self._capture = None
        self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buffer.append(data)


def normalize_text(value: str) -> str:
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_name_token(value: str) -> str:
    value = normalize_text(value)
    value = re.sub(r"&[a-zA-Z#0-9]+;", " ", value)
    value = re.sub(r"[^A-Za-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip() or "Section"


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def extract_main_html(document: str) -> str:
    match = re.search(r"<main\b[^>]*>", document, flags=re.IGNORECASE)
    if not match:
        return ""

    main_start = match.end()
    main_end = re.search(r"</main>", document[main_start:], flags=re.IGNORECASE)
    if not main_end:
        return ""

    return document[main_start : main_start + main_end.start()]


def extract_top_level_sections(main_html: str) -> list[tuple[str, str, str]]:
    pattern = re.compile(r"<(/?)section\b([^>]*)>", flags=re.IGNORECASE)
    sections: list[tuple[str, str, str]] = []
    depth = 0
    start = -1
    attrs_text = ""

    for match in pattern.finditer(main_html):
        is_close = match.group(1) == "/"
        if not is_close:
            if depth == 0:
                start = match.start()
                attrs_text = match.group(2)
            depth += 1
            continue

        depth -= 1
        if depth == 0 and start >= 0:
            html = main_html[start : match.end()]
            section_id = extract_attribute(attrs_text, "id")
            classes = extract_attribute(attrs_text, "class")
            sections.append((html, section_id, classes))
            start = -1
            attrs_text = ""

    return sections


def is_style_v2_or_v3(classes: str) -> bool:
    class_list = {name.strip() for name in classes.split() if name.strip()}
    return any(name.startswith("ic-") for name in class_list)


def extract_attribute(attrs_text: str, name: str) -> str:
    pattern = rf"""\b{name}\s*=\s*(['"])(.*?)\1"""
    match = re.search(pattern, attrs_text, flags=re.IGNORECASE | re.DOTALL)
    return match.group(2).strip() if match else ""


def strip_id_attributes(section_html: str) -> str:
    return re.sub(r"""\s+id\s*=\s*(['"]).*?\1""", "", section_html, flags=re.IGNORECASE | re.DOTALL)


def fingerprint_section(section_html: str) -> str:
    normalized = re.sub(r">\s+<", "><", section_html)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def parse_section_metadata(section_html: str) -> tuple[str, str, str]:
    parser = SectionMetadataParser()
    parser.feed(section_html)
    heading = parser.headings[0] if parser.headings else "Untitled Section"
    label = parser.labels[0] if parser.labels else ""
    summary = parser.paragraphs[0] if parser.paragraphs else ""
    return heading, label, summary


def replace_images_with_placeholders(section_html: str) -> str:
    def tag_dimensions(tag_html: str) -> tuple[str, str]:
        width = extract_attribute(tag_html, "width") or "800"
        height = extract_attribute(tag_html, "height") or "600"
        width = re.sub(r"[^0-9]", "", width) or "800"
        height = re.sub(r"[^0-9]", "", height) or "600"
        return width, height

    def replace_src_attr(tag_html: str) -> str:
        width, height = tag_dimensions(tag_html)
        placeholder = f"https://placehold.co/{width}x{height}"
        return re.sub(
            r"""(\s(src|poster)\s*=\s*)(['"]).*?\3""",
            rf"\1\3{placeholder}\3",
            tag_html,
            flags=re.IGNORECASE | re.DOTALL,
        )

    def replace_srcset_attr(tag_html: str) -> str:
        width, height = tag_dimensions(tag_html)
        srcset = extract_attribute(tag_html, "srcset")
        if not srcset:
            return tag_html

        parts = []
        for candidate in [part.strip() for part in srcset.split(",") if part.strip()]:
            descriptor_match = re.search(r"(\s+\d+[wx])\s*$", candidate)
            descriptor = descriptor_match.group(1).strip() if descriptor_match else ""
            if descriptor.endswith("w"):
                descriptor_width = re.sub(r"[^0-9]", "", descriptor) or width
                placeholder = f"https://placehold.co/{descriptor_width}x{height}"
                parts.append(f"{placeholder} {descriptor}")
            elif descriptor.endswith("x"):
                parts.append(f"https://placehold.co/{width}x{height} {descriptor}")
            else:
                parts.append(f"https://placehold.co/{width}x{height}")

        normalized_srcset = ", ".join(parts)
        quote_match = re.search(r"""\ssrcset\s*=\s*(['"])""", tag_html, flags=re.IGNORECASE)
        quote = quote_match.group(1) if quote_match else '"'
        return re.sub(
            r"""\ssrcset\s*=\s*(['"]).*?\1""",
            f' srcset={quote}{normalized_srcset}{quote}',
            tag_html,
            flags=re.IGNORECASE | re.DOTALL,
        )

    def replace_tag(match: re.Match[str]) -> str:
        tag_html = match.group(0)
        tag_name = match.group(1).lower()
        updated = tag_html

        if tag_name in {"img", "source"}:
            updated = replace_srcset_attr(updated)
            updated = replace_src_attr(updated)

        return updated

    return re.sub(r"<(img|source)\b[^>]*>", replace_tag, section_html, flags=re.IGNORECASE | re.DOTALL)


def replace_primary_headings(section_html: str) -> str:
    def repl(match: re.Match[str]) -> str:
        tag = match.group(1)
        attrs = match.group(2)
        if re.search(r"""\sclass\s*=""", attrs, flags=re.IGNORECASE):
            updated_attrs = re.sub(
                r"""(\sclass\s*=\s*)(['"])(.*?)\2""",
                lambda class_match: (
                    f"{class_match.group(1)}{class_match.group(2)}"
                    f"{class_match.group(3)}{' ' if class_match.group(3).strip() else ''}ic-section-title"
                    f"{class_match.group(2)}"
                    if "ic-section-title" not in class_match.group(3).split()
                    else class_match.group(0)
                ),
                attrs,
                count=1,
                flags=re.IGNORECASE | re.DOTALL,
            )
        else:
            updated_attrs = f'{attrs} class="ic-section-title"'

        return f"<{tag}{updated_attrs}>Section Headline</{tag}>"

    return re.sub(r"<(h[12])([^>]*)>.*?</\1>", repl, section_html, flags=re.IGNORECASE | re.DOTALL)


def add_section_name(section_html: str, section_name: str) -> str:
    quoted_name = section_name.replace("\\", "\\\\").replace("'", "\\'")

    def repl(match: re.Match[str]) -> str:
        attrs = match.group(1)
        if re.search(r"""\sstyle\s*=""", attrs, flags=re.IGNORECASE):
            return re.sub(
                r"""(\sstyle\s*=\s*)(['"])(.*?)\2""",
                lambda style_match: f"{style_match.group(1)}{style_match.group(2)}{style_match.group(3).rstrip('; ')}; --name:'{quoted_name}';{style_match.group(2)}",
                match.group(0),
                flags=re.IGNORECASE | re.DOTALL,
            )
        return f"<section{attrs} style=\"--name:'{quoted_name}';\">"

    return re.sub(r"<section([^>]*)>", repl, section_html, count=1, flags=re.IGNORECASE | re.DOTALL)


def blank_section_id(section_html: str) -> str:
    def repl(match: re.Match[str]) -> str:
        attrs = match.group(1)
        attrs_without_id = re.sub(
            r"""\sid\s*=\s*(['"]).*?\1""",
            "",
            attrs,
            count=1,
            flags=re.IGNORECASE | re.DOTALL,
        )
        attrs_without_id = re.sub(r"\s+", " ", attrs_without_id).rstrip()
        return f'<section id=""{attrs_without_id}>'

    return re.sub(r"<section([^>]*)>", repl, section_html, count=1, flags=re.IGNORECASE | re.DOTALL)


def standardize_staple_hero_placeholder(section_html: str, section_name: str) -> str:
    if section_name not in {"Culture Hero", "High Voltage Safety Hero", "Course Updates Hero"}:
        return section_html

    alt_match = re.search(r"""<img\b[^>]*\balt=(['"])(.*?)\1""", section_html, flags=re.IGNORECASE | re.DOTALL)
    alt_text = alt_match.group(2) if alt_match else "Section image"
    replacement = CULTURE_HERO_IMAGE_TEMPLATE.format(alt=alt_text)

    if re.search(r"<picture\b", section_html, flags=re.IGNORECASE):
        return re.sub(
            r"<picture\b.*?</picture>",
            replacement,
            section_html,
            count=1,
            flags=re.IGNORECASE | re.DOTALL,
        )

    return re.sub(
        r"<img\b[^>]*>",
        replacement,
        section_html,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )


def standardize_staple_hero_layout(section_html: str, section_name: str) -> str:
    if section_name == "High Voltage Safety Hero":
        section_html = section_html.replace(
            'class="col col-12 col-md-6 col-xl-5 mb-3 mb-md-0 pr-md-5"',
            'class="col col-12 col-md-5 col-xl-5 mb-3 mb-md-0 pr-md-5"',
            1,
        )
        section_html = section_html.replace(
            'class="col col-12 col-md-6 col-xl-7 mt-3 mt-md-0"',
            'class="col col-12 col-md-7 col-xl-7 mt-3 mt-md-0"',
            1,
        )
    elif section_name == "Course Updates Hero":
        section_html = section_html.replace(
            'class="col col-12 col-md-6 col-xl-5 mb-3 mb-md-0"',
            'class="col col-12 col-md-7 col-xl-7 mb-3 mb-md-0"',
            1,
        )
        section_html = section_html.replace(
            'class="col col-12 col-md-6 col-xl-7 pl-lg-5 mt-3 mt-md-0"',
            'class="col col-12 col-md-5 col-xl-5 pl-lg-5 mt-3 mt-md-0"',
            1,
        )

    return section_html


def classify_section(section_id: str, classes: str, heading: str, label: str, summary: str) -> str:
    haystack = " ".join(filter(None, [section_id, classes, heading, label, summary])).lower()

    if "hero" in classes.lower():
        return "Hero Sections"
    if "section-nav" in classes.lower() or section_id == "page-nav":
        return "In-Page Navigation"
    if any(token in haystack for token in ["quote", "testimonial", "ceo", "hear from our team", "what our employees say", "what platinum professionals are saying"]):
        return "Media / Quote / Testimonial Sections"
    if any(token in haystack for token in ["video playlist", "learner experiences", "lab", "playlist", "gallery"]):
        return "Media / Quote / Testimonial Sections"
    if any(token in haystack for token in ["nomination form", "contact us", "questions", "get started", "join the", "start your", "make an impact", "report"]):
        return "CTA / Form Sections"
    if any(token in haystack for token in ["what is", "vision", "mission", "purpose", "values", "common", "overview", "recognized for our culture", "re-investments to support the industry"]):
        return "Overview / Explainer Sections"
    if any(token in haystack for token in ["courses", "education", "training", "academy", "program", "career path", "format", "international", "iacet", "impact fund currently at work", "projects"]):
        return "Education / Training / Program Sections"
    if any(token in haystack for token in ["benefits", "requirements", "process", "standards", "hiring", "shop structure", "path to certification", "why go platinum"]):
        return "Requirements / Benefits / Process Sections"
    if any(token in haystack for token in ["tools", "resources", "rts", "repairers realm", "platinum path", "reach your collision repair network goals", "technical information"]):
        return "Resources / Tools Sections"
    if any(token in haystack for token in ["governance", "board", "leadership", "membership", "feedback forums", "trusted across the industry", "collaboration centric", "together, we all win"]):
        return "Partner / Trust / Governance Sections"
    if any(token in haystack for token in ["travel", "airport", "hotel", "marketing kit", "logos", "messaging", "social media", "display", "reserves recap", "financial recap"]):
        return "Utility / Travel / Marketing Sections"
    return "General Content Sections"


def collect_unique_sections() -> tuple[OrderedDict[str, ExtractedSection], int]:
    unique_sections: OrderedDict[str, ExtractedSection] = OrderedDict()
    total_sections = 0
    group_counts: dict[str, int] = defaultdict(int)

    files = sorted(
        path
        for path in HTML_ROOT.rglob("*.html")
        if path.relative_to(HTML_ROOT) not in EXCLUDED_PATHS
    )

    for path in files:
        document = path.read_text(encoding="utf-8")
        main_html = extract_main_html(document)
        if not main_html:
            continue

        relative_path = path.relative_to(REPO_ROOT).as_posix()
        for section_html, section_id, classes in extract_top_level_sections(main_html):
            if not is_style_v2_or_v3(classes):
                continue
            total_sections += 1
            normalized_html = strip_id_attributes(section_html)
            fingerprint = fingerprint_section(normalized_html)
            if fingerprint in unique_sections:
                existing = unique_sections[fingerprint]
                existing.source = f"{existing.source}, {relative_path}"
                continue

            heading, label, summary = parse_section_metadata(section_html)
            group = classify_section(section_id, classes, heading, label, summary)
            group_counts[group] += 1
            configured_names = GROUP_SECTION_NAMES.get(group, [])
            if group_counts[group] <= len(configured_names):
                unique_name = configured_names[group_counts[group] - 1]
            else:
                unique_name = f"{normalize_name_token(group)} {group_counts[group]:02d}"
            rendered_name = HERO_VARIANT_NAMES.get(unique_name, unique_name)
            transformed_html = replace_images_with_placeholders(section_html)
            transformed_html = replace_primary_headings(transformed_html)
            transformed_html = standardize_staple_hero_placeholder(transformed_html, unique_name)
            transformed_html = standardize_staple_hero_layout(transformed_html, unique_name)
            transformed_html = add_section_name(transformed_html, rendered_name)
            transformed_html = blank_section_id(transformed_html)
            unique_sections[fingerprint] = ExtractedSection(
                source=relative_path,
                original_id=section_id,
                classes=classes,
                html=transformed_html.strip(),
                display_name=unique_name,
                heading=heading,
                label=label,
                summary=summary,
                group=group,
            )

    return unique_sections, total_sections


def render_group_nav(groups: dict[str, list[ExtractedSection]]) -> str:
    links = []
    for group in GROUP_ORDER:
        items = groups.get(group, [])
        if not items:
            continue
        links.append(
            f'<li><span class="inventory-nav-item">{group} <span class="inventory-nav-count">({len(items)})</span></span></li>'
        )
    return "\n".join(links)


def render_group_sections(groups: dict[str, list[ExtractedSection]]) -> str:
    rendered_groups: list[str] = []
    for group in GROUP_ORDER:
        items = groups.get(group, [])
        if not items:
            continue

        rendered_items = []
        for item in items:
            rendered_items.append(
                indent_html(item.html, 8)
            )

        rendered_groups.append(
            "\n".join(
                [
                    f"        <!-- {group} ({len(items)} unique sections) -->",
                    *rendered_items,
                ]
            )
        )

    return "\n\n".join(rendered_groups)


def indent_html(value: str, level: int) -> str:
    prefix = " " * level
    return "\n".join(f"{prefix}{line}" if line else "" for line in value.splitlines())


def escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_document(unique_sections: OrderedDict[str, ExtractedSection], total_sections: int) -> str:
    groups: dict[str, list[ExtractedSection]] = defaultdict(list)
    for section in unique_sections.values():
        groups[section.group].append(section)

    hero_sections = groups.get("Hero Sections", [])
    if hero_sections:
        hero_lookup = {section.display_name: section for section in hero_sections}
        groups["Hero Sections"] = [
            hero_lookup[name]
            for name in HERO_STAPLE_ORDER
            if name in hero_lookup
        ]

    for group_name, sections in groups.items():
        if group_name == "Hero Sections":
            continue
        sections.sort(key=lambda section: section.heading.lower())

    navigation = render_group_nav(groups)
    grouped_sections = render_group_sections(groups)
    unique_count = len(unique_sections)
    duplicate_count = total_sections - unique_count

    return f"""<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unique Section Inventory</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://info.i-car.com/dist/styles/main.css?v=202106042">
    <link rel="stylesheet" href="../node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="../css/style.css">
</head>

<body>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&amp;display=swap"
        rel="stylesheet" />
    <main>
{grouped_sections}
    </main>
</body>

</html>
"""


def main() -> None:
    unique_sections, total_sections = collect_unique_sections()
    document = build_document(unique_sections, total_sections)
    OUTPUT_PATH.write_text(document, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
