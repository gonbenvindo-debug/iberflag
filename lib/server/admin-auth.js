const { getSupabaseAdmin } = require('./supabase-admin');
const { getEnvValue } = require('./env');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function getHeaderValue(req, name) {
    if (!req?.headers) return '';
    const value = req.headers[name] || req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : String(value || '');
}

function getSupabaseBaseUrl() {
    return getEnvValue(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']).replace(/\/+$/, '');
}

function getSupabaseServiceRoleKey() {
    return getEnvValue(['SUPABASE_SERVICE_ROLE_KEY']);
}

function createAuthError(code, message, statusCode = 401) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

function extractBearerToken(req) {
    const authorization = getHeaderValue(req, 'authorization');
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

async function verifySupabaseUserToken(accessToken) {
    const baseUrl = getSupabaseBaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();

    if (!baseUrl || !serviceRoleKey) {
        throw createAuthError('ADMIN_AUTH_NOT_CONFIGURED', 'Autenticacao admin nao configurada.', 500);
    }

    const response = await fetch(`${baseUrl}/auth/v1/user`, {
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
        }
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.email) {
        throw createAuthError('ADMIN_UNAUTHORIZED', 'Sessao admin invalida.', 401);
    }

    return payload;
}

async function isAdminEmail(email) {
    const normalized = normalizeEmail(email);

    if (!normalized) {
        return false;
    }

    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('admin_users')
            .select('email,active')
            .eq('email', normalized)
            .maybeSingle();

        if (!error && data?.active === true) {
            return true;
        }
    } catch (error) {
        const raw = String(error?.message || '').toLowerCase();
        if (error?.code !== 'PGRST205' && !raw.includes('admin_users')) {
            throw error;
        }

        throw createAuthError(
            'ADMIN_ALLOWLIST_NOT_CONFIGURED',
            'Allowlist admin nao configurada no Supabase.',
            500
        );
    }

    return false;
}

async function requireAdminRequest(req) {
    const accessToken = extractBearerToken(req);
    if (!accessToken) {
        throw createAuthError('ADMIN_AUTH_REQUIRED', 'Sessao admin obrigatoria.', 401);
    }

    const user = await verifySupabaseUserToken(accessToken);
    const email = normalizeEmail(user.email);
    const allowed = await isAdminEmail(email);

    if (!allowed) {
        throw createAuthError('ADMIN_FORBIDDEN', 'Utilizador sem permissoes admin.', 403);
    }

    return {
        email,
        id: user.id || user.sub || null
    };
}

module.exports = {
    requireAdminRequest
};
