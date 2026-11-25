import { auth, db } from './firebase.js';

import {
    collection,
    doc,
    getDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

import {
    BRL
} from './utils.js';


/* =========================================================
   ELEMENTOS
   ========================================================= */

const loadingEl =
    document.getElementById('admin-loading');

const appEl =
    document.getElementById('admin-app');

const accessDeniedEl =
    document.getElementById('access-denied');

const adminUserNameEl =
    document.getElementById('admin-user-name');

const adminUserEmailEl =
    document.getElementById('admin-user-email');

const adminUserInitialEl =
    document.getElementById('admin-user-initial');

const pageTitleEl =
    document.getElementById('page-title');

const sidebarEl =
    document.getElementById('admin-sidebar');

const sidebarToggleEl =
    document.getElementById('sidebar-toggle');

const logoutButtonEl =
    document.getElementById('admin-logout');

const deniedLogoutEl =
    document.getElementById('denied-logout');

const refreshDashboardEl =
    document.getElementById('refresh-dashboard');

const productsLoadingEl =
    document.getElementById('products-loading');

const productsEmptyEl =
    document.getElementById('products-empty');

const productsTableWrapperEl =
    document.getElementById('products-table-wrapper');

const productsTableBodyEl =
    document.getElementById('products-table-body');

const productsSearchEl =
    document.getElementById('products-search');

const refreshProductsEl =
    document.getElementById('refresh-products');

const productEditorEl =
    document.getElementById('product-editor');

const productFormEl =
    document.getElementById('product-form');

const productIdEl =
    document.getElementById('product-id');

const productNameEl =
    document.getElementById('product-name');

const productCategoryEl =
    document.getElementById('product-category');

const productPriceEl =
    document.getElementById('product-price');

const productPromotionalPriceEl =
    document.getElementById('product-promotional-price');

const productStockEl =
    document.getElementById('product-stock');

const productWeightEl =
    document.getElementById('product-weight');

const productDescriptionEl =
    document.getElementById('product-description');

const cancelProductEditEl =
    document.getElementById('cancel-product-edit');


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function formatCurrency(value) {

    const number =
        Number(value) || 0;

    return BRL(number);

}


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

}


function getInitial(name, email) {

    const source =
        String(name || email || 'A')
            .trim();

    if (!source) {
        return 'A';
    }

    return source
        .charAt(0)
        .toUpperCase();

}


function formatDate(timestamp) {

    if (!timestamp) {
        return 'Data pendente';
    }


    try {

        let date;


        if (
            typeof timestamp.toDate === 'function'
        ) {

            date =
                timestamp.toDate();

        } else {

            date =
                new Date(timestamp);

        }


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return 'Data pendente';
        }


        return date.toLocaleDateString(
            'pt-BR'
        );

    } catch (error) {

        return 'Data pendente';

    }

}


function getStatusInfo(status) {

    switch (status) {

        case 'pending':

            return {
                text: 'Pendente',
                className: 'status-pending'
            };


        case 'paid':

            return {
                text: 'Pago',
                className: 'status-paid'
            };


        case 'shipped':

            return {
                text: 'Enviado',
                className: 'status-shipped'
            };


        case 'cancelled':

            return {
                text: 'Cancelado',
                className: 'status-cancelled'
            };


        default:

            return {
                text: status || 'Em análise',
                className: 'status-default'
            };

    }

}


/* =========================================================
   ACCESSO ADMIN
   ========================================================= */

async function checkAdminAccess(user) {

    if (!user) {

        showAccessDenied();

        return false;

    }


    try {

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


        if (!isAdmin) {

            showAccessDenied();

            return false;

        }


        return true;

    } catch (error) {

        console.error(
            'Erro ao verificar permissão administrativa:',
            error
        );


        showAccessDenied();

        return false;

    }

}


function showAccessDenied() {

    if (loadingEl) {
        loadingEl.hidden = true;
    }


    if (appEl) {
        appEl.hidden = true;
    }


    if (accessDeniedEl) {
        accessDeniedEl.hidden = false;
    }

}


/* =========================================================
   IDENTIDADE DO ADMIN
   ========================================================= */

function populateAdminUser(user) {

    if (!user) {
        return;
    }


    const displayName =
        user.displayName ||
        'Administrador';


    if (adminUserNameEl) {

        adminUserNameEl.textContent =
            displayName;

    }


    if (adminUserEmailEl) {

        adminUserEmailEl.textContent =
            user.email || '—';

    }


    if (adminUserInitialEl) {

        adminUserInitialEl.textContent =
            getInitial(
                displayName,
                user.email
            );

    }

}


