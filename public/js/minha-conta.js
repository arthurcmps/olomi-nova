import { auth, db } from './firebase.js';

import {
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import {
    BRL,
    showToast
} from './utils.js';


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

const loadingSpinner = `
    <div class="account-loading">
        <div class="spinner"></div>
    </div>
`;


function escapeHtml(value) {

    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function formatPhone(value) {

    const numbers = String(value || '')
        .replace(/\D/g, '')
        .slice(0, 11);

    if (numbers.length <= 10) {

        return numbers
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2');

    }

    return numbers
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
}


function formatCep(value) {

    const numbers = String(value || '')
        .replace(/\D/g, '')
        .slice(0, 8);

    return numbers.replace(
        /^(\d{5})(\d)/,
        '$1-$2'
    );
}


function getStatusInfo(status) {

    switch (status) {

        case 'pending':
            return {
                text: 'Pendente',
                className: 'pending'
            };

        case 'paid':
            return {
                text: 'Pago',
                className: 'paid'
            };

        case 'shipped':
            return {
                text: 'Enviado',
                className: 'shipped'
            };

        case 'cancelled':
            return {
                text: 'Cancelado',
                className: 'cancelled'
            };

        default:
            return {
                text: status || 'Em análise',
                className: 'default'
            };

    }
}


/* =========================================================
   DADOS DO USUÁRIO
   ========================================================= */

async function loadUserData(user, container) {

    if (!container) {
        return;
    }

    container.innerHTML = loadingSpinner;


    try {

        const userRef = doc(
            db,
            'users',
            user.uid
        );

        const docSnap = await getDoc(userRef);


        if (!docSnap.exists()) {

            container.innerHTML = `
                <div class="account-error">
                    Não foi possível encontrar os dados
                    da sua conta.
                </div>
            `;

            return;
        }


        const data = docSnap.data();


        container.innerHTML = `

            <form
                id="user-details-form"
            >

                <fieldset class="account-fieldset">

                    <legend>
                        Dados pessoais
                    </legend>

                    <div class="account-form-grid">

                        <div class="account-field full">

                            <label for="account-name">
                                Nome completo
                            </label>

                            <input
                                id="account-name"
                                name="name"
                                type="text"
                                value="${escapeHtml(data.name || '')}"
                                autocomplete="name"
                                required
                            />

                        </div>


                        <div class="account-field">

                            <label for="account-phone">
                                Telefone / WhatsApp
                            </label>

                            <input
                                id="account-phone"
                                name="phone"
                                type="tel"
                                value="${escapeHtml(data.phone || '')}"
                                autocomplete="tel"
                                required
                            />

                        </div>


                        <div class="account-field">

                            <label for="account-email">
                                E-mail
                            </label>

                            <input
                                id="account-email"
                                type="email"
                                value="${escapeHtml(user.email || '')}"
                                autocomplete="email"
                                disabled
                            />

                        </div>

                    </div>

                </fieldset>


                <fieldset class="account-fieldset">

                    <legend>
                        Endereço de entrega
                    </legend>

                    <div class="account-form-grid">

                        <div class="account-field">

                            <label for="account-cep">
                                CEP
                            </label>

                            <input
                                id="account-cep"
                                name="cep"
                                type="text"
                                value="${escapeHtml(data.address?.cep || '')}"
                                autocomplete="postal-code"
                                maxlength="9"
                                required
                            />

                        </div>


                        <div class="account-field">

                            <label for="account-number">
                                Número
                            </label>

                            <input
                                id="account-number"
                                name="number"
                                type="text"
                                value="${escapeHtml(data.address?.number || '')}"
                                autocomplete="address-line2"
                                required
                            />

                        </div>


                        <div class="account-field full">

                            <label for="account-street">
                                Rua / Logradouro
                            </label>

                            <input
                                id="account-street"
                                name="street"
                                type="text"
                                value="${escapeHtml(data.address?.street || '')}"
                                autocomplete="street-address"
                                required
                            />

                        </div>


                        <div class="account-field">

                            <label for="account-complement">
                                Complemento
                            </label>

                            <input
                                id="account-complement"
                                name="complement"
                                type="text"
                                value="${escapeHtml(data.address?.complement || '')}"
                                placeholder="Opcional"
                                autocomplete="address-line2"
                            />

                        </div>


                        <div class="account-field">

                            <label for="account-neighborhood">
                                Bairro
                            </label>

                            <input
                                id="account-neighborhood"
                                name="neighborhood"
                                type="text"
                                value="${escapeHtml(data.address?.neighborhood || '')}"
                                autocomplete="address-level3"
                                required
                            />

                        </div>


                        <div class="account-field">

                            <label for="account-city">
                                Cidade
                            </label>

                            <input
                                id="account-city"
                                name="city"
                                type="text"
                                value="${escapeHtml(data.address?.city || '')}"
                                autocomplete="address-level2"
                                required
                            />

                        </div>


                        <div class="account-field">

                            <label for="account-state">
                                Estado
                            </label>

                            <input
                                id="account-state"
                                name="state"
                                type="text"
                                value="${escapeHtml(data.address?.state || '')}"
                                autocomplete="address-level1"
                                required
                            />

                        </div>

                    </div>

                </fieldset>


                <button
                    type="submit"
                    class="account-submit"
                >
                    Salvar alterações
                </button>

            </form>

        `;


        const form = document.getElementById(
            'user-details-form'
        );


        if (!form) {
            return;
        }


        form.addEventListener(
            'submit',
            handleUpdateUserData
        );


        const phoneInput =
            form.querySelector('[name="phone"]');

        if (phoneInput) {

            phoneInput.addEventListener(
                'input',
                () => {
                    phoneInput.value =
                        formatPhone(phoneInput.value);
                }
            );

        }


        const cepInput =
            form.querySelector('[name="cep"]');

        if (cepInput) {

            cepInput.addEventListener(
                'input',
                () => {
                    cepInput.value =
                        formatCep(cepInput.value);
                }
            );

            cepInput.addEventListener(
                'blur',
                handleCepBlur
            );

        }


    } catch (error) {

        console.error(
            "Erro ao carregar dados do utilizador:",
            error
        );

        container.innerHTML = `
            <div class="account-error">
                Ocorreu um erro ao carregar os seus dados.
                Tente novamente mais tarde.
            </div>
        `;

    }

}


/* =========================================================
   ATUALIZAR DADOS
   ========================================================= */

async function handleUpdateUserData(event) {

    event.preventDefault();


    const form = event.target;

    const user = auth.currentUser;


    if (!user) {

        showToast(
            'Sua sessão expirou. Faça login novamente.',
            'error'
        );

        return;
    }


    const button =
        form.querySelector(
            'button[type="submit"]'
        );


    if (!button) {
        return;
    }


    button.disabled = true;

    button.textContent =
        'Salvando alterações...';


    const data =
        Object.fromEntries(
            new FormData(form).entries()
        );


    const userRef =
        doc(
            db,
            'users',
            user.uid
        );


    try {

        await updateDoc(
            userRef,
            {

                name: data.name,

                phone: data.phone,

                address: {

                    cep: data.cep,

                    street: data.street,

                    number: data.number,

                    complement:
                        data.complement,

                    neighborhood:
                        data.neighborhood,

                    city: data.city,

                    state: data.state

                }

            }
        );


        showToast(
            'Dados atualizados com sucesso!',
            'success'
        );


    } catch (error) {

        console.error(
            'Erro ao atualizar dados:',
            error
        );


        showToast(
            'Ocorreu um erro ao atualizar os seus dados.',
            'error'
        );


    } finally {

        button.disabled = false;

        button.textContent =
            'Salvar alterações';

    }

}


/* =========================================================
   BUSCA CEP
   ========================================================= */

async function handleCepBlur(event) {

    const form =
        event.target.closest('form');


    if (!form) {
        return;
    }


    const cep =
        event.target.value
            .replace(/\D/g, '');


    if (cep.length !== 8) {
        return;
    }


    const street =
        form.querySelector('[name="street"]');

    const neighborhood =
        form.querySelector('[name="neighborhood"]');

    const city =
        form.querySelector('[name="city"]');

    const state =
        form.querySelector('[name="state"]');


    street.value = 'Consultando...';

    neighborhood.value = 'Consultando...';

    city.value = 'Consultando...';

    state.value = '...';


    try {

        const response =
            await fetch(
                `https://viacep.com.br/ws/${cep}/json/`
            );


        if (!response.ok) {

            throw new Error(
                'Erro na consulta do CEP.'
            );

        }


        const data =
            await response.json();


        if (data.erro) {

            showToast(
                'CEP não encontrado.',
                'error'
            );


            street.value = '';

            neighborhood.value = '';

            city.value = '';

            state.value = '';

            return;
        }


        street.value =
            data.logradouro || '';

        neighborhood.value =
            data.bairro || '';

        city.value =
            data.localidade || '';

        state.value =
            data.uf || '';


        const numberInput =
            form.querySelector(
                '[name="number"]'
            );


        if (numberInput) {
            numberInput.focus();
        }


    } catch (error) {

        console.error(
            'Erro ao buscar CEP:',
            error
        );


        showToast(
            'Erro ao consultar o CEP.',
            'error'
        );


        street.value = '';

        neighborhood.value = '';

        city.value = '';

        state.value = '';

    }

}


/* =========================================================
   HISTÓRICO DE PEDIDOS
   ========================================================= */

async function loadOrderHistory(
    user,
    container
) {

    if (!container) {
        return;
    }


    container.innerHTML =
        loadingSpinner;


    const q = query(

        collection(
            db,
            'orders'
        ),

        where(
            'userId',
            '==',
            user.uid
        ),

        orderBy(
            'createdAt',
            'desc'
        )

    );


    try {

        const querySnapshot =
            await getDocs(q);


        if (querySnapshot.empty) {

            container.innerHTML = `

                <div class="account-empty">

                    <strong>
                        Ainda não há pedidos.
                    </strong>

                    <span>
                        Quando você fizer sua primeira compra,
                        ela aparecerá aqui.
                    </span>

                </div>

            `;

            return;
        }


        container.innerHTML = '';


        querySnapshot.forEach(
            (orderDoc) => {

                const order =
                    orderDoc.data();


                const orderDate =
                    order.createdAt?.toDate
                        ? order.createdAt
                            .toDate()
                            .toLocaleDateString(
                                'pt-BR'
                            )
                        : 'Data pendente';


                const status =
                    getStatusInfo(
                        order.status
                    );


                const items =
                    Array.isArray(
                        order.items
                    )
                        ? order.items
                        : [];


                const itemsHtml =
                    items
                        .map(
                            (item) => {

                                const qty =
                                    Number(
                                        item.qty
                                    ) || 0;

                                const name =
                                    escapeHtml(
                                        item.name ||
                                        'Produto'
                                    );


                                return `
                                    <li>
                                        ${qty}x ${name}
                                    </li>
                                `;

                            }
                        )
                        .join('');


                let paymentButton =
                    '';


                if (

                    order.status === 'pending' &&

                    typeof order.paymentUrl === 'string' &&

                    /^https?:\/\//i.test(
                        order.paymentUrl
                    )

                ) {

                    paymentButton = `

                        <a
                            href="${escapeHtml(order.paymentUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="order-payment-link"
                        >
                            Pagar agora
                        </a>

                    `;

                }


                const orderElement =
                    document.createElement(
                        'div'
                    );


                orderElement.className =
                    'order-item';


                orderElement.innerHTML = `

                    <div class="order-item-header">

                        <span class="order-id">
                            Pedido #${escapeHtml(
                                orderDoc.id.substring(
                                    0,
                                    6
                                )
                            )}
                        </span>


                        <span
                            class="order-status-badge ${status.className}"
                        >
                            ${escapeHtml(
                                status.text
                            )}
                        </span>

                    </div>


                    <div class="order-details">

                        <p>
                            <strong>
                                Data:
                            </strong>

                            ${escapeHtml(
                                orderDate
                            )}
                        </p>


                        <p>
                            <strong>
                                Total:
                            </strong>

                            ${BRL(
                                Number(
                                    order.total
                                ) || 0
                            )}
                        </p>


                        ${paymentButton}

                    </div>


                    ${
                        itemsHtml
                            ? `
                                <div
                                    class="order-items-list"
                                >

                                    <strong>
                                        Itens:
                                    </strong>

                                    <ul>
                                        ${itemsHtml}
                                    </ul>

                                </div>
                            `
                            : ''
                    }

                `;


                container.appendChild(
                    orderElement
                );

            }
        );


    } catch (error) {

        console.error(
            'Erro ao carregar o histórico de pedidos:',
            error
        );


        container.innerHTML = `

            <div class="account-error">

                Ocorreu um erro ao carregar
                o seu histórico de pedidos.

            </div>

        `;

    }

}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

export function initMinhaContaPage(user) {

    const userDetailsContent =
        document.getElementById(
            'user-details-content'
        );


    const orderHistoryList =
        document.getElementById(
            'order-history-list'
        );


    if (user) {

        loadUserData(
            user,
            userDetailsContent
        );


        loadOrderHistory(
            user,
            orderHistoryList
        );

    } else {

        if (userDetailsContent) {

            userDetailsContent.innerHTML = `

                <div class="account-error">
                    Você precisa estar autenticado
                    para acessar esta página.
                </div>

            `;

        }


        if (orderHistoryList) {

            orderHistoryList.innerHTML = '';

        }

    }

}