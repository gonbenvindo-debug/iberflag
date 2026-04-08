function getEnvValue(keys) {
    return String(keys
        .map((key) => process.env[key])
        .find((value) => String(value || '').trim()) || '').trim();
}

function parseBoolean(value, fallback = false) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    return ['1', 'true', 'yes', 'sim', 'on'].includes(raw);
}

function parsePort(value, fallback) {
    const port = Number(value || fallback);
    return Number.isFinite(port) && port > 0 ? port : fallback;
}

function getSmtpConfig() {
    const host = getEnvValue(['SMTP_HOST', 'EMAIL_SMTP_HOST']);
    const port = parsePort(getEnvValue(['SMTP_PORT', 'EMAIL_SMTP_PORT']), 587);
    const secure = parseBoolean(getEnvValue(['SMTP_SECURE', 'EMAIL_SMTP_SECURE']), port === 465);
    const user = getEnvValue(['SMTP_USER', 'EMAIL_SMTP_USER']);
    const password = getEnvValue(['SMTP_PASSWORD', 'SMTP_PASS', 'EMAIL_SMTP_PASSWORD']);
    const fromEmail = getEnvValue(['SMTP_FROM_EMAIL', 'MAIL_FROM_EMAIL', 'EMAIL_FROM']) || user;
    const fromName = getEnvValue(['SMTP_FROM_NAME', 'MAIL_FROM_NAME']) || 'IberFlag';
    const replyTo = getEnvValue(['SMTP_REPLY_TO', 'MAIL_REPLY_TO', 'SUPPORT_EMAIL']) || fromEmail;

    const missing = [];
    if (!host) missing.push('SMTP_HOST');
    if (!user) missing.push('SMTP_USER');
    if (!password) missing.push('SMTP_PASSWORD');
    if (!fromEmail) missing.push('SMTP_FROM_EMAIL');

    return {
        host,
        port,
        secure,
        user,
        password,
        fromEmail,
        fromName,
        replyTo,
        missing,
        configured: missing.length === 0
    };
}

function getImapConfig() {
    const host = getEnvValue(['IMAP_HOST', 'EMAIL_IMAP_HOST']);
    const port = parsePort(getEnvValue(['IMAP_PORT', 'EMAIL_IMAP_PORT']), 993);
    const secure = parseBoolean(getEnvValue(['IMAP_SECURE', 'EMAIL_IMAP_SECURE']), true);
    const user = getEnvValue(['IMAP_USER', 'EMAIL_IMAP_USER']);
    const password = getEnvValue(['IMAP_PASSWORD', 'IMAP_PASS', 'EMAIL_IMAP_PASSWORD']);

    const missing = [];
    if (!host) missing.push('IMAP_HOST');
    if (!user) missing.push('IMAP_USER');
    if (!password) missing.push('IMAP_PASSWORD');

    return {
        host,
        port,
        secure,
        user,
        password,
        missing,
        configured: missing.length === 0
    };
}

function getMailConfigStatus() {
    const smtp = getSmtpConfig();
    const imap = getImapConfig();

    return {
        smtp: {
            configured: smtp.configured,
            host: smtp.host ? 'configured' : '',
            port: smtp.port,
            secure: smtp.secure,
            user: smtp.user ? 'configured' : '',
            fromEmail: smtp.fromEmail ? 'configured' : '',
            replyTo: smtp.replyTo ? 'configured' : '',
            missing: smtp.missing
        },
        imap: {
            configured: imap.configured,
            host: imap.host ? 'configured' : '',
            port: imap.port,
            secure: imap.secure,
            user: imap.user ? 'configured' : '',
            missing: imap.missing
        }
    };
}

function buildFromAddress(config = getSmtpConfig()) {
    const name = String(config.fromName || 'IberFlag').replace(/["<>]/g, '').trim();
    const email = String(config.fromEmail || '').trim();
    return name ? `"${name}" <${email}>` : email;
}

module.exports = {
    buildFromAddress,
    getImapConfig,
    getMailConfigStatus,
    getSmtpConfig
};
