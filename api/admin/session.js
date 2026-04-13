const { requireAdminRequest } = require('../../lib/server/admin-auth');
const { sendJson } = require('../../lib/server/http');

module.exports = async function adminSessionHandler(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
        return;
    }

    try {
        const admin = await requireAdminRequest(req);
        sendJson(res, 200, {
            authenticated: true,
            admin
        });
    } catch (error) {
        if (error?.statusCode) {
            sendJson(res, error.statusCode, {
                error: error.code,
                message: error.message
            });
            return;
        }

        console.error('Erro ao validar sessao admin:', error);
        sendJson(res, 500, {
            error: 'ADMIN_SESSION_FAILED',
            message: 'Nao foi possivel validar a sessao admin.'
        });
    }
};
