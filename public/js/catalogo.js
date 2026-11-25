import { db } from './firebase.js';
// ATENÇÃO: Adicionámos o 'where' e o 'startAfter' na importação
import { collection, getDocs, query, orderBy, limit, startAfter, where } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { BRL, cartStore, showToast, escapeHTML } from './utils.js';

// --- SELEÇÃO DOS ELEMENTOS ---
const listEl = document.getElementById('products');
const searchEl = document.getElementById('search');
const catEl = document.getElementById('category');

let products = []; 
let lastVisibleDoc = null; 
let hasMoreProducts = true; 
let allFetchedForSearch = []; // Guarda a busca temporária para não gastar dados à toa

// ==========================================
// 1. LÓGICA DO CARRINHO E RENDERIZAÇÃO
// ==========================================
function handleAddToCart(productId, button) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const cart = cartStore.get();
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        if (existingItem.qty < product.stock) {
            existingItem.qty++;
            showToast(`${product.name} adicionado ao carrinho!`);
        } else {
            showToast('Quantidade máxima em stock atingida.', 'warning');
            return; 
        }
    } else {
        const effectivePrice = Number(product.promotionalPrice) > 0 && Number(product.promotionalPrice) < Number(product.price)
            ? Number(product.promotionalPrice)
            : Number(product.price || 0);

        cart.push({
            id: product.id,
            name: product.name,
            price: effectivePrice,
            qty: 1,
            stock: product.stock,
            weight: product.weight || 0,
            length: product.length || 0,
            width: product.width || 0,
            height: product.height || 0,
            imageUrl: (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : null
        });
        showToast(`${product.name} adicionado ao carrinho!`);
    }

    cartStore.set(cart); 

    button.textContent = 'Adicionado!';
    button.disabled = true;
    setTimeout(() => {
        button.textContent = 'Adicionar ao Carrinho';
        button.disabled = false;
    }, 1500);
}

function render(list) {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (list.length === 0) {
        listEl.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666; padding: 2rem;">Nenhum produto encontrado com estes filtros.</p>';
        return;
    }

    list.forEach(p => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';

        const imageUrl = (p.imageUrls && p.imageUrls.length > 0) ? p.imageUrls[0] : 'https://placehold.co/400x400/4A1F2B/fff?text=Olomi';
        const safeImageUrl = String(imageUrl).replace(/\"/g, '%22');
        const safeId = encodeURIComponent(p.id);
        const safeName = escapeHTML(p.name);
        const safeDescription = escapeHTML(p.description || 'Clique para ver mais detalhes.');
        const isOutOfStock = Number(p.stock) <= 0;
        const buttonText = isOutOfStock ? 'Esgotado' : 'Adicionar ao Carrinho';
        const buttonDisabled = isOutOfStock ? 'disabled' : '';
        const hasPromo = p.promotionalPrice && p.promotionalPrice > 0;
        const promoBadgeHtml = hasPromo ? `<div class="promo-badge">PROMOÇÃO</div>` : '';
        const currentPrice = hasPromo ? Number(p.promotionalPrice) : Number(p.price || 0);
        const priceHtml = hasPromo
            ? `<div class="price-container">
                   <span class="old-price">${BRL(Number(p.price || 0))}</span>
                   <span class="current-price">${BRL(currentPrice)}</span>
               </div>`
            : `<div class="price-container"><p class="product-price">${BRL(currentPrice)}</p></div>`;

        productCard.innerHTML = `
            ${promoBadgeHtml}
            <a href="produto.html?id=${safeId}" class="product-link">
                <img src="${safeImageUrl}" alt="${safeName}" class="product-image" loading="lazy">
            </a>
            <div class="card-content">
                <h3 class="product-title"><a href="produto.html?id=${safeId}">${safeName}</a></h3>
                <p class="product-description">${safeDescription}</p>
                ${priceHtml}
                <button type="button" class="add-to-cart-btn" data-id="${safeId}" ${buttonDisabled}>${buttonText}</button>
            </div>
        `;

        const button = productCard.querySelector('button');
        if (button) button.addEventListener('click', () => handleAddToCart(p.id, button));
        listEl.appendChild(productCard);
    });
}

