(function () {
    const CONTAINER = '.js-ic-dropdown-container';
    const BTN_SEL = '.js-ic-btn-dropdown';
    const DD_SEL = '.js-ic-dropdown';
    const HIDDEN = 'ic-visually-hidden';

    // Get dropdown associated with a button
    function getDropdown(btn) {
        // 1) aria-controls wins
        const id = btn.getAttribute('aria-controls') || btn.getAttribute('data-target');
        if (id) {
            const node = document.getElementById(id.replace(/^#/, ''));
            if (node) return node;
        }
        // 2) fallback: find within the same container
        const container = btn.closest(CONTAINER);
        return container ? container.querySelector(DD_SEL) : null;
    }

    function hideDropdown(dropdown, btn) {
        if (!dropdown || dropdown.classList.contains(HIDDEN)) return;

        // If focus is inside the dropdown, send it back to the button before hiding
        if (dropdown.contains(document.activeElement)) {
            btn?.focus({ preventScroll: true });
        }

        dropdown.classList.add(HIDDEN);
        dropdown.setAttribute('aria-hidden', 'true');
        dropdown.setAttribute('inert', '');
        btn?.setAttribute('aria-expanded', 'false');
    }

    function showDropdown(dropdown, btn) {
        if (!dropdown) return;

        dropdown.classList.remove(HIDDEN);
        dropdown.removeAttribute('aria-hidden');
        dropdown.removeAttribute('inert');
        btn?.setAttribute('aria-expanded', 'true');
    }

    function closeAllExcept(skip) {
        document.querySelectorAll(DD_SEL).forEach(d => {
            if (d !== skip) hideDropdown(d, d._icOwnerBtn);
        });
    }

    function primeA11y(dropdown, btn) {
        dropdown._icOwnerBtn = btn;

        // Button ARIA
        if (!btn.hasAttribute('aria-haspopup')) btn.setAttribute('aria-haspopup', 'menu');
        if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
        // Never set aria-hidden on the button.

        // Dropdown ARIA
        if (!dropdown.hasAttribute('role')) dropdown.setAttribute('role', 'menu');
        if (dropdown.classList.contains(HIDDEN)) {
            dropdown.setAttribute('aria-hidden', 'true');
            dropdown.setAttribute('inert', '');
        }

        dropdown.querySelectorAll('a, button').forEach(el => {
            if (!el.hasAttribute('role')) el.setAttribute('role', 'menuitem');
            if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
        });
    }

    // Delegated click handler (works for any number of containers)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest(BTN_SEL);
        if (!btn) return;

        // Ensure click was inside a valid container
        if (!btn.closest(CONTAINER)) return;

        e.preventDefault();

        const dropdown = getDropdown(btn);
        if (!dropdown) return;

        primeA11y(dropdown, btn);

        const willOpen = dropdown.classList.contains(HIDDEN);
        if (willOpen) {
            closeAllExcept(dropdown);

            // Outside click + Escape to close
            function onDocClick(ev) {
                if (dropdown.contains(ev.target) || btn.contains(ev.target)) return;
                teardown();
                hideDropdown(dropdown, btn);
            }
            function onKey(ev) {
                if (ev.key === 'Escape') {
                    teardown();
                    hideDropdown(dropdown, btn);
                    btn.focus();
                }
            }
            function teardown() {
                document.removeEventListener('click', onDocClick);
                document.removeEventListener('keydown', onKey);
            }
            // Defer to avoid immediate close from the opening click
            setTimeout(() => {
                document.addEventListener('click', onDocClick);
                document.addEventListener('keydown', onKey);
            }, 0);

            showDropdown(dropdown, btn);
        } else {
            hideDropdown(dropdown, btn);
        }
    });

    // Optional: initialize ARIA/inert on load for all instances
    function initPass() {
        document.querySelectorAll(CONTAINER).forEach(container => {
            const btn = container.querySelector(BTN_SEL);
            const dropdown = container.querySelector(DD_SEL);
            if (btn && dropdown) primeA11y(dropdown, btn);
        });
    }
    if (document.readyState !== 'loading') initPass();
    else document.addEventListener('DOMContentLoaded', initPass);
})();

// reCAPTCHA loader + timestamp updater
(function () {
    // Load the API once (only if not already present on the page)
    function loadRecaptcha() {
        if (window.grecaptcha || document.querySelector('script[src*="google.com/recaptcha/api.js"]')) return;
        var s = document.createElement('script');
        s.src = 'https://www.google.com/recaptcha/api.js';
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
    }

    // Mirror of your timestamp() with safety checks
    function updateCaptchaTimestamp() {
        var response = document.getElementById('g-recaptcha-response');
        if (response && response.value && response.value.trim() !== '') return;

        var settingsEl = document.getElementsByName('captcha_settings')[0];
        if (!settingsEl || !settingsEl.value) return;

        try {
            var json = JSON.parse(settingsEl.value);
            json.ts = String(Date.now());
            settingsEl.value = JSON.stringify(json);
        } catch (e) {
            // If the field isn't valid JSON yet, skip quietly.
        }
    }

    function start() {
        loadRecaptcha();
        // Only run the interval if the page actually has reCAPTCHA fields
        var hasCaptcha = document.getElementById('g-recaptcha-response') || document.getElementsByName('captcha_settings')[0];
        if (hasCaptcha) setInterval(updateCaptchaTimestamp, 500);
    }

    if (document.readyState !== 'loading') start();
    else document.addEventListener('DOMContentLoaded', start);
})();

document.addEventListener("DOMContentLoaded", function () {
    const swatches = document.querySelectorAll(".js-ic-swatch");

    swatches.forEach(swatch => {
        swatch.addEventListener("click", function (e) {
            const hex = getComputedStyle(swatch)
                .getPropertyValue("--color-hex")
                .replace(/"/g, "")
                .trim();

            if (!hex) return;

            navigator.clipboard.writeText(hex).then(() => {
                const msg = document.createElement("span");
                msg.className = "ic-copied-msg";
                msg.textContent = `Copied ${hex}!`;

                // Position relative to click inside swatch
                const rect = swatch.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                msg.style.left = `${x}px`;
                msg.style.top = `${y}px`;

                swatch.appendChild(msg);

                setTimeout(() => msg.remove(), 1500);
            });
        });
    });
});