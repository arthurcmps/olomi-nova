import { auth, db } from './firebase.js';

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';

import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

import {
    showToast
} from './utils.js';


const loginForm =
    document.getElementById('login-form');

const resetPasswordLink =
    document.getElementById('reset-password-link');


// ==========================================
// LOGIN ADMINISTRATIVO
// ==========================================

if (loginForm) {

    loginForm.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();

            const email =
                loginForm.email.value.trim();

            const password =
                loginForm.password.value;

            const submitButton =
                loginForm.querySelector(
                    'button[type="submit"]'
                );


            // ======================================
            // VALIDAÇÃO BÁSICA
            // ======================================

            if (!email || !password) {

                showToast(
                    'Informe seu e-mail e sua senha.',
                    'error'
                );

                return;
            }


            // ======================================
            // ESTADO DE CARREGAMENTO
            // ======================================

            if (submitButton) {

                submitButton.disabled = true;

                submitButton.classList.add(
                    'is-loading'
                );
            }


            try {

                // ==================================
                // AUTENTICAÇÃO FIREBASE
                // ==================================

                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                const user =
                    userCredential.user;


                // ==================================
                // VERIFICAÇÃO DO PAPEL
                // ==================================

                const roleRef =
                    doc(
                        db,
                        'roles',
                        user.uid
                    );

                const roleSnap =
                    await getDoc(roleRef);


                const isAdmin =
                    roleSnap.exists() &&
                    roleSnap.data()?.admin === true;


                // ==================================
                // NÃO É ADMIN
                // ==================================

                if (!isAdmin) {

                    await signOut(auth);

                    throw new Error(
                        'ACESSO_NAO_AUTORIZADO'
                    );
                }


                // ==================================
                // ADMINISTRADOR AUTORIZADO
                // ==================================

                window.location.href =
                    'admin.html';

            } catch (error) {

                console.error(
                    'Erro no login administrativo:',
                    error
                );


                let message =
                    'Não foi possível entrar. Verifique seu e-mail e sua senha.';


                if (
                    error?.message ===
                    'ACESSO_NAO_AUTORIZADO'
                ) {

                    message =
                        'Esta conta não possui permissão de administrador.';

                } else if (
                    error?.code ===
                    'auth/invalid-credential'
                ) {

                    message =
                        'E-mail ou senha inválidos.';

                } else if (
                    error?.code ===
                    'auth/user-disabled'
                ) {

                    message =
                        'Esta conta está desativada.';

                } else if (
                    error?.code ===
                    'auth/too-many-requests'
                ) {

                    message =
                        'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.';

                } else if (
                    error?.code ===
                    'auth/network-request-failed'
                ) {

                    message =
                        'Não foi possível conectar ao Firebase. Verifique sua conexão.';
                }


                showToast(
                    message,
                    'error'
                );


                // ==================================
                // RESTAURA BOTÃO
                // ==================================

                if (submitButton) {

                    submitButton.disabled = false;

                    submitButton.classList.remove(
                        'is-loading'
                    );
                }
            }
        }
    );
}


// ==========================================
// RECUPERAÇÃO DE SENHA
// ==========================================

if (resetPasswordLink) {

    resetPasswordLink.addEventListener(
        'click',
        async (event) => {

            event.preventDefault();


            const result =
                await Swal.fire({

                    title: 'Recuperar senha',

                    input: 'email',

                    inputLabel:
                        'Informe o e-mail da conta administrativa.',

                    inputPlaceholder:
                        'admin@exemplo.com',

                    inputAttributes: {
                        autocomplete: 'email'
                    },

                    showCancelButton: true,

                    confirmButtonText:
                        'Enviar link',

                    cancelButtonText:
                        'Cancelar',

                    confirmButtonColor:
                        '#351313',

                    cancelButtonColor:
                        '#74685f'
                });


            const email =
                result.value?.trim();


            if (!email) {
                return;
            }


            try {

                await sendPasswordResetEmail(
                    auth,
                    email
                );


                showToast(
                    'Link de redefinição enviado para o e-mail informado.',
                    'success'
                );

            } catch (error) {

                console.error(
                    'Erro ao enviar redefinição de senha:',
                    error
                );


                showToast(
                    'Não foi possível enviar o e-mail de redefinição.',
                    'error'
                );
            }
        }
    );
}