import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { cartStore } from './utils.js';

function injectHeaderAndFooter() {
    const headerHTML = `
        <div class="announcement-bar" aria-label="Informações da loja">
            <div class="announcement-inner">
                <span class="announcement-delivery">
                    Axé que fortalece seus rituais
                </span>

                <span class="announcement-divider">•</span>

                <span class="announcement-delivery">
                    Compra segura e atendimento próximo
                </span>

                <div class="announcement-account">
                    <a href="minha-conta.html">Minha conta</a>
                    <span class="announcement-divider">|</span>
                    <a href="login-cliente.html">Entrar</a>
                </div>
            </div>
        </div>

        <header class="site-header">
            <div class="container header-inner">

                <a href="index.html" class="brand" aria-label="Olomi - início">
                    <img
                        src="./assets/img/logo.jpg"
                        alt="Olomi"
                        class="brand-logo"
                    >
                </a>

                <button
                    type="button"
                    class="mobile-menu-toggle"
                    id="mobile-menu-toggle"
                    aria-label="Abrir menu"
                    aria-expanded="false"
                    aria-controls="main-nav"
                >
                    ☰
                </button>

                <nav
                    class="main-nav"
                    id="main-nav"
                    aria-label="Navegação principal"
                >
                    <a href="index.html" class="nav-link">
                        Início
                    </a>

                    <a href="index.html#catalogo" class="nav-link">
                        Produtos
                    </a>

                    <a href="index.html#sobre" class="nav-link">
                        A Olomi
                    </a>

                    <div id="admin-link-container"></div>

                    <div id="user-navigation"></div>
                </nav>

                <div class="header-actions">

                    <label
                        class="header-search"
                        aria-label="Buscar produtos"
                    >
                        <span aria-hidden="true">⌕</span>

                        <input
                            type="search"
                            id="global-product-search"
                            placeholder="Buscar produtos..."
                            autocomplete="off"
                        >
                    </label>

                    <a
                        href="carrinho.html"
                        class="header-cart"
                        aria-label="Carrinho"
                    >
                        <span
                            class="cart-icon"
                            aria-hidden="true"
                        >
                            🛒
                        </span>

                        <span
                            id="cart-count"
                            class="cart-bubble"
                        >
                            0
                        </span>
                    </a>

                </div>
            </div>
        </header>
    `;

    const footerHTML = `
        <footer class="site-footer">

            <div
                class="footer-pattern"
                aria-hidden="true"
            ></div>

            <div class="container footer-main">

                <div class="footer-brand">

                    <img
                        src="./assets/img/logo.jpg"
                        alt="Olomi"
                        class="footer-logo"
                    >

                    <p>
                        Artigos africanos e religiosos
                    </p>

                    <span>
                        Produtos escolhidos com respeito às
                        tradições e à sua caminhada.
                    </span>

                </div>

                <div class="footer-column">

                    <h3>Olomi</h3>

                    <a href="index.html">
                        Início
                    </a>

                    <a href="index.html#catalogo">
                        Produtos
                    </a>

                    <a href="index.html#sobre">
                        Sobre nós
                    </a>

                    <a href="minha-conta.html">
                        Minha conta
                    </a>

                </div>

                <div class="footer-column">

                    <h3>Atendimento</h3>

                    <a
                        href="https://wa.me/5521959517508"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        WhatsApp
                    </a>

                    <a
                        href="https://www.instagram.com/olomi_rj/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Instagram
                    </a>

                    <a href="login-cliente.html">
                        Entrar
                    </a>

                    <a href="cadastro.html">
                        Criar conta
                    </a>

                </div>

                <div class="footer-security">

                    <div class="security-badge">

                        <strong>
                            Compra segura
                        </strong>

                        <span>
                            Seus dados são tratados com cuidado.
                        </span>

                    </div>

                    <p>
                        © ${new Date().getFullYear()}
                        Olomi. Todos os direitos reservados.
                    </p>

                </div>

            </div>
        </footer>
    `;

    // Header
    if (!document.querySelector('.site-header')) {
        document.body.insertAdjacentHTML(
            'afterbegin',
            headerHTML
        );
    }

    // Footer
    if (!document.querySelector('.site-footer')) {
        document.body.insertAdjacentHTML(
            'beforeend',
            footerHTML
        );
    }

    // ==========================================
    // MENU MOBILE
    // ==========================================

    const menuToggle =
        document.getElementById('mobile-menu-toggle');

    const mainNav =
        document.getElementById('main-nav');

    if (
        menuToggle &&
        mainNav &&
        !menuToggle.dataset.initialized
    ) {
        menuToggle.dataset.initialized = 'true';

        menuToggle.addEventListener('click', () => {

            const isOpen =
                mainNav.classList.toggle('is-open');

            menuToggle.setAttribute(
                'aria-expanded',
                String(isOpen)
            );

            menuToggle.setAttribute(
                'aria-label',
                isOpen
                    ? 'Fechar menu'
                    : 'Abrir menu'
            );

            menuToggle.textContent =
                isOpen ? '×' : '☰';
        });

        mainNav.addEventListener('click', (event) => {

            if (!event.target.closest('a')) {
                return;
            }

            mainNav.classList.remove('is-open');

            menuToggle.setAttribute(
                'aria-expanded',
                'false'
            );

            menuToggle.setAttribute(
                'aria-label',
                'Abrir menu'
            );

            menuToggle.textContent = '☰';
        });
    }

    // ==========================================
    // BUSCA GLOBAL
    // ==========================================

    const globalSearch =
        document.getElementById('global-product-search');

    if (
        globalSearch &&
        !globalSearch.dataset.initialized
    ) {
        globalSearch.dataset.initialized = 'true';

        globalSearch.addEventListener(
            'keydown',
            (event) => {

                if (event.key !== 'Enter') {
                    return;
                }

                const term =
                    globalSearch.value.trim();

                if (!term) {
                    window.location.href =
                        'index.html#catalogo';

                    return;
                }

                window.location.href =
                    `index.html?busca=${encodeURIComponent(term)}#catalogo`;
            }
        );
    }
}

