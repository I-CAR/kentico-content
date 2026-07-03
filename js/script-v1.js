(() => {
    function onDomReady(callback) {
        if (document.readyState !== "loading") {
            callback();
            return;
        }
        document.addEventListener("DOMContentLoaded", callback, { once: true });
    }

    var CONTAINER = ".js-ic-dropdown-container";
    var BTN_SEL = ".js-ic-btn-dropdown";
    var DD_SEL = ".js-ic-dropdown";
    var HIDDEN = "ic-visually-hidden";
    var HERO_SECTION = ".section_hero";
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
    function initHeroLinksDropdown() {
        initHeroToggleLinks();
        initDropdownButtons();
        onDomReady(initDropdownA11yPass);
    }

    function loadRecaptcha() {
        if (window.grecaptcha || document.querySelector('script[src*="google.com/recaptcha/api.js"]')) {
            return;
        }
        const script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }
    function updateCaptchaTimestamp() {
        const response = document.getElementById("g-recaptcha-response");
        if (response && response.value && response.value.trim() !== "") return;
        const settingsElement = document.getElementsByName("captcha_settings")[0];
        if (!settingsElement || !settingsElement.value) return;
        try {
            const data = JSON.parse(settingsElement.value);
            data.ts = String(Date.now());
            settingsElement.value = JSON.stringify(data);
        } catch {
        }
    }
    function startRecaptcha() {
        loadRecaptcha();
        const hasCaptcha = document.getElementById("g-recaptcha-response") || document.getElementsByName("captcha_settings")[0];
        if (hasCaptcha) {
            setInterval(updateCaptchaTimestamp, 500);
        }
    }
    function initRecaptcha() {
        onDomReady(startRecaptcha);
    }

    function initSwatches() {
        const swatches = document.querySelectorAll(".js-ic-swatch");
        swatches.forEach((swatch) => {
            swatch.addEventListener("click", (event) => {
                const hex = getComputedStyle(swatch).getPropertyValue("--color-hex").replace(/"/g, "").trim();
                if (!hex) return;
                navigator.clipboard.writeText(hex).then(() => {
                    const message = document.createElement("span");
                    message.className = "ic-copied-msg";
                    message.textContent = `Copied ${hex}!`;
                    const rect = swatch.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;
                    message.style.left = `${x}px`;
                    message.style.top = `${y}px`;
                    swatch.appendChild(message);
                    setTimeout(() => message.remove(), 1500);
                });
            });
        });
    }
    function initSwatchCopy() {
        onDomReady(initSwatches);
    }

    function initDefaultSwiperInstance() {
        if (typeof Swiper === "undefined" || !document.querySelector(".js-ic-swiper")) return;
        new Swiper(".js-ic-swiper", {
            loop: false,
            spaceBetween: 0,
            grabCursor: true,
            slidesPerView: 1.25,
            breakpoints: {
                576: {
                    slidesPerView: 2
                },
                1024: {
                    slidesPerView: 3
                },
                1440: {
                    slidesPerView: 4
                }
            },
            navigation: {
                nextEl: ".js-ic-swiper-nav-next",
                prevEl: ".js-ic-swiper-nav-prev"
            },
            keyboard: {
                enabled: true
            }
        });
    }
    function initDefaultSwiper() {
        onDomReady(initDefaultSwiperInstance);
    }

    function initCoursesSwiperInstance() {
        const coursesSwiperElement = document.querySelector(".js-ic-swiper-courses");
        if (!coursesSwiperElement || typeof Swiper === "undefined") return;
        new Swiper(".js-ic-swiper-courses", {
            loop: false,
            spaceBetween: 0,
            grabCursor: true,
            slidesPerView: 1.25,
            breakpoints: {
                576: {
                    slidesPerView: 2,
                    spaceBetween: 22
                },
                768: {
                    slidesPerView: 3,
                    spaceBetween: 22
                },
                1200: {
                    slidesPerView: 4,
                    spaceBetween: 22
                }
            },
            navigation: {
                nextEl: ".js-ic-swiper-nav-next",
                prevEl: ".js-ic-swiper-nav-prev"
            },
            keyboard: {
                enabled: true
            }
        })
    }
    function initCoursesSwiper() {
        onDomReady(initCoursesSwiperInstance);
    }

    initHeroLinksDropdown();
    initRecaptcha();
    initSwatchCopy();
    initDefaultSwiper();
    initCoursesSwiper();
})();