/* =========================================================
   CARREGAMENTO DO DASHBOARD
   ========================================================= */

async function loadDashboard() {

    const [
        productsSnapshot,
        ordersSnapshot,
        usersSnapshot
    ] = await Promise.all([

        getDocs(
            collection(
                db,
                'products'
            )
        ),

        getDocs(
            collection(
                db,
                'orders'
            )
        ),

        getDocs(
            collection(
                db,
                'users'
            )
        )

    ]);


    const products =
        productsSnapshot.docs.map(
            document => ({
                id: document.id,
                ...document.data()
            })
        );


    const orders =
        ordersSnapshot.docs.map(
            document => ({
                id: document.id,
                ...document.data()
            })
        );


    const users =
        usersSnapshot.docs.map(
            document => ({
                id: document.id,
                ...document.data()
            })
        );


    updateProductStats(products);

    updateOrderStats(orders);

    updateCustomerStats(users);

    renderRecentOrders(orders);

}

/* =========================================================
   PRODUTOS — ESTATÍSTICAS
   ========================================================= */

function updateProductStats(products) {

    const total =
        products.length;


    const active =
        products.filter(
            product => {

                if (
                    product.active === false
                ) {
                    return false;
                }

                if (
                    product.status === 'inactive'
                ) {
                    return false;
                }

                return true;

            }
        ).length;


    const inactive =
        total - active;


    const totalEl =
        document.getElementById(
            'stat-products'
        );


    const activeEl =
        document.getElementById(
            'summary-active-products'
        );


    const inactiveEl =
        document.getElementById(
            'summary-inactive-products'
        );


    if (totalEl) {

        totalEl.textContent =
            String(total);

    }


    if (activeEl) {

        activeEl.textContent =
            String(active);

    }


    if (inactiveEl) {

        inactiveEl.textContent =
            String(inactive);

    }

}


/* =========================================================
   GESTÃO DE PRODUTOS
   ========================================================= */

let adminProducts = [];


async function loadProducts() {

    if (!productsTableBodyEl) {
        return;
    }


    if (productsLoadingEl) {
        productsLoadingEl.hidden = false;
    }

    if (productsEmptyEl) {
        productsEmptyEl.hidden = true;
    }

    if (productsTableWrapperEl) {
        productsTableWrapperEl.hidden = true;
    }


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    'products'
                )
            );


        adminProducts =
            snapshot.docs.map(
                document => ({
                    id: document.id,
                    ...document.data()
                })
            );


        renderProductsTable(
            adminProducts
        );

    } catch (error) {

        console.error(
            'Erro ao carregar produtos:',
            error
        );


        if (productsLoadingEl) {
            productsLoadingEl.hidden = true;
        }


        if (productsEmptyEl) {
            productsEmptyEl.hidden = false;

            productsEmptyEl.textContent =
                'Não foi possível carregar os produtos.';
        }

    }

}


