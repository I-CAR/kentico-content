import { onDomReady } from "../utils/on-dom-ready.js";

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
        // Skip quietly if the field isn't valid JSON yet.
    }
}

function startRecaptcha() {
    loadRecaptcha();

    const hasCaptcha =
        document.getElementById("g-recaptcha-response") ||
        document.getElementsByName("captcha_settings")[0];

    if (hasCaptcha) {
        setInterval(updateCaptchaTimestamp, 500);
    }
}

export function initRecaptcha() {
    onDomReady(startRecaptcha);
}
