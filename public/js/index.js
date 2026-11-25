const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

initializeApp();

const MERCADOPAGO_ACCESS_TOKEN = defineSecret("MERCADOPAGO_ACCESS_TOKEN");
const SUPERFRETE_TOKEN = defineSecret("SUPERFRETE_TOKEN");

const REGION = "southamerica-east1";
const STORE_POSTAL_CODE = "21371270";
const SHIPPING_QUOTE_TTL_MS = 10 * 60 * 1000;

function normalizeCep(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function normalizeCouponCode(value) {
    return String(value || "").trim().toUpperCase().slice(0, 50);
}

function effectiveProductPrice(product) {
    const price = Number(product.price || 0);
    const promotionalPrice = Number(product.promotionalPrice || 0);

    if (
        Number.isFinite(promotionalPrice) &&
        promotionalPrice > 0 &&
        promotionalPrice < price
    ) {
        return promotionalPrice;
    }

    return price;
}

function validateQuantity(value) {
    const qty = Number(value);

    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        throw new HttpsError(
            "invalid-argument",
            "Quantidade de produto inválida."
        );
    }

    return qty;
}

function validateCustomer(customer) {
    if (!customer || typeof customer !== "object") {
        throw new HttpsError("invalid-argument", "Dados do cliente ausentes.");
    }

    const email = String(customer.email || "").trim().toLowerCase();
    const name = String(customer.name || "").trim();
    const phone = String(customer.phone || "").trim();

    if (!name || name.length < 2 || name.length > 120) {
        throw new HttpsError("invalid-argument", "Nome inválido.");
    }

    if (!email || email.length > 160 || !/^\S+@\S+\.\S+$/.test(email)) {
        throw new HttpsError("invalid-argument", "E-mail inválido.");
    }

    if (!phone || phone.length > 30) {
        throw new HttpsError("invalid-argument", "Telefone inválido.");
    }

    return {
        name,
        email,
        phone,
        address: {
            cep: normalizeCep(customer.address?.cep),
            street: String(customer.address?.street || "").trim().slice(0, 160),
            number: String(customer.address?.number || "").trim().slice(0, 30),
            complement: String(customer.address?.complement || "").trim().slice(0, 120),
            neighborhood: String(customer.address?.neighborhood || "").trim().slice(0, 120),
            city: String(customer.address?.city || "").trim().slice(0, 100),
            state: String(customer.address?.state || "").trim().slice(0, 2).toUpperCase(),
        },
    };
}

function validatePayment(payment) {
    if (!payment || typeof payment !== "object") {
        throw new HttpsError("invalid-argument", "Dados de pagamento ausentes.");
    }

    const paymentMethodId = String(payment.payment_method_id || "").trim();
    const installments = Number(payment.installments || 1);

    if (!paymentMethodId || paymentMethodId.length > 50) {
        throw new HttpsError("invalid-argument", "Método de pagamento inválido.");
    }

    if (!Number.isInteger(installments) || installments < 1 || installments > 12) {
        throw new HttpsError("invalid-argument", "Número de parcelas inválido.");
    }

    const result = {
        payment_method_id: paymentMethodId,
        installments,
    };

    if (payment.token) {
        result.token = String(payment.token);
    }

    if (payment.payer?.email) {
        result.payer = {
            email: String(payment.payer.email).trim().toLowerCase(),
        };
    }

    if (payment.payer?.identification?.type && payment.payer?.identification?.number) {
        result.payer = {
            ...(result.payer || {}),
            identification: {
                type: String(payment.payer.identification.type).slice(0, 10),
                number: String(payment.payer.identification.number).replace(/\D/g, "").slice(0, 20),
            },
        };
    }

    if (payment.issuer_id) {
        result.issuer_id = String(payment.issuer_id).slice(0, 20);
    }

    return result;
}

function sanitizePaymentResponse(paymentResponse) {
    if (!paymentResponse) return null;

    return {
        id: paymentResponse.id,
        status: paymentResponse.status,
        status_detail: paymentResponse.status_detail,
        payment_method_id: paymentResponse.payment_method_id,
        external_reference: paymentResponse.external_reference,
        transaction_amount: paymentResponse.transaction_amount,
        currency_id: paymentResponse.currency_id,
        point_of_interaction: paymentResponse.point_of_interaction,
    };
}

