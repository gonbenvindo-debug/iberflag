const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveCheckoutCart } = require('../lib/server/order-flow');

function createSupabaseMock({ products = [], bases = [] } = {}) {
    return {
        from(table) {
            const rows = table === 'produtos' ? products : bases;
            return {
                select() {
                    const createResult = (data) => ({ data, error: null });
                    const builder = {
                        in(column, values) {
                            const allowed = new Set((values || []).map(Number));
                            const filtered = rows.filter((row) => allowed.has(Number(row[column])));
                            return Promise.resolve(createResult(filtered));
                        },
                        then(resolve, reject) {
                            return Promise.resolve(createResult(rows)).then(resolve, reject);
                        }
                    };

                    return builder;
                }
            };
        }
    };
}

const product = {
    id: 10,
    nome: 'Wall Banner',
    preco: 91.5,
    imagem: '/wall.jpg',
    categoria: 'wall-banner',
    ativo: true
};

const defaultBase = {
    produto_id: 10,
    base_id: 7,
    base_nome: 'Base Cruzeta',
    base_imagem: '/base.jpg',
    preco_extra_aplicado: 12,
    is_default: true,
    ativo: true,
    base_ativa: true
};

test('checkout não adiciona base por defeito quando o carrinho não envia baseId', async () => {
    const supabase = createSupabaseMock({ products: [product], bases: [defaultBase] });
    const [item] = await resolveCheckoutCart(supabase, [{ id: 10, quantity: 1, customized: true }]);

    assert.equal(item.baseId, null);
    assert.equal(item.baseNome, '');
    assert.equal(item.basePrecoExtra, 0);
    assert.equal(item.preco, 91.5);
});

test('checkout aplica uma base válida apenas quando baseId vem no carrinho', async () => {
    const supabase = createSupabaseMock({ products: [product], bases: [defaultBase] });
    const [item] = await resolveCheckoutCart(supabase, [{ id: 10, baseId: 7, quantity: 1, customized: true }]);

    assert.equal(item.baseId, 7);
    assert.equal(item.baseNome, 'Base Cruzeta');
    assert.equal(item.basePrecoExtra, 12);
    assert.equal(item.preco, 103.5);
});

test('checkout rejeita baseId inválido em vez de escolher fallback', async () => {
    const supabase = createSupabaseMock({ products: [product], bases: [defaultBase] });

    await assert.rejects(
        () => resolveCheckoutCart(supabase, [{ id: 10, baseId: 999, quantity: 1, customized: true }]),
        (error) => error?.code === 'BASE_INVALIDA'
    );
});
