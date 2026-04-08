const nodemailer = require('nodemailer');
const { buildFromAddress, getSmtpConfig } = require('./mail-config');

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

async function sendTemplateEmail({ to, subject, html, text, preheader = '' }) {
    const recipient = String(to || '').trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        throw createMailError('INVALID_EMAIL_RECIPIENT', 'Destinatario de email invalido.', 400);
    }

    const config = getSmtpConfig();
    const transporter = createSmtpTransport();
    const info = await transporter.sendMail({
        from: buildFromAddress(config),
        replyTo: config.replyTo || undefined,
        to: recipient,
        subject: String(subject || '').trim(),
        html: String(html || ''),
        text: String(text || ''),
        headers: preheader ? { 'X-Preheader': String(preheader || '').trim() } : undefined
    });

    return {
        messageId: info?.messageId || '',
        accepted: info?.accepted || [],
        rejected: info?.rejected || []
    };
}

module.exports = {
    sendTemplateEmail
};
