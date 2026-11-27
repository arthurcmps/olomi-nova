import { auth, db, storage } from './firebase.js';

import {
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc
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

const ordersLoadingEl =
    document.getElementById('orders-loading');

const ordersEmptyEl =
    document.getElementById('orders-empty');

const ordersTableWrapperEl =
    document.getElementById('orders-table-wrapper');

const ordersTableBodyEl =
    document.getElementById('orders-table-body');

const ordersSearchEl =
    document.getElementById('orders-search');

const refreshOrdersEl =
    document.getElementById('refresh-orders');

const orderDetailsEl =
    document.getElementById('order-details');

const orderDetailsTitleEl =
    document.getElementById('order-details-title');

const orderDetailsDateEl =
    document.getElementById('order-details-date');

const orderDetailsContentEl =
    document.getElementById('order-details-content');

const closeOrderDetailsEl =
    document.getElementById('close-order-details');

const orderStatusSelectEl =
    document.getElementById('order-status-select');

const saveOrderStatusEl =
    document.getElementById('save-order-status');

const orderDetailsBodyEl =
    document.getElementById('order-details-body');

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

const productLengthEl =
    document.getElementById('product-length');

const productWidthEl =
    document.getElementById('product-width');

const productHeightEl =
    document.getElementById('product-height');

const productDescriptionEl =
    document.getElementById('product-description');

const productImagesEl =
    document.getElementById('product-images');

const productCurrentImagesEl =
    document.getElementById('product-current-images');

const productImagesPreviewEl =
    document.getElementById('product-images-preview');

const cancelProductEditEl =
    document.getElementById('cancel-product-edit');

const newProductButtonEl =
    document.getElementById('new-product-button');

const productEditorTitleEl =
    document.getElementById('product-editor-title');


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

    const totalEl =
        document.getElementById('stat-products');

    if (totalEl) {
        totalEl.textContent = String(products.length);
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

                            <button
                                type="button"
                                class="table-action-button"
                                data-product-action="delete"
                                data-product-id="${escapeHTML(product.id)}"
                            >
                                Excluir
                            </button>

                        </div>

                    </td>

                </tr>

            `;

        }).join('');

}

function openNewProductEditor() {

    // Limpa o ID do produto para indicar
    // que estamos criando um novo produto
    productIdEl.value = '';

    // Limpa os campos do formulário
    productNameEl.value = '';
    productCategoryEl.value = '';
    productPriceEl.value = '';
    productPromotionalPriceEl.value = '';
    productStockEl.value = '';
    productWeightEl.value = '';
    productLengthEl.value = '';
    productWidthEl.value = '';
    productHeightEl.value = '';
    productDescriptionEl.value = '';

    // Limpa as imagens atuais e as novas imagens selecionadas
    productCurrentImagesEl.innerHTML = '';
    productImagesPreviewEl.innerHTML = '';

    if (productImagesEl) {
        productImagesEl.value = '';
    }

    // Altera o título do editor
    if (productEditorTitleEl) {
        productEditorTitleEl.textContent =
            'Novo produto';
    }

    // Exibe o editor
    productEditorEl.hidden = false;

    // Leva o usuário até o formulário
    productEditorEl.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });

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

    if (productEditorTitleEl) {
    productEditorTitleEl.textContent =
        'Editar produto';
}

const saveButton =
    document.getElementById('save-product');

if (saveButton) {
    saveButton.textContent =
        'Salvar alterações';
}

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

    productLengthEl.value =
        product.length ?? '';

    productWidthEl.value =
        product.width ?? '';

    productHeightEl.value =
        product.height ?? '';

    productDescriptionEl.value =
        product.description || '';

    renderCurrentProductImages(product);

    productEditorEl.hidden = false;

    productEditorEl.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function renderCurrentProductImages(product) {

    if (!productCurrentImagesEl) {
        return;
    }

    productCurrentImagesEl.innerHTML = '';

    const images =
        Array.isArray(product.imageUrls)
            ? product.imageUrls
            : [];

    const imagePaths =
        Array.isArray(product.imagePaths)
            ? product.imagePaths
            : [];

    if (!images.length) {

        productCurrentImagesEl.textContent =
            'Este produto ainda não possui imagens cadastradas.';

        return;

    }

    images.forEach((url, index) => {

        const item =
            document.createElement('div');

        item.className =
            'product-image-preview-item';

        const image =
            document.createElement('img');

        image.src = url;

        image.alt =
            `Imagem ${index + 1} do produto`;

        image.loading = 'lazy';

        const label =
            document.createElement('span');

        label.textContent =
            index === 0
                ? 'Imagem principal'
                : `Imagem ${index + 1}`;

        const actions =
            document.createElement('div');

        actions.className =
            'product-image-actions';

        if (index !== 0) {

            const primaryButton =
                document.createElement('button');

            primaryButton.type = 'button';

            primaryButton.className =
                'product-image-action-button';

            primaryButton.textContent =
                'Definir principal';

            primaryButton.dataset.imageAction =
                'primary';

            primaryButton.dataset.imageIndex =
                String(index);

            actions.appendChild(
                primaryButton
            );

        }

        const deleteButton =
            document.createElement('button');

        deleteButton.type = 'button';

        deleteButton.className =
            'product-image-action-button product-image-delete-button';

        deleteButton.textContent =
            'Excluir';

        deleteButton.dataset.imageAction =
            'delete';

        deleteButton.dataset.imageIndex =
            String(index);

        actions.appendChild(
            deleteButton
        );

        item.append(
            image,
            label,
            actions
        );

        productCurrentImagesEl.appendChild(
            item
        );

    });

}

function getStoragePathFromDownloadUrl(url) {

    if (!url) {
        return null;
    }

    try {

        const parsedUrl =
            new URL(url);

        const match =
            parsedUrl.pathname.match(
                /\/o\/(.+)$/
            );

        if (!match) {
            return null;
        }

        return decodeURIComponent(
            match[1]
        );

    } catch (error) {

        console.warn(
            'Não foi possível identificar o caminho da imagem no Storage:',
            error
        );

        return null;

    }

}

async function setPrimaryProductImage(
    productId,
    imageIndex
) {

    const product =
        adminProducts.find(
            item => item.id === productId
        );

    if (!product) {
        return;
    }

    const imageUrls =
        Array.isArray(product.imageUrls)
            ? [...product.imageUrls]
            : [];

    const imagePaths =
        Array.isArray(product.imagePaths)
            ? [...product.imagePaths]
            : [];

    if (
        imageIndex < 0 ||
        imageIndex >= imageUrls.length
    ) {
        return;
    }

    if (imageIndex === 0) {
        return;
    }

    const selectedUrl =
        imageUrls.splice(
            imageIndex,
            1
        )[0];

    imageUrls.unshift(
        selectedUrl
    );

    const selectedPath =
        imagePaths.length > imageIndex
            ? imagePaths.splice(
                imageIndex,
                1
            )[0]
            : null;

    imagePaths.unshift(
        selectedPath || null
    );

    try {

        await updateDoc(
            doc(
                db,
                'products',
                productId
            ),
            {
                imageUrls,
                imagePaths
            }
        );

        const productIndex =
            adminProducts.findIndex(
                item => item.id === productId
            );

        if (productIndex !== -1) {

            adminProducts[productIndex] = {
                ...adminProducts[productIndex],
                imageUrls,
                imagePaths
            };

        }

        renderCurrentProductImages(
            adminProducts[productIndex]
        );

        renderProductsTable(
            adminProducts
        );

        Swal.fire({
            icon: 'success',
            title: 'Imagem principal alterada',
            text: 'A nova imagem principal foi definida.',
            timer: 1500,
            showConfirmButton: false
        });

    } catch (error) {

        console.error(
            'Erro ao definir imagem principal:',
            error
        );

        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível alterar a imagem principal.'
        });

    }

}

async function deleteProductImage(
    productId,
    imageIndex
) {

    const product =
        adminProducts.find(
            item => item.id === productId
        );

    if (!product) {
        return;
    }

    const imageUrls =
        Array.isArray(product.imageUrls)
            ? [...product.imageUrls]
            : [];

    const imagePaths =
        Array.isArray(product.imagePaths)
            ? [...product.imagePaths]
            : [];

    if (
        imageIndex < 0 ||
        imageIndex >= imageUrls.length
    ) {
        return;
    }

    if (imageUrls.length === 1) {

        const result =
            await Swal.fire({
                icon: 'warning',
                title: 'Excluir a única imagem?',
                text: 'O produto ficará sem imagem no catálogo.',
                showCancelButton: true,
                confirmButtonText: 'Sim, excluir',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#a33',
                reverseButtons: true
            });

        if (!result.isConfirmed) {
            return;
        }

    } else {

        const result =
            await Swal.fire({
                icon: 'warning',
                title: 'Excluir imagem?',
                text: 'Esta imagem será removida do produto.',
                showCancelButton: true,
                confirmButtonText: 'Sim, excluir',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#a33',
                reverseButtons: true
            });

        if (!result.isConfirmed) {
            return;
        }

    }

    const imageUrl =
        imageUrls[imageIndex];

    const imagePath =
        imagePaths[imageIndex] ||
        getStoragePathFromDownloadUrl(
            imageUrl
        );

    try {

        if (imagePath) {

            const fileRef =
                storageRef(
                    storage,
                    imagePath
                );

            await deleteObject(
                fileRef
            );

        }

        imageUrls.splice(
            imageIndex,
            1
        );

        if (
            imagePaths.length > imageIndex
        ) {

            imagePaths.splice(
                imageIndex,
                1
            );

        }

        await updateDoc(
            doc(
                db,
                'products',
                productId
            ),
            {
                imageUrls,
                imagePaths
            }
        );

        const productIndex =
            adminProducts.findIndex(
                item => item.id === productId
            );

        if (productIndex !== -1) {

            adminProducts[productIndex] = {
                ...adminProducts[productIndex],
                imageUrls,
                imagePaths
            };

            renderCurrentProductImages(
                adminProducts[productIndex]
            );

            renderProductsTable(
                adminProducts
            );

        }

        Swal.fire({
            icon: 'success',
            title: 'Imagem excluída',
            text: 'A imagem foi removida com sucesso.',
            timer: 1500,
            showConfirmButton: false
        });

    } catch (error) {

        console.error(
            'Erro ao excluir imagem:',
            error
        );

        Swal.fire({
            icon: 'error',
            title: 'Erro ao excluir',
            text: 'Não foi possível remover a imagem.'
        });

    }

}

function renderSelectedProductImages(files) {

    if (!productImagesPreviewEl) {
        return;
    }

    productImagesPreviewEl.innerHTML = '';

    Array.from(files).forEach((file, index) => {

        const item = document.createElement('div');
        item.className = 'product-image-preview-item';

        const image = document.createElement('img');
        image.src = URL.createObjectURL(file);
        image.alt = file.name;

        const label = document.createElement('span');
        label.textContent = `Nova imagem ${index + 1}`;

        item.append(image, label);

        productImagesPreviewEl.appendChild(item);

    });

}

async function uploadProductImages(productId, files) {

    const uploadedUrls = [];
    const uploadedPaths = [];
    const uploadedRefs = [];

    try {

        for (let index = 0; index < files.length; index++) {

            const file = files[index];

            const safeName = file.name.replace(
                /[^a-zA-Z0-9._-]/g,
                '_'
            );

            const path =
                `products/${productId}/${Date.now()}_${index}_${safeName}`;

            const fileRef = storageRef(storage, path);

            await uploadBytes(fileRef, file);

            uploadedRefs.push(fileRef);

            const downloadUrl =
                await getDownloadURL(fileRef);

            uploadedUrls.push(downloadUrl);
            uploadedPaths.push(path);

        }

        return {
            urls: uploadedUrls,
            paths: uploadedPaths,
            refs: uploadedRefs
        };

    } catch (error) {

        await Promise.all(
            uploadedRefs.map(fileRef =>
                deleteObject(fileRef).catch(
                    cleanupError => {
                        console.error(
                            'Erro ao limpar upload incompleto:',
                            cleanupError
                        );
                    }
                )
            )
        );

        throw error;

    }

}

async function saveProductChanges() {

    if (!productFormEl) {
        return;
    }

    const productId = productIdEl.value.trim();

    const isCreatingProduct = !productId;

    const productData = {
        name: productNameEl.value.trim(),
        category: productCategoryEl.value.trim(),
        price: Number(productPriceEl.value),
        promotionalPrice:
            productPromotionalPriceEl.value.trim() === ''
                ? 0
                : Number(productPromotionalPriceEl.value),
        stock: Number(productStockEl.value),
        weight:
            productWeightEl.value.trim() === ''
                ? 0
                : Number(productWeightEl.value),

        length:
            productLengthEl.value.trim() === ''
                ? 0
                : Number(productLengthEl.value),

        width:
            productWidthEl.value.trim() === ''
                ? 0
                : Number(productWidthEl.value),

        height:
            productHeightEl.value.trim() === ''
                ? 0
                : Number(productHeightEl.value),

        description:
            productDescriptionEl.value.trim()
    };

    if (!productData.name) {
        Swal.fire({
            icon: 'warning',
            title: 'Nome obrigatório',
            text: 'Informe o nome do produto.'
        });
        return;
    }

    if (!productData.category) {
        Swal.fire({
            icon: 'warning',
            title: 'Categoria obrigatória',
            text: 'Informe a categoria do produto.'
        });
        return;
    }

    if (productData.price < 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Preço inválido',
            text: 'O preço não pode ser negativo.'
        });
        return;
    }

    if (
        productData.promotionalPrice < 0 ||
        (
            productData.promotionalPrice > 0 &&
            productData.promotionalPrice >= productData.price
        )
    ) {
        Swal.fire({
            icon: 'warning',
            title: 'Preço promocional inválido',
            text: 'O preço promocional deve ser maior que zero e menor que o preço normal.'
        });
        return;
    }

    if (productData.stock < 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Estoque inválido',
            text: 'O estoque não pode ser negativo.'
        });
        return;
    }

    if (
    productData.weight < 0 ||
    productData.length < 0 ||
    productData.width < 0 ||
    productData.height < 0
) {
    Swal.fire({
        icon: 'warning',
        title: 'Medidas inválidas',
        text: 'Peso e dimensões não podem ser negativos.'
    });
    return;
}

    const saveButton =
        document.getElementById('save-product');

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
    }

    const selectedImageFiles =
    Array.from(productImagesEl?.files || []);

for (const file of selectedImageFiles) {

    if (!file.type.startsWith('image/')) {

    if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent =
            isCreatingProduct
                ? 'Salvar produto'
                : 'Salvar alterações';
    }

    Swal.fire({
        icon: 'warning',
        title: 'Arquivo inválido',
        text: 'Selecione somente arquivos de imagem.'
    });

    return;
}

    if (file.size >= 10 * 1024 * 1024) {

    if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent =
            isCreatingProduct
                ? 'Salvar produto'
                : 'Salvar alterações';
    }

    Swal.fire({
        icon: 'warning',
        title: 'Imagem muito grande',
        text: `O arquivo "${file.name}" deve ter menos de 10 MB.`
    });

    return;
}

}

let uploadedStorageRefs = [];
let savedProductId = productId;

    try {

        let productRef;

        if (isCreatingProduct) {

            productRef = await addDoc(
                collection(db, 'products'),
                {
                    ...productData,
                    imageUrls: [],
                    imagePaths: []
                }
            );

        } else {

            productRef =
                doc(db, 'products', productId);

        }

         savedProductId =
            productRef.id;

        if (selectedImageFiles.length > 0) {

        const uploadResult =
            await uploadProductImages(
                savedProductId,
                selectedImageFiles
            );

    uploadedStorageRefs =
        uploadResult.refs;

    const currentProduct =
        isCreatingProduct
            ? null
            : adminProducts.find(
                product => product.id === productId
            );

    const currentImageUrls =
        Array.isArray(currentProduct?.imageUrls)
            ? currentProduct.imageUrls
            : [];

    const currentImagePaths =
        Array.isArray(currentProduct?.imagePaths)
            ? currentProduct.imagePaths
            : [];

    // Mantém imagePaths alinhado com imageUrls,
    // inclusive para produtos antigos que ainda
    // não possuem caminhos registrados.
    const normalizedImagePaths =
        currentImageUrls.map(
            (_, index) =>
                currentImagePaths[index] || null
        );

    productData.imageUrls = [
        ...currentImageUrls,
        ...uploadResult.urls
    ];

    productData.imagePaths = [
        ...normalizedImagePaths,
        ...uploadResult.paths
    ];

}

        await updateDoc(
            productRef,
            productData
        );

        if (isCreatingProduct) {

            adminProducts.push({
                id: savedProductId,
                ...productData
            });

        } else {

            const productIndex =
                adminProducts.findIndex(
                    product => product.id === productId
                );

            if (productIndex !== -1) {

                adminProducts[productIndex] = {
                    ...adminProducts[productIndex],
                    ...productData
                };

            }

        }

        renderProductsTable(adminProducts);

        if (productEditorEl) {
            productEditorEl.hidden = true;
        }

        Swal.fire({
            icon: 'success',
            title: isCreatingProduct
                ? 'Produto criado'
                : 'Produto atualizado',
            text: isCreatingProduct
                ? 'O produto foi cadastrado com sucesso.'
                : 'As alterações foram salvas com sucesso.',
            timer: 1800,
            showConfirmButton: false
        });

    } catch (error) {

    console.error(
        'Erro ao salvar produto:',
        error
    );

    // Se o produto foi criado e alguma etapa posterior falhou,
    // remove o documento recém-criado para evitar registro órfão.
    if (isCreatingProduct && savedProductId) {

        try {

            await deleteDoc(
                doc(
                    db,
                    'products',
                    savedProductId
                )
            );

        } catch (cleanupError) {

            console.error(
                'Erro ao remover produto criado após falha:',
                cleanupError
            );

        }

    }

    // Se alguma imagem já foi enviada antes da falha,
    // remove essas imagens do Storage.
    if (uploadedStorageRefs.length > 0) {

        await Promise.all(
            uploadedStorageRefs.map(fileRef =>
                deleteObject(fileRef).catch(
                    cleanupError => {

                        console.error(
                            'Erro ao remover imagem após falha:',
                            cleanupError
                        );

                    }
                )
            )
        );

    }

    Swal.fire({
        icon: 'error',
        title: 'Erro ao salvar',
        text: isCreatingProduct
            ? 'Não foi possível cadastrar o produto.'
            : 'Não foi possível atualizar o produto.'
    });

} finally {

        if (productImagesEl) {
            productImagesEl.value = '';
        }

        if (productImagesPreviewEl) {
            productImagesPreviewEl.innerHTML = '';
        }

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = isCreatingProduct
                ? 'Salvar produto'
                : 'Salvar alterações';
        }
    }
}

async function deleteProduct(productId) {

    const product =
        adminProducts.find(
            item => item.id === productId
        );

    if (!product) {
        console.error(
            'Produto não encontrado:',
            productId
        );
        return;
    }

    const result = await Swal.fire({
        icon: 'warning',
        title: 'Excluir produto?',
        text: `O produto "${product.name}" e suas imagens serão removidos do catálogo. Essa ação não poderá ser desfeita.`,
        showCancelButton: true,
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#a33',
        reverseButtons: true
    });

    if (!result.isConfirmed) {
        return;
    }

    try {

        /*
         * Monta a lista de caminhos das imagens
         * que precisam ser removidas do Storage.
         *
         * Produtos novos possuem imagePaths.
         * Produtos antigos podem possuir apenas imageUrls.
         */
        const imagePaths = [];

        if (Array.isArray(product.imagePaths)) {

            product.imagePaths.forEach(path => {

                if (
                    path &&
                    typeof path === 'string'
                ) {
                    imagePaths.push(path);
                }

            });

        }

        /*
         * Compatibilidade com produtos antigos:
         * se não houver imagePaths correspondentes,
         * tenta descobrir o caminho diretamente
         * a partir da URL do Storage.
         */
        if (Array.isArray(product.imageUrls)) {

            product.imageUrls.forEach((url, index) => {

                const existingPath =
                    imagePaths[index];

                if (!existingPath) {

                    const derivedPath =
                        getStoragePathFromDownloadUrl(
                            url
                        );

                    if (derivedPath) {
                        imagePaths.push(
                            derivedPath
                        );
                    }

                }

            });

        }

        /*
         * Remove caminhos duplicados.
         */
        const uniqueImagePaths =
            [...new Set(imagePaths)];

        /*
         * Exclui as imagens do Firebase Storage.
         *
         * Cada imagem é tratada individualmente.
         * Se uma imagem já não existir, a exclusão
         * do produto não deve ser interrompida.
         */
        const storageDeletionResults =
            await Promise.all(
                uniqueImagePaths.map(
                    async imagePath => {

                        try {

                            await deleteObject(
                                storageRef(
                                    storage,
                                    imagePath
                                )
                            );

                            return {
                                success: true,
                                path: imagePath
                            };

                        } catch (error) {

                            console.warn(
                                'Não foi possível excluir a imagem do Storage:',
                                imagePath,
                                error
                            );

                            return {
                                success: false,
                                path: imagePath,
                                error
                            };

                        }

                    }
                )
            );

        const failedImageDeletions =
            storageDeletionResults.filter(
                result =>
                    !result.success
            );

        /*
         * Depois da tentativa de limpeza das imagens,
         * remove o documento do produto no Firestore.
         */
        await deleteDoc(
            doc(
                db,
                'products',
                productId
            )
        );

        /*
         * Atualiza a lista local de produtos.
         */
        adminProducts =
            adminProducts.filter(
                item => item.id !== productId
            );

        updateProductStats(
            adminProducts
        );

        filterAdminProducts();

        /*
         * Se o produto excluído estava aberto
         * no editor, fecha o editor.
         */
        if (
            productIdEl &&
            productIdEl.value === productId
        ) {

            productEditorEl.hidden = true;
            productFormEl.reset();

        }

        /*
         * Se alguma imagem não pôde ser excluída,
         * o produto ainda foi removido corretamente,
         * mas avisamos sobre a limpeza incompleta
         * do Storage.
         */
        if (
            failedImageDeletions.length > 0
        ) {

            await Swal.fire({
                icon: 'warning',
                title: 'Produto excluído',
                text: 'O produto foi removido, mas algumas imagens não puderam ser excluídas do armazenamento. Verifique o console para identificar os arquivos.',
                confirmButtonText: 'Entendi'
            });

        } else {

            await Swal.fire({
                icon: 'success',
                title: 'Produto excluído',
                text: 'O produto e suas imagens foram removidos com sucesso.',
                timer: 1800,
                showConfirmButton: false
            });

        }

    } catch (error) {

        console.error(
            'Erro ao excluir produto:',
            error
        );

        Swal.fire({
            icon: 'error',
            title: 'Erro ao excluir',
            text: 'Não foi possível excluir o produto.'
        });

    }

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

if (ordersSearchEl) {

    ordersSearchEl.addEventListener(
        'input',
        filterAdminOrders
    );

}

if (ordersTableBodyEl) {

    ordersTableBodyEl.addEventListener(
        'click',
        event => {

            const button =
                event.target.closest(
                    '[data-order-action]'
                );


            if (!button) {
                return;
            }


            const action =
                button.dataset.orderAction;


            const orderId =
                button.dataset.orderId;


            if (
                action === 'view' &&
                orderId
            ) {

                openOrderDetails(
                    orderId
                );

            }

        }
    );

}

if (closeOrderDetailsEl) {

    closeOrderDetailsEl.addEventListener(
        'click',
        () => {

            if (orderDetailsEl) {

                orderDetailsEl.hidden =
                    true;

            }

        }
    );

}

if (saveOrderStatusEl) {

    saveOrderStatusEl.addEventListener(
        'click',
        updateOrderStatus
    );

}


if (refreshOrdersEl) {

    refreshOrdersEl.addEventListener(
        'click',
        loadOrders
    );

}

if (productsTableBodyEl) {

    productsTableBodyEl.addEventListener(
        'click',
        async event => {

            const button =
                event.target.closest(
                    '[data-product-action]'
                );

            if (!button) {
                return;
            }

            const productId =
                button.dataset.productId;

            const action =
                button.dataset.productAction;

            if (action === 'edit') {
                openProductEditor(productId);
                return;
            }

            if (action === 'delete') {
                await deleteProduct(productId);
                return;
            }

        }
    );

}

if (productCurrentImagesEl) {

    productCurrentImagesEl.addEventListener(
        'click',
        async event => {

            const button =
                event.target.closest(
                    '[data-image-action]'
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset.imageAction;

            const imageIndex =
                Number(
                    button.dataset.imageIndex
                );

            const productId =
                productIdEl?.value?.trim();

            if (
                !productId ||
                Number.isNaN(imageIndex)
            ) {
                return;
            }

            if (
                action === 'primary'
            ) {

                await setPrimaryProductImage(
                    productId,
                    imageIndex
                );

            }

            if (
                action === 'delete'
            ) {

                await deleteProductImage(
                    productId,
                    imageIndex
                );

            }

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

if (newProductButtonEl) {

    newProductButtonEl.addEventListener(
        'click',
        () => {
            openNewProductEditor();
        }
    );

}

if (productFormEl) {

    productFormEl.addEventListener(
        'submit',
        async event => {

            event.preventDefault();

            await saveProductChanges();
        }
    );
}


if (refreshProductsEl) {

    refreshProductsEl.addEventListener(
        'click',
        loadProducts
    );

}

if (productImagesEl) {

    productImagesEl.addEventListener(
        'change',
        () => {
            renderSelectedProductImages(
                productImagesEl.files
            );
        }
    );

}

let adminOrders = [];


async function loadOrders() {

    if (!ordersTableBodyEl) {
        return;
    }

    if (orderDetailsEl) {
        orderDetailsEl.hidden = true;
    }


    if (ordersLoadingEl) {
        ordersLoadingEl.hidden = false;
    }

    if (ordersEmptyEl) {
        ordersEmptyEl.hidden = true;
    }

    if (ordersTableWrapperEl) {
        ordersTableWrapperEl.hidden = true;
    }


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    'orders'
                )
            );


        adminOrders =
            snapshot.docs.map(
                document => ({
                    id: document.id,
                    ...document.data()
                })
            );


        renderOrdersTable(
            adminOrders
        );

    } catch (error) {

        console.error(
            'Erro ao carregar pedidos:',
            error
        );


        if (ordersLoadingEl) {
            ordersLoadingEl.hidden = true;
        }


        if (ordersEmptyEl) {

            ordersEmptyEl.hidden = false;

            ordersEmptyEl.textContent =
                'Não foi possível carregar os pedidos.';

        }

    }

}


function renderOrdersTable(orders) {

    if (!ordersTableBodyEl) {
        return;
    }


    if (ordersLoadingEl) {
        ordersLoadingEl.hidden = true;
    }


    if (!orders.length) {

        ordersTableBodyEl.innerHTML = '';

        if (ordersTableWrapperEl) {
            ordersTableWrapperEl.hidden = true;
        }

        if (ordersEmptyEl) {

            ordersEmptyEl.hidden = false;

            ordersEmptyEl.textContent =
                'Nenhum pedido encontrado.';

        }

        return;

    }


    if (ordersEmptyEl) {
        ordersEmptyEl.hidden = true;
    }


    if (ordersTableWrapperEl) {
        ordersTableWrapperEl.hidden = false;
    }


    const sortedOrders =
        [...orders].sort(
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
        );


    ordersTableBodyEl.innerHTML =
        sortedOrders
            .map(order => {

                const status =
                    getStatusInfo(
                        order.status
                    );


                const customer =
                    order.customer || {};


                const customerName =
                    customer.name ||
                    order.customerName ||
                    order.name ||
                    'Cliente';


                const customerEmail =
                    customer.email ||
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


                const shortOrderId =
                    order.id
                        ? order.id.slice(0, 8)
                        : '—';


                return `

                    <tr>

                        <td>

                            <div class="order-table-id">

                                <strong>
                                    #${escapeHTML(
                                        shortOrderId
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        order.id || ''
                                    )}
                                </span>

                            </div>

                        </td>


                        <td>

                            <div class="order-table-customer">

                                <strong>
                                    ${escapeHTML(
                                        customerName
                                    )}
                                </strong>

                                ${
                                    customerEmail
                                        ? `
                                            <span>
                                                ${escapeHTML(
                                                    customerEmail
                                                )}
                                            </span>
                                        `
                                        : ''
                                }

                            </div>

                        </td>


                        <td>
                            ${escapeHTML(
                                formatDate(
                                    order.createdAt
                                )
                            )}
                        </td>


                        <td>

                            <strong>
                                ${formatCurrency(
                                    total
                                )}
                            </strong>

                        </td>


                        <td>

                            <span
                                class="status-badge ${escapeHTML(
                                    status.className
                                )}"
                            >
                                ${escapeHTML(
                                    status.text
                                )}
                            </span>

                        </td>


                        <td>

                            <div class="table-actions">

                                <button
                                    type="button"
                                    class="table-action-button"
                                    data-order-action="view"
                                    data-order-id="${escapeHTML(
                                        order.id
                                    )}"
                                >
                                    Ver pedido
                                </button>

                            </div>

                        </td>

                    </tr>

                `;

            })
            .join('');

}


function filterAdminOrders() {

    if (!ordersSearchEl) {
        return;
    }


    const term =
        ordersSearchEl.value
            .trim()
            .toLowerCase();


    if (!term) {

        renderOrdersTable(
            adminOrders
        );

        return;

    }


    const filtered =
        adminOrders.filter(
            order => {

                const customer =
                    order.customer || {};


                const orderId =
                    String(
                        order.id || ''
                    ).toLowerCase();


                const customerName =
                    String(
                        customer.name ||
                        order.customerName ||
                        order.name ||
                        ''
                    ).toLowerCase();


                const customerEmail =
                    String(
                        customer.email ||
                        order.customerEmail ||
                        order.email ||
                        ''
                    ).toLowerCase();


                return (
                    orderId.includes(term) ||
                    customerName.includes(term) ||
                    customerEmail.includes(term)
                );

            }
        );


    renderOrdersTable(
        filtered
    );

}

/* =========================================================
   PEDIDOS
   ========================================================= */

function openOrderDetails(orderId) {

    const order =
        adminOrders.find(
            item => item.id === orderId
        );


    if (!order) {

        console.error(
            'Pedido não encontrado:',
            orderId
        );

        return;

    }


    if (!orderDetailsEl) {
        return;
    }


    const status =
        getStatusInfo(
            order.status
        );


    const customer =
        order.customer || {};


    const customerName =
        customer.name ||
        order.customerName ||
        order.name ||
        'Cliente';


    const customerEmail =
        customer.email ||
        order.customerEmail ||
        order.email ||
        'Não informado';


    const customerPhone =
        customer.phone ||
        order.customerPhone ||
        order.phone ||
        'Não informado';


    const address =
        customer.address ||
        order.address ||
        {};


    const total =
        Number(
            order.total ??
            order.totalAmount ??
            order.amount ??
            0
        );


    const subtotal =
        Number(
            order.subtotal || 0
        );


    const discount =
        Number(
            order.desconto || 0
        );


    const shipping =
        order.shipping || {};


    const shippingCost =
        Number(
            shipping.cost || 0
        );


    const coupon =
        order.cupomUsado ||
        'Nenhum';


    if (orderDetailsTitleEl) {

        orderDetailsTitleEl.textContent =
            `Pedido #${order.id}`;

    }


    if (orderDetailsDateEl) {

        orderDetailsDateEl.textContent =
            formatDateTime(
                order.createdAt
            );

    }


    /*
     * Atualiza o seletor de status
     * para refletir o status atual do pedido.
     */
    if (orderStatusSelectEl) {

        updateOrderStatusOptions(
            order.status || 'pending'
        );

    }


    if (orderDetailsBodyEl) {

        orderDetailsBodyEl.innerHTML = `

            <div class="order-detail-status">

                <span
                    class="status-badge ${escapeHTML(
            status.className
        )}"
                >
                    ${escapeHTML(
            status.text
        )}
                </span>

            </div>


            <div class="order-detail-grid">

                <div class="order-detail-section">

                    <span class="card-kicker">
                        CLIENTE
                    </span>

                    <h4>
                        ${escapeHTML(
            customerName
        )}
                    </h4>

                    <p>
                        ${escapeHTML(
            customerEmail
        )}
                    </p>

                    <p>
                        ${escapeHTML(
            customerPhone
        )}
                    </p>

                </div>


                <div class="order-detail-section">

                    <span class="card-kicker">
                        ENTREGA
                    </span>

                    <h4>
                        Endereço
                    </h4>

                    <p>
                        ${escapeHTML(
            formatOrderAddress(
                address
            )
        )}
                    </p>

                </div>

            </div>


            <div class="order-detail-section">

                <span class="card-kicker">
                    PRODUTOS
                </span>

                <div class="order-items">

                    ${renderOrderItems(
            order.items
        )}

                </div>

            </div>


            <div class="order-summary">

                <div class="order-summary-line">

                    <span>
                        Subtotal
                    </span>

                    <strong>
                        ${formatCurrency(
            subtotal
        )}
                    </strong>

                </div>


                <div class="order-summary-line">

                    <span>
                        Desconto
                    </span>

                    <strong>
                        ${formatCurrency(
            discount
        )}
                    </strong>

                </div>


                <div class="order-summary-line">

                    <span>
                        Frete
                    </span>

                    <strong>
                        ${formatCurrency(
            shippingCost
        )}
                    </strong>

                </div>


                <div class="order-summary-line order-summary-total">

                    <span>
                        Total
                    </span>

                    <strong>
                        ${formatCurrency(
            total
        )}
                    </strong>

                </div>

            </div>


            <div class="order-detail-grid">

                <div class="order-detail-section">

                    <span class="card-kicker">
                        PAGAMENTO
                    </span>

                    <p>
                        ${escapeHTML(
            getPaymentMethodLabel(
                order.payment
            )
        )}
                    </p>

                </div>


                <div class="order-detail-section">

                    <span class="card-kicker">
                        CUPOM
                    </span>

                    <p>
                        ${escapeHTML(
            coupon
        )}
                    </p>

                </div>

            </div>

        `;

    }


    orderDetailsEl.hidden = false;


    orderDetailsEl.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });

}

