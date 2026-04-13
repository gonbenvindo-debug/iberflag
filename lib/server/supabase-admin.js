const { getEnvValue } = require('./env');

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

function buildOperatorFilterValue(operator, value) {
    const normalizedOperator = String(operator || 'eq').trim().toLowerCase();

    if ((normalizedOperator === 'is' || normalizedOperator === 'eq') && value === null) {
        return `${normalizedOperator}.null`;
    }

    if (typeof value === 'boolean') {
        return `${normalizedOperator}.${value ? 'true' : 'false'}`;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${normalizedOperator}.${value}`;
    }

    return `${normalizedOperator}.${String(value ?? '')}`;
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

function appendPreferHeader(existing, value) {
    const current = String(existing || '').trim();
    if (!current) {
        return value;
    }

    return `${current},${value}`;
}

function parseResponseCount(response) {
    const contentRange = String(response.headers.get('content-range') || '').trim();
    if (!contentRange || !contentRange.includes('/')) {
        return null;
    }

    const rawCount = contentRange.split('/').pop();
    const parsed = Number.parseInt(rawCount, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

class SupabaseRestQuery {
    constructor(config, table) {
        this.config = config;
        this.table = table;
        this.mode = 'select';
        this.selectColumns = '*';
        this.selectOptions = {};
        this.filters = [];
        this.orderBy = [];
        this.limitValue = null;
        this.payload = null;
        this.upsertOptions = null;
        this.resultMode = 'many';
    }

    select(columns = '*', options = {}) {
        this.selectColumns = columns || '*';
        this.selectOptions = options || {};
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

    neq(column, value) {
        this.filters.push({ column, value, operator: 'neq' });
        return this;
    }

    lt(column, value) {
        this.filters.push({ column, value, operator: 'lt' });
        return this;
    }

    lte(column, value) {
        this.filters.push({ column, value, operator: 'lte' });
        return this;
    }

    gt(column, value) {
        this.filters.push({ column, value, operator: 'gt' });
        return this;
    }

    gte(column, value) {
        this.filters.push({ column, value, operator: 'gte' });
        return this;
    }

    not(column, operator, value) {
        this.filters.push({
            column,
            value,
            operator: 'not',
            notOperator: operator
        });
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

    upsert(payload, options = {}) {
        this.mode = 'upsert';
        this.payload = payload;
        this.upsertOptions = options || {};
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

    order(column, options = {}) {
        this.orderBy.push({
            column,
            ascending: options?.ascending !== false,
            nullsFirst: Boolean(options?.nullsFirst)
        });
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
                : this.mode === 'insert' || this.mode === 'upsert'
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

        this.filters.forEach(({ column, value, operator, notOperator }) => {
            if (operator === 'in') {
                url.searchParams.set(column, buildInFilterValue(value));
                return;
            }

            if (operator === 'not') {
                url.searchParams.set(column, `not.${buildOperatorFilterValue(notOperator, value)}`);
                return;
            }

            if (['neq', 'lt', 'lte', 'gt', 'gte'].includes(operator)) {
                url.searchParams.set(column, buildOperatorFilterValue(operator, value));
                return;
            }

            url.searchParams.set(column, buildFilterValue(value));
        });

        this.orderBy.forEach(({ column, ascending, nullsFirst }) => {
            const direction = ascending ? 'asc' : 'desc';
            const nulls = nullsFirst ? '.nullsfirst' : '';
            url.searchParams.append('order', `${column}.${direction}${nulls}`);
        });

        let body = undefined;
        if (this.mode === 'insert' || this.mode === 'update' || this.mode === 'upsert') {
            headers['Content-Type'] = 'application/json';
            headers.Prefer = this.mode === 'upsert'
                ? 'resolution=merge-duplicates,return=representation'
                : 'return=representation';
            body = JSON.stringify(this.payload);
        } else if (this.mode === 'delete' && this.selectColumns) {
            headers.Prefer = 'return=representation';
        }

        if (this.mode === 'upsert' && this.upsertOptions?.onConflict) {
            url.searchParams.set('on_conflict', String(this.upsertOptions.onConflict));
        }

        if (this.selectOptions?.count) {
            headers.Prefer = appendPreferHeader(headers.Prefer, `count=${String(this.selectOptions.count).trim()}`);
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
        const count = this.selectOptions?.count ? parseResponseCount(response) : null;

        if (this.resultMode === 'single') {
            if (rows.length === 0) {
                const error = new Error('Single row expected but none was returned');
                error.code = 'SUPABASE_SINGLE_RESULT_EMPTY';
                throw error;
            }

            return {
                data: rows[0],
                error: null,
                count
            };
        }

        if (this.resultMode === 'maybeSingle') {
            return {
                data: rows[0] || null,
                error: null,
                count
            };
        }

        return {
            data: rows.length > 0 ? rows : null,
            error: null,
            count
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
