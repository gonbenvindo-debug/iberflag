function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function insertOrderItemsWithFallback(supabase, orderId, items) {
    const { data: dbProducts, error: dbProductsError } = await supabase
        .from('produtos')
        .select('id, nome');

    if (dbProductsError) {
        throw dbProductsError;
    }

    const productIdSet = new Set((dbProducts || []).map((product) => Number(product.id)).filter(Number.isFinite));
    const productIdByName = new Map();

    (dbProducts || []).forEach((product) => {
        const normalized = normalizeName(product.nome);
        if (normalized && !productIdByName.has(normalized)) {
            productIdByName.set(normalized, Number(product.id));
        }
    });

    const unresolvedItems = [];
    const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
        const candidateId = Number(item.id);
        const normalizedName = normalizeName(item.nome);

        let resolvedProductId = null;
        if (Number.isFinite(candidateId) && productIdSet.has(candidateId)) {
            resolvedProductId = candidateId;
        } else if (normalizedName && productIdByName.has(normalizedName)) {
            resolvedProductId = productIdByName.get(normalizedName);
        }

        if (!resolvedProductId) {
            unresolvedItems.push(item.nome || `ID ${item.id}`);
        }

        return {
            ...item,
            resolvedProductId
        };
    });

    if (unresolvedItems.length > 0) {
        throw {
            code: 'MISSING_PRODUCT_MAPPING',
            message: `Produtos nao encontrados na base de dados: ${unresolvedItems.join(', ')}`,
            details: unresolvedItems
        };
    }

    const baseItems = normalizedItems.map((item) => ({
        encomenda_id: orderId,
        produto_id: item.resolvedProductId,
        quantidade: Number(item.quantity || 1),
        preco_unitario: Number(item.preco || 0),
        subtotal: Number(item.preco || 0) * Number(item.quantity || 1)
    }));

    const optionalColumns = ['design_id', 'design_svg', 'design_preview', 'nome_produto', 'imagem_produto'];
    const optionalValueByColumn = {
        design_id: (item) => item.designId || item.design_id || null,
        design_svg: (item) => item.design || null,
        design_preview: (item) => item.designPreview || item.design_preview || null,
        nome_produto: (item) => item.nome || null,
        imagem_produto: (item) => item.imagem || null
    };

    const getSupportedOptionalColumns = async () => {
        try {
            const { data, error } = await supabase
                .from('itens_encomenda')
                .select('*')
                .limit(1);

            if (error || !Array.isArray(data) || data.length === 0) {
                return [];
            }

            const available = new Set(Object.keys(data[0] || {}));
            return optionalColumns.filter((columnName) => available.has(columnName));
        } catch {
            return [];
        }
    };

    let activeOptionalColumns = await getSupportedOptionalColumns();

    const getMissingColumnFromError = (error) => {
        const raw = [error?.message, error?.details, error?.hint]
            .filter(Boolean)
            .join(' | ')
            .toLowerCase();

        let match = raw.match(/column\s+"([a-z0-9_]+)"\s+of\s+relation\s+"itens_encomenda"\s+does\s+not\s+exist/);
        if (match) return match[1];

        match = raw.match(/could\s+not\s+find\s+the\s+'([a-z0-9_]+)'\s+column\s+of\s+'itens_encomenda'/);
        if (match) return match[1];

        match = raw.match(/could\s+not\s+find\s+the\s+"([a-z0-9_]+)"\s+column\s+of\s+"itens_encomenda"/);
        if (match) return match[1];

        return null;
    };

    while (true) {
        const payload = baseItems.map((baseItem, index) => {
            const sourceItem = normalizedItems[index];
            const enriched = { ...baseItem };

            activeOptionalColumns.forEach((columnName) => {
                enriched[columnName] = optionalValueByColumn[columnName](sourceItem);
            });

            return enriched;
        });

        const { error } = await supabase
            .from('itens_encomenda')
            .insert(payload);

        if (!error) {
            return;
        }

        const missingColumn = getMissingColumnFromError(error);
        if (!missingColumn) {
            throw error;
        }

        const columnIndex = activeOptionalColumns.indexOf(missingColumn);
        if (columnIndex === -1) {
            throw error;
        }

        activeOptionalColumns.splice(columnIndex, 1);

        if (activeOptionalColumns.length === 0) {
            const retry = await supabase
                .from('itens_encomenda')
                .insert(baseItems);

            if (retry.error) {
                throw retry.error;
            }
            return;
        }
    }
}

module.exports = {
    insertOrderItemsWithFallback
};
