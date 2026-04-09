const {
    buildCheckoutPayloadSnapshot,
    buildOrderItemSnapshots,
    normalizeCustomerType,
    normalizePaymentMethodType
} = require('./checkout');
const { normalizeTaxId, validateTaxId } = require('./tax-id');

function normalizeText(value) {
    return String(value ?? '').trim();
}

const COMMON_EMAIL_DOMAIN_FIXES = {
    'gmail.com.pt': 'gmail.com',
    'gmail.pt': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'outlook.con': 'outlook.com'
};

function normalizeName(value) {
    return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeQuantity(value) {
    const maxQuantity = Math.max(1, Number.parseInt(process.env.CHECKOUT_MAX_ITEM_QUANTITY || '99', 10) || 99);
    const parsed = Number.parseInt(String(value || '1'), 10);
    const quantity = Number.isFinite(parsed) ? parsed : 1;
    return Math.max(1, Math.min(maxQuantity, quantity));
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueNumbers(values) {
    return [...new Set(
        (Array.isArray(values) ? values : [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
    )];
}

function createCheckoutError(code, message, details = null) {
    const error = new Error(message || code);
    error.code = code;
    if (details) {
        error.details = details;
    }
    return error;
}

function buildCheckoutCustomerSnapshot(customer = {}) {
    const customerType = normalizeCustomerType(
        customer.customerType || customer.tipo_cliente || customer.tipoCliente,
        customer
    );

    return {
        nome: normalizeText(customer.nome),
        email: normalizeText(customer.email).toLowerCase(),
        telefone: normalizeCheckoutPhoneNumber(customer.telefone),
        tipo_cliente: customerType,
        empresa: normalizeText(customer.empresa),
        nif: normalizeTaxId(customer.nif),
        morada: normalizeText(customer.morada),
        codigo_postal: normalizeCheckoutPostalCode(
            customer.codigo_postal,
            resolveCustomerCountry(customer, customerType)
        ),
        cidade: normalizeText(customer.cidade)
    };
}

function resolveCustomerCountry(customer = {}, customerType = '') {
    const normalizedPostalCode = String(customer?.codigo_postal || '').trim();
    const normalizedTaxId = normalizeTaxId(customer?.nif);

    if (/^\d{5}(-\d{4})?$/.test(normalizedPostalCode)) {
        return 'ES';
    }

    if (/^\d{4}-?\d{3}$/.test(normalizedPostalCode)) {
        return 'PT';
    }

    if (/^[XYZ]\d{7}[A-Z]$/.test(normalizedTaxId) || /^[A-Z]\d{7}[A-Z0-9]$/.test(normalizedTaxId)) {
        return 'ES';
    }

    if (String(customerType || '').trim().toLowerCase() === 'empresa' && normalizedTaxId && /^[A-Z]/.test(normalizedTaxId)) {
        return 'ES';
    }

    return 'PT';
}

function normalizeCheckoutPhoneNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }

    let normalized = raw.replace(/[^\d+]/g, '');
    if (normalized.startsWith('00')) {
        normalized = `+${normalized.slice(2)}`;
    }

    if (normalized.startsWith('+')) {
        return `+${normalized.slice(1).replace(/\D/g, '')}`;
    }

    return normalized.replace(/\D/g, '');
}

function validateCheckoutCustomerPhone(customer = {}) {
    const snapshot = buildCheckoutCustomerSnapshot(customer);
    const normalized = snapshot.telefone;
    const country = resolveCustomerCountry(snapshot, snapshot.tipo_cliente);

    if (!normalized) {
        return {
            valid: false,
            normalized,
            country,
            message: 'Introduza um numero de telemovel ou telefone valido.'
        };
    }

    const digits = normalized.replace(/^\+/, '');

    if (digits.startsWith('351')) {
        const localNumber = digits.slice(3);
        return {
            valid: /^[29]\d{8}$/.test(localNumber),
            normalized: `+${digits}`,
            country: 'PT',
            message: /^[29]\d{8}$/.test(localNumber)
                ? ''
                : 'O numero de contacto portugues parece invalido.'
        };
    }

    if (digits.startsWith('34')) {
        const localNumber = digits.slice(2);
        return {
            valid: /^[6789]\d{8}$/.test(localNumber),
            normalized: `+${digits}`,
            country: 'ES',
            message: /^[6789]\d{8}$/.test(localNumber)
                ? ''
                : 'O numero de contacto espanhol parece invalido.'
        };
    }

    if (country === 'ES' || /^[678]\d{8}$/.test(digits)) {
        return {
            valid: /^[6789]\d{8}$/.test(digits),
            normalized: `+34${digits}`,
            country: 'ES',
            message: /^[6789]\d{8}$/.test(digits)
                ? ''
                : 'Introduza um numero espanhol com 9 digitos valido.'
        };
    }

    return {
        valid: /^[29]\d{8}$/.test(digits),
        normalized: `+351${digits}`,
        country: 'PT',
        message: /^[29]\d{8}$/.test(digits)
            ? ''
            : 'Introduza um numero portugues com 9 digitos valido.'
    };
}

function normalizeCheckoutPostalCode(value, country = 'PT') {
    const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
        return '';
    }

    if (String(country || '').toUpperCase() === 'ES') {
        return normalized.replace(/[^\d]/g, '').slice(0, 5);
    }

    const digits = normalized.replace(/[^\d]/g, '').slice(0, 7);
    if (digits.length === 7) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    return normalized;
}

function validateCheckoutCustomerType(customer = {}) {
    const snapshot = buildCheckoutCustomerSnapshot(customer);

    if (!['particular', 'empresa'].includes(snapshot.tipo_cliente)) {
        return {
            valid: false,
            normalized: snapshot.tipo_cliente,
            message: 'Escolha se a faturacao e para particular ou empresa.'
        };
    }

    return {
        valid: true,
        normalized: snapshot.tipo_cliente,
        message: ''
    };
}

function validateCheckoutPostalCode(customer = {}) {
    const snapshot = buildCheckoutCustomerSnapshot(customer);
    const country = resolveCustomerCountry(snapshot, snapshot.tipo_cliente);
    const normalized = normalizeCheckoutPostalCode(snapshot.codigo_postal, country);
    const valid = country === 'ES'
        ? /^\d{5}$/.test(normalized)
        : /^\d{4}-\d{3}$/.test(normalized);

    return {
        valid,
        normalized,
        country,
        message: valid
            ? ''
            : country === 'ES'
                ? 'Introduza um codigo postal espanhol com 5 digitos.'
                : 'Introduza um codigo postal portugues no formato 0000-000.'
    };
}

function buildCustomerPersistencePayload(customerSnapshot = {}) {
    return {
        nome: customerSnapshot.nome,
        email: customerSnapshot.email,
        telefone: customerSnapshot.telefone,
        empresa: customerSnapshot.empresa,
        nif: customerSnapshot.nif,
        morada: customerSnapshot.morada,
        codigo_postal: customerSnapshot.codigo_postal,
        cidade: customerSnapshot.cidade
    };
}

function validateCheckoutCustomerEmail(email) {
    const normalized = normalizeText(email).toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return {
            valid: false,
            normalized,
            message: 'Introduza um email valido.'
        };
    }

    const domain = normalized.split('@').pop();
    const suggestedDomain = COMMON_EMAIL_DOMAIN_FIXES[domain];
    if (suggestedDomain) {
        return {
            valid: false,
            normalized,
            suggestion: normalized.replace(/@[^@]+$/, `@${suggestedDomain}`),
            message: `O dominio do email parece invalido: @${domain}. Queria dizer @${suggestedDomain}?`
        };
    }

    return {
        valid: true,
        normalized,
        message: ''
    };
}

