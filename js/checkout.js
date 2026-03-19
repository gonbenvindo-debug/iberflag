// ===== CHECKOUT PAGE LOGIC =====

const FREE_SHIPPING_THRESHOLD = 150;
const SHIPPING_COST = 7.50;

// ===== DOM ELEMENTS =====
const checkoutForm = document.getElementById('checkout-form');
const orderItems = document.getElementById('order-items');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const totalEl = document.getElementById('total');
const remainingEl = document.getElementById('remaining');
const freeShippingMsg = document.getElementById('free-shipping-msg');
const placeOrderBtn = document.getElementById('place-order-btn');
const termsCheckbox = document.getElementById('terms-checkbox');

function buildOrderItemSnapshots(items) {
    return items.map((item) => ({
        produtoId: Number(item.id) || null,
        nome: item.nome || 'Produto',
        quantidade: Math.max(1, Number.parseInt(item.quantity || 1, 10) || 1),
        precoUnitario: Number(item.preco || 0),
        imagem: item.imagem || '',
        designPreview: item.designPreview || (typeof getCartItemImage === 'function' ? getCartItemImage(item) : item.imagem || ''),
        design: item.design || ''
    }));
}

async function insertOrderItemsWithFallback(orderId, items) {
    const baseItems = items.map((item) => ({
        encomenda_id: orderId,
        produto_id: item.id,
        quantidade: item.quantity,
        preco_unitario: item.preco,
        subtotal: item.preco * item.quantity
    }));

    // These columns are optional because schemas can differ between environments.
    const optionalColumns = ['design_svg', 'design_preview', 'nome_produto', 'imagem_produto'];
    const optionalValueByColumn = {
        design_svg: (item) => item.design || null,
        design_preview: (item) => item.designPreview || (typeof getCartItemImage === 'function' ? getCartItemImage(item) : item.imagem || null),
        nome_produto: (item) => item.nome || null,
        imagem_produto: (item) => item.imagem || null
    };

    const activeOptionalColumns = [...optionalColumns];

    while (true) {
        const payload = baseItems.map((baseItem, index) => {
            const sourceItem = items[index];
            const enriched = { ...baseItem };

            activeOptionalColumns.forEach((columnName) => {
                enriched[columnName] = optionalValueByColumn[columnName](sourceItem);
            });

            return enriched;
        });

        const { error } = await supabaseClient
            .from('itens_encomenda')
            .insert(payload);

        if (!error) {
            return;
        }

        const errorMessage = String(error.message || '').toLowerCase();
        const match = errorMessage.match(/column\s+"([a-z0-9_]+)"\s+of\s+relation\s+"itens_encomenda"\s+does\s+not\s+exist/);

        if (!match) {
            throw error;
        }

        const missingColumn = match[1];
        const columnIndex = activeOptionalColumns.indexOf(missingColumn);

        if (columnIndex === -1) {
            throw error;
        }

        activeOptionalColumns.splice(columnIndex, 1);

        if (activeOptionalColumns.length === 0) {
            const retry = await supabaseClient
                .from('itens_encomenda')
                .insert(baseItems);

            if (retry.error) {
                throw retry.error;
            }
            return;
        }
    }
}