async function loadCartProducts(db, items, reader = null) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        throw new HttpsError("invalid-argument", "Carrinho inválido.");
    }

    const normalizedItems = items.map((item) => ({
        id: String(item?.id || "").trim(),
        qty: validateQuantity(item?.qty),
    }));

    const ids = normalizedItems.map((item) => item.id);
    if (ids.some((id) => !id || id.length > 128) || new Set(ids).size !== ids.length) {
        throw new HttpsError("invalid-argument", "Itens do carrinho inválidos.");
    }

    const refs = ids.map((id) => db.collection("products").doc(id));
    const docs = reader ? await reader(...refs) : await db.getAll(...refs);

    const itemsForOrder = [];
    const stockUpdates = [];
    let subtotal = 0;

    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const item = normalizedItems[i];

        if (!doc.exists) {
            throw new HttpsError("not-found", "Produto não encontrado.");
        }

        const product = doc.data();
        const stock = Number(product.stock || 0);
        const price = effectiveProductPrice(product);

        if (!Number.isFinite(price) || price < 0) {
            throw new HttpsError("failed-precondition", "Produto com preço inválido.");
        }

        if (stock < item.qty) {
            throw new HttpsError(
                "failed-precondition",
                `Estoque insuficiente para ${String(product.name || "o produto")}.`
            );
        }

        subtotal += price * item.qty;

        itemsForOrder.push({
            id: doc.id,
            name: String(product.name || "Produto").slice(0, 200),
            price,
            qty: item.qty,
        });

        stockUpdates.push({
            ref: doc.ref,
            newStock: stock - item.qty,
        });
    }

    return {
        normalizedItems,
        itemsForOrder,
        stockUpdates,
        subtotal: Number(subtotal.toFixed(2)),
    };
}

async function calculateShippingFromProducts(db, cepDestino, items) {
    const { itemsForOrder } = await loadCartProducts(db, items);

    const refs = items.map((item) => db.collection("products").doc(String(item.id)));
    const docs = await db.getAll(...refs);

    let pesoTotal = 0;
    let alturaTotal = 0;
    let maiorLargura = 0;
    let maiorComprimento = 0;
    let valorTotalCarrinho = 0;

    for (let i = 0; i < docs.length; i++) {
        const product = docs[i].data();
        const qty = validateQuantity(items[i].qty);

        pesoTotal += (Number(product.weight) || 0.5) * qty;
        alturaTotal += (Number(product.height) || 15) * qty;
        maiorLargura = Math.max(maiorLargura, Number(product.width) || 20);
        maiorComprimento = Math.max(maiorComprimento, Number(product.length) || 20);
        valorTotalCarrinho += effectiveProductPrice(product) * qty;
    }

    const payload = {
        from: { postal_code: STORE_POSTAL_CODE },
        to: { postal_code: normalizeCep(cepDestino) },
        services: "1,2",
        declared_value: Number(valorTotalCarrinho.toFixed(2)),
        package: {
            weight: Math.max(0.1, Number(pesoTotal.toFixed(3))),
            height: Math.max(2, Number(alturaTotal.toFixed(2))),
            width: Math.max(11, Number(maiorLargura.toFixed(2))),
            length: Math.max(16, Number(maiorComprimento.toFixed(2))),
        },
    };

    return { payload, itemsForOrder };
}

// --- ATUALIZAÇÃO SERVERLESS DE DASHBOARD E CRM ---
exports.atualizarMetricas = onDocumentWritten("orders/{orderId}", async (event) => {
    const order = event.data.after.exists ? event.data.after.data() : null;
    const previous = event.data.before.exists ? event.data.before.data() : null;

    const isNowPaid = order && order.status === "paid" && (!previous || previous.status !== "paid");

    if (isNowPaid) {
        const db = getFirestore();
        const valor = Number(order.total || 0);
        const email = order.customer?.email;

        await db.collection("system").doc("dashboard_stats").set({
            faturamentoTotal: FieldValue.increment(valor),
            pedidosPagos: FieldValue.increment(1),
        }, { merge: true });

        if (email) {
            const normalizedEmail = String(email).trim().toLowerCase();
            await db.collection("customers").doc(normalizedEmail).set({
                nome: order.customer?.name || "Cliente",
                email: normalizedEmail,
                telefone: order.customer?.phone || "",
                ltv: FieldValue.increment(valor),
                totalPedidos: FieldValue.increment(1),
                ultimoPedido: Timestamp.now(),
            }, { merge: true });
        }
    }
});