function validateCheckoutCustomerTaxId(customer = {}) {
    const snapshot = buildCheckoutCustomerSnapshot(customer);
    return validateTaxId(snapshot.nif, {
        postalCode: snapshot.codigo_postal,
        country: customer.country || customer.pais || ''
    });
}

function hasCustomerIdentityMismatch(existingCustomer = {}, customerSnapshot = {}) {
    const existingEmail = normalizeText(existingCustomer.email).toLowerCase();
    const incomingEmail = normalizeText(customerSnapshot.email).toLowerCase();
    if (existingEmail && incomingEmail && existingEmail !== incomingEmail) {
        return true;
    }

    const existingBusinessName = normalizeName(existingCustomer.empresa || existingCustomer.nome);
    const incomingBusinessName = normalizeName(customerSnapshot.empresa || customerSnapshot.nome);
    if (existingBusinessName && incomingBusinessName && existingBusinessName !== incomingBusinessName) {
        return true;
    }

    return false;
}

function buildCustomerUpdatePayload(existingCustomer = {}, customerSnapshot = {}, strategy = 'overwrite_non_empty') {
    const source = buildCustomerPersistencePayload(customerSnapshot);
    const existing = existingCustomer && typeof existingCustomer === 'object' ? existingCustomer : {};
    const entries = Object.entries(source).filter(([, value]) => String(value || '').trim());

    if (strategy === 'fill_empty_only') {
        return Object.fromEntries(
            entries.filter(([key]) => !String(existing[key] || '').trim())
        );
    }

    return Object.fromEntries(entries);
}