function renderProductsTable(products) {

    if (!productsTableBodyEl) {
        return;
    }


    if (productsLoadingEl) {
        productsLoadingEl.hidden = true;
    }


    if (!products.length) {

        productsTableBodyEl.innerHTML = '';

        if (productsTableWrapperEl) {
            productsTableWrapperEl.hidden = true;
        }

        if (productsEmptyEl) {
            productsEmptyEl.hidden = false;
            productsEmptyEl.textContent =
                'Nenhum produto cadastrado.';
        }

        return;

    }


    if (productsEmptyEl) {
        productsEmptyEl.hidden = true;
    }


    if (productsTableWrapperEl) {
        productsTableWrapperEl.hidden = false;
    }


    productsTableBodyEl.innerHTML =
        products.map(product => {

            const price =
                Number(
                    product.price || 0
                );


            const promotionalPrice =
                Number(
                    product.promotionalPrice || 0
                );


            const hasPromotion =
                promotionalPrice > 0 &&
                promotionalPrice < price;


            const stock =
                Number(
                    product.stock || 0
                );


            const isActive =
                product.active !== false &&
                product.status !== 'inactive';


            const statusClass =
                isActive
                    ? 'status-active'
                    : 'status-inactive';


            const statusText =
                isActive
                    ? 'Ativo'
                    : 'Inativo';


            const imageUrl =
                product.imageUrls &&
                product.imageUrls.length
                    ? product.imageUrls[0]
                    : '';


            const imageHtml =
                imageUrl
                    ? `
                        <img
                            src="${escapeHTML(imageUrl)}"
                            alt="${escapeHTML(product.name || 'Produto')}"
                            class="product-table-image"
                            loading="lazy"
                        >
                    `
                    : `
                        <div class="product-table-image product-table-image-placeholder">
                            ◇
                        </div>
                    `;


            const priceHtml =
                hasPromotion
                    ? `
                        <div class="product-price-cell">

                            <span class="product-old-price">
                                ${formatCurrency(price)}
                            </span>

                            <strong>
                                ${formatCurrency(
                                    promotionalPrice
                                )}
                            </strong>

                        </div>
                    `
                    : `
                        <strong>
                            ${formatCurrency(price)}
                        </strong>
                    `;


            return `

                <tr>

                    <td>

                        <div class="product-table-name">

                            ${imageHtml}

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        product.name ||
                                        'Produto sem nome'
                                    )}
                                </strong>

                                <span>
                                    ID: ${escapeHTML(
                                        product.id
                                    )}
                                </span>

                            </div>

                        </div>

                    </td>


                    <td>
                        ${escapeHTML(
                            product.category ||
                            'Sem categoria'
                        )}
                    </td>


                    <td>
                        ${priceHtml}
                    </td>


                    <td>

                        <span
                            class="stock-value ${
                                stock <= 0
                                    ? 'stock-empty'
                                    : ''
                            }"
                        >
                            ${stock}
                        </span>

                    </td>


                    <td>

                        <span
                            class="status-badge ${
                                statusClass
                            }"
                        >
                            ${statusText}
                        </span>

                    </td>


                    <td>

                        <div class="table-actions">
                            
                            <button
                                type="button"
                                class="table-action-button"
                                data-product-action="edit"
                                data-product-id="${escapeHTML(
                                    product.id
                                )}"
                            >
                                Editar
                            </button>

                        </div>

                    </td>

                </tr>

            `;

        }).join('');

}

