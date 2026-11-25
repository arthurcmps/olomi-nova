import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { collection, getDoc, doc, addDoc, onSnapshot, updateDoc, deleteDoc, orderBy, query, setDoc, limit, where } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { BRL, showToast, showConfirmation } from './utils.js';
import { getStorage, ref, deleteObject, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// ==========================================
// 1. CONFIGURAÇÕES INICIAIS E COMPRESSÃO
// ==========================================
const storage = getStorage();

const compressImage = async (file, maxWidth = 800, quality = 0.8) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleSize = maxWidth / img.width;
                const scale = scaleSize < 1 ? scaleSize : 1; 
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Erro na conversão WebP."));
                }, 'image/webp', quality);
            };
            img.onerror = () => reject(new Error("Erro ao carregar imagem."));
        };
        reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
    });
};

// ==========================================
// 2. SELETORES DA TELA (DOM) E VARIÁVEIS
// ==========================================
// Produtos e Pedidos
const productForm = document.getElementById('product-form');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const productsTableBody = document.querySelector('#products-table tbody');
const ordersTableBody = document.querySelector('#orders-table tbody');

let currentEditingProductId = null;
let existingImageUrls = [];

// Temas e Logo
const themeForm = document.getElementById('theme-form');
const logoContainer = document.getElementById('logo-edit-container');
const logoInput = document.getElementById('logoUpload');
const currentLogoImg = document.getElementById('current-logo-img');

let selectedLogoFile = null;

// ==========================================
// 3. FUNÇÕES DE CARREGAMENTO
// ==========================================

// -> Carregar Tema
async function loadThemeSettings() {
    try {
        const themeRef = doc(db, 'settings', 'storeTheme');
        const themeSnap = await getDoc(themeRef);
        
        if (themeSnap.exists()) {
            const data = themeSnap.data();
            if(data.primaryColor && themeForm) themeForm.themeColor.value = data.primaryColor;
            if(data.topBarMessage && themeForm) themeForm.topBarText.value = data.topBarMessage;
            if(data.topBarAnimation && themeForm) themeForm.topBarAnimation.value = data.topBarAnimation;
            if(data.logoUrl && currentLogoImg) currentLogoImg.src = data.logoUrl;
        }
    } catch (error) {
        console.error("Erro ao carregar tema:", error);
    }
}

// -> Carregar Produtos
const loadProducts = () => {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy("name"));
    onSnapshot(q, (snapshot) => {
        productsTableBody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const product = docSnap.data();
            const tr = document.createElement('tr');
            
            const isPromo = product.promotionalPrice && product.promotionalPrice > 0;
            const nomeComBadge = isPromo 
                ? `${product.name} <br><span style="background-color: #e74c3c; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; display: inline-block; margin-top: 5px;">🔥 Promoção Ativa</span>` 
                : product.name;
            
            const precoFormatado = isPromo 
                ? `<span style="text-decoration: line-through; color: #999; font-size: 0.85em;">${BRL(product.price)}</span> <br> <strong>${BRL(product.promotionalPrice)}</strong>` 
                : BRL(product.price);

            tr.innerHTML = `
                <td><img src="${product.imageUrls[0] || 'https://placehold.co/100x100/f39c12/fff?text=Olomi'}" width="50"></td>
                <td>${nomeComBadge}</td>
                <td>${precoFormatado}</td>
                <td>${product.stock}</td>
                <td class="actions-cell">
                    <button class="action-btn-icon edit" data-id="${docSnap.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="action-btn-icon delete" data-id="${docSnap.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            `;
            productsTableBody.appendChild(tr);
        });
    });
};

// Variáveis Globais de Paginação de Pedidos
let allOrdersData = [];
let ordersCurrentPage = 1;

// -> Carregar Pedidos
const loadOrders = () => {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy("createdAt", "desc"), limit(50));
    
    onSnapshot(q, (snapshot) => {
        allOrdersData = []; // Zera a lista a cada atualização do banco
        
        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            order.id = docSnap.id; // Guarda o ID junto com os dados
            allOrdersData.push(order);
        });

        // Chamada direta para desenhar a tabela (sem tentar alterar o dashboard daqui)
        renderOrdersTable(); 
    }, (error) => {
        console.error("Erro crítico ao buscar pedidos:", error);
    });
};