async function findOrCreateCheckoutCustomer(supabase, customer) {
    const customerSnapshot = buildCheckoutCustomerSnapshot(customer);
    if (!customerSnapshot.email) {
        throw createCheckoutError('EMAIL_REQUIRED', 'Email do cliente obrigatorio.');
    }

    const emailValidation = validateCheckoutCustomerEmail(customerSnapshot.email);
    if (!emailValidation.valid) {
        throw createCheckoutError('EMAIL_INVALIDO', emailValidation.message, {
            field: 'email',
            suggestion: emailValidation.suggestion || null
        });
    }

    const phoneValidation = validateCheckoutCustomerPhone(customerSnapshot);
    if (!phoneValidation.valid) {
        throw createCheckoutError('TELEFONE_INVALIDO', phoneValidation.message, {
            field: 'telefone'
        });
    }
    customerSnapshot.telefone = phoneValidation.normalized;

    const customerTypeValidation = validateCheckoutCustomerType(customerSnapshot);
    if (!customerTypeValidation.valid) {
        throw createCheckoutError('TIPO_CLIENTE_INVALIDO', customerTypeValidation.message, {
            field: 'tipo_cliente'
        });
    }

    const postalCodeValidation = validateCheckoutPostalCode(customerSnapshot);
    if (!postalCodeValidation.valid) {
        throw createCheckoutError('CODIGO_POSTAL_INVALIDO', postalCodeValidation.message, {
            field: 'codigo_postal'
        });
    }
    customerSnapshot.codigo_postal = postalCodeValidation.normalized;

    if (customerSnapshot.tipo_cliente === 'empresa') {
        if (!customerSnapshot.empresa) {
            throw createCheckoutError('EMPRESA_REQUIRED', 'Indique o nome fiscal da empresa para emitir a fatura.', {
                field: 'empresa'
            });
        }

        if (!customerSnapshot.nif) {
            throw createCheckoutError('NIF_REQUIRED', 'Para faturacao empresarial o NIF e obrigatorio.', {
                field: 'nif'
            });
        }
    }

    const { data: existingCustomer, error: lookupError } = await supabase
        .from('clientes')
        .select('id,email,nome,telefone,empresa,nif,morada,codigo_postal,cidade')
        .eq('email', customerSnapshot.email)
        .maybeSingle();

    if (lookupError) {
        throw lookupError;
    }

    let matchedCustomer = existingCustomer || null;
    let matchedBy = matchedCustomer?.id ? 'email' : '';

    if (!matchedCustomer?.id && customerSnapshot.nif) {
        const { data: existingByTaxId, error: taxLookupError } = await supabase
            .from('clientes')
            .select('id,email,nome,telefone,empresa,nif,morada,codigo_postal,cidade')
            .eq('nif', customerSnapshot.nif)
            .limit(1)
            .maybeSingle();

        if (taxLookupError) {
            throw taxLookupError;
        }

        matchedCustomer = existingByTaxId || null;
        matchedBy = matchedCustomer?.id ? 'tax_id' : matchedBy;
    }

    if (matchedCustomer?.id) {
        if (matchedBy === 'tax_id' && hasCustomerIdentityMismatch(matchedCustomer, customerSnapshot)) {
            throw createCheckoutError(
                'CUSTOMER_IDENTITY_CONFLICT',
                'Ja existe um cliente com este NIF associado a outro contacto. Confirme o email e o nome fiscal antes de continuar.',
                {
                    field: 'nif'
                }
            );
        }

        const updatePayload = buildCustomerUpdatePayload(
            matchedCustomer,
            customerSnapshot,
            matchedBy === 'tax_id' ? 'fill_empty_only' : 'overwrite_non_empty'
        );

        if (Object.keys(updatePayload).length > 0) {
            const { error: updateError } = await supabase
                .from('clientes')
                .update(updatePayload)
                .eq('id', matchedCustomer.id);

            if (updateError) {
                throw updateError;
            }
        }

        return matchedCustomer.id;
    }

    const { data: createdCustomer, error: createError } = await supabase
        .from('clientes')
        .insert([buildCustomerPersistencePayload(customerSnapshot)])
        .select('id')
        .single();

    if (createError) {
        throw createError;
    }

    return createdCustomer?.id || null;
}