// --- CRIAÇÃO DO PEDIDO ---
exports.createorder = onCall(
    {
        region: REGION,
        secrets: [MERCADOPAGO_ACCESS_TOKEN],
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Precisa estar autenticado.");
        }

        const userId = request.auth.uid;
        const { items, customer, shipping, cupom, payment } = request.data || {};
        const db = getFirestore();

        if (!Array.isArray(items) || items.length === 0) {
            throw new HttpsError("invalid-argument", "Carrinho vazio.");
        }

        const validatedCustomer = validateCustomer(customer);
        const validatedPayment = validatePayment(payment);
        const couponCode = normalizeCouponCode(cupom?.codigo);
        const quoteId = String(shipping?.quoteId || "").trim();
        const selectedShippingMethod = String(shipping?.method || "").trim().slice(0, 100);

        if (!quoteId || !selectedShippingMethod) {
            throw new HttpsError("invalid-argument", "Frete não selecionado.");
        }

        try {
            const orderRef = db.collection("orders").doc();

            const result = await db.runTransaction(async (transaction) => {
                const cart = await loadCartProducts(db, items, transaction.getAll.bind(transaction));

                const quoteRef = db.collection("shippingQuotes").doc(quoteId);
                const quoteDoc = await transaction.get(quoteRef);

                if (!quoteDoc.exists) {
                    throw new HttpsError("failed-precondition", "Cotação de frete expirada. Calcule novamente.");
                }

                const quote = quoteDoc.data();
                const expiresAt = quote.expiresAt?.toMillis?.() || 0;
                const now = Date.now();

                if (quote.userId !== userId || expiresAt < now) {
                    throw new HttpsError("failed-precondition", "Cotação de frete inválida ou expirada.");
                }

                const quoteItems = JSON.stringify(quote.items || []);
                const currentItems = JSON.stringify(cart.normalizedItems);

                if (quoteItems !== currentItems) {
                    throw new HttpsError(
                        "failed-precondition",
                        "O carrinho foi alterado. Calcule o frete novamente."
                    );
                }

                const selectedOption = (quote.options || []).find(
                    (option) => option.name === selectedShippingMethod
                );

                if (!selectedOption) {
                    throw new HttpsError("failed-precondition", "Opção de frete inválida.");
                }

                const freteCusto = Number(selectedOption.price || 0);
                let valorDesconto = 0;
                let cupomValidoParaUso = false;
                let cupomRef = null;
                let cupomData = null;

                if (couponCode) {
                    cupomRef = db.collection("coupons").doc(couponCode);
                    const couponDoc = await transaction.get(cupomRef);

                    if (couponDoc.exists) {
                        cupomData = couponDoc.data();

                        const ativo = cupomData.ativo !== false;
                        const usado = Number(cupomData.usado || 0);
                        const limiteUso = Number(cupomData.limiteUso || 0);
                        const valorMinimo = Number(cupomData.valorMinimo || 0);

                        if (ativo && usado < limiteUso && cart.subtotal >= valorMinimo) {
                            if (cupomData.tipo === "fixo") {
                                valorDesconto = Number(cupomData.valor || 0);
                            } else {
                                const percentual = Number(cupomData.valor || 0);
                                valorDesconto = cart.subtotal * (percentual / 100);
                            }

                            valorDesconto = Math.min(
                                Math.max(0, valorDesconto),
                                cart.subtotal
                            );
                            valorDesconto = Number(valorDesconto.toFixed(2));
                            cupomValidoParaUso = true;
                        }
                    }
                }

                const valorTotalFinal = Number(
                    Math.max(0, cart.subtotal - valorDesconto + freteCusto).toFixed(2)
                );

                if (valorTotalFinal <= 0) {
                    throw new HttpsError("failed-precondition", "Valor do pedido inválido.");
                }

                const client = new MercadoPagoConfig({
                    accessToken: MERCADOPAGO_ACCESS_TOKEN.value(),
                });
                const mpPayment = new Payment(client);

                const paymentBody = {
                    transaction_amount: valorTotalFinal,
                    description: "Compra na Olomi",
                    installments: validatedPayment.installments,
                    payment_method_id: validatedPayment.payment_method_id,
                    payer: {
                        email: validatedPayment.payer?.email || validatedCustomer.email,
                    },
                    external_reference: orderRef.id,
                };

                if (validatedPayment.token) {
                    paymentBody.token = validatedPayment.token;
                }

                if (validatedPayment.payer?.identification?.number) {
                    paymentBody.payer.identification = validatedPayment.payer.identification;
                }

                if (validatedPayment.issuer_id) {
                    paymentBody.issuer_id = validatedPayment.issuer_id;
                }

                let mpResponse;

                try {
                    mpResponse = await mpPayment.create({
                        body: paymentBody,
                        requestOptions: { idempotencyKey: orderRef.id },
                    });
                } catch (mpError) {
                    logger.error("Erro ao processar pagamento Mercado Pago", {
                        orderId: orderRef.id,
                        status: mpError?.status,
                        message: mpError?.message,
                    });

                    throw new HttpsError(
                        "aborted",
                        "Não foi possível processar o pagamento. Verifique os dados e tente novamente."
                    );
                }

                cart.stockUpdates.forEach((update) => {
                    transaction.update(update.ref, { stock: update.newStock });
                });

                if (cupomValidoParaUso && cupomRef && cupomData) {
                    transaction.update(cupomRef, {
                        usado: Number(cupomData.usado || 0) + 1,
                    });
                }

                transaction.set(orderRef, {
                    userId,
                    items: cart.itemsForOrder,
                    subtotal: cart.subtotal,
                    desconto: valorDesconto,
                    cupomUsado: cupomValidoParaUso ? couponCode : null,
                    shipping: {
                        method: selectedOption.name,
                        cost: freteCusto,
                    },
                    total: valorTotalFinal,
                    customer: validatedCustomer,
                    status: mpResponse.status === "approved" ? "paid" : "pending",
                    paymentId: mpResponse.id,
                    createdAt: Timestamp.now(),
                });

                return {
                    status: "success",
                    orderId: orderRef.id,
                    paymentResponse: sanitizePaymentResponse(mpResponse),
                };
            });

            return result;
        } catch (error) {
            logger.error("Erro capturado no backend", {
                code: error?.code,
                message: error?.message,
            });

            if (error instanceof HttpsError) {
                throw error;
            }

            throw new HttpsError(
                "internal",
                "Não foi possível concluir o pedido. Tente novamente."
            );
        }
    }
);

