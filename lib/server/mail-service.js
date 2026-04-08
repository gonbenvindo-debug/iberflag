const {
    buildFromAddress,
    getImapConfig,
    getResendConfig,
    getSmtpConfig,
    resolveActiveMailProvider
} = require('./mail-config');

function createMailError(code, message, statusCode = 500) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

function createSmtpTransport() {
    const config = getSmtpConfig();
    if (!config.configured) {
        throw createMailError(
            'SMTP_NOT_CONFIGURED',
            `SMTP incompleto. Faltam variaveis: ${config.missing.join(', ')}`,
            503
        );
    }

    const nodemailer = require('nodemailer');
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.password
        }
    });
}

async function buildRawMessage({ from, replyTo, to, subject, html, text, preheader = '' }) {
    const MailComposer = require('nodemailer/lib/mail-composer');
    return new MailComposer({
        from,
        replyTo: replyTo || undefined,
        to,
        subject,
        html,
        text,
        headers: preheader ? { 'X-Preheader': String(preheader || '').trim() } : undefined
    }).compile().build();
}

function pickSentMailbox(mailboxes, configuredPath = '') {
    const configured = String(configuredPath || '').trim();
    if (configured) {
        return configured;
    }

    const all = Array.isArray(mailboxes) ? mailboxes : [];
    const special = all.find((mailbox) => mailbox.specialUse === '\\Sent');
    if (special?.path) return special.path;

    const candidates = ['Sent', 'Sent Mail', 'Sent Items', 'Enviados', 'Itens Enviados', 'INBOX.Sent', 'INBOX.Enviados'];
    const byName = all.find((mailbox) => {
        const mailboxPath = String(mailbox.path || '').toLowerCase();
        return candidates.some((candidate) => mailboxPath === candidate.toLowerCase() || mailboxPath.endsWith(`.${candidate.toLowerCase()}`));
    });

    return byName?.path || 'Sent';
}

async function saveSentCopy(rawMessage) {
    const config = getImapConfig();
    if (!config.configured) {
        return {
            saved: false,
            reason: 'IMAP_NOT_CONFIGURED'
        };
    }

    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.password
        },
        logger: false
    });

    await client.connect();
    try {
        const mailboxes = await client.list();
        const sentMailbox = pickSentMailbox(mailboxes, config.sentMailbox);
        await client.append(sentMailbox, rawMessage, ['\\Seen'], new Date());
        return {
            saved: true,
            mailbox: sentMailbox
        };
    } finally {
        await client.logout().catch(() => {});
    }
}

async function sendViaResend({ to, subject, html, text, preheader = '' }) {
    const config = getResendConfig();
    if (!config.configured) {
        throw createMailError(
            'RESEND_NOT_CONFIGURED',
            `Resend incompleto. Faltam variaveis: ${config.missing.join(', ')}`,
            503
        );
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: buildFromAddress(config),
            to: [String(to || '').trim()],
            reply_to: config.replyTo || undefined,
            subject: String(subject || '').trim(),
            html: String(html || ''),
            text: String(text || ''),
            headers: preheader ? { 'X-Preheader': String(preheader || '').trim() } : undefined
        })
    });

    const rawText = await response.text();
    let payload = {};
    try {
        payload = rawText ? JSON.parse(rawText) : {};
    } catch {
        payload = { message: rawText };
    }

    if (!response.ok) {
        const message = payload?.message || payload?.error || rawText || `Resend request failed (${response.status})`;
        const normalized = String(message || '').toLowerCase();
        if (response.status === 403 && normalized.includes('domain is not verified')) {
            throw createMailError(
                'RESEND_DOMAIN_NOT_VERIFIED',
                message,
                response.status
            );
        }

        if (response.status === 403 && normalized.includes('only send testing emails to your own email address')) {
            throw createMailError(
                'RESEND_TEST_MODE_RESTRICTED',
                message,
                response.status
            );
        }

        throw createMailError('RESEND_SEND_FAILED', message, response.status);
    }

    return {
        messageId: payload?.id || '',
        accepted: [String(to || '').trim()],
        rejected: [],
        sentCopy: {
            saved: false,
            reason: 'PROVIDER_MANAGED'
        },
        provider: 'resend'
    };
}

async function sendViaSmtp({ to, subject, html, text, preheader = '' }) {
    const config = getSmtpConfig();
    const transporter = createSmtpTransport();
    const from = buildFromAddress(config);
    const message = {
        from,
        replyTo: config.replyTo || undefined,
        to: String(to || '').trim(),
        subject: String(subject || '').trim(),
        html: String(html || ''),
        text: String(text || ''),
        headers: preheader ? { 'X-Preheader': String(preheader || '').trim() } : undefined
    };
    const rawMessage = await buildRawMessage({
        from,
        replyTo: config.replyTo || undefined,
        to: String(to || '').trim(),
        subject: String(subject || '').trim(),
        html: String(html || ''),
        text: String(text || ''),
        preheader
    });
    const info = await transporter.sendMail(message);

    let sentCopy = {
        saved: false,
        reason: 'NOT_ATTEMPTED'
    };
    try {
        sentCopy = await saveSentCopy(rawMessage);
    } catch (error) {
        sentCopy = {
            saved: false,
            reason: error?.code || 'IMAP_APPEND_FAILED',
            message: error?.message || 'Nao foi possivel gravar copia em Enviados.'
        };
        console.warn('Email enviado por SMTP, mas a copia IMAP em Enviados falhou:', sentCopy.message);
    }

    return {
        messageId: info?.messageId || '',
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
        sentCopy,
        provider: 'smtp'
    };
}

async function sendTemplateEmail({ to, subject, html, text, preheader = '' }) {
    const recipient = String(to || '').trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        throw createMailError('INVALID_EMAIL_RECIPIENT', 'Destinatario de email invalido.', 400);
    }

    const provider = resolveActiveMailProvider();
    if (provider === 'resend') {
        return sendViaResend({ to: recipient, subject, html, text, preheader });
    }

    if (provider === 'smtp') {
        return sendViaSmtp({ to: recipient, subject, html, text, preheader });
    }

    const resend = getResendConfig();
    const smtp = getSmtpConfig();
    const missing = [
        ...(resend.missing || []).map((name) => `Resend:${name}`),
        ...(smtp.missing || []).map((name) => `SMTP:${name}`)
    ];
    throw createMailError(
        'MAIL_PROVIDER_NOT_CONFIGURED',
        `Nenhum provider de email configurado. Faltam variaveis: ${missing.join(', ')}`,
        503
    );
}

module.exports = {
    sendTemplateEmail
};