async function fetchProductsForCheckout(supabase, rawItems) {
    const productIds = uniqueNumbers(rawItems.map((item) => item?.id || item?.produtoId || item?.produto_id));
    const productRows = [];
    const productIdsSeen = new Set();

    if (productIds.length > 0) {
        const { data, error } = await supabase
            .from('produtos')
            .select('id,nome,preco,imagem,categoria,ativo')
            .in('id', productIds);

        if (error) {
            throw error;
        }

        (data || []).forEach((product) => {
            productRows.push(product);
            productIdsSeen.add(Number(product.id));
        });
    }

    const hasNameOnlyItems = rawItems.some((item) => !Number(item?.id || item?.produtoId || item?.produto_id) && normalizeName(item?.nome));
    if (hasNameOnlyItems || productRows.length < productIds.length) {
        const { data, error } = await supabase
            .from('produtos')
            .select('id,nome,preco,imagem,categoria,ativo');

        if (error) {
            throw error;
        }

        (data || []).forEach((product) => {
            const id = Number(product.id);
            if (!productIdsSeen.has(id)) {
                productRows.push(product);
                productIdsSeen.add(id);
            }
        });
    }

    return productRows;
}

async function fetchProductBasesForCheckout(supabase, productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('vw_produto_bases')
            .select('produto_id,base_id,base_nome,base_imagem,preco_extra_aplicado,is_default,ativo,base_ativa')
            .in('produto_id', productIds);

        if (error) {
            throw error;
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        const raw = String(error?.message || '').toLowerCase();
        if (error?.code === 'PGRST205' || raw.includes('vw_produto_bases')) {
            return [];
        }
        throw error;
    }
}

function buildProductLookup(products) {
    const byId = new Map();
    const byName = new Map();

    (products || []).forEach((product) => {
        const id = Number(product?.id);
        if (Number.isFinite(id)) {
            byId.set(id, product);
        }

        const name = normalizeName(product?.nome);
        if (name && !byName.has(name)) {
            byName.set(name, product);
        }
    });

    return { byId, byName };
}

function buildBaseLookup(bases) {
    const byProductAndBaseId = new Map();
    const byProductId = new Map();

    (bases || []).forEach((base) => {
        if (base?.ativo === false || base?.base_ativa === false) {
            return;
        }

        const productId = Number(base?.produto_id);
        const baseId = Number(base?.base_id);
        if (Number.isFinite(productId) && Number.isFinite(baseId)) {
            byProductAndBaseId.set(`${productId}:${baseId}`, base);
            if (!byProductId.has(productId)) {
                byProductId.set(productId, []);
            }
            byProductId.get(productId).push(base);
        }
    });

    return { byProductAndBaseId, byProductId };
}

function resolveProductForItem(item, productLookup) {
    const candidateId = Number(item?.id || item?.produtoId || item?.produto_id);
    if (Number.isFinite(candidateId) && productLookup.byId.has(candidateId)) {
        return productLookup.byId.get(candidateId);
    }

    const candidateName = normalizeName(item?.nome);
    if (candidateName && productLookup.byName.has(candidateName)) {
        return productLookup.byName.get(candidateName);
    }

    throw createCheckoutError(
        'MISSING_PRODUCT_MAPPING',
        `Produto nao encontrado na base de dados: ${normalizeText(item?.nome) || candidateId || 'desconhecido'}`
    );
}

function normalizeDesignPayload(value, maxLength = 750000) {
    const text = normalizeText(value);
    if (!text) {
        return '';
    }
    return text.slice(0, maxLength);
}