// ==========================================
// 2. BUSCA GERAL DE CATEGORIAS
// ==========================================
async function loadCategoriesFromDB() {
    if (!catEl) return;
    try {
        // Vai buscar o nome de todas as categorias do banco apenas uma vez ao entrar no site
        const snapshot = await getDocs(collection(db, 'products'));
        const categories = [...new Set(snapshot.docs.map(doc => doc.data().category).filter(Boolean))];
        categories.sort();

        const currentSelected = catEl.value;
        catEl.innerHTML = '<option value="">Todas as categorias</option>';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            catEl.appendChild(opt);
        });
        catEl.value = currentSelected;
    } catch (error) {
        console.error("Erro ao carregar categorias:", error);
    }
}

// ==========================================
// 3. MOTOR DE BUSCA COM PAGINAÇÃO HÍBRIDA
// ==========================================
async function fetchProducts(isLoadMore = false) {
    if (!listEl) return;

    const term = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();
    const cat = (catEl && catEl.value) ? catEl.value : '';

    // Se é uma pesquisa nova, reseta a tela
    if (!isLoadMore) {
        listEl.innerHTML = `<div class="loader-container"><div class="spinner"></div></div>`;
        products = [];
        lastVisibleDoc = null;
        hasMoreProducts = true;
        allFetchedForSearch = [];
    } else {
        const btn = document.getElementById('btn-load-more');
        if (btn) btn.textContent = 'A carregar...';
    }

    try {
        const productsRef = collection(db, 'products');

        // MODO 1: PESQUISA POR TEXTO (Puxa do banco e filtra com alta precisão no código)
        if (term !== '') {
            if (!isLoadMore) {
                let q;
                if (cat !== '') {
                    q = query(productsRef, where("category", "==", cat), orderBy("name"));
                } else {
                    q = query(productsRef, orderBy("name"));
                }
                const snapshot = await getDocs(q);
                const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Filtra perfeitamente qualquer palavra no meio do nome do produto
                allFetchedForSearch = allDocs.filter(p => p.name.toLowerCase().includes(term));
            }

            // Paginação Manual (de 20 em 20)
            const startIndex = products.length;
            const nextBatch = allFetchedForSearch.slice(startIndex, startIndex + 20);
            
            products = isLoadMore ? [...products, ...nextBatch] : nextBatch;
            hasMoreProducts = products.length < allFetchedForSearch.length;

        } 
        // MODO 2: NAVEGAÇÃO NORMAL (Paginação pura do Firebase para economia de dados)
        else {
            let queryConstraints = [];
            
            if (cat !== '') queryConstraints.push(where("category", "==", cat));
            queryConstraints.push(orderBy("name"));
            
            if (isLoadMore && lastVisibleDoc) queryConstraints.push(startAfter(lastVisibleDoc));
            queryConstraints.push(limit(20));

            const q = query(productsRef, ...queryConstraints);
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                hasMoreProducts = false;
                updateLoadMoreButton();
                if (!isLoadMore) listEl.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666; padding: 2rem;">Nenhum produto encontrado com estes filtros.</p>';
                return;
            }

            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
            const newProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            products = isLoadMore ? [...products, ...newProducts] : newProducts;
            hasMoreProducts = snapshot.docs.length === 20;
        }

        render(products);
        updateLoadMoreButton();

    } catch (error) {
        console.error("Erro ao carregar os produtos:", error);
        if (!isLoadMore) {
            listEl.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: red;">Não foi possível carregar os produtos. Tente recarregar a página.</p>';
        }
    }
}

// Botão "Carregar Mais" Dinâmico
function updateLoadMoreButton() {
    let btn = document.getElementById('btn-load-more');
    
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btn-load-more';
        btn.className = 'submit-btn'; 
        btn.style.display = 'block';
        btn.style.margin = '2rem auto';
        btn.style.padding = '0.8rem 2.5rem';
        btn.style.fontSize = '1.1rem';
        btn.addEventListener('click', () => fetchProducts(true));
        listEl.parentNode.insertBefore(btn, listEl.nextSibling);
    }

    if (hasMoreProducts) {
        btn.style.display = 'block';
        btn.textContent = 'Carregar mais produtos';
    } else {
        btn.style.display = 'none';
    }
}

// ==========================================
// 4. EVENT LISTENERS E INICIALIZAÇÃO
// ==========================================

// "Debounce": Impede que o site vá ao banco de dados a cada letra digitada
let searchTimeout;
if (searchEl) {
    searchEl.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchProducts(false);
        }, 500); // Pesquisa no banco 0.5s depois de o cliente parar de escrever
    });
}

if (catEl) {
    catEl.addEventListener('change', () => {
        fetchProducts(false);
    });
}

function init() {
    loadCategoriesFromDB().then(() => {
        fetchProducts(false);
    });
}

init();