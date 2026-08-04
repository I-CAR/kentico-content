import { onDomReady } from "../utils/on-dom-ready.js";

function initRuntimeIframeEmbedsInstance() {
    document.querySelectorAll("[data-runtime-iframe-embed][data-iframe-src]").forEach((container) => {
        if (container.dataset.iframeEmbedInitialized === "true") {
            return;
        }

        const src = container.dataset.iframeSrc?.trim();
        if (!src) {
            return;
        }

        container.className = "mx-auto mt-md-4 pt-md-1";

        const title = container.dataset.iframeTitle?.trim() || "Embedded video";
        const ratioBox = container.firstElementChild instanceof HTMLDivElement
            ? container.firstElementChild
            : document.createElement("div");

        if (ratioBox.parentElement !== container) {
            ratioBox.style.cssText = "width: 100%; padding-top: 56.25%;";
            container.replaceChildren(ratioBox);
        }

        const iframe = document.createElement("iframe");
        iframe.className = "ic-rounded";
        iframe.src = src;
        iframe.title = title;
        iframe.loading = "lazy";
        iframe.allow = "encrypted-media; fullscreen";
        iframe.style.cssText = "width: 100%; position: absolute; top: 0px; right: 0px; bottom: 0px; left: 0px; height: 100%; border: 0;";

        ratioBox.appendChild(iframe);
        container.dataset.iframeEmbedInitialized = "true";
    });
}

export function initRuntimeIframeEmbeds() {
    onDomReady(initRuntimeIframeEmbedsInstance);
}