function openProductEditor(productId) {

    const product = adminProducts.find(
        item => item.id === productId
    );

    if (!product) {
        console.error(
            'Produto não encontrado:',
            productId
        );
        return;
    }

    if (!productEditorEl) {
        return;
    }

    productIdEl.value = product.id;

    productNameEl.value =
        product.name || '';

    productCategoryEl.value =
        product.category || '';

    productPriceEl.value =
        product.price ?? '';

    productPromotionalPriceEl.value =
        product.promotionalPrice ?? '';

    productStockEl.value =
        product.stock ?? 0;

    productWeightEl.value =
        product.weight ?? '';

    productDescriptionEl.value =
        product.description || '';

    productEditorEl.hidden = false;

    productEditorEl.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function filterAdminProducts() {

    if (!productsSearchEl) {
        return;
    }


    const term =
        productsSearchEl.value
            .trim()
            .toLowerCase();


    if (!term) {

        renderProductsTable(
            adminProducts
        );

        return;

    }


    const filtered =
        adminProducts.filter(
            product => {

                const name =
                    String(
                        product.name || ''
                    ).toLowerCase();


                const category =
                    String(
                        product.category || ''
                    ).toLowerCase();


                return (
                    name.includes(term) ||
                    category.includes(term)
                );

            }
        );


    renderProductsTable(
        filtered
    );

}

if (productsSearchEl) {

    productsSearchEl.addEventListener(
        'input',
        filterAdminProducts
    );

}

if (productsTableBodyEl) {

    productsTableBodyEl.addEventListener(
        'click',
        event => {

            const button =
                event.target.closest(
                    '[data-product-action="edit"]'
                );

            if (!button) {
                return;
            }

            const productId =
                button.dataset.productId;

            openProductEditor(productId);
        }
    );
}

if (cancelProductEditEl) {

    cancelProductEditEl.addEventListener(
        'click',
        () => {

            if (productEditorEl) {
                productEditorEl.hidden = true;
            }

            if (productFormEl) {
                productFormEl.reset();
            }
        }
    );
}


if (refreshProductsEl) {

    refreshProductsEl.addEventListener(
        'click',
        loadProducts
    );

}


/* =========================================================
   PEDIDOS
   ========================================================= */

function updateOrderStats(orders) {

    const total =
        orders.length;


    const pending =
        orders.filter(
            order =>
                order.status === 'pending'
        ).length;


    const paid =
        orders.filter(
            order =>
                order.status === 'paid'
        ).length;


    const shipped =
        orders.filter(
            order =>
                order.status === 'shipped'
        ).length;


    /*
     * Faturamento:
     *
     * Por segurança, nesta primeira versão
     * consideramos somente pedidos com status
     * "paid" ou "shipped".
     */

    const revenue =
        orders
            .filter(
                order =>
                    order.status === 'paid' ||
                    order.status === 'shipped'
            )
            .reduce(
                (totalValue, order) => {

                    const value =
                        Number(
                            order.total ??
                            order.totalAmount ??
                            order.amount ??
                            0
                        );


                    return (
                        totalValue +
                        (
                            Number.isFinite(
                                value
                            )
                                ? value
                                : 0
                        )
                    );

                },
                0
            );


    const totalEl =
        document.getElementById(
            'stat-orders'
        );


    const revenueEl =
        document.getElementById(
            'stat-revenue'
        );


    const pendingEl =
        document.getElementById(
            'summary-pending-orders'
        );


    const paidEl =
        document.getElementById(
            'summary-paid-orders'
        );


    const shippedEl =
        document.getElementById(
            'summary-shipped-orders'
        );


    if (totalEl) {

        totalEl.textContent =
            String(total);

    }


    if (revenueEl) {

        revenueEl.textContent =
            formatCurrency(revenue);

    }


    if (pendingEl) {

        pendingEl.textContent =
            String(pending);

    }


    if (paidEl) {

        paidEl.textContent =
            String(paid);

    }


    if (shippedEl) {

        shippedEl.textContent =
            String(shipped);

    }

}


/* =========================================================
   CLIENTES
   ========================================================= */

function updateCustomerStats(users) {

    const customersEl =
        document.getElementById(
            'stat-customers'
        );


    if (customersEl) {

        customersEl.textContent =
            String(users.length);

    }

}


/* =========================================================
   PEDIDOS RECENTES
   ========================================================= */

function renderRecentOrders(orders) {

    const container =
        document.getElementById(
            'recent-orders'
        );


    if (!container) {
        return;
    }


    if (!orders.length) {

        container.innerHTML = `

            <div class="empty-table">

                Ainda não existem pedidos
                registrados.

            </div>

        `;

        return;

    }


    const sortedOrders =
        [...orders]
            .sort(
                (a, b) => {

                    const dateA =
                        getTimestampValue(
                            a.createdAt
                        );


                    const dateB =
                        getTimestampValue(
                            b.createdAt
                        );


                    return dateB - dateA;

                }
            )
            .slice(0, 6);


    container.innerHTML =
        sortedOrders
            .map(order => {

                const status =
                    getStatusInfo(
                        order.status
                    );


                const customerName =
                    order.customerName ||
                    order.name ||
                    'Cliente';


                const customerEmail =
                    order.customerEmail ||
                    order.email ||
                    '';


                const total =
                    Number(
                        order.total ??
                        order.totalAmount ??
                        order.amount ??
                        0
                    );


                return `

                    <div class="order-row">

                        <div class="order-client">

                            <strong>
                                ${escapeHTML(
                                    customerName
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    customerEmail
                                )}
                            </span>

                        </div>


                        <div class="order-value">

                            ${formatCurrency(
                                total
                            )}

                        </div>


                        <div class="order-date">

                            ${formatDate(
                                order.createdAt
                            )}

                        </div>


                        <div>

                            <span
                                class="status-badge ${status.className}"
                            >
                                ${escapeHTML(
                                    status.text
                                )}
                            </span>

                        </div>

                    </div>

                `;

            })
            .join('');

}


function getTimestampValue(timestamp) {

    if (!timestamp) {
        return 0;
    }


    try {

        if (
            typeof timestamp.toMillis ===
            'function'
        ) {

            return timestamp.toMillis();

        }


        if (
            typeof timestamp.toDate ===
            'function'
        ) {

            return timestamp
                .toDate()
                .getTime();

        }


        const date =
            new Date(timestamp);


        return date.getTime() || 0;

    } catch (error) {

        return 0;

    }

}


/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function setActiveSection(sectionName) {

    const sections =
        document.querySelectorAll(
            '[data-section-content]'
        );


    const navItems =
        document.querySelectorAll(
            '[data-section]'
        );


    sections.forEach(section => {

        const isTarget =
            section.dataset.sectionContent ===
            sectionName;


        section.hidden =
            !isTarget;


        section.classList.toggle(
            'is-active',
            isTarget
        );

    });


    navItems.forEach(item => {

        item.classList.toggle(
            'is-active',
            item.dataset.section ===
            sectionName
        );

    });


    const titles = {

        dashboard:
            'Dashboard',

        products:
            'Produtos',

        orders:
            'Pedidos',

        customers:
            'Clientes',

        coupons:
            'Cupons',

        settings:
            'Configurações'

    };


    if (pageTitleEl) {

        pageTitleEl.textContent =
            titles[sectionName] ||
            'Dashboard';

    }


    if (sidebarEl) {

        sidebarEl.classList.remove(
            'is-open'
        );

    }


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

}


function setupNavigation() {

    document
        .querySelectorAll(
            '[data-section]'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    setActiveSection(
                        button.dataset.section
                    );

                }
            );

        });


    document
        .querySelectorAll(
            '[data-section-link]'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    setActiveSection(
                        button.dataset.sectionLink
                    );

                }
            );

        });

}


