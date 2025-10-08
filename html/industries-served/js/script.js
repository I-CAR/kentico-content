function toggleLinks() {
    const section = document.querySelector('.section_hero');
    const dropdown = section.querySelector('.dropdown');
    if (section.classList.contains('dropdown-open')) {
        section.classList.remove('dropdown-open');
    } else {
        section.classList.add('dropdown-open');
    }
    if (dropdown.classList.contains('-hidden')) {
        dropdown.classList.remove('-hidden');
    } else {
        dropdown.classList.add('-hidden');
    }
}