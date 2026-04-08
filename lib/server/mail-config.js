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

function getMailIdentity() {
    const fromEmail = getEnvValue([
        'RESEND_FROM_EMAIL',
        'MAIL_FROM_EMAIL',
        'SMTP_FROM_EMAIL',
        'EMAIL_FROM'
    ]);
    const fromName = getEnvValue([
        'RESEND_FROM_NAME',
        'MAIL_FROM_NAME',
        'SMTP_FROM_NAME'
    ]) || 'IberFlag';
    const replyTo = getEnvValue([
        'RESEND_REPLY_TO',
        'MAIL_REPLY_TO',
        'SMTP_REPLY_TO',
        'SUPPORT_EMAIL'
    ]) || fromEmail;

    return {
        fromEmail,
        fromName,
        replyTo
    };
}

function getResendConfig() {
    const apiKey = getEnvValue(['RESEND_API_KEY']);
    const identity = getMailIdentity();

    const missing = [];
    if (!apiKey) missing.push('RESEND_API_KEY');
    if (!identity.fromEmail) missing.push('RESEND_FROM_EMAIL');

    return {
        provider: 'resend',
        apiKey,
        ...identity,
        missing,
        configured: missing.length === 0
    };
}

function getSmtpConfig() {
    const host = getEnvValue(['SMTP_HOST', 'EMAIL_SMTP_HOST']);
    const port = parsePort(getEnvValue(['SMTP_PORT', 'EMAIL_SMTP_PORT']), 587);
    const secure = parseBoolean(getEnvValue(['SMTP_SECURE', 'EMAIL_SMTP_SECURE']), port === 465);
    const user = getEnvValue(['SMTP_USER', 'EMAIL_SMTP_USER']);
    const password = getEnvValue(['SMTP_PASSWORD', 'SMTP_PASS', 'EMAIL_SMTP_PASSWORD']);
    const identity = getMailIdentity();
    const fromEmail = identity.fromEmail || user;

    const missing = [];
    if (!host) missing.push('SMTP_HOST');
    if (!user) missing.push('SMTP_USER');
    if (!password) missing.push('SMTP_PASSWORD');
    if (!fromEmail) missing.push('SMTP_FROM_EMAIL');

    return {
        provider: 'smtp',
        host,
        port,
        secure,
        user,
        password,
        fromEmail,
        fromName: identity.fromName,
        replyTo: identity.replyTo || fromEmail,
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
    const sentMailbox = getEnvValue(['IMAP_SENT_MAILBOX', 'EMAIL_IMAP_SENT_MAILBOX']);

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
        sentMailbox,
        missing,
        configured: missing.length === 0
    };
}

function resolveActiveMailProvider() {
    const resend = getResendConfig();
    if (resend.configured) {
        return 'resend';
    }

    const smtp = getSmtpConfig();
    if (smtp.configured) {
        return 'smtp';
    }

    return 'none';
}

function getMailConfigStatus() {
    const resend = getResendConfig();
    const smtp = getSmtpConfig();
    const imap = getImapConfig();
    const activeProvider = resolveActiveMailProvider();

    return {
        activeProvider,
        resend: {
            configured: resend.configured,
            fromEmail: resend.fromEmail ? 'configured' : '',
            fromName: resend.fromName ? 'configured' : '',
            replyTo: resend.replyTo ? 'configured' : '',
            missing: resend.missing
        },
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
            sentMailbox: imap.sentMailbox || '',
            missing: imap.missing
        }
    };
}

function buildFromAddress(config) {
    const name = String(config?.fromName || 'IberFlag').replace(/["<>]/g, '').trim();
    const email = String(config?.fromEmail || '').trim();
    return name ? `"${name}" <${email}>` : email;
}

module.exports = {
    buildFromAddress,
    getImapConfig,
    getMailConfigStatus,
    getMailIdentity,
    getResendConfig,
    getSmtpConfig,
    resolveActiveMailProvider
};