// Função separada para renderizar os pedidos com base nos filtros e página
const renderOrdersTable = () => {
    const tbody = document.getElementById('orders-table').querySelector('tbody');
    const paginationContainer = document.getElementById('orders-pagination');
    if (!tbody) return;

    // 1. Filtros (Sem Optional Chaining para iPhones antigos)
    const textElement = document.getElementById('search-order-text');
    const statusElement = document.getElementById('search-order-status');
    const startElement = document.getElementById('search-order-date-start');
    const endElement = document.getElementById('search-order-date-end');

    const textValue = textElement ? textElement.value.toLowerCase().trim() : '';
    const statusValue = statusElement ? statusElement.value : '';
    const startDateStr = startElement ? startElement.value : '';
    const endDateStr = endElement ? endElement.value : '';

    let start = null; let end = null;
    if (startDateStr) { const [y, m, d] = startDateStr.split('-'); start = new Date(y, m - 1, d, 0, 0, 0); }
    if (endDateStr) { const [y, m, d] = endDateStr.split('-'); end = new Date(y, m - 1, d, 23, 59, 59); }

    const filteredOrders = allOrdersData.filter(order => {
        let orderDateObj = (order.createdAt && typeof order.createdAt.toDate === 'function') ? order.createdAt.toDate() : null;
        const idMatch = order.id.toLowerCase().includes(textValue);
        const customerName = (order.customer && order.customer.name) ? order.customer.name : '';
        const nameMatch = customerName.toLowerCase().includes(textValue);
        const statusMatch = statusValue === "" || order.status === statusValue;
        
        let dateMatch = true;
        if (orderDateObj) {
            if (start && orderDateObj < start) dateMatch = false;
            if (end && orderDateObj > end) dateMatch = false;
        } else if (start || end) {
            dateMatch = false;
        }
        return (idMatch || nameMatch) && dateMatch && statusMatch;
    });

    // 2. Paginação
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    if (ordersCurrentPage > totalPages) ordersCurrentPage = totalPages || 1;

    const startIndex = (ordersCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const ordersToDisplay = filteredOrders.slice(startIndex, endIndex);

    tbody.innerHTML = '';
    paginationContainer.innerHTML = '';

    if (ordersToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Nenhum pedido encontrado.</td></tr>';
        return;
    }

    // 3. Desenhar a Tabela
    ordersToDisplay.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = 'order-summary-row';
        tr.dataset.orderId = order.id;
        
        let orderDate = (order.createdAt && typeof order.createdAt.toDate === 'function') ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'Data Indisponível';
        const statusMap = { pending: { text: 'Pendente', class: 'pending' }, paid: { text: 'Pago', class: 'paid' }, shipped: { text: 'Enviado', class: 'shipped' }, cancelled: { text: 'Cancelado', class: 'cancelled' }};
        const statusInfo = statusMap[order.status] || statusMap.pending;
        
        const customerName = (order.customer && order.customer.name) ? order.customer.name : 'Cliente';
        const customerEmail = (order.customer && order.customer.email) ? order.customer.email : 'N/A';
        const customerPhone = (order.customer && order.customer.phone) ? order.customer.phone : 'N/A';
        
        tr.innerHTML = `
            <td><strong>#${order.id.substring(0, 6)}</strong></td>
            <td><strong>${customerName}</strong></td>
            <td>${orderDate}</td>
            <td><strong>${BRL(order.total || 0)}</strong></td>
            <td><span class="status ${statusInfo.class}">${statusInfo.text}</span></td>
            <td class="order-actions">
                ${(order.status === 'pending' || order.status === 'paid') ? 
                `<button class="action-btn ship" data-id="${order.id}">Marcar Enviado</button>
                 <button class="action-btn cancel" data-id="${order.id}">Cancelar</button>` 
                : ''}
            </td>
        `;
        tbody.appendChild(tr);

        // ==========================================
        // ABA EXPANSÍVEL: DETALHES REAIS DO PEDIDO E CUPOM
        // ==========================================
        const detailsTr = document.createElement('tr');
        detailsTr.className = 'order-details-row';
        detailsTr.style.display = 'none';
        
        // 1. Monta a lista de itens comprados
        let itemsHTML = '<ul style="list-style: none; padding: 0; margin: 0;">';
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                itemsHTML += `<li style="padding: 0.5rem 0; border-bottom: 1px solid #eee;">
                    ${item.quantity || 1}x <strong>${item.name || item.title || 'Produto'}</strong> - ${BRL(item.price || 0)}
                </li>`;
            });
        } else {
            itemsHTML += '<li>Nenhum item listado.</li>';
        }
        itemsHTML += '</ul>';

        // 2. Monta o endereço de entrega
        let addressHTML = 'Endereço não informado';
        const addr = (order.shipping && order.shipping.address) ? order.shipping.address : (order.customer && order.customer.address ? order.customer.address : null);
        
        if (addr) {
            addressHTML = `${addr.street || ''}, ${addr.number || ''} ${addr.complement ? '- ' + addr.complement : ''}<br>
                           ${addr.neighborhood || ''} - ${addr.city || ''}/${addr.state || ''}<br>
                           CEP: ${addr.cep || ''}`;
        }

        // 3. Método de envio, frete e CUPOM
        const freteMethod = (order.shipping && order.shipping.method) ? order.shipping.method : 'Padrão';
        const freteCost = (order.shipping && order.shipping.cost) ? order.shipping.cost : 0;
        const freteHTML = order.shipping ? `${freteMethod} - ${BRL(freteCost)}` : 'Não informado';
        
        let cupomHTML = '';
        if (order.cupomUsado || (order.desconto && order.desconto > 0)) {
            const nomeCupom = order.cupomUsado ? String(order.cupomUsado).toUpperCase() : 'Desconto';
            const valorDesconto = order.desconto ? BRL(order.desconto) : '';
            cupomHTML = `Cupom Aplicado: <strong style="color: #2ecc71;">${nomeCupom}</strong> <span style="color: #e74c3c;">${valorDesconto ? '(-' + valorDesconto + ')' : ''}</span><br>`;
        }

        detailsTr.innerHTML = `
            <td colspan="6" style="padding: 0;">
                <div style="padding: 1.5rem; background: #f8fafc; border-bottom: 2px solid #e2e8f0; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; text-align: left;">
                    <div>
                        <h4 style="margin-bottom: 0.5rem; color: #333; font-size: 1.1rem;">📦 Itens do Pedido</h4>
                        ${itemsHTML}
                        <div style="margin-top: 1rem; font-weight: bold; line-height: 1.6;">
                            Frete: ${freteHTML}<br>
                            ${cupomHTML}
                            Total do Pedido: <span style="color: #E05A3D; font-size: 1.2rem;">${BRL(order.total || 0)}</span>
                        </div>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 0.5rem; color: #333; font-size: 1.1rem;">📍 Dados do Cliente e Entrega</h4>
                        <p style="margin: 0; line-height: 1.5; font-size: 0.95rem;">
                            <strong>${customerName}</strong><br>
                            Email: ${customerEmail}<br>
                            Telefone: ${customerPhone}<br>
                            <br>
                            <strong>Endereço de Entrega:</strong><br>
                            ${addressHTML}
                        </p>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(detailsTr);
    });

    // 4. Botões de Página
    if (totalPages > 1) {
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === ordersCurrentPage ? 'active' : ''}`;
            btn.innerText = i;
            btn.addEventListener('click', () => {
                ordersCurrentPage = i;
                renderOrdersTable();
            });
            paginationContainer.appendChild(btn);
        }
    }
};