// ===== LOAD CART =====
function loadCart() {
    if (!cart || cart.length === 0) {
        window.location.href = '/produtos.html';
        return;
    }

    // Render cart items
    orderItems.innerHTML = cart.map(item => `
        <div class="flex gap-3 pb-4 border-b">
            <img src="${typeof getCartItemImage === 'function' ? getCartItemImage(item) : item.imagem}" alt="${item.nome}" class="w-16 h-16 object-cover rounded bg-gray-50 border border-gray-100">
            <div class="flex-1">
                <h4 class="font-semibold text-sm">${item.nome}</h4>
                ${item.customized ? '<span class="text-xs text-green-600 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>Personalizado</span>' : ''}
                <p class="text-sm text-gray-600">Qtd: ${item.quantity}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-blue-600">${(item.preco * item.quantity).toFixed(2)}€</p>
            </div>
        </div>
    `).join('');

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = subtotal + shipping;

    subtotalEl.textContent = `${subtotal.toFixed(2)}€`;
    shippingEl.textContent = shipping === 0 ? 'Grátis' : `${shipping.toFixed(2)}€`;
    totalEl.textContent = `${total.toFixed(2)}€`;

    // Free shipping message
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
        freeShippingMsg.innerHTML = '<p class="font-semibold">Envio grátis aplicado! 🎉</p>';
    } else {
        const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
        remainingEl.textContent = `${remaining.toFixed(2)}€`;
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ===== VALIDATE CUSTOMIZATION =====
function validateCustomization() {
    const hasUncustomized = cart.some(item => !item.customized);
    
    if (hasUncustomized) {
        showToast('Todos os produtos devem ser personalizados antes da compra', 'error');
        setTimeout(() => {
            window.location.href = '/produtos.html';
        }, 2000);
        return false;
    }
    
    return true;
}

// ===== PLACE ORDER =====
if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Validate form
        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }

        // Check terms
        if (!termsCheckbox.checked) {
            showToast('Por favor, aceite os termos e condições', 'error');
            return;
        }

        // Validate customization
        if (!validateCustomization()) {
            return;
        }

        // Get form data
        const formData = new FormData(checkoutForm);
        const customerData = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            telefone: formData.get('telefone'),
            nif: formData.get('nif') || null,
            empresa: formData.get('empresa') || null,
            morada: formData.get('morada'),
            codigo_postal: formData.get('codigo_postal'),
            cidade: formData.get('cidade')
        };

        const orderNotes = formData.get('notas') || null;

        // Calculate totals
        const subtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
        const total = subtotal + shipping;

        // Disable button
        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = '<div class="spinner mx-auto"></div>';

        try {
            // 1. Create or get customer
            let customerId;
            const { data: existingCustomer } = await supabaseClient
                .from('clientes')
                .select('id')
                .eq('email', customerData.email)
                .maybeSingle();

            if (existingCustomer) {
                customerId = existingCustomer.id;
                // Update customer data
                await supabaseClient
                    .from('clientes')
                    .update(customerData)
                    .eq('id', customerId);
            } else {
                // Create new customer
                const { data: newCustomer, error: customerError } = await supabaseClient
                    .from('clientes')
                    .insert([customerData])
                    .select()
                    .single();

                if (customerError) throw customerError;
                customerId = newCustomer.id;
            }

            // 2. Create order
            const orderNumber = `IBF${Date.now()}`;
            const initialWorkflowStatus = 'pendente_confirmacao';
            const orderMeta = {
                workflowStatus: initialWorkflowStatus,
                trackingCode: '',
                trackingUrl: '',
                statusHistory: [
                    {
                        status: initialWorkflowStatus,
                        at: new Date().toISOString(),
                        note: 'Encomenda criada no checkout'
                    }
                ],
                itemSnapshots: buildOrderItemSnapshots(cart)
            };

            const orderData = {
                cliente_id: customerId,
                numero_encomenda: orderNumber,
                status: typeof getLegacyStatusFromWorkflow === 'function'
                    ? getLegacyStatusFromWorkflow(initialWorkflowStatus)
                    : 'pendente',
                subtotal: subtotal,
                envio: shipping,
                total: total,
                notas: typeof buildOrderNotesWithMeta === 'function'
                    ? buildOrderNotesWithMeta(orderNotes, orderMeta)
                    : orderNotes,
                morada_envio: `${customerData.morada}, ${customerData.codigo_postal} ${customerData.cidade}`,
                metodo_pagamento: 'stripe_placeholder'
            };

            const { data: order, error: orderError } = await supabaseClient
                .from('encomendas')
                .insert([orderData])
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Create order items (with graceful fallback for optional design columns)
            await insertOrderItemsWithFallback(order.id, cart);

            // Success!
            showToast('Encomenda criada com sucesso!', 'success');
            
            // Clear cart
            cart = [];
            localStorage.removeItem('iberflag_cart');
            localStorage.removeItem('latinflag_cart');
            localStorage.removeItem('cart');

            // Show success message
            setTimeout(() => {
                alert(`✅ Encomenda ${orderNumber} criada com sucesso!\n\n` +
                      `📧 Receberá um email de confirmação em breve.\n\n` +
                      `💳 NOTA: A integração com Stripe será implementada em breve.\n` +
                      `Por enquanto, a encomenda foi registada no sistema.\n\n` +
                        `🔎 Pode acompanhar o estado em /encomendas.html com o seu email e nº da encomenda.\n\n` +
                      `📦 Produção: 12-24h\n` +
                      `🚚 Entrega: 2-4 dias úteis\n\n` +
                      `Total: ${total.toFixed(2)}€`);
                
                window.location.href = '/';
            }, 1000);

        } catch (error) {
            console.error('Erro ao criar encomenda:', error);
            showToast('Erro ao processar encomenda. Por favor, tente novamente.', 'error');
            
            // Re-enable button
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i> Finalizar Encomenda';
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
});
