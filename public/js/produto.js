import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { BRL, cartStore, showToast } from './utils.js';

const productDetailEl = document.getElementById('product-detail');
let currentProduct = null;
let selectedQuantity = 1;

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeUrl(value) {
    const url = String(value ?? '').trim();
    if (!url) return '';

    try {
        const parsed = new URL(url, window.location.origin);
        if (['http:', 'https:'].includes(parsed.protocol)) return parsed.href;
    } catch (_) {}

    return '';
}

function getProductImages(product) {
    const images = Array.isArray(product.imageUrls)
        ? product.imageUrls.map(safeUrl).filter(Boolean)
        : [];

    return [...new Set(images)];
}

function getCategory(product) {
    return product.category || product.categoria || 'Artigos religiosos';
}

function getOldPrice(product) {
    const candidates = [product.oldPrice, product.precoAntigo, product.originalPrice];
    const value = candidates.find(item => Number.isFinite(Number(item)) && Number(item) > Number(product.price || 0));
    return value ? Number(value) : null;
}

function renderProduct(product) {
    if (!productDetailEl) return;

    document.title = `${product.name || 'Produto'} - Olomi`;

    const name = escapeHTML(product.name || 'Produto Olomi');
    const category = escapeHTML(getCategory(product));
    const description = escapeHTML(product.description || 'Este produto não possui uma descrição cadastrada.');
    const images = getProductImages(product);
    const mainImage = images[0] || '';
    const stock = Math.max(0, Number(product.stock || 0));
    const price = Number(product.price || 0);
    const oldPrice = getOldPrice(product);
    const outOfStock = stock <= 0;

    const thumbs = images.length > 1
        ? `<div class="product-thumbnails" aria-label="Outras imagens do produto">
            ${images.map((url, index) => `
                <button class="product-thumb ${index === 0 ? 'is-active' : ''}" type="button" data-image="${escapeHTML(url)}" aria-label="Ver imagem ${index + 1}">
                    <img src="${escapeHTML(url)}" alt="${name} — imagem ${index + 1}" loading="lazy">
                </button>
            `).join('')}
        </div>`
        : '';

    const imageMarkup = mainImage
        ? `<img id="product-main-image" class="product-main-image" src="${escapeHTML(mainImage)}" alt="${name}">`
        : `<div class="product-image-placeholder">Olomi</div>`;

    productDetailEl.innerHTML = `
        <article class="product-detail-card">
            <section class="product-gallery" aria-label="Imagens do produto">
                <div class="product-main-image-wrap">
                    ${imageMarkup}
                </div>
                ${thumbs}
            </section>

            <section class="product-info">
                <p class="product-category">${category}</p>
                <h1 class="product-title-large">${name}</h1>

                <div class="product-rating" aria-label="Produto em destaque">
                    <span class="product-rating-stars" aria-hidden="true">★★★★★</span>
                    <span>Produto selecionado pela Olomi</span>
                </div>

                <div class="product-price-block">
                    ${oldPrice ? `<span class="product-old-price">${BRL(oldPrice)}</span>` : ''}
                    <p class="product-price-large">${BRL(price)}</p>
                    <p class="product-installment">Pagamento seguro e compra protegida.</p>
                </div>

                <p class="product-description-large">${description}</p>

                <span class="product-stock ${outOfStock ? 'is-out' : ''}">
                    ${outOfStock ? '● Produto esgotado' : `● ${stock} ${stock === 1 ? 'unidade disponível' : 'unidades disponíveis'}`}
                </span>

                <div class="product-purchase-box">
                    <div class="product-quantity-row">
                        <span class="product-quantity-label">Quantidade</span>
                        <div class="product-quantity" aria-label="Selecionar quantidade">
                            <button id="quantity-minus" type="button" aria-label="Diminuir quantidade">−</button>
                            <span id="quantity-value" class="product-quantity-value">1</span>
                            <button id="quantity-plus" type="button" aria-label="Aumentar quantidade">+</button>
                        </div>
                    </div>

                    <button id="add-to-cart" class="add-to-cart-btn-large" type="button" ${outOfStock ? 'disabled' : ''}>
                        ${outOfStock ? 'Produto esgotado' : 'Adicionar ao carrinho'}
                    </button>
                </div>

                <div class="product-trust-list">
                    <div class="product-trust-item">
                        <span class="product-trust-icon">✓</span>
                        <span>Compra segura e pagamento protegido.</span>
                    </div>
                    <div class="product-trust-item">
                        <span class="product-trust-icon">↗</span>
                        <span>Envio para todo o Brasil.</span>
                    </div>
                    <div class="product-trust-item">
                        <span class="product-trust-icon">♡</span>
                        <span>Atendimento próximo e humanizado.</span>
                    </div>
                    <div class="product-trust-item">
                        <span class="product-trust-icon">✦</span>
                        <span>Produtos escolhidos com respeito à tradição.</span>
                    </div>
                </div>
            </section>
        </article>
    `;

    selectedQuantity = 1;
    bindProductInteractions(product, stock);
}

function bindProductInteractions(product, stock) {
    const quantityValue = document.getElementById('quantity-value');
    const minus = document.getElementById('quantity-minus');
    const plus = document.getElementById('quantity-plus');
    const addButton = document.getElementById('add-to-cart');
    const mainImage = document.getElementById('product-main-image');

    const updateQuantity = (next) => {
        selectedQuantity = Math.max(1, Math.min(stock, next));
        if (quantityValue) quantityValue.textContent = String(selectedQuantity);
    };

    minus?.addEventListener('click', () => updateQuantity(selectedQuantity - 1));
    plus?.addEventListener('click', () => updateQuantity(selectedQuantity + 1));

    document.querySelectorAll('.product-thumb').forEach(button => {
        button.addEventListener('click', () => {
            const image = safeUrl(button.dataset.image);
            if (!image || !mainImage) return;

            mainImage.src = image;
            document.querySelectorAll('.product-thumb').forEach(item => item.classList.remove('is-active'));
            button.classList.add('is-active');
        });
    });

    addButton?.addEventListener('click', () => {
        if (!product || stock <= 0) return;

        const cart = cartStore.get();
        const existingItem = cart.find(item => item.id === product.id);
        const existingQty = existingItem ? Number(existingItem.qty || 0) : 0;

        if (existingQty + selectedQuantity > stock) {
            showToast(`Você pode adicionar no máximo ${stock} unidade(s) deste produto.`, 'warning');
            return;
        }

        if (existingItem) {
            existingItem.qty = existingQty + selectedQuantity;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: Number(product.price || 0),
                qty: selectedQuantity,
                stock,
                imageUrl: getProductImages(product)[0] || null
            });
        }

        cartStore.set(cart);
        showToast(`${product.name} foi adicionado ao carrinho!`, 'success');

        addButton.textContent = 'Adicionado ao carrinho ✓';
        addButton.disabled = true;

        setTimeout(() => {
            addButton.textContent = 'Adicionar ao carrinho';
            addButton.disabled = false;
        }, 1500);
    });
}

function renderError(message) {
    if (!productDetailEl) return;

    productDetailEl.innerHTML = `
        <div class="product-error">
            <p>${escapeHTML(message)}</p>
            <a href="/">Voltar para a loja</a>
        </div>
    `;
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        renderError('Produto não encontrado.');
        return;
    }

    try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            renderError('Esse produto não está disponível ou não existe mais.');
            return;
        }

        currentProduct = {
            id: productSnap.id,
            ...productSnap.data()
        };

        renderProduct(currentProduct);
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        renderError('Não foi possível carregar o produto agora. Tente novamente em alguns instantes.');
    }
}

init();
