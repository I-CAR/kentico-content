import { onDomReady } from "../utils/on-dom-ready.js";

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

export function initSwatchCopy() {
    onDomReady(initSwatches);
}
