function getMissingColumnFromError(error, tableName) {
    const raw = [error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .join(' | ')
        .toLowerCase();
    const escapedTable = String(tableName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        new RegExp(`column\\s+"([a-z0-9_]+)"\\s+of\\s+relation\\s+"${escapedTable}"\\s+does\\s+not\\s+exist`),
        new RegExp(`could\\s+not\\s+find\\s+the\\s+'([a-z0-9_]+)'\\s+column\\s+of\\s+'${escapedTable}'`),
        new RegExp(`could\\s+not\\s+find\\s+the\\s+"([a-z0-9_]+)"\\s+column\\s+of\\s+"${escapedTable}"`)
    ];

    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) return match[1];
    }

    return null;
}

function withoutUndefined(payload) {
    return Object.fromEntries(
        Object.entries(payload || {}).filter(([, value]) => value !== undefined)
    );
}

async function insertWithOptionalColumns(supabase, tableName, requiredPayload, optionalPayload = {}) {
    const required = withoutUndefined(requiredPayload);
    const optional = withoutUndefined(optionalPayload);
    let optionalEntries = Object.entries(optional);

    while (true) {
        const payload = {
            ...required,
            ...Object.fromEntries(optionalEntries)
        };

        const { data, error } = await supabase
            .from(tableName)
            .insert([payload])
            .select('*')
            .single();

        if (!error) {
            return { data, error: null };
        }

        const missingColumn = getMissingColumnFromError(error, tableName);
        if (!missingColumn) {
            return { data: null, error };
        }

        const nextEntries = optionalEntries.filter(([columnName]) => columnName !== missingColumn);
        if (nextEntries.length === optionalEntries.length) {
            return { data: null, error };
        }

        optionalEntries = nextEntries;
    }
}

async function updateWithOptionalColumns(supabase, tableName, matchColumn, matchValue, payload) {
    let entries = Object.entries(withoutUndefined(payload));

    while (entries.length > 0) {
        const activePayload = Object.fromEntries(entries);
        const { error } = await supabase
            .from(tableName)
            .update(activePayload)
            .eq(matchColumn, matchValue);

        if (!error) {
            return { error: null };
        }

        const missingColumn = getMissingColumnFromError(error, tableName);
        if (!missingColumn) {
            return { error };
        }

        const nextEntries = entries.filter(([columnName]) => columnName !== missingColumn);
        if (nextEntries.length === entries.length) {
            return { error };
        }

        entries = nextEntries;
    }

    return { error: null };
}

module.exports = {
    getMissingColumnFromError,
    insertWithOptionalColumns,
    updateWithOptionalColumns
};
