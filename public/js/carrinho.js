import { db, auth, app } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { BRL, cartStore, showToast } from './utils.js';

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeImageUrl(value) {
    try {
        const url = new URL(value || '', window.location.href);
        if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch (_) {}
    return 'https://placehold.co/240x240/f3e5d0/351313?text=Olomi';
}


const itemsListEl = document.getElementById('cart-items-list');
const totalsEl = document.getElementById('totals-summary');
const form = document.getElementById('checkout-form');
const cartContainer = document.getElementById('cart-container');
const btnCalcShipping = document.getElementById('btn-calc-shipping');
const inputCep = document.getElementById('calc-cep');
const shippingResult = document.getElementById('shipping-result');

form.addEventListener('submit', (e) => e.preventDefault());

window.valorFrete = 0;
window.nomeFrete = '';
window.cupomAtivo = null;

// ==========================================
// CONFIGURAÇÃO DO MERCADO PAGO BRICKS
// ==========================================
// SUBSTITUA PELA SUA PUBLIC KEY DE PRODUÇÃO/TESTE
const mp = new MercadoPago('APP_USR-4c51d59c-b0b9-434b-8572-643ed528396a', { locale: 'pt-BR' });
const bricksBuilder = mp.bricks();
let paymentBrickController = null;

// ==========================================
// FUNÇÕES DE FRETE E CARRINHO (MANTIDAS)
// ==========================================
if (btnCalcShipping) {
    btnCalcShipping.addEventListener('click', async () => {
        const cep = inputCep.value.replace(/\D/g, '');
        if (cep.length !== 8) {
            shippingResult.innerHTML = '<span style="color: #e74c3c;">Digite um CEP válido com 8 dígitos.</span>';
            return;
        }

        shippingResult.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div> Buscando opções nos Correios...';
        btnCalcShipping.disabled = true;

        const cart = cartStore.get();
        const itemsForFreight = cart.map(item => ({
            qty: item.qty,
            weight: item.weight || 0.5, 
            length: item.length || 20,
            width: item.width || 20,
            height: item.height || 20
        }));

        const functionsBR = getFunctions(app, 'southamerica-east1');
        const calcularFreteFunction = httpsCallable(functionsBR, 'calcularfrete');
        
        try {
            const result = await calcularFreteFunction({ cepDestino: cep, items: itemsForFreight });
            const apenasCorreios = result.data.filter(opcao => opcao.company && opcao.company.name.toUpperCase() === 'CORREIOS');

            let htmlOpcoes = '<div style="margin-top: 1rem; text-align: left; display: flex; flex-direction: column; gap: 0.5rem;">';
            if (apenasCorreios.length > 0) {
                apenasCorreios.forEach(opcao => {
                    const tipo = opcao.name; 
                    const precoComDesconto = parseFloat(opcao.price);
                    const valorDesconto = parseFloat(opcao.discount || 0);
                    const valorDeBalcao = parseFloat(opcao.original_price) || (precoComDesconto + valorDesconto);
                    const idFrete = `frete-${tipo.replace(/\s+/g, '')}`;
                    
                    htmlOpcoes += `
                        <label for="${idFrete}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;">
                            <div>
                                <input type="radio" id="${idFrete}" name="escolhaFrete" value="${valorDeBalcao}" data-nome="${tipo}" onchange="selecionarFrete(this)">
                                <strong>${tipo}</strong> (até ${opcao.delivery_time} dias úteis)
                            </div>
                            <span>${BRL(valorDeBalcao)}</span>
                        </label>
                    `;
                });
                htmlOpcoes += '</div>';
                shippingResult.innerHTML = htmlOpcoes;            
            } else {
                shippingResult.innerHTML = `<div style="color: #e74c3c; margin-top: 1rem; padding: 1rem; border: 1px solid #ffcccc; border-radius: 8px; background-color: #fff9f9;">Indisponível no momento.</div>`;
            }
        } catch (error) {
            shippingResult.innerHTML = `<span style="color: #e74c3c; display: block; margin-top: 1rem;">Erro ao consultar os Correios. Tente novamente.</span>`;
        } finally {
            btnCalcShipping.disabled = false;
        }
    });
}

window.selecionarFrete = function(radioElement) {
    window.valorFrete = parseFloat(radioElement.value);
    window.nomeFrete = radioElement.getAttribute('data-nome');
    renderCart(); 
};

cartStore.onChange(() => {
    window.valorFrete = 0;
    window.nomeFrete = '';
    if (shippingResult) shippingResult.innerHTML = '';
    renderCart();
});


async function populateFormWithUserData(user) {
    if (!user || !form) return;

    try {
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) return;

        const userData = docSnap.data();
        const address = userData.address || {};

        const fields = {
            name: userData.name || '',
            phone: userData.phone || '',
            email: user.email || '',
            cep: address.cep || '',
            street: address.street || '',
            number: address.number || '',
            complement: address.complement || '',
            neighborhood: address.neighborhood || '',
            city: address.city || '',
            state: address.state || ''
        };

        Object.entries(fields).forEach(([name, value]) => {
            const field = form.elements.namedItem(name);

            if (field) {
                field.value = value;
            }
        });
    } catch (error) {
        console.error('Erro ao preencher dados do cliente:', error);
    }
}