// --- COTAÇÃO DE FRETE ---
exports.calcularfrete = onCall(
    {
        region: REGION,
        secrets: [SUPERFRETE_TOKEN],
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Precisa estar autenticado.");
        }

        const { cepDestino, items } = request.data || {};
        const cep = normalizeCep(cepDestino);

        if (cep.length !== 8) {
            throw new HttpsError("invalid-argument", "CEP inválido.");
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new HttpsError("invalid-argument", "Carrinho vazio.");
        }

        const db = getFirestore();

        try {
            const { payload } = await calculateShippingFromProducts(db, cep, items);

            const response = await axios.post(
                "https://api.superfrete.com/api/v0/calculator",
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${SUPERFRETE_TOKEN.value()}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    timeout: 15000,
                }
            );

            const options = (Array.isArray(response.data) ? response.data : [])
                .filter((option) => Number.isFinite(Number(option.price)))
                .map((option) => ({
                    name: String(option.name || "Frete").slice(0, 100),
                    price: Number((Number(option.original_price || option.price)).toFixed(2)),
                    delivery_time: Number(option.delivery_time || 0),
                    company: option.company?.name
                        ? { name: String(option.company.name).slice(0, 100) }
                        : null,
                }));

            if (options.length === 0) {
                return [];
            }

            const quoteRef = db.collection("shippingQuotes").doc();
            await quoteRef.set({
                userId: request.auth.uid,
                cepDestino: cep,
                items: items.map((item) => ({
                    id: String(item.id),
                    qty: validateQuantity(item.qty),
                })),
                options,
                expiresAt: Timestamp.fromMillis(Date.now() + SHIPPING_QUOTE_TTL_MS),
                createdAt: Timestamp.now(),
            });

            return options.map((option) => ({
                ...option,
                quoteId: quoteRef.id,
            }));
        } catch (error) {
            logger.error("Erro ao calcular frete", {
                status: error?.response?.status,
                message: error?.message,
            });

            if (error instanceof HttpsError) {
                throw error;
            }

            throw new HttpsError(
                "internal",
                "Falha ao conectar com a transportadora. Tente novamente."
            );
        }
    }
);