injectHeaderAndFooter();

// ==========================================
// NAVEGAÇÃO DO USUÁRIO
// ==========================================

const userNavContainer =
    document.getElementById('user-navigation');

const adminLinkContainer =
    document.getElementById('admin-link-container');

if (
    userNavContainer &&
    adminLinkContainer
) {

    // ==========================================
    // CARRINHO
    // ==========================================

    cartStore.updateCountUI();

    cartStore.onChange(
        cartStore.updateCountUI
    );

    // ==========================================
    // AUTENTICAÇÃO
    // ==========================================

    onAuthStateChanged(
        auth,
        async (user) => {

            if (user) {

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
                    roleSnap.data().admin;

                // ------------------------------
                // ADMIN
                // ------------------------------

                adminLinkContainer.innerHTML =
                    isAdmin
                        ? `
                            <a
                                href="admin.html"
                                class="nav-link admin-link"
                            >
                                Painel Admin
                            </a>
                        `
                        : '';

                // ------------------------------
                // USUÁRIO LOGADO
                // ------------------------------

                userNavContainer.innerHTML = `
                    <a
                        href="minha-conta.html"
                        class="nav-link account-link"
                    >
                        Minha Conta
                    </a>

                    <a
                        href="#"
                        id="logout-btn"
                        class="nav-link account-link"
                    >
                        Sair
                    </a>
                `;

                // ------------------------------
                // LOGOUT
                // ------------------------------

                const logoutBtn =
                    document.getElementById(
                        'logout-btn'
                    );

                if (logoutBtn) {

                    logoutBtn.addEventListener(
                        'click',
                        async (event) => {

                            event.preventDefault();

                            try {

                                await signOut(auth);

                                window.location.href =
                                    'index.html';

                            } catch (error) {

                                console.error(
                                    'Erro ao sair:',
                                    error
                                );
                            }
                        }
                    );
                }

            } else {

                // ==================================
                // USUÁRIO NÃO LOGADO
                // ==================================

                adminLinkContainer.innerHTML = '';

                userNavContainer.innerHTML = `
                    <a
                        href="login-cliente.html"
                        class="nav-link account-link"
                    >
                        Entrar
                    </a>

                    <a
                        href="cadastro.html"
                        class="nav-link account-link account-highlight"
                    >
                        Criar conta
                    </a>
                `;
            }
        }
    );
}

// ==========================================
// APLICADOR DE TEMA DINÂMICO
// ==========================================

