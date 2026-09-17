import { onDomReady } from "../utils/on-dom-ready.js";

const GTGC_LEAD_FORM_SELECTOR = "[data-gtgc-lead-form]";

function isGtgcLeadFormElement(element) {
    return Boolean(element?.closest?.(GTGC_LEAD_FORM_SELECTOR));
}

function getGenericCaptchaSettings() {
    return Array.from(document.getElementsByName("captcha_settings"))
        .filter((element) => !isGtgcLeadFormElement(element));
}

function hasGenericRecaptchaMarkup() {
    const recaptchaWidgets = Array.from(document.querySelectorAll(".g-recaptcha"))
        .filter((element) => !isGtgcLeadFormElement(element));

    return recaptchaWidgets.length > 0 || getGenericCaptchaSettings().length > 0;
}

function loadRecaptcha() {
    if (!hasGenericRecaptchaMarkup()) {
        return;
    }

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

    const settingsElements = getGenericCaptchaSettings();
    if (!settingsElements.length) return;

    settingsElements.forEach((settingsElement) => {
        if (!settingsElement.value) return;

        try {
            const data = JSON.parse(settingsElement.value);
            data.ts = String(Date.now());
            settingsElement.value = JSON.stringify(data);
        } catch {
            // Skip quietly if the field isn't valid JSON yet.
        }
    });
}

function startRecaptcha() {
    if (!hasGenericRecaptchaMarkup()) {
        return;
    }

    loadRecaptcha();

    setInterval(updateCaptchaTimestamp, 500);
}

export function initRecaptcha() {
    onDomReady(startRecaptcha);
}
