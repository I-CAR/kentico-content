import Swiper from "swiper";
import { Keyboard, Navigation } from "swiper/modules";
import { onDomReady } from "../utils/on-dom-ready.js";

function initDefaultSwiperInstance() {
    if (!document.querySelector(".js-ic-swiper")) return;

    new Swiper(".js-ic-swiper", {
        modules: [Keyboard, Navigation],
        loop: false,
        spaceBetween: 0,
        grabCursor: true,
        slidesPerView: 1.25,
        breakpoints: {
            576: {
                slidesPerView: 2,
            },
            1024: {
                slidesPerView: 3,
            },
            1440: {
                slidesPerView: 4,
            },
        },
        navigation: {
            nextEl: ".js-ic-swiper-nav-next",
            prevEl: ".js-ic-swiper-nav-prev",
        },
        keyboard: {
            enabled: true,
        },
    });
}

export function initDefaultSwiper() {
    onDomReady(initDefaultSwiperInstance);
}