function updateCart(productId, action) {
    const cart = cartStore.get();
    const itemIndex = cart.findIndex(i => i.id === productId);
    if (itemIndex < 0) return;

    const item = cart[itemIndex];
    if (action === 'increase') {
        if (item.qty < item.stock) item.qty++;
        else showToast('Quantidade máxima em estoque atingida.', 'info');
    } else if (action === 'decrease') {
        item.qty--;
        if (item.qty <= 0) cart.splice(itemIndex, 1);
    } else if (action === 'remove') {
        cart.splice(itemIndex, 1);
    }
    cartStore.set(cart); 
}

if (itemsListEl) {
    itemsListEl.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const { id, action } = button.dataset;
        if (id && action) updateCart(id, action);
    });
}

// ==========================================
// RENDERIZAÇÃO DO CARRINHO E DO BRICK
// ==========================================
const renderPaymentBrick = async (totalFinal) => {
    if (totalFinal <= 0) return;

    // FORÇA O VALOR A SER UM NÚMERO EXATO (ex: 150.50) PARA NÃO QUEBRAR A API
    const valorCorrigido = Number(totalFinal.toFixed(2));

    if (paymentBrickController) {
        paymentBrickController.update({ amount: valorCorrigido });
        return;
    }

    const settings = {
        initialization: {
            amount: valorCorrigido
        },
        customization: {
            visual: { style: { theme: 'default' } },
            paymentMethods: {
                creditCard: "all",   // 🟢 ATIVA CARTÕES DE CRÉDITO
                debitCard: "all",    // 🟢 ATIVA CARTÕES DE DÉBITO
                bankTransfer: "all", // 🟢 ATIVA O PIX
                maxInstallments: 12
            }
        },
        callbacks: {
            onReady: () => {},
            onSubmit: ({ selectedPaymentMethod, formData }) => {
                return new Promise(async (resolve, reject) => {
                    // RASTREADOR: Vai imprimir no painel (F12) o que o Mercado Pago gerou
                    

                    try { 
                        const user = auth.currentUser;
                        if (!user) {
                            showToast('Você precisa estar autenticado para finalizar a compra.', 'warning');
                            window.location.href = `login-cliente.html?redirect=carrinho.html`;
                            return reject(); // Destrava
                        }

                        if (window.valorFrete === 0) {
                            showToast('Por favor, calcule e selecione uma opção de frete antes de finalizar.', 'warning');
                            inputCep.focus();
                            return reject(); // Destrava
                        }

                        if (!form.checkValidity()) {
                            form.reportValidity();
                            return reject(); // Destrava
                        }

                        const formEntries = Object.fromEntries(new FormData(form).entries());
                        const customerPayload = {
                            name: formEntries.name,
                            phone: formEntries.phone,
                            email: formEntries.email,
                            address: {
                                cep: formEntries.cep, street: formEntries.street, number: formEntries.number,
                                complement: formEntries.complement, neighborhood: formEntries.neighborhood,
                                city: formEntries.city, state: formEntries.state
                            }
                        };
                        const shippingPayload = { method: window.nomeFrete, cost: window.valorFrete };
                        const itemsForFunction = cartStore.get().map(item => ({ id: item.id, qty: item.qty }));

                        const functionsBR = getFunctions(app, 'southamerica-east1');
                        const createOrderFunction = httpsCallable(functionsBR, 'createorder');

                        // Chama o Servidor
                        const result = await createOrderFunction({ 
                            items: itemsForFunction,
                            customer: customerPayload,
                            shipping: shippingPayload,
                            cupom: window.cupomAtivo,
                            payment: formData 
                        });
                        
                        // Validação estrita
                        if (result.data && result.data.status === 'success') {
                            cartStore.clear();

                            // 🟢 NOVA LÓGICA: VERIFICA SE É PIX PARA MOSTRAR O QR CODE
                            if (formData.payment_method_id === 'pix') {
                                // Tenta extrair os dados do PIX da resposta do Mercado Pago
                                const qrCodeBase64 = result.data.qr_code_base64 || result.data.paymentResponse?.point_of_interaction?.transaction_data?.qr_code_base64;
                                const qrCodeText = result.data.qr_code || result.data.paymentResponse?.point_of_interaction?.transaction_data?.qr_code;

                                if (qrCodeBase64 && qrCodeText) {
                                    Swal.fire({
                                        title: 'Pague com PIX',
                                        html: `
                                            <p style="margin-bottom: 10px; color: #555;">Escaneie o QR Code ou copie o código abaixo:</p>
                                            <img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code PIX" style="width: 200px; height: 200px; border: 1px solid #ddd; padding: 10px; border-radius: 8px;">
                                            <input type="text" id="pix-copia-cola" value="${qrCodeText}" readonly style="width: 100%; padding: 10px; margin-top: 15px; border: 1px solid #ccc; border-radius: 5px; text-align: center; font-size: 12px; color: #333;">
                                            <button type="button" onclick="const input = document.getElementById('pix-copia-cola'); input.select(); document.execCommand('copy'); alert('Código PIX copiado!');" style="margin-top: 10px; background: #2ecc71; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%;">📋 Copiar Código PIX</button>
                                        `,
                                        icon: 'info',
                                        confirmButtonText: 'Já paguei / Ir para Meus Pedidos',
                                        allowOutsideClick: false
                                    }).then(() => {
                                        window.location.href = 'minha-conta.html';
                                    });
                                } else {
                                    // Fallback caso o servidor não devolva o QR Code
                                    Swal.fire("Pedido Gerado!", "Seu pedido PIX foi gerado, mas não conseguimos exibir o QR Code na tela. Acesse 'Meus Pedidos' ou o seu e-mail para pagar.", "warning").then(() => window.location.href = 'minha-conta.html');
                                }
                            } else {
                                // SE FOR CARTÃO DE CRÉDITO / DÉBITO (Fluxo Normal)
                                Swal.fire("Sucesso!", "O seu pagamento foi aprovado e o pedido recebido!", "success").then(() => {
                                    window.location.href = 'minha-conta.html';
                                });
                            }
                            resolve(); // Sucesso absoluto!
                        } else {
                            // SE NÃO FOR SUCESSO, FORÇA O ERRO PARA NÃO CONGELAR
                            throw new Error("O servidor respondeu, mas não confirmou o pagamento. Verifique os dados.");
                        }
                    } catch (error) {
                        console.error("Erro fatal no checkout:", error);
                        Swal.fire("Erro no Pagamento", error.message || 'Ocorreu um erro ao processar o cartão.', "error");
                        reject(); // 🔴 ISSO DESCONGELA A TELA!
                    }
                });
            },
            onError: (error) => {
                console.error("Erro interno do Brick:", error);
            }
        }
    };

    paymentBrickController = await bricksBuilder.create('payment', 'paymentCardBrick_container', settings);
};

