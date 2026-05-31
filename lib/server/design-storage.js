const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { getEnvValue } = require('./env');

const DEFAULT_DESIGN_BUCKET = 'design-sources';
const TOKEN_BYTES = 32;

let storageClient = null;

function normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function getDesignStorageBucket() {
    return String(process.env.DESIGN_STORAGE_BUCKET || DEFAULT_DESIGN_BUCKET).trim() || DEFAULT_DESIGN_BUCKET;
}

function getSupabaseStorageClient() {
    if (storageClient) {
        return storageClient;
    }

    const url = normalizeBaseUrl(getEnvValue(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']));
    const serviceRoleKey = getEnvValue(['SUPABASE_SERVICE_ROLE_KEY']);
    if (!url || !serviceRoleKey) {
        const error = new Error('Supabase Storage is not configured.');
        error.code = !url ? 'SUPABASE_URL_NOT_CONFIGURED' : 'SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED';
        throw error;
    }

    storageClient = createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    return storageClient;
}

function normalizeDesignStorageId(value) {
    return String(value || '')
        .trim()
        .slice(0, 120)
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildDesignStoragePaths(designId) {
    const safeId = normalizeDesignStorageId(designId);
    if (!safeId) {
        return {
            safeId: '',
            maskedSvgPath: '',
            documentPath: ''
        };
    }

    return {
        safeId,
        maskedSvgPath: `designs/${safeId}/masked.svg`,
        documentPath: `designs/${safeId}/document.json`
    };
}

function generateReadToken() {
    return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashReadToken(token) {
    const normalized = String(token || '').trim();
    if (!normalized) {
        return '';
    }

    return crypto.createHash('sha256').update(normalized).digest('hex');
}

function safeEqualHash(a, b) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right || left.length !== right.length) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
    } catch {
        return false;
    }
}

function verifyReadToken(token, expectedHash) {
    return safeEqualHash(hashReadToken(token), expectedHash);
}

function buildDesignAssetUrl(designId, token, asset = 'svg') {
    const params = new URLSearchParams({
        designId: String(designId || '').trim(),
        token: String(token || '').trim(),
        asset
    });
    return `/api/designs?${params.toString()}`;
}

async function uploadPrivateDesignSvg(designId, svgMarkup) {
    const bucket = getDesignStorageBucket();
    const paths = buildDesignStoragePaths(designId);
    if (!paths.maskedSvgPath) {
        const error = new Error('Invalid design storage path.');
        error.code = 'INVALID_DESIGN_STORAGE_PATH';
        throw error;
    }

    const { data, error } = await getSupabaseStorageClient()
        .storage
        .from(bucket)
        .upload(paths.maskedSvgPath, Buffer.from(String(svgMarkup || ''), 'utf8'), {
            cacheControl: '3600',
            contentType: 'image/svg+xml',
            upsert: true
        });

    if (error) {
        throw error;
    }

    return {
        bucket,
        path: paths.maskedSvgPath,
        data
    };
}

async function uploadPrivateDesignDocument(designId, documentValue) {
    if (!documentValue || typeof documentValue !== 'object') {
        return null;
    }

    const bucket = getDesignStorageBucket();
    const paths = buildDesignStoragePaths(designId);
    if (!paths.documentPath) {
        return null;
    }

    const { data, error } = await getSupabaseStorageClient()
        .storage
        .from(bucket)
        .upload(paths.documentPath, Buffer.from(JSON.stringify(documentValue), 'utf8'), {
            cacheControl: '3600',
            contentType: 'application/json',
            upsert: true
        });

    if (error) {
        throw error;
    }

    return {
        bucket,
        path: paths.documentPath,
        data
    };
}

async function downloadPrivateDesignSvg(bucket, path) {
    const { data, error } = await getSupabaseStorageClient()
        .storage
        .from(String(bucket || getDesignStorageBucket()).trim())
        .download(String(path || '').trim());

    if (error) {
        throw error;
    }

    if (data && typeof data.arrayBuffer === 'function') {
        return Buffer.from(await data.arrayBuffer()).toString('utf8');
    }

    if (Buffer.isBuffer(data)) {
        return data.toString('utf8');
    }

    return String(data || '');
}

module.exports = {
    buildDesignAssetUrl,
    buildDesignStoragePaths,
    downloadPrivateDesignSvg,
    generateReadToken,
    getDesignStorageBucket,
    hashReadToken,
    uploadPrivateDesignDocument,
    uploadPrivateDesignSvg,
    verifyReadToken
};
