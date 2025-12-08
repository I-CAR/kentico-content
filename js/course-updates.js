document.addEventListener('DOMContentLoaded', function () {
    const newCoursesSwiper = new Swiper('.js-ic-swiper-courses', {
        loop: false,
        spaceBetween: 0,
        grabCursor: true,
        slidesPerView: 1.25,

        breakpoints: {
            576: {
                slidesPerView: 2,
                spaceBetween: 22,
            },
            768: {
                slidesPerView: 3,
                spaceBetween: 22,
            },
            1200: {
                slidesPerView: 4,
                spaceBetween: 22,
            },
        },

        navigation: {
            nextEl: '.js-ic-swiper-nav-next',
            prevEl: '.js-ic-swiper-nav-prev',
        },

        keyboard: {
            enabled: true,
        },
    });
});
