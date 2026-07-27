function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, ''); // Remove non-numeric characters
    if (value.length > 3 && value.length <= 6) {
        input.value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    } else if (value.length > 6) {
        input.value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
    } else {
        input.value = value;
    }
}

const leadForm = document.getElementById('leadForm');

if (leadForm) {

    const phoneInput = document.getElementById('leadFormPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            formatPhoneNumber(e.target);
        });
    }

    leadForm.addEventListener('submit', function (event) {
        const submitButton = document.getElementById('leadFormSubmit');

        if (submitButton) {
            submitButton.innerText = 'Submitting your request...';

            setTimeout(() => {
                const defaultView = document.querySelector('.default-view');
                const successView = document.querySelector('.success-view');
                if (defaultView && successView) {
                    defaultView.style.display = 'none';
                    successView.style.display = 'block';
                }
                leadForm.reset();
                submitButton.innerText = 'Request Information';
            }, 1000);
        }
    });
}