// Eventos de Busca de Pedidos (Sintaxe clássica)
const searchOrderTextEl = document.getElementById('search-order-text');
if (searchOrderTextEl) searchOrderTextEl.addEventListener('input', () => { ordersCurrentPage = 1; renderOrdersTable(); });

const searchOrderDateStartEl = document.getElementById('search-order-date-start');
if (searchOrderDateStartEl) searchOrderDateStartEl.addEventListener('change', () => { ordersCurrentPage = 1; renderOrdersTable(); });

const searchOrderDateEndEl = document.getElementById('search-order-date-end');
if (searchOrderDateEndEl) searchOrderDateEndEl.addEventListener('change', () => { ordersCurrentPage = 1; renderOrdersTable(); });

const searchOrderStatusEl = document.getElementById('search-order-status');
if (searchOrderStatusEl) searchOrderStatusEl.addEventListener('change', () => { ordersCurrentPage = 1; renderOrdersTable(); });

// ==========================================
// MÓDULO DO DASHBOARD FINANCEIRO E ESTOQUE
// ==========================================
let salesChartInstance = null;

const loadDashboard = () => {
    // 1. OUVINTE DE ESTOQUE (Produtos)
    onSnapshot(collection(db, 'products'), (snapshot) => {
        const lowStockList = document.getElementById('low-stock-list');
        lowStockList.innerHTML = '';
        let hasLowStock = false;

        snapshot.forEach(doc => {
            const prod = doc.data();
            if (prod.stock <= 5) { // Alerta para estoque menor ou igual a 5
                hasLowStock = true;
                lowStockList.innerHTML += `<li><span>${prod.name}</span> <strong style="color:#e74c3c;">${prod.stock} un.</strong></li>`;
            }
        });

        if (!hasLowStock) lowStockList.innerHTML = '<li><span style="color:#2ecc71;">Tudo sob controle!</span></li>';
    });

    // 2. OUVINTE DE VENDAS E FINANCEIRO
    // Puxa apenas pedidos Pagos ou Enviados para o financeiro
    const ordersQuery = query(collection(db, 'orders'), where('status', 'in', ['paid', 'shipped']));
    
    onSnapshot(ordersQuery, (snapshot) => {
        let faturamentoTotal = 0;
        let faturamentoMes = 0;
        let totalPedidosValidos = 0;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthlyData = {}; // Para o gráfico
        const productSales = {}; // Para o Top Produtos
        const customerSales = {}; // Para o Top Clientes

        // Inicializa os últimos 6 meses para o gráfico ficar bonito
        for (let i = 5; i >= 0; i--) {
            const d = new Date(currentYear, currentMonth - i, 1);
            const monthLabel = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            monthlyData[monthLabel] = 0;
        }

        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            const valor = order.total || 0;
            faturamentoTotal += valor;
            totalPedidosValidos++;

            // Processa a Data
            if (order.createdAt && typeof order.createdAt.toDate === 'function') {
                const orderDate = order.createdAt.toDate();
                
                // Faturamento do Mês Atual
                if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
                    faturamentoMes += valor;
                }

                // Agrupamento para o Gráfico
                const monthLabel = orderDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
                if (monthlyData[monthLabel] !== undefined) {
                    monthlyData[monthLabel] += valor;
                }
            }

            // Agrupa Top Produtos
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    productSales[item.name] = (productSales[item.name] || 0) + item.qty;
                });
            }

            // Agrupa Top Clientes
            if (order.customer && order.customer.email) {
                const email = order.customer.email;
                const nome = order.customer.name || email.split('@')[0];
                if (!customerSales[email]) customerSales[email] = { name: nome, spent: 0 };
                customerSales[email].spent += valor;
            }
        });

        const ticketMedio = totalPedidosValidos > 0 ? (faturamentoTotal / totalPedidosValidos) : 0;

        // Atualiza os Cards
        document.getElementById('dash-total').textContent = BRL(faturamentoTotal);
        document.getElementById('dash-mes').textContent = BRL(faturamentoMes);
        document.getElementById('dash-ticket').textContent = BRL(ticketMedio);

        // Atualiza Top Produtos
        const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
        document.getElementById('top-products-list').innerHTML = sortedProducts.length 
            ? sortedProducts.map(p => `<li><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${p[0]}</span> <strong>${p[1]} un.</strong></li>`).join('')
            : '<li>Ainda sem vendas.</li>';

        // Atualiza Top Clientes
        const sortedCustomers = Object.values(customerSales).sort((a, b) => b.spent - a.spent).slice(0, 5);
        document.getElementById('top-customers-list').innerHTML = sortedCustomers.length
            ? sortedCustomers.map(c => `<li><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">${c.name}</span> <strong>${BRL(c.spent)}</strong></li>`).join('')
            : '<li>Nenhum cliente ainda.</li>';

        // Atualiza o Gráfico (Destrói o antigo e recria para não bugar)
        const ctx = document.getElementById('salesChart');
        if (ctx) {
            if (salesChartInstance) salesChartInstance.destroy();
            salesChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Object.keys(monthlyData),
                    datasets: [{
                        label: 'Faturamento (R$)',
                        data: Object.values(monthlyData),
                        borderColor: '#E05A3D', // Terracota
                        backgroundColor: 'rgba(224, 90, 61, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#2C1B4D', // Roxo Meia-noite
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    });
};

