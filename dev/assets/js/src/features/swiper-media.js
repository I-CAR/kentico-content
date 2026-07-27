import Swiper from "swiper";
import { Autoplay, Keyboard, Pagination } from "swiper/modules";
import { onDomReady } from "../utils/on-dom-ready.js";

function initMediaSwiperInstance() {
    const mediaSwiperElement = document.querySelector(".js-ic-swiper-media");

    if (!mediaSwiperElement) return;

    new Swiper(".js-ic-swiper-media", {
        modules: [Autoplay, Keyboard, Pagination],
        loop: true,
        speed: 600,
        spaceBetween: 0,
        slidesPerView: 1,
        autoHeight: true,
        observer: true,
        observeParents: true,
        pagination: {
            el: ".js-ic-swiper-media .swiper-pagination",
            clickable: true,
        },
        autoplay: {
            delay: 4000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
        },
        keyboard: {
            enabled: true,
        },
    });
}

export function initMediaSwiper() {
    onDomReady(initMediaSwiperInstance);
}
