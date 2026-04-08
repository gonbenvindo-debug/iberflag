const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const { ImapFlow } = require('imapflow');
const { buildFromAddress, getImapConfig, getSmtpConfig } = require('./mail-config');

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
        const path = String(mailbox.path || '').toLowerCase();
        return candidates.some((candidate) => path === candidate.toLowerCase() || path.endsWith(`.${candidate.toLowerCase()}`));
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

async function sendTemplateEmail({ to, subject, html, text, preheader = '' }) {
    const recipient = String(to || '').trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        throw createMailError('INVALID_EMAIL_RECIPIENT', 'Destinatario de email invalido.', 400);
    }

    const config = getSmtpConfig();
    const transporter = createSmtpTransport();
    const from = buildFromAddress(config);
    const message = {
        from,
        replyTo: config.replyTo || undefined,
        to: recipient,
        subject: String(subject || '').trim(),
        html: String(html || ''),
        text: String(text || ''),
        headers: preheader ? { 'X-Preheader': String(preheader || '').trim() } : undefined
    };
    const rawMessage = await buildRawMessage({
        from,
        replyTo: config.replyTo || undefined,
        to: recipient,
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
        sentCopy
    };
}

module.exports = {
    sendTemplateEmail
};