// ==========================================
// 4. VERIFICAÇÃO DE SEGURANÇA E INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Vai no banco confirmar se a pessoa tem o crachá de Admin
            const roleRef = doc(db, 'roles', user.uid);
            const roleSnap = await getDoc(roleRef);
            
            if (roleSnap.exists() && roleSnap.data().admin === true) {
                // ✅ É Admin! Carrega todas as tabelas do painel
                if (typeof loadDashboard === 'function') loadDashboard();
                if (typeof loadOrders === 'function') loadOrders();
                if (typeof loadProducts === 'function') loadProducts();
                if (typeof loadCoupons === 'function') loadCoupons();
                if (typeof loadCRM === 'function') loadCRM();
            } else {
                console.warn("Acesso negado: Usuário não é administrador.");
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error("Erro ao verificar permissões:", error);
            window.location.href = 'login.html';
        }
    } else {
        // ❌ Ninguém está logado. Expulsa para a tela de login imediatamente.
        window.location.href = 'login.html';
    }
});

// ==========================================
// MÓDULO EXPORTAÇÃO CSV E CRM (COM PAGINAÇÃO)
// ==========================================

// Variáveis Globais de Paginação
let crmDataList = [];
let crmCurrentPage = 1;
let crmSearchTerm = '';
const itemsPerPage = 7; // Define 7 itens por página