function buildResolvedCheckoutItem(item, product, baseLookup) {
    if (product?.ativo === false) {
        throw createCheckoutError('PRODUCT_INACTIVE', `Produto indisponivel: ${product.nome || product.id}`);
    }

    const productId = Number(product.id);
    const baseId = Number(item?.baseId || item?.base_id || 0);
    const productBases = baseLookup.byProductId.get(productId) || [];
    const base = baseId > 0
        ? baseLookup.byProductAndBaseId.get(`${productId}:${baseId}`)
        : (productBases.find((candidate) => candidate?.is_default === true || String(candidate?.is_default) === 'true') || productBases[0] || null);

    if (baseId > 0 && !base) {
        throw createCheckoutError('BASE_INVALIDA', `Base invalida para o produto ${product.nome || productId}.`);
    }

    const productPrice = toNumber(product.preco, 0);
    const baseExtra = base ? toNumber(base.preco_extra_aplicado, 0) : 0;
    const unitPrice = Math.max(0, Number((productPrice + baseExtra).toFixed(2)));
    const quantity = normalizeQuantity(item?.quantity || item?.quantidade);

    if (unitPrice <= 0) {
        throw createCheckoutError('TOTAL_INVALIDO', `Preco invalido para o produto ${product.nome || productId}.`);
    }

    return {
        id: productId,
        produtoId: productId,
        nome: normalizeText(product.nome) || normalizeText(item?.nome) || 'Produto',
        quantity,
        quantidade: quantity,
        preco: unitPrice,
        precoUnitario: unitPrice,
        imagem: normalizeText(product.imagem || item?.imagem),
        customized: Boolean(item?.customized),
        designId: normalizeText(item?.designId || item?.design_id),
        design: normalizeDesignPayload(item?.design),
        designPreview: normalizeDesignPayload(item?.designPreview || item?.design_preview, 1500000),
        baseId: base ? Number(base.base_id) : null,
        baseNome: base ? normalizeText(base.base_nome) : '',
        baseImagem: base ? normalizeText(base.base_imagem) : '',
        basePrecoExtra: Number(baseExtra.toFixed(2))
    };
}

async function resolveCheckoutCart(supabase, rawItems) {
    const items = Array.isArray(rawItems) ? rawItems : [];
    if (items.length === 0) {
        throw createCheckoutError('CARRINHO_VAZIO', 'O carrinho esta vazio.');
    }

    const products = await fetchProductsForCheckout(supabase, items);
    const productLookup = buildProductLookup(products);

    const resolvedProducts = items.map((item) => resolveProductForItem(item, productLookup));
    const productIds = uniqueNumbers(resolvedProducts.map((product) => product.id));
    const bases = await fetchProductBasesForCheckout(supabase, productIds);
    const baseLookup = buildBaseLookup(bases);

    return items.map((item, index) => buildResolvedCheckoutItem(item, resolvedProducts[index], baseLookup));
}

function calculateCheckoutTotals(items) {
    const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
        return sum + (toNumber(item.preco, 0) * normalizeQuantity(item.quantity));
    }, 0);
    const shipping = 0;
    const total = subtotal + shipping;

    return {
        subtotal: Number(subtotal.toFixed(2)),
        shipping,
        total: Number(total.toFixed(2))
    };
}

function buildInitialOrderMeta(customerSnapshot, cart, selectedPaymentMethod, notes) {
    const itemSnapshots = buildOrderItemSnapshots(cart);

    return {
        workflowStatus: 'em_preparacao',
        paymentStatus: 'pending',
        paymentProvider: 'stripe',
        paymentMethod: normalizePaymentMethodType(selectedPaymentMethod),
        trackingCode: '',
        trackingUrl: '',
        stripeSessionId: '',
        stripePaymentIntent: '',
        facturalusaCustomerCode: '',
        facturalusaDocumentNumber: '',
        facturalusaDocumentUrl: '',
        facturalusaLastError: '',
        facturalusaStatus: 'pending',
        facturalusaLastAttemptAt: '',
        statusHistory: [
            {
                status: 'em_preparacao',
                at: new Date().toISOString(),
                note: 'Encomenda criada no checkout'
            }
        ],
        itemSnapshots,
        checkoutCustomer: customerSnapshot,
        checkoutSnapshot: buildCheckoutPayloadSnapshot(customerSnapshot, cart, selectedPaymentMethod, notes)
    };
}