// --- WEBHOOK DO MERCADO PAGO ---
exports.webhookpagamento = onRequest(
    {
        region: REGION,
        secrets: [MERCADOPAGO_ACCESS_TOKEN],
    },
    async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).send("Método não permitido");
        }

        try {
            const { type, data, action } = req.body || {};
            const isPayment = type === "payment" || action?.startsWith("payment");
            const paymentId = data?.id;

            if (!isPayment || !paymentId) {
                return res.status(200).send("OK");
            }

            const client = new MercadoPagoConfig({
                accessToken: MERCADOPAGO_ACCESS_TOKEN.value(),
            });
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });

            if (paymentInfo.status !== "approved") {
                return res.status(200).send("OK");
            }

            const orderId = String(paymentInfo.external_reference || "").trim();
            if (!orderId) {
                return res.status(200).send("OK");
            }

            const db = getFirestore();
            const orderRef = db.collection("orders").doc(orderId);
            const orderSnap = await orderRef.get();

            if (!orderSnap.exists) {
                logger.warn("Webhook recebido para pedido inexistente", { orderId, paymentId });
                return res.status(200).send("OK");
            }

            const order = orderSnap.data();
            const paidAmount = Number(paymentInfo.transaction_amount || 0);
            const orderAmount = Number(order.total || 0);
            const currency = String(paymentInfo.currency_id || "").toUpperCase();

            if (currency !== "BRL" || Math.abs(paidAmount - orderAmount) > 0.01) {
                logger.error("Pagamento divergente do pedido", {
                    orderId,
                    paymentId,
                    paidAmount,
                    orderAmount,
                    currency,
                });
                return res.status(400).send("Pagamento inválido");
            }

            await orderRef.update({
                status: "paid",
                paymentId: paymentInfo.id,
                paidAt: Timestamp.now(),
            });

            return res.status(200).send("OK");
        } catch (error) {
            logger.error("Erro no webhook de pagamento", {
                message: error?.message,
                status: error?.status,
            });
            return res.status(500).send("Erro interno");
        }
    }
);

// --- VALIDAÇÃO DE CUPOM ---
exports.validarcupom = onCall({ region: REGION }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Precisa estar autenticado.");
    }

    const { codigo, items } = request.data || {};
    const couponCode = normalizeCouponCode(codigo);

    if (!couponCode) {
        throw new HttpsError("invalid-argument", "Código não informado.");
    }

    const db = getFirestore();
    const cart = await loadCartProducts(db, items);
    const couponSnap = await db.collection("coupons").doc(couponCode).get();

    if (!couponSnap.exists) {
        throw new HttpsError("not-found", "Cupom inválido ou inexistente.");
    }

    const coupon = couponSnap.data();
    const ativo = coupon.ativo !== false;
    const usado = Number(coupon.usado || 0);
    const limiteUso = Number(coupon.limiteUso || 0);
    const valorMinimo = Number(coupon.valorMinimo || 0);

    if (!ativo) {
        throw new HttpsError("failed-precondition", "Este cupom está desativado.");
    }

    if (usado >= limiteUso) {
        throw new HttpsError("failed-precondition", "Este cupom já atingiu o limite de usos.");
    }

    if (cart.subtotal < valorMinimo) {
        throw new HttpsError(
            "failed-precondition",
            `O valor mínimo para usar este cupom é R$ ${valorMinimo.toFixed(2)}.`
        );
    }

    let desconto;

    if (coupon.tipo === "fixo") {
        desconto = Number(coupon.valor || 0);
    } else {
        desconto = cart.subtotal * (Number(coupon.valor || 0) / 100);
    }

    desconto = Math.min(Math.max(0, desconto), cart.subtotal);
    desconto = Number(desconto.toFixed(2));

    return {
        codigo: couponSnap.id,
        desconto,
        tipo: coupon.tipo,
    };
});