// Exportação de Relatório (Blindado contra iPhones Antigos)
const btnExport = document.getElementById('btn-export-csv');
if (btnExport) {
    const newBtnExport = btnExport.cloneNode(true);
    btnExport.parentNode.replaceChild(newBtnExport, btnExport);
    
    newBtnExport.addEventListener('click', () => {
        let csvContent = "ID do Pedido,Nome do Cliente,E-mail,Telefone,Data,Total Pago (R$),Status,Frete (R$),Cupom Usado,Desconto (R$)\n";
        
        const textElement = document.getElementById('search-order-text');
        const statusElement = document.getElementById('search-order-status');
        const startElement = document.getElementById('search-order-date-start');
        const endElement = document.getElementById('search-order-date-end');

        const textValue = textElement ? textElement.value.toLowerCase().trim() : '';
        const statusValue = statusElement ? statusElement.value : '';
        const startDateStr = startElement ? startElement.value : '';
        const endDateStr = endElement ? endElement.value : '';

        let start = null; let end = null;
        if (startDateStr) { const [y, m, d] = startDateStr.split('-'); start = new Date(y, m - 1, d, 0, 0, 0); }
        if (endDateStr) { const [y, m, d] = endDateStr.split('-'); end = new Date(y, m - 1, d, 23, 59, 59); }

        const filteredOrders = allOrdersData.filter(order => {
            let orderDateObj = (order.createdAt && typeof order.createdAt.toDate === 'function') ? order.createdAt.toDate() : null;
            const idMatch = order.id.toLowerCase().includes(textValue);
            const customerName = (order.customer && order.customer.name) ? order.customer.name : '';
            const nameMatch = customerName.toLowerCase().includes(textValue);
            const statusMatch = statusValue === "" || order.status === statusValue;
            
            let dateMatch = true;
            if (orderDateObj) {
                if (start && orderDateObj < start) dateMatch = false;
                if (end && orderDateObj > end) dateMatch = false;
            } else if (start || end) {
                dateMatch = false;
            }
            return (idMatch || nameMatch) && dateMatch && statusMatch;
        });

        filteredOrders.forEach(order => {
            const id = order.id;
            const cliente = (order.customer && order.customer.name) ? order.customer.name : 'Não informado';
            const email = (order.customer && order.customer.email) ? order.customer.email : 'N/A';
            const telefone = (order.customer && order.customer.phone) ? order.customer.phone : 'N/A';
            const data = (order.createdAt && typeof order.createdAt.toDate === 'function') ? order.createdAt.toDate().toLocaleDateString('pt-BR') : 'Sem data';
            const cupom = order.cupomUsado ? String(order.cupomUsado).toUpperCase() : 'Nenhum';
            const desconto = order.desconto ? order.desconto.toFixed(2).replace('.', ',') : '0,00';
            const envioCusto = (order.shipping && order.shipping.cost) ? order.shipping.cost.toFixed(2).replace('.', ',') : '0,00';
            const total = order.total ? order.total.toFixed(2).replace('.', ',') : '0,00';
            const statusMap = { pending: 'Pendente', paid: 'Pago', shipped: 'Enviado', cancelled: 'Cancelado' };
            const status = statusMap[order.status] || 'Pendente';

            const clean = str => `"${String(str).replace(/"/g, '""')}"`;
            csvContent += `${clean(id)},${clean(cliente)},${clean(email)},${clean(telefone)},${clean(data)},${clean(total)},${clean(status)},${clean(envioCusto)},${clean(cupom)},${clean(desconto)}\n`;
        });

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_olomi_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
}

// Renderizar Tabela do CRM com Paginação
const renderCRM = () => {
    const tbody = document.getElementById('crm-table-body');
    const paginationContainer = document.getElementById('crm-pagination');
    if (!tbody) return;

    // 1. Aplica o Filtro de Busca primeiro
    const filteredList = crmDataList.filter(c => {
        const conteudo = `${c.nome} ${c.email} ${c.telefone}`.toLowerCase();
        return conteudo.includes(crmSearchTerm);
    });

    // 2. Calcula a Paginação
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);
    if (crmCurrentPage > totalPages) crmCurrentPage = totalPages || 1;

    const startIndex = (crmCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToDisplay = filteredList.slice(startIndex, endIndex);

    tbody.innerHTML = '';
    paginationContainer.innerHTML = '';

    if (itemsToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Nenhum cliente encontrado.</td></tr>';
        return;
    }

    // 3. Desenha os itens fatiados
    itemsToDisplay.forEach(c => {
        const ticketMedio = c.totalPedidos > 0 ? (c.ltv / c.totalPedidos) : 0;
        let ultimaCompra = 'Nunca comprou';
        if (c.ultimoPedido && typeof c.ultimoPedido.toDate === 'function') {
            ultimaCompra = c.ultimoPedido.toDate().toLocaleDateString('pt-BR');
        }

        let btnWhats = '';
        if (c.telefone) {
            const numLimpo = c.telefone.replace(/\D/g, ''); 
            if (numLimpo.length >= 10) {
                btnWhats = `<a href="https://wa.me/55${numLimpo}" target="_blank" class="action-btn" style="background-color: #25D366; color: white; text-decoration: none; padding: 0.4rem 0.8rem; border-radius: 5px; display: inline-block;">WhatsApp</a>`;
            }
        }

        const badge = c.isRegistered 
            ? `<span style="font-size: 0.7rem; background: #3498db; color: white; padding: 2px 6px; border-radius: 4px;">Conta Criada</span>` 
            : `<span style="font-size: 0.7rem; background: #e67e22; color: white; padding: 2px 6px; border-radius: 4px;">S/ Cadastro</span>`;

        tbody.innerHTML += `
            <tr class="crm-row">
                <td><strong>${c.nome}</strong><br>${badge}</td>
                <td>${c.email}<br><small>${c.telefone || 'Sem telefone'}</small></td>
                <td><strong style="color: #E05A3D">${BRL(c.ltv || 0)}</strong></td>
                <td>${BRL(ticketMedio)}</td>
                <td>${ultimaCompra}<br><small style="color: #666;">${c.totalPedidos} pedido(s)</small></td>
                <td>${btnWhats}</td>
            </tr>
        `;
    });

    // 4. Desenha os Botões de Página
    if (totalPages > 1) {
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === crmCurrentPage ? 'active' : ''}`;
            btn.innerText = i;
            btn.addEventListener('click', () => {
                crmCurrentPage = i;
                renderCRM();
            });
            paginationContainer.appendChild(btn);
        }
    }
};

const loadCRM = () => {
    let usersData = {};
    let customersData = {};

    const processData = () => {
        const combined = {};
        Object.values(usersData).forEach(u => {
            const email = (u.email || '').toLowerCase();
            combined[email] = { nome: u.name || 'Sem nome', email: email, telefone: u.phone || '', ltv: 0, totalPedidos: 0, ultimoPedido: null, isRegistered: true };
        });
        Object.values(customersData).forEach(c => {
            const email = (c.email || '').toLowerCase();
            if (combined[email]) {
                combined[email].ltv = c.ltv || 0;
                combined[email].totalPedidos = c.totalPedidos || 0;
                combined[email].ultimoPedido = c.ultimoPedido;
                if (!combined[email].telefone && c.telefone) combined[email].telefone = c.telefone;
            } else {
                combined[email] = { nome: c.nome || 'Cliente', email: email, telefone: c.telefone || '', ltv: c.ltv || 0, totalPedidos: c.totalPedidos || 0, ultimoPedido: c.ultimoPedido, isRegistered: false };
            }
        });

        // Atualiza a lista global e chama o renderizador
        crmDataList = Object.values(combined).sort((a, b) => b.ltv - a.ltv);
        renderCRM();
    };

    onSnapshot(collection(db, 'users'), (snapshot) => {
        usersData = {};
        snapshot.forEach(docSnap => { usersData[docSnap.id] = docSnap.data(); });
        processData();
    });

    onSnapshot(collection(db, 'customers'), (snapshot) => {
        customersData = {};
        snapshot.forEach(docSnap => { customersData[docSnap.id] = docSnap.data(); });
        processData();
    });
};

// Motor de Busca Específico do CRM (Agora aciona a paginação)
const searchCrmText = document.getElementById('search-crm-text');
if (searchCrmText) {
    searchCrmText.addEventListener('input', (e) => {
        crmSearchTerm = e.target.value.toLowerCase().trim();
        crmCurrentPage = 1; // Volta pra página 1 ao pesquisar
        renderCRM();
    });
}

// ==========================================
// 5. EVENT LISTENERS (Cliques, Uploads, Submits)
// ==========================================

// -> Upload Interativo da Logo
if (logoContainer && logoInput) {
    logoContainer.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        selectedLogoFile = file;
        const reader = new FileReader();
        reader.onload = (event) => { if(currentLogoImg) currentLogoImg.src = event.target.result; };
        reader.readAsDataURL(file);
    });
}

// -> Formulário de Temas
if (themeForm) {
    const btnSubmit = themeForm.querySelector('button');
    if (btnSubmit) btnSubmit.textContent = 'Salvar Tema da Loja';

    themeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = themeForm.querySelector('button');
        btn.textContent = 'Salvando...';
        btn.disabled = true;

        try {
            let finalLogoUrl = null;

            if (selectedLogoFile) {
                showToast('Fazendo upload da nova logo...', 'info');
                const fileRef = ref(storage, `settings/logo_${Date.now()}_${selectedLogoFile.name}`);
                const snapshot = await uploadBytes(fileRef, selectedLogoFile);
                finalLogoUrl = await getDownloadURL(snapshot.ref);
            }

            const themeRef = doc(db, 'settings', 'storeTheme');
            const themeData = {
                primaryColor: themeForm.themeColor.value,
                topBarMessage: themeForm.topBarText.value,
                topBarAnimation: themeForm.topBarAnimation.value,
                updatedAt: new Date()
            };

            if (finalLogoUrl) {
                themeData.logoUrl = finalLogoUrl;
            }

            await updateDoc(themeRef, themeData).catch(async (err) => {
                if(err.code === 'not-found') {
                    await setDoc(themeRef, themeData);
                } else throw err;
            });

            showToast('Tema atualizado com sucesso!', 'success');

            if (finalLogoUrl) {
                document.querySelectorAll('.logo, .login-logo').forEach(img => img.src = finalLogoUrl);
                selectedLogoFile = null; 
            }

        } catch (error) {
            console.error("Erro ao salvar tema:", error);
            showToast('Erro ao atualizar tema.', 'error');
        } finally {
            btn.textContent = 'Salvar Tema da Loja';
            btn.disabled = false;
        }
    });
}

// -> Upload de Imagens do Produto (Preview)
if(imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        imagePreviewContainer.innerHTML = '';
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                imagePreviewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

// -> Tabela de Pedidos
if(ordersTableBody) {
    ordersTableBody.addEventListener('click', async (e) => {
        const actionButton = e.target.closest('.action-btn');
        const summaryRow = e.target.closest('.order-summary-row');

        if (actionButton) {
            e.stopPropagation();
            const id = actionButton.getAttribute('data-id');
            const orderRef = doc(db, 'orders', id);

            if (actionButton.classList.contains('ship')) {
                if (await showConfirmation('Marcar como Enviado?', 'O estado do pedido será alterado para "Enviado".', 'Sim, enviar')) {
                    await updateDoc(orderRef, { status: 'shipped' });
                    showToast('Pedido marcado como enviado!', 'success');
                }
            } else if (actionButton.classList.contains('cancel')) {
                if (await showConfirmation('Cancelar este Pedido?', 'Esta ação não pode ser revertida.', 'Sim, cancelar')) {
                    await updateDoc(orderRef, { status: 'cancelled' });
                    showToast('Pedido cancelado.', 'info');
                }
            }
        } else if (summaryRow) {
            const detailsRow = summaryRow.nextElementSibling;
            if (detailsRow && detailsRow.classList.contains('order-details-row')) {
                detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
            }
        }
    });
}

// -> Tabela de Produtos
if(productsTableBody) {
    productsTableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('.action-btn-icon');
        if (!target) return;
        const id = target.getAttribute('data-id');

        if (target.classList.contains('delete')) {
            if (await showConfirmation('Tem a certeza?', 'O produto será apagado permanentemente.', 'Sim, apagar')) {
                try {
                    const productRef = doc(db, 'products', id);
                    const productSnap = await getDoc(productRef);
                    if(productSnap.exists()) {
                        const productData = productSnap.data();
                        if (productData.imageUrls && productData.imageUrls.length > 0) {
                            for (const url of productData.imageUrls) {
                                await deleteObject(ref(storage, url)).catch(() => {});
                            }
                        }
                    }
                    await deleteDoc(productRef);
                    showToast('Produto apagado com sucesso!');
                    if (currentEditingProductId === id) {
                        productForm.reset();
                        imagePreviewContainer.innerHTML = '';
                        currentEditingProductId = null;
                        productForm.querySelector('button[type="submit"]').textContent = 'Salvar Produto';
                    }
                } catch (error) {
                    showToast('Falha ao apagar o produto.', 'error');
                }
            }
        }

        if (target.classList.contains('edit')) {
            const productRef = doc(db, 'products', id);
            const productSnap = await getDoc(productRef);
            const product = productSnap.data();

            productForm.name.value = product.name;
            productForm.description.value = product.description;
            productForm.price.value = product.price;
            productForm.promoPrice.value = product.promotionalPrice || '';
            productForm.stock.value = product.stock;
            productForm.category.value = product.category;
            productForm.weight.value = product.weight || '';
            productForm.length.value = product.length || '';
            productForm.width.value = product.width || '';
            productForm.height.value = product.height || '';

            imagePreviewContainer.innerHTML = '';
            if (product.imageUrls && product.imageUrls.length > 0) {
                product.imageUrls.forEach(url => {
                    const img = document.createElement('img');
                    img.src = url;
                    imagePreviewContainer.appendChild(img);
                });
            }

            currentEditingProductId = id;
            existingImageUrls = product.imageUrls || [];
            productForm.querySelector('button[type="submit"]').textContent = 'Atualizar Produto';
            window.scrollTo(0, 0);
        }
    });
}

// -> Salvar Produto
if(productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = productForm.querySelector('button[type="submit"]');
        const isEditing = !!currentEditingProductId;
        submitButton.disabled = true;
        submitButton.textContent = isEditing ? 'Atualizando...' : 'Salvando...';

        try {
            let imageUrls = existingImageUrls;
            const files = imageUpload.files;

            if (files.length > 0) {
                const novasImagens = [];
                for (const file of Array.from(files)) {
                    const compressedBlob = await compressImage(file, 800, 0.8);
                    const novoNome = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    const fileRef = ref(storage, `products/${Date.now()}_${novoNome}`);
                    const snapshot = await uploadBytes(fileRef, compressedBlob, { contentType: 'image/webp' });                
                    novasImagens.push(await getDownloadURL(snapshot.ref));
                }
                imageUrls = novasImagens;

                if (isEditing && existingImageUrls.length > 0) {
                     for (const url of existingImageUrls) {
                        await deleteObject(ref(storage, url)).catch(() => {});
                    }
                }
            }

            const productData = {
                name: productForm.name.value,
                description: productForm.description.value,
                price: parseFloat(productForm.price.value.replace(',', '.')),
                promotionalPrice: parseFloat(productForm.promoPrice.value) || null,
                stock: parseInt(productForm.stock.value),
                category: productForm.category.value,
                weight: parseFloat(productForm.weight.value) || 0,
                length: parseInt(productForm.length.value) || 0,
                width: parseInt(productForm.width.value) || 0,
                height: parseInt(productForm.height.value) || 0,
                imageUrls: imageUrls
            };

            if (isEditing) {
                await updateDoc(doc(db, 'products', currentEditingProductId), productData);
                showToast('Produto atualizado com sucesso!', 'success');
            } else {
                await addDoc(collection(db, 'products'), { ...productData, createdAt: new Date() });
                showToast('Produto adicionado com sucesso!', 'success');
            }

            productForm.reset();
            imagePreviewContainer.innerHTML = '';
            currentEditingProductId = null;
            existingImageUrls = [];

        } catch (error) {
            showToast(`Falha ao salvar produto`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Produto';
            imageUpload.value = '';
        }
    });
}

// ==========================================
// 6. MOTOR DE CUPONS DE DESCONTO
// ==========================================
const couponForm = document.getElementById('coupon-form');
const couponsTableBody = document.querySelector('#coupons-table tbody');

if (couponForm && couponsTableBody) {
    
    // -> CRIAR OU ATUALIZAR CUPOM
    couponForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = couponForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const formData = new FormData(couponForm);
        const codigo = formData.get('codigo').trim().toUpperCase();
        
        const cupomData = {
            tipo: formData.get('tipo'),
            valor: parseFloat(formData.get('valor')),
            valorMinimo: parseFloat(formData.get('valorMinimo')) || 0,
            limiteUso: parseInt(formData.get('limiteUso')) || 999,
            ativo: formData.get('ativo') === 'on',
            updatedAt: new Date()
        };

        try {
            const cupomRef = doc(db, 'coupons', codigo);
            const cupomSnap = await getDoc(cupomRef);
            
            // Se o cupom for novo, inicia os usos em zero.
            if (!cupomSnap.exists()) {
                cupomData.usado = 0; 
            }

            await setDoc(cupomRef, cupomData, { merge: true });
            
            // Exibe o alerta bonito na tela!
            Swal.fire('Axé!', 'Cupom criado com sucesso!', 'success');
            couponForm.reset();
        } catch (error) {
            console.error("Erro ao salvar cupom:", error);
            Swal.fire('Erro', 'Não foi possível salvar o cupom.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Criar / Atualizar Cupom';
        }
    });

    // -> LER E EXIBIR OS CUPONS NA TABELA
    const couponsRef = collection(db, 'coupons');
    onSnapshot(couponsRef, (snapshot) => {
        couponsTableBody.innerHTML = '';
        
        snapshot.forEach((documento) => {
            const cupom = documento.data();
            const id = documento.id;
            
            const descontoTexto = cupom.tipo === 'porcentagem' 
                ? `${cupom.valor}%` 
                : `R$ ${cupom.valor.toFixed(2)}`;
                
            const statusHtml = cupom.ativo 
                ? '<span class="status shipped" style="background-color: #2ecc71;">Ativo</span>' 
                : '<span class="status cancelled" style="background-color: #e74c3c;">Pausado</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold; color: var(--cor-laranja); font-size: 1.1rem;">${id}</td>
                <td style="font-weight: bold;">${descontoTexto}</td>
                <td>R$ ${cupom.valorMinimo.toFixed(2)}</td>
                <td>${cupom.usado || 0} / ${cupom.limiteUso}</td>
                <td>${statusHtml}</td>
                <td>
                    <button class="action-btn toggle-coupon-btn" data-id="${id}" data-ativo="${cupom.ativo}" style="background-color: #f39c12; color: white; margin-right: 5px;">
                        ${cupom.ativo ? 'Pausar' : 'Ativar'}
                    </button>
                    <button class="action-btn delete-coupon-btn" data-id="${id}" style="background-color: #e74c3c; color: white;">
                        Excluir
                    </button>
                </td>
            `;
            couponsTableBody.appendChild(tr);
        });

        // -> AÇÕES DA TABELA DE CUPONS (Pausar/Excluir)
        document.querySelectorAll('.toggle-coupon-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const isAtivo = e.target.getAttribute('data-ativo') === 'true';
                await updateDoc(doc(db, 'coupons', id), { ativo: !isAtivo });
            });
        });

        document.querySelectorAll('.delete-coupon-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                Swal.fire({
                    title: 'Tem certeza?',
                    text: `Você vai deletar o cupom ${id} para sempre!`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#e74c3c',
                    confirmButtonText: 'Sim, excluir!'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        await deleteDoc(doc(db, 'coupons', id));
                    }
                });
            });
        });
    });
}

