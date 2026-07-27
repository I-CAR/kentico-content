import { onDomReady } from "../utils/on-dom-ready.js";

const CONTAINER = ".js-ic-dropdown-container";
const BTN_SEL = ".js-ic-btn-dropdown";
const DD_SEL = ".js-ic-dropdown";
const HIDDEN = "ic-visually-hidden";
const HERO_SECTION = ".section_hero";

function getDropdown(button) {
    const id = button.getAttribute("aria-controls") || button.getAttribute("data-target");

    if (id) {
        const node = document.getElementById(id.replace(/^#/, ""));
        if (node) return node;
    }

    const container = button.closest(CONTAINER);
    return container ? container.querySelector(DD_SEL) : null;
}

function hideDropdown(dropdown, button) {
    if (!dropdown || dropdown.classList.contains(HIDDEN)) return;

    if (dropdown.contains(document.activeElement)) {
        button?.focus({ preventScroll: true });
    }

    dropdown.classList.add(HIDDEN);
    dropdown.setAttribute("aria-hidden", "true");
    dropdown.setAttribute("inert", "");
    button?.setAttribute("aria-expanded", "false");
}

function showDropdown(dropdown, button) {
    if (!dropdown) return;

    dropdown.classList.remove(HIDDEN);
    dropdown.removeAttribute("aria-hidden");
    dropdown.removeAttribute("inert");
    button?.setAttribute("aria-expanded", "true");
}

function closeAllExcept(skip) {
    document.querySelectorAll(DD_SEL).forEach((dropdown) => {
        if (dropdown !== skip) hideDropdown(dropdown, dropdown._icOwnerBtn);
    });
}

function primeA11y(dropdown, button) {
    dropdown._icOwnerBtn = button;

    if (!button.hasAttribute("aria-haspopup")) button.setAttribute("aria-haspopup", "menu");
    if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");

    if (!dropdown.hasAttribute("role")) dropdown.setAttribute("role", "menu");
    if (dropdown.classList.contains(HIDDEN)) {
        dropdown.setAttribute("aria-hidden", "true");
        dropdown.setAttribute("inert", "");
    }

    dropdown.querySelectorAll("a, button").forEach((element) => {
        if (!element.hasAttribute("role")) element.setAttribute("role", "menuitem");
        if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
    });
}

function initHeroToggleLinks() {
    window.toggleLinks = function (trigger) {
        const button = trigger instanceof Element ? trigger : null;
        const section = button?.closest(HERO_SECTION) || document.querySelector(HERO_SECTION);
        const dropdown = section?.querySelector(".dropdown");

        if (!section || !dropdown) return;

        section.classList.toggle("dropdown-open");
        dropdown.classList.toggle("-hidden");
    };
}

function initDropdownButtons() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest(BTN_SEL);
        if (!button || !button.closest(CONTAINER)) return;

        event.preventDefault();

        const dropdown = getDropdown(button);
        if (!dropdown) return;

        primeA11y(dropdown, button);

        const willOpen = dropdown.classList.contains(HIDDEN);
        if (!willOpen) {
            hideDropdown(dropdown, button);
            return;
        }

        closeAllExcept(dropdown);

        function teardown() {
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onKeydown);
        }

        function onDocClick(nextEvent) {
            if (dropdown.contains(nextEvent.target) || button.contains(nextEvent.target)) return;
            teardown();
            hideDropdown(dropdown, button);
        }

        function onKeydown(nextEvent) {
            if (nextEvent.key !== "Escape") return;
            teardown();
            hideDropdown(dropdown, button);
            button.focus();
        }

        setTimeout(() => {
            document.addEventListener("click", onDocClick);
            document.addEventListener("keydown", onKeydown);
        }, 0);

        showDropdown(dropdown, button);
    });
}

function initDropdownA11yPass() {
    document.querySelectorAll(CONTAINER).forEach((container) => {
        const button = container.querySelector(BTN_SEL);
        const dropdown = container.querySelector(DD_SEL);
        if (button && dropdown) primeA11y(dropdown, button);
    });
}

export function initHeroLinksDropdown() {
    initHeroToggleLinks();
    initDropdownButtons();
    onDomReady(initDropdownA11yPass);
}