function getAllowedOrderStatusTransitions(currentStatus) {

    const transitions = {
        /*
         * O pagamento NÃO pode ser alterado
         * manualmente pelo administrador.
         *
         * O status "paid" é definido pelo
         * backend após a confirmação do
         * pagamento.
         */
        pending: [
            'cancelled'
        ],

        /*
         * Depois que o pagamento foi confirmado,
         * o administrador pode enviar ou cancelar
         * o pedido.
         */
        paid: [
            'shipped',
            'cancelled'
        ],

        /*
         * Pedido enviado é um estado final
         * para o fluxo administrativo atual.
         */
        shipped: [],

        /*
         * Pedido cancelado também é final.
         */
        cancelled: []
    };

    return transitions[currentStatus] || [];
}

function updateOrderStatusOptions(currentStatus) {

    if (!orderStatusSelectEl) {
        return;
    }

    const allowedStatuses =
        getAllowedOrderStatusTransitions(
            currentStatus
        );

    const statusOptions = [
        {
            value: 'pending',
            label: 'Pendente'
        },
        {
            value: 'paid',
            label: 'Pago'
        },
        {
            value: 'shipped',
            label: 'Enviado'
        },
        {
            value: 'cancelled',
            label: 'Cancelado'
        }
    ];

    orderStatusSelectEl.innerHTML = '';

    /*
     * O status atual continua aparecendo
     * para que o administrador consiga
     * visualizar a situação atual.
     */
    const currentOption =
        statusOptions.find(
            option =>
                option.value === currentStatus
        );

    if (currentOption) {

        const option =
            document.createElement('option');

        option.value =
            currentOption.value;

        option.textContent =
            `${currentOption.label} (atual)`;

        orderStatusSelectEl.appendChild(
            option
        );

    }

    /*
     * Adiciona somente as transições
     * permitidas para o status atual.
     */
    allowedStatuses.forEach(
        allowedStatus => {

            const optionData =
                statusOptions.find(
                    option =>
                        option.value === allowedStatus
                );

            if (!optionData) {
                return;
            }

            const option =
                document.createElement('option');

            option.value =
                optionData.value;

            option.textContent =
                optionData.label;

            orderStatusSelectEl.appendChild(
                option
            );

        }
    );

    /*
     * Se não existem transições possíveis,
     * desabilita o seletor e o botão.
     */
    const hasTransitions =
        allowedStatuses.length > 0;

    orderStatusSelectEl.disabled =
        !hasTransitions;

    if (saveOrderStatusEl) {

        saveOrderStatusEl.disabled =
            !hasTransitions;

    }

}

