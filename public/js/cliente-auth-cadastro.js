import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { showToast } from './utils.js';

const registerForm = document.getElementById('register-form');

if (registerForm) {
    const phoneInput = registerForm.phone;
    const cepInput = registerForm.cep;
    const submitButton = document.getElementById('register-submit');
    const cepStatus = document.getElementById('cep-status');

    const steps = [...document.querySelectorAll('.form-step')];
    const progressItems = [...document.querySelectorAll('.progress-item')];

    let currentStep = 1;

    const formatPhone = (value) => {
        let digits = (value || '').replace(/\D/g, '').slice(0, 11);

        if (digits.length > 10) {
            return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }

        if (digits.length > 6) {
            return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        }

        if (digits.length > 2) {
            return digits.replace(/(\d{2})(\d+)/, '($1) $2');
        }

        if (digits.length > 0) {
            return `(${digits}`;
        }

        return '';
    };

    const formatCep = (value) => {
        const digits = (value || '').replace(/\D/g, '').slice(0, 8);
        if (digits.length > 5) {
            return `${digits.slice(0, 5)}-${digits.slice(5)}`;
        }
        return digits;
    };

    const clearAddressFields = () => {
        registerForm.street.value = '';
        registerForm.neighborhood.value = '';
        registerForm.city.value = '';
        registerForm.state.value = '';
    };

    const setCepStatus = (message = '', type = '') => {
        cepStatus.textContent = message;
        cepStatus.className = 'field-status';

        if (type) {
            cepStatus.classList.add(`is-${type}`);
        }
    };

    const showStep = (stepNumber) => {
        currentStep = stepNumber;

        steps.forEach((step) => {
            step.classList.toggle(
                'is-active',
                Number(step.dataset.step) === stepNumber
            );
        });

        progressItems.forEach((item) => {
            const number = Number(item.dataset.progress);
            item.classList.toggle('is-active', number === stepNumber);
            item.classList.toggle('is-complete', number < stepNumber);
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const validateStep = (stepNumber) => {
        const step = steps.find(
            (item) => Number(item.dataset.step) === stepNumber
        );

        if (!step) return true;

        const fields = [...step.querySelectorAll('input')];

        for (const field of fields) {
            if (!field.checkValidity()) {
                field.reportValidity();
                field.focus();
                return false;
            }
        }

        if (stepNumber === 1) {
            const password = registerForm.password.value;
            const confirmPassword = registerForm.confirmPassword.value;

            if (password !== confirmPassword) {
                showToast('As senhas não coincidem. Tente novamente.', 'error');
                registerForm.confirmPassword.focus();
                return false;
            }
        }

        return true;
    };

    phoneInput.addEventListener('input', (event) => {
        event.target.value = formatPhone(event.target.value);
    });

    cepInput.addEventListener('input', async (event) => {
        const formatted = formatCep(event.target.value);
        event.target.value = formatted;

        setCepStatus('');

        if (formatted.replace(/\D/g, '').length !== 8) {
            clearAddressFields();
            return;
        }

        const cep = formatted.replace(/\D/g, '');

        registerForm.street.value = '';
        registerForm.neighborhood.value = '';
        registerForm.city.value = '';
        registerForm.state.value = '';

        registerForm.street.classList.add('is-loading');
        registerForm.neighborhood.classList.add('is-loading');
        registerForm.city.classList.add('is-loading');
        registerForm.state.classList.add('is-loading');

        registerForm.street.placeholder = 'Buscando endereço...';
        setCepStatus('Buscando...');

        try {
            const response = await fetch(
                `https://brasilapi.com.br/api/cep/v1/${cep}`
            );

            if (!response.ok) {
                throw new Error('CEP não encontrado.');
            }

            const data = await response.json();

            if (data.errors?.length) {
                throw new Error(data.errors[0].message);
            }

            registerForm.street.value = data.street || '';
            registerForm.neighborhood.value = data.neighborhood || '';
            registerForm.city.value = data.city || '';
            registerForm.state.value = data.state || '';

            setCepStatus('Encontrado', 'success');
            registerForm.number.focus();
        } catch (error) {
            clearAddressFields();
            setCepStatus('Não encontrado', 'error');
            showToast(error.message || 'Não foi possível consultar o CEP.', 'error');
        } finally {
            [
                registerForm.street,
                registerForm.neighborhood,
                registerForm.city,
                registerForm.state
            ].forEach((field) => field.classList.remove('is-loading'));

            registerForm.street.placeholder = 'Rua, avenida, estrada...';
        }
    });

    document.querySelectorAll('.next-step').forEach((button) => {
        button.addEventListener('click', () => {
            const nextStep = Number(button.dataset.next);

            if (validateStep(currentStep)) {
                showStep(nextStep);
            }
        });
    });

    document.querySelectorAll('.prev-step').forEach((button) => {
        button.addEventListener('click', () => {
            showStep(Number(button.dataset.prev));
        });
    });

    document.querySelectorAll('.password-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const target = document.getElementById(button.dataset.target);

            if (!target) return;

            const shouldShow = target.type === 'password';
            target.type = shouldShow ? 'text' : 'password';
            button.textContent = shouldShow ? 'Ocultar' : 'Mostrar';
            button.setAttribute(
                'aria-label',
                shouldShow ? 'Ocultar senha' : 'Mostrar senha'
            );
        });
    });

    registerForm.state.addEventListener('input', (event) => {
        event.target.value = event.target.value
            .replace(/[^a-zA-Z]/g, '')
            .slice(0, 2)
            .toUpperCase();
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!validateStep(1) || !validateStep(2)) {
            return;
        }

        const name = registerForm.name.value.trim();
        const phone = phoneInput.value.replace(/\D/g, '');
        const email = registerForm.email.value.trim();
        const password = registerForm.password.value;
        const cep = cepInput.value.replace(/\D/g, '');
        const street = registerForm.street.value.trim();
        const number = registerForm.number.value.trim();
        const complement = registerForm.complement.value.trim();
        const neighborhood = registerForm.neighborhood.value.trim();
        const city = registerForm.city.value.trim();
        const state = registerForm.state.value.trim().toUpperCase();

        submitButton.disabled = true;
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Criando sua conta...';

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            await setDoc(doc(db, 'users', user.uid), {
                name,
                phone,
                email,
                address: {
                    cep,
                    street,
                    number,
                    complement,
                    neighborhood,
                    city,
                    state
                }
            });

            await setDoc(doc(db, 'roles', user.uid), {
                client: true
            });

            showToast(
                'Conta criada com sucesso! Redirecionando...',
                'success'
            );

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2500);
        } catch (error) {
            let message = 'Ocorreu um erro ao criar a sua conta.';

            if (error.code === 'auth/email-already-in-use') {
                message = 'Este e-mail já está sendo utilizado.';
            } else if (error.code === 'auth/weak-password') {
                message = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Informe um e-mail válido.';
            } else if (error.code === 'auth/network-request-failed') {
                message = 'Não foi possível conectar ao servidor. Verifique sua internet.';
            }

            showToast(message, 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}