function renderCart() {
    const cart = cartStore.get();
    const countEl = document.getElementById('cart-items-count');
    const totalItems = cart.reduce((acc, item) => acc + Number(item.qty || 0), 0);

    if (countEl) {
        countEl.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
    }

    if (cart.length === 0) {
        if (cartContainer) {
            cartContainer.innerHTML = `
                <div class="cart-empty">
                    <div class="empty-mark">🛒</div>
                    <h2>Seu carrinho está vazio.</h2>
                    <p>Encontre peças para sua fé, sua casa e sua caminhada espiritual no catálogo da Olomi.</p>
                    <a href="index.html#catalogo" class="back-to-store-btn">Explorar produtos →</a>
                </div>`;
        }
        return;
    }

    if (itemsListEl) {
        itemsListEl.innerHTML = cart.map(item => {
            const name = escapeHTML(item.name);
            const imageUrl = safeImageUrl(item.imageUrl);
            const unitPrice = Number(item.price || 0);
            const qty = Math.max(1, Number(item.qty || 1));
            const stock = Number(item.stock || 0);
            const subtotal = unitPrice * qty;

            return `
                <article class="cart-item">
                    <div class="item-image">
                        <img src="${imageUrl}" alt="${name}" loading="lazy">
                    </div>
                    <div class="item-info">
                        <p class="item-name">${name}</p>
                        <p class="item-meta">${BRL(unitPrice)} por unidade${stock ? ` · ${stock} disponíveis` : ''}</p>
                        <div class="item-quantity" aria-label="Quantidade de ${name}">
                            <button type="button" data-id="${escapeHTML(item.id)}" data-action="decrease" aria-label="Diminuir quantidade">−</button>
                            <span>${qty}</span>
                            <button type="button" data-id="${escapeHTML(item.id)}" data-action="increase" aria-label="Aumentar quantidade">+</button>
                        </div>
                    </div>
                    <div class="item-price">
                        <p>${BRL(subtotal)}</p>
                        <button type="button" class="remove-btn" data-id="${escapeHTML(item.id)}" data-action="remove">Remover</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    if (totalsEl) {
        const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.qty || 0)), 0);
        let descontoVisual = 0;
        let htmlDesconto = '';

        if (window.cupomAtivo) {
            descontoVisual = Math.max(0, Number(window.cupomAtivo.desconto || 0));
            if (descontoVisual > subtotal) descontoVisual = subtotal;

            htmlDesconto = `
                <div class="summary-row" style="color: #237a52;">
                    <span>Desconto (${escapeHTML(window.cupomAtivo.codigo)})</span>
                    <span style="color:#237a52;">− ${BRL(descontoVisual)}</span>
                </div>
            `;
        }

        const frete = Number(window.valorFrete || 0);
        const totalFinal = Math.max(0, (subtotal - descontoVisual) + frete);
        const freteLabel = window.nomeFrete ? `Frete (${escapeHTML(window.nomeFrete)})` : 'Frete';

        totalsEl.innerHTML = `
            <div class="summary-row">
                <span>Subtotal</span>
                <span>${BRL(subtotal)}</span>
            </div>
            <div class="summary-row">
                <span>${freteLabel}</span>
                <span>${frete > 0 ? BRL(frete) : 'A calcular'}</span>
            </div>
            ${htmlDesconto}
            <div class="summary-row total">
                <span>Total</span>
                <span>${BRL(totalFinal)}</span>
            </div>
        `;

        renderPaymentBrick(totalFinal);
    }
}

// ==========================================
// LÓGICA DO CUPOM DE DESCONTO
// ==========================================
const btnAplicarCupom = document.getElementById('btn-aplicar-cupom');
const inputCupom = document.getElementById('cupom-input');
const cupomResult = document.getElementById('cupom-result');

if (btnAplicarCupom) {
    btnAplicarCupom.addEventListener('click', async () => {
        const codigo = inputCupom.value.trim();
        if (!codigo) return;

        btnAplicarCupom.disabled = true;
        btnAplicarCupom.textContent = 'Aguarde...';
        cupomResult.innerHTML = '';

        const cart = cartStore.get();
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

        try {
            const functionsBR = getFunctions(app, 'southamerica-east1');
            const validarCupomFn = httpsCallable(functionsBR, 'validarcupom');
            const result = await validarCupomFn({ codigo, subtotal });
            
            window.cupomAtivo = result.data; 
            cupomResult.innerHTML = `<span style="color: #2ecc71; font-weight: bold;">✅ Desconto de ${BRL(result.data.desconto)} aplicado!</span>`;
            renderCart(); 
        } catch (error) {
            window.cupomAtivo = null;
            cupomResult.innerHTML = `<span style="color: #e74c3c;">❌ ${error.message}</span>`;
            renderCart();
        } finally {
            btnAplicarCupom.disabled = false;
            btnAplicarCupom.textContent = 'Aplicar';
        }
    });
}

function init() {
    renderCart();
    cartStore.onChange(renderCart);
    onAuthStateChanged(auth, (user) => { if (user) populateFormWithUserData(user); });
}

init();