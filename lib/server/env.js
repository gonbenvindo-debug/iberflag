function sanitizeEnvValue(value) {
    return String(value ?? '')
        .replace(/\\r\\n/g, '')
        .replace(/\\n/g, '')
        .replace(/\\r/g, '')
        .trim();
}

function getEnvValue(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    return keyList
        .map((key) => sanitizeEnvValue(process.env[key]))
        .find(Boolean) || '';
}

module.exports = {
    getEnvValue,
    sanitizeEnvValue
};