function buildOrderItemsFromSnapshots(meta) {
    const sourceMeta = meta && typeof meta === 'object' ? meta : {};
    const snapshots = Array.isArray(sourceMeta.itemSnapshots) ? sourceMeta.itemSnapshots : [];

    return snapshots.map((snapshot) => ({
        produto_id: snapshot.produtoId || null,
        quantidade: snapshot.quantidade || 1,
        preco_unitario: snapshot.precoUnitario || 0,
        subtotal: (Number(snapshot.precoUnitario || 0) * Number(snapshot.quantidade || 1)),
        design_id: snapshot.designId || null,
        design_preview: snapshot.designPreview || null,
        nome_produto: snapshot.nome || 'Produto',
        imagem_produto: snapshot.imagem || '',
        base_id: snapshot.baseId || null,
        base_nome: snapshot.baseNome || '',
        base_preco_extra: snapshot.basePrecoExtra || 0,
        produtos: {
            id: snapshot.produtoId || null,
            nome: snapshot.nome || 'Produto',
            imagem: snapshot.imagem || '',
            preco: snapshot.precoUnitario || 0
        }
    }));
}

function buildPublicOrderPayload(order, meta) {
    const paymentStatus = normalizeText(order?.payment_status) || normalizeText(meta?.paymentStatus) || 'pending';
    const paymentProvider = normalizeText(order?.payment_provider) || normalizeText(meta?.paymentProvider) || 'stripe';
    const paymentMethod = normalizeText(order?.metodo_pagamento) || normalizeText(meta?.paymentMethod);
    const facturalusaDocumentNumber = normalizeText(order?.facturalusa_document_number) || normalizeText(meta?.facturalusaDocumentNumber);
    const facturalusaDocumentUrl = normalizeText(order?.facturalusa_document_url) || normalizeText(meta?.facturalusaDocumentUrl);
    const facturalusaStatus = normalizeText(order?.facturalusa_status) || normalizeText(meta?.facturalusaStatus) || (
        facturalusaDocumentNumber ? 'emitted'
            : paymentStatus === 'paid' ? 'pending'
                : 'not_required'
    );

    return {
        id: order?.id || null,
        numero_encomenda: order?.numero_encomenda || null,
        status: order?.status || null,
        subtotal: order?.subtotal || 0,
        envio: order?.envio || 0,
        total: order?.total || 0,
        metodo_pagamento: paymentMethod,
        payment_provider: paymentProvider,
        payment_status: paymentStatus,
        facturalusa_status: facturalusaStatus,
        facturalusa_document_number: facturalusaDocumentNumber || null,
        facturalusa_document_url: facturalusaDocumentUrl || null,
        created_at: order?.created_at || null,
        updated_at: order?.updated_at || null,
        tracking_codigo: meta?.trackingCode || order?.tracking_codigo || order?.codigo_tracking || order?.tracking_code || null,
        tracking_url: meta?.trackingUrl || order?.tracking_url || order?.url_tracking || order?.tracking_link || null
    };
}

function buildPublicOrderItemPayload(item = {}) {
    const product = item?.produtos && typeof item.produtos === 'object' ? item.produtos : {};
    const productName = normalizeText(item.nome_produto || product.nome) || 'Produto';
    const productImage = normalizeText(item.imagem_produto || product.imagem);
    const quantity = normalizeQuantity(item.quantidade || 1);
    const unitPrice = toNumber(item.preco_unitario || product.preco, 0);

    return {
        produto_id: item.produto_id || product.id || null,
        quantidade: quantity,
        preco_unitario: unitPrice,
        subtotal: toNumber(item.subtotal, unitPrice * quantity),
        design_id: normalizeText(item.design_id),
        design_preview: normalizeText(item.design_preview),
        nome_produto: productName,
        imagem_produto: productImage,
        base_id: item.base_id || null,
        base_nome: normalizeText(item.base_nome),
        base_preco_extra: toNumber(item.base_preco_extra, 0),
        produtos: {
            id: product.id || item.produto_id || null,
            nome: productName,
            imagem: productImage,
            preco: unitPrice
        }
    };
}

function buildPublicOrderItemsFromRows(items) {
    return (Array.isArray(items) ? items : []).map(buildPublicOrderItemPayload);
}

module.exports = {
    buildCheckoutCustomerSnapshot,
    buildInitialOrderMeta,
    buildOrderItemsFromSnapshots,
    buildPublicOrderItemsFromRows,
    buildPublicOrderItemPayload,
    buildPublicOrderPayload,
    calculateCheckoutTotals,
    createCheckoutError,
    findOrCreateCheckoutCustomer,
    normalizeQuantity,
    normalizeCheckoutPhoneNumber,
    normalizeCheckoutPostalCode,
    resolveCheckoutCart,
    validateCheckoutCustomerEmail,
    validateCheckoutCustomerPhone,
    validateCheckoutCustomerType,
    validateCheckoutCustomerTaxId,
    validateCheckoutPostalCode
};