async function applyStoreTheme() {

    try {

        const themeRef =
            doc(
                db,
                'settings',
                'storeTheme'
            );

        const themeSnap =
            await getDoc(themeRef);

        if (!themeSnap.exists()) {
            return;
        }

        const theme =
            themeSnap.data();

        // ======================================
        // COR PRINCIPAL
        // ======================================

        if (theme.primaryColor) {

            document.documentElement.style.setProperty(
                '--cor-laranja',
                theme.primaryColor
            );

            document.documentElement.style.setProperty(
                '--cor-laranja-hover',
                `${theme.primaryColor}dd`
            );

            document.documentElement.style.setProperty(
                '--olomi-terracota',
                theme.primaryColor
            );

            document.documentElement.style.setProperty(
                '--olomi-terracota-dark',
                `${theme.primaryColor}dd`
            );

            document.documentElement.style.setProperty(
                '--olomi-accent',
                theme.primaryColor
            );

            let dynamicStyle =
                document.getElementById(
                    'dynamic-theme-css'
                );

            if (!dynamicStyle) {

                dynamicStyle =
                    document.createElement(
                        'style'
                    );

                dynamicStyle.id =
                    'dynamic-theme-css';

                document.head.appendChild(
                    dynamicStyle
                );
            }

            dynamicStyle.innerHTML = `

                button,
                button[type="submit"],
                .submit-btn,
                .add-to-cart-btn,
                .add-to-cart-btn-large,
                .btn-primary {

                    background-color:
                        ${theme.primaryColor}
                        !important;

                    color:
                        #ffffff
                        !important;

                    border:
                        none
                        !important;
                }

                button:hover,
                button[type="submit"]:hover,
                .submit-btn:hover,
                .add-to-cart-btn:hover,
                .add-to-cart-btn-large:hover,
                .btn-primary:hover {

                    background-color:
                        ${theme.primaryColor}dd
                        !important;
                }

                .login-logo,
                .logo-edit-container {

                    border-color:
                        ${theme.primaryColor}
                        !important;
                }

                .back-link,
                .login-link,
                .nav-link,
                .cart-link {

                    color:
                        ${theme.primaryColor}
                        !important;
                }

                .nav-link:hover,
                .cart-link:hover {

                    color:
                        #ffffff
                        !important;
                }

                .product-price-large {

                    color:
                        ${theme.primaryColor}
                        !important;
                }

                .login-form legend {

                    border-bottom-color:
                        ${theme.primaryColor}
                        !important;
                }

                @keyframes blink-anim {

                    0% {
                        opacity: 1;
                    }

                    50% {
                        opacity: .2;
                    }

                    100% {
                        opacity: 1;
                    }
                }

                @keyframes scroll-anim {

                    0% {
                        transform:
                            translateX(100vw);
                    }

                    100% {
                        transform:
                            translateX(-100%);
                    }
                }

                .faixa-blink {
                    animation:
                        blink-anim
                        1.5s
                        infinite
                        ease-in-out;
                }

                .faixa-scroll {

                    display: inline-block;

                    white-space: nowrap;

                    animation:
                        scroll-anim
                        15s
                        linear
                        infinite;

                    will-change:
                        transform;
                }
            `;
        }

        // ======================================
        // BARRA SUPERIOR DINÂMICA
        // ======================================

        if (
            theme.topBarMessage &&
            theme.topBarMessage.trim() !== ''
        ) {

            let topBarContainer =
                document.getElementById(
                    'dynamic-top-bar'
                );

            if (!topBarContainer) {

                topBarContainer =
                    document.createElement(
                        'div'
                    );

                topBarContainer.id =
                    'dynamic-top-bar';

                topBarContainer.className =
                    'announcement-bar';

                const topBarInner =
                    document.createElement(
                        'div'
                    );

                topBarInner.className =
                    'announcement-inner';

                const textSpan =
                    document.createElement(
                        'span'
                    );

                textSpan.className =
                    'announcement-message';

                textSpan.textContent =
                    theme.topBarMessage;

                topBarInner.appendChild(
                    textSpan
                );

                topBarContainer.appendChild(
                    topBarInner
                );

                document.body.insertBefore(
                    topBarContainer,
                    document.body.firstChild
                );
            }

            const textSpan =
                topBarContainer.querySelector(
                    '.announcement-message'
                );

            if (textSpan) {

                textSpan.textContent =
                    theme.topBarMessage;

                textSpan.classList.remove(
                    'faixa-blink',
                    'faixa-scroll'
                );

                if (
                    theme.topBarAnimation ===
                    'blink'
                ) {

                    textSpan.classList.add(
                        'faixa-blink'
                    );

                } else if (
                    theme.topBarAnimation ===
                    'scroll'
                ) {

                    textSpan.classList.add(
                        'faixa-scroll'
                    );
                }
            }
        }

        // ======================================
        // LOGO DINÂMICO
        // ======================================

        if (theme.logoUrl) {

            document
                .querySelectorAll(
                    '.brand-logo, .footer-logo, .logo, .login-logo'
                )
                .forEach((img) => {

                    img.src =
                        theme.logoUrl;
                });
        }

    } catch (error) {

        console.error(
            'Erro ao aplicar tema:',
            error
        );
    }
}

applyStoreTheme();