function getEnvValue(keys) {
    return String(keys
        .map((key) => process.env[key])
        .find((value) => String(value || '').trim()) || '').trim();
}

function requireEnvValue(keys, label) {
    const value = getEnvValue(keys);
    if (!value) {
        const error = new Error(`${label} not configured`);
        error.code = `${label}_NOT_CONFIGURED`;
        throw error;
    }

    return value;
}

function normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function parseResponseBody(rawText) {
    if (!rawText) {
        return null;
    }

    try {
        return JSON.parse(rawText);
    } catch {
        return rawText;
    }
}

function createSupabaseRestError(message, response, payload) {
    const error = new Error(
        (payload && typeof payload === 'object' && (payload.message || payload.error || payload.hint || payload.details))
            || message
            || `Supabase request failed (${response.status})`
    );
    error.status = response.status;
    error.code = payload?.code || response.statusText || 'SUPABASE_REQUEST_FAILED';
    error.details = payload?.details || null;
    error.hint = payload?.hint || null;
    error.response = payload;
    return error;
}

function buildFilterValue(value) {
    if (value === null) {
        return 'is.null';
    }

    if (typeof value === 'boolean') {
        return `eq.${value ? 'true' : 'false'}`;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return `eq.${value}`;
    }

    return `eq.${String(value ?? '')}`;
}

function buildInFilterValue(values) {
    const normalized = (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .map((value) => value.replace(/"/g, '\\"'));

    if (normalized.length === 0) {
        return 'in.()';
    }

    return `in.(${normalized.join(',')})`;
}

class SupabaseRestQuery {
    constructor(config, table) {
        this.config = config;
        this.table = table;
        this.mode = 'select';
        this.selectColumns = '*';
        this.filters = [];
        this.limitValue = null;
        this.payload = null;
        this.resultMode = 'many';
    }

    select(columns = '*') {
        this.selectColumns = columns || '*';
        return this;
    }

    eq(column, value) {
        this.filters.push({ column, value, operator: 'eq' });
        return this;
    }

    in(column, values) {
        this.filters.push({ column, value: values, operator: 'in' });
        return this;
    }

    limit(value) {
        this.limitValue = value;
        return this;
    }

    insert(payload) {
        this.mode = 'insert';
        this.payload = payload;
        return this;
    }

    update(payload) {
        this.mode = 'update';
        this.payload = payload;
        return this;
    }

    delete() {
        this.mode = 'delete';
        return this;
    }

    maybeSingle() {
        this.resultMode = 'maybeSingle';
        return this._execute();
    }

    single() {
        this.resultMode = 'single';
        return this._execute();
    }

    then(resolve, reject) {
        return this._execute().then(resolve, reject);
    }

    async _execute() {
        const { baseUrl, token } = this.config;
        const url = new URL(`${baseUrl}/rest/v1/${encodeURIComponent(this.table)}`);
        const method = this.mode === 'update'
            ? 'PATCH'
            : this.mode === 'delete'
                ? 'DELETE'
                : this.mode === 'insert'
                    ? 'POST'
                    : 'GET';

        const headers = {
            apikey: token,
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        };

        if (this.selectColumns && this.mode !== 'delete') {
            url.searchParams.set('select', this.selectColumns);
        }

        if (this.limitValue !== null && this.limitValue !== undefined) {
            url.searchParams.set('limit', String(this.limitValue));
        }

        this.filters.forEach(({ column, value, operator }) => {
            url.searchParams.set(column, operator === 'in' ? buildInFilterValue(value) : buildFilterValue(value));
        });

        let body = undefined;
        if (this.mode === 'insert' || this.mode === 'update') {
            headers['Content-Type'] = 'application/json';
            headers.Prefer = 'return=representation';
            body = JSON.stringify(this.payload);
        } else if (this.mode === 'delete' && this.selectColumns) {
            headers.Prefer = 'return=representation';
        }

        const response = await fetch(url, {
            method,
            headers,
            body
        });

        const rawText = await response.text();
        const payload = parseResponseBody(rawText);

        if (!response.ok) {
            throw createSupabaseRestError('Supabase request failed', response, payload);
        }

        const rows = Array.isArray(payload)
            ? payload
            : payload && typeof payload === 'object'
                ? [payload]
                : [];

        if (this.resultMode === 'single') {
            if (rows.length === 0) {
                const error = new Error('Single row expected but none was returned');
                error.code = 'SUPABASE_SINGLE_RESULT_EMPTY';
                throw error;
            }

            return {
                data: rows[0],
                error: null
            };
        }

        if (this.resultMode === 'maybeSingle') {
            return {
                data: rows[0] || null,
                error: null
            };
        }

        return {
            data: rows.length > 0 ? rows : null,
            error: null
        };
    }
}

class SupabaseRestClient {
    constructor(baseUrl, token) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.token = token;
    }

    from(table) {
        return new SupabaseRestQuery({
            baseUrl: this.baseUrl,
            token: this.token
        }, table);
    }
}

let adminClient = null;

function getSupabaseAdmin() {
    if (adminClient) {
        return adminClient;
    }

    const url = normalizeBaseUrl(getEnvValue(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']));
    const serviceRoleKey = requireEnvValue(['SUPABASE_SERVICE_ROLE_KEY'], 'SUPABASE_SERVICE_ROLE_KEY');

    if (!url) {
        const error = new Error('SUPABASE_URL not configured');
        error.code = 'SUPABASE_URL_NOT_CONFIGURED';
        throw error;
    }

    adminClient = new SupabaseRestClient(url, serviceRoleKey);
    return adminClient;
}

module.exports = {
    getSupabaseAdmin
};
