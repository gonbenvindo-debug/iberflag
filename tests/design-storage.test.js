const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildDesignAssetUrl,
    buildDesignStoragePaths,
    generateReadToken,
    hashReadToken,
    verifyReadToken
} = require('../lib/server/design-storage');
const { resolveCheckoutCart } = require('../lib/server/order-flow');

function createSupabaseMock({ products = [], bases = [], designSnapshots = [] } = {}) {
    return {
        from(table) {
            const rows = table === 'produtos'
                ? products
                : table === 'vw_produto_bases'
                    ? bases
                    : table === 'design_snapshots'
                        ? designSnapshots
                        : [];

            return {
                select() {
                    const createResult = (data) => ({ data, error: null });
                    const builder = {
                        in(column, values) {
                            const allowed = new Set((values || []).map((value) => String(value)));
                            const filtered = rows.filter((row) => allowed.has(String(row[column])));
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

test('design storage gera paths estaveis e tokens verificaveis', () => {
    const paths = buildDesignStoragePaths('dsg-123 teste!');
    assert.equal(paths.maskedSvgPath, 'designs/dsg-123-teste/masked.svg');
    assert.equal(paths.documentPath, 'designs/dsg-123-teste/document.json');

    const token = generateReadToken();
    const hash = hashReadToken(token);
    assert.equal(verifyReadToken(token, hash), true);
    assert.equal(verifyReadToken(`${token}-wrong`, hash), false);
});

test('checkout reaproveita metadata Storage do snapshot remoto', async () => {
    const supabase = createSupabaseMock({
        products: [{
            id: 10,
            nome: 'Fly Banner Surf 400CM',
            preco: 100,
            imagem: '/fly.jpg',
            ativo: true
        }],
        designSnapshots: [{
            design_id: 'dsg-storage-ok',
            design_preview: '',
            storage_bucket: 'design-sources',
            masked_svg_path: 'designs/dsg-storage-ok/masked.svg',
            document_path: 'designs/dsg-storage-ok/document.json',
            asset_manifest: {}
        }]
    });

    const [item] = await resolveCheckoutCart(supabase, [{
        id: 10,
        quantity: 1,
        customized: true,
        designId: 'dsg-storage-ok',
        designReadToken: 'read-token'
    }]);

    assert.equal(item.designStorageBucket, 'design-sources');
    assert.equal(item.designStoragePath, 'designs/dsg-storage-ok/masked.svg');
    assert.equal(item.designPreview, buildDesignAssetUrl('dsg-storage-ok', 'read-token', 'svg'));
});