async function updateOrderStatus() {

    if (
        !orderStatusSelectEl ||
        !saveOrderStatusEl
    ) {
        return;
    }


    const orderId =
        orderDetailsTitleEl?.textContent
            ?.replace('Pedido #', '')
            ?.trim();


    if (!orderId) {

        Swal.fire({
            icon: 'error',
            title: 'Pedido não identificado',
            text: 'Não foi possível identificar o pedido.'
        });

        return;

    }


    const order =
        adminOrders.find(
            item => item.id === orderId
        );


    if (!order) {

        Swal.fire({
            icon: 'error',
            title: 'Pedido não encontrado',
            text: 'Não foi possível localizar este pedido.'
        });

        return;

    }


    const newStatus =
        orderStatusSelectEl.value;


    const currentStatus =
        order.status || 'pending';


    if (newStatus === currentStatus) {

        Swal.fire({
            icon: 'info',
            title: 'Nenhuma alteração',
            text: 'O pedido já está com esse status.',
            timer: 1600,
            showConfirmButton: false
        });

        return;

    }


    const newStatusInfo =
        getStatusInfo(
            newStatus
        );


    const currentStatusInfo =
        getStatusInfo(
            currentStatus
        );


    const confirmation =
        await Swal.fire({

            icon: 'question',

            title: 'Alterar status do pedido?',

            html: `
                <p>
                    O pedido
                    <strong>
                        #${escapeHTML(order.id)}
                    </strong>
                    será alterado de
                    <strong>
                        ${escapeHTML(
                currentStatusInfo.text
            )}
                    </strong>
                    para
                    <strong>
                        ${escapeHTML(
                newStatusInfo.text
            )}
                    </strong>.
                </p>
            `,

            showCancelButton: true,

            confirmButtonText:
                'Sim, alterar',

            cancelButtonText:
                'Cancelar',

            reverseButtons: true

        });


    if (!confirmation.isConfirmed) {

        orderStatusSelectEl.value =
            currentStatus;

        return;

    }


    saveOrderStatusEl.disabled = true;

    saveOrderStatusEl.textContent =
        'Salvando...';


    try {

        await updateDoc(
            doc(
                db,
                'orders',
                orderId
            ),
            {
                status: newStatus
            }
        );


        /*
         * Atualiza o pedido em memória.
         */
        const orderIndex =
            adminOrders.findIndex(
                item =>
                    item.id === orderId
            );


        if (orderIndex !== -1) {

            adminOrders[orderIndex] = {
                ...adminOrders[orderIndex],
                status: newStatus
            };

        }


        /*
         * Atualiza a tabela de pedidos.
         */
        filterAdminOrders();


        /*
         * Atualiza os indicadores
         * do dashboard usando os pedidos
         * já carregados.
         */
        updateOrderStats(
            adminOrders
        );


        /*
         * Reabre o detalhe com o
         * novo status visual.
         */
        openOrderDetails(
            orderId
        );


        await Swal.fire({

            icon: 'success',

            title: 'Status atualizado',

            text:
                `O pedido foi marcado como ${newStatusInfo.text}.`,

            timer: 1700,

            showConfirmButton: false

        });

    } catch (error) {

        console.error(
            'Erro ao atualizar status do pedido:',
            error
        );


        /*
         * Restaura o status anterior
         * caso a atualização falhe.
         */
        orderStatusSelectEl.value =
            currentStatus;


        Swal.fire({

            icon: 'error',

            title: 'Erro ao atualizar',

            text:
                'Não foi possível alterar o status do pedido.'

        });

    } finally {

        saveOrderStatusEl.disabled =
            false;

        saveOrderStatusEl.textContent =
            'Salvar status';

    }

}