/* =========================================================
   SIDEBAR MOBILE
   ========================================================= */

function setupSidebar() {

    if (!sidebarToggleEl ||
        !sidebarEl) {

        return;

    }


    sidebarToggleEl.addEventListener(
        'click',
        () => {

            sidebarEl.classList.toggle(
                'is-open'
            );

        }
    );

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function handleLogout() {

    try {

        await signOut(auth);


        window.location.href =
            'index.html';

    } catch (error) {

        console.error(
            'Erro ao sair:',
            error
        );


        if (
            typeof Swal !==
            'undefined'
        ) {

            Swal.fire({
                icon: 'error',
                title: 'Não foi possível sair',
                text:
                    'Tente novamente.'
            });

        }

    }

}


function setupLogout() {

    if (logoutButtonEl) {

        logoutButtonEl.addEventListener(
            'click',
            handleLogout
        );

    }


    if (deniedLogoutEl) {

        deniedLogoutEl.addEventListener(
            'click',
            handleLogout
        );

    }

}


/* =========================================================
   ATUALIZAÇÃO
   ========================================================= */

async function refreshDashboard() {

    if (!refreshDashboardEl) {
        return;
    }


    const originalText =
        refreshDashboardEl.textContent;


    refreshDashboardEl.disabled =
        true;


    refreshDashboardEl.textContent =
        'Atualizando...';


    try {

        await loadDashboard();

        await loadProducts();

        if (loadingEl) {
        loadingEl.hidden = true;
    }

    if (appEl) {
        appEl.hidden = false;
    }


    } catch (error) {

        console.error(
            'Erro ao atualizar dashboard:',
            error
        );


        if (
            typeof Swal !==
            'undefined'
        ) {

            Swal.fire({
                icon: 'error',
                title: 'Erro ao atualizar',
                text:
                    'Não foi possível carregar os dados do painel.'
            });

        }

    } finally {

        refreshDashboardEl.disabled =
            false;

        refreshDashboardEl.textContent =
            originalText;

    }

}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function initializeAdmin(user) {

    console.log('[ADMIN] 1. initializeAdmin iniciado');
    console.log('[ADMIN] Usuário:', user);

    const hasAccess =
        await checkAdminAccess(user);

    console.log('[ADMIN] 2. checkAdminAccess terminou:', hasAccess);

    if (!hasAccess) {
        console.log('[ADMIN] Acesso negado.');
        return;
    }

    console.log('[ADMIN] 3. Usuário autorizado.');

    populateAdminUser(user);

    console.log('[ADMIN] 4. populateAdminUser concluído.');

    setupNavigation();

    console.log('[ADMIN] 5. setupNavigation concluído.');

    setupSidebar();

    console.log('[ADMIN] 6. setupSidebar concluído.');

    setupLogout();

    console.log('[ADMIN] 7. setupLogout concluído.');

    if (refreshDashboardEl) {

        refreshDashboardEl.addEventListener(
            'click',
            refreshDashboard
        );

    }

    console.log('[ADMIN] 8. Iniciando loadDashboard...');

    try {

        await loadDashboard();

        console.log('[ADMIN] 9. loadDashboard concluído.');

        if (loadingEl) {
            loadingEl.hidden = true;
        }

        if (appEl) {
            appEl.hidden = false;
        }

        console.log('[ADMIN] 10. Painel exibido com sucesso.');

    } catch (error) {

        console.error(
            '[ADMIN] ERRO ao carregar painel:',
            error
        );

        if (loadingEl) {
            loadingEl.hidden = true;
        }

        if (typeof Swal !== 'undefined') {

            Swal.fire({
                icon: 'error',
                title: 'Erro ao carregar o painel',
                text:
                    'Não foi possível carregar os dados administrativos.'
            });

        }

        if (appEl) {
            appEl.hidden = false;
        }

    }

}



onAuthStateChanged(
    auth,
    async user => {

        await initializeAdmin(
            user
        );

    }
);