function formatDateTime(timestamp) {

    if (!timestamp) {
        return 'Data não informada';
    }


    try {

        let date;


        if (
            typeof timestamp.toDate ===
            'function'
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

            return 'Data não informada';

        }


        return date.toLocaleString(
            'pt-BR',
            {
                dateStyle: 'short',
                timeStyle: 'short'
            }
        );

    } catch (error) {

        return 'Data não informada';

    }

}


function formatOrderAddress(address) {

    if (!address) {
        return 'Endereço não informado';
    }


    const parts = [];


    if (address.street) {

        let street =
            address.street;


        if (address.number) {

            street +=
                `, ${address.number}`;

        }


        parts.push(street);

    }


    if (address.complement) {

        parts.push(
            address.complement
        );

    }


    if (address.neighborhood) {

        parts.push(
            address.neighborhood
        );

    }


    const cityState = [
        address.city,
        address.state
    ]
        .filter(Boolean)
        .join(' - ');


    if (cityState) {

        parts.push(
            cityState
        );

    }


    if (address.cep) {

        parts.push(
            `CEP: ${address.cep}`
        );

    }


    return parts.length
        ? parts.join(', ')
        : 'Endereço não informado';

}


function renderOrderItems(items) {

    if (
        !Array.isArray(items) ||
        !items.length
    ) {

        return `
            <p>
                Nenhum produto registrado neste pedido.
            </p>
        `;

    }


    return items
        .map(item => {

            const quantity =
                Number(
                    item.qty || 0
                );


            const price =
                Number(
                    item.price || 0
                );


            const itemTotal =
                price * quantity;


            return `

                <div class="order-item">

                    <div>

                        <strong>
                            ${escapeHTML(
                item.name ||
                'Produto'
            )}
                        </strong>

                        <span>
                            ${quantity} ×
                            ${formatCurrency(
                price
            )}
                        </span>

                    </div>


                    <strong>
                        ${formatCurrency(
                itemTotal
            )}
                    </strong>

                </div>

            `;

        })
        .join('');

}


function getPaymentMethodLabel(payment) {

    if (!payment) {
        return 'Não informado';
    }


    if (typeof payment === 'string') {
        return payment;
    }


    const method =
        payment.method ||
        payment.type ||
        payment.paymentMethod ||
        '';


    if (!method) {
        return 'Não informado';
    }


    const labels = {

        pix:
            'PIX',

        credit_card:
            'Cartão de crédito',

        debit_card:
            'Cartão de débito',

        card:
            'Cartão',

        boleto:
            'Boleto'

    };


    return (
        labels[method] ||
        method
    );

}

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

        await loadOrders();

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

        await loadOrders();

        console.log('[ADMIN] 9.5. loadOrders concluído.');

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