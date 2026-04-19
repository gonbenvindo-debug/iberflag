const { applyRateLimit, readJsonBody, readRawBody, sendJson } = require('../lib/server/http');
const { getEnvValue } = require('../lib/server/env');
const { getSupabaseAdmin } = require('../lib/server/supabase-admin');
const { getMailIdentity } = require('../lib/server/mail-config');
const { sendTemplateEmail } = require('../lib/server/mail-service');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeMessage(value) {
    return String(value ?? '').trim().replace(/\r\n/g, '\n');
}

function pickFirstNonEmpty(...values) {
    for (const value of values) {
        const normalized = normalizeText(value);
        if (normalized) return normalized;
    }
    return '';
}

async function readContactPayload(req) {
    const contentType = String(req?.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
        return readJsonBody(req);
    }

    const rawBody = await readRawBody(req);
    if (!rawBody || !rawBody.trim()) {
        return {};
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(rawBody);
        return Object.fromEntries(params.entries());
    }

    try {
        return JSON.parse(rawBody);
    } catch {
        const params = new URLSearchParams(rawBody);
        return Object.fromEntries(params.entries());
    }
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function buildRecipient() {
    const identity = getMailIdentity();
    return normalizeText(
        getEnvValue(['SUPPORT_EMAIL', 'CONTACT_EMAIL', 'MAIL_TO_EMAIL'])
        || getEnvValue(['ADMIN_EMAIL'])
        || getEnvValue(['RESEND_REPLY_TO', 'MAIL_REPLY_TO', 'SMTP_REPLY_TO'])
        || identity.fromEmail
        || 'geral@iberflag.com'
    );
}

function buildRecipientList() {
    const identity = getMailIdentity();
    const rawRecipients = [
        getEnvValue(['SUPPORT_EMAIL', 'CONTACT_EMAIL', 'MAIL_TO_EMAIL']),
        getEnvValue(['ADMIN_EMAIL']),
        getEnvValue(['RESEND_REPLY_TO', 'MAIL_REPLY_TO', 'SMTP_REPLY_TO']),
        identity.fromEmail
    ];

    const recipients = rawRecipients
        .map((value) => normalizeText(value))
        .filter((value) => value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

    return [...new Set(recipients)];
}

function buildSubject(subject) {
    const cleanSubject = normalizeText(subject);
    return cleanSubject ? `Novo contacto IberFlag: ${cleanSubject}` : 'Novo contacto IberFlag';
}

function buildTextBody({ nome, email, telefone, assunto, mensagem, source, pageUrl }) {
    return [
        'Novo contacto IberFlag',
        `Nome: ${nome}`,
        `Email: ${email}`,
        `Telefone: ${telefone || '-'}`,
        `Assunto: ${assunto}`,
        `Origem: ${source || '-'}`,
        `Pagina: ${pageUrl || '-'}`,
        '',
        'Mensagem:',
        mensagem
    ].join('\n');
}

function buildHtmlBody({ nome, email, telefone, assunto, mensagem, source, pageUrl }) {
    return `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <h1 style="font-size: 20px; margin: 0 0 16px;">Novo contacto IberFlag</h1>
            <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 640px;">
                <tr><td style="padding: 6px 0; font-weight: 700; width: 140px;">Nome</td><td style="padding: 6px 0;">${escapeHtml(nome)}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 700;">Email</td><td style="padding: 6px 0;">${escapeHtml(email)}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 700;">Telefone</td><td style="padding: 6px 0;">${escapeHtml(telefone || '-')}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 700;">Assunto</td><td style="padding: 6px 0;">${escapeHtml(assunto)}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 700;">Origem</td><td style="padding: 6px 0;">${escapeHtml(source || '-')}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: 700;">Pagina</td><td style="padding: 6px 0;">${escapeHtml(pageUrl || '-')}</td></tr>
            </table>
            <div style="margin-top: 20px;">
                <div style="font-weight: 700; margin-bottom: 8px;">Mensagem</div>
                <div style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">${escapeHtml(mensagem)}</div>
            </div>
        </div>
    `.trim();
}

module.exports = async function contactHandler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, {
            error: 'METHOD_NOT_ALLOWED',
            message: 'Use POST para enviar o formulario de contacto.'
        }, {
            Allow: 'POST'
        });
        return;
    }

    if (!applyRateLimit(req, res, {
        key: '/api/contact',
        windowMs: 10 * 60 * 1000,
        max: 8,
        message: 'Demasiados envios. Tente novamente dentro de alguns minutos.'
    })) {
        return;
    }

    let payload = {};
    try {
        payload = await readContactPayload(req);
    } catch (error) {
        sendJson(res, 400, {
            error: 'INVALID_JSON_BODY',
            message: 'Nao foi possivel ler o formulario enviado.'
        });
        return;
    }

    const nome = pickFirstNonEmpty(payload.nome, payload.nome_completo, payload.name);
    const email = pickFirstNonEmpty(payload.email, payload.contact_email, payload.replyTo);
    const telefone = pickFirstNonEmpty(payload.telefone, payload.phone, payload.telemovel, payload.telemóvel);
    const assunto = pickFirstNonEmpty(payload.assunto, payload.subject, payload.produto, payload.product, payload.tema);
    const mensagem = normalizeMessage(payload.mensagem || payload.message || payload.descricao || payload.texto);
    const source = normalizeText(payload.source || payload.origem || payload.pagePath || 'contact-form');
    const pageUrl = normalizeText(payload.pageUrl || payload.page || '');

    const missingFields = [];
    if (nome.length < 2) missingFields.push('nome');
    if (email.length < 5 || !isValidEmail(email)) missingFields.push('email');
    if (assunto.length < 2) missingFields.push('assunto');
    if (mensagem.length < 1) missingFields.push('mensagem');

    if (missingFields.length > 0) {
        sendJson(res, 400, {
            error: 'INVALID_CONTACT_PAYLOAD',
            message: missingFields.length === 1
                ? `Preencha o campo ${missingFields[0]} antes de enviar.`
                : `Preencha os campos ${missingFields.join(', ')} antes de enviar.`,
            missingFields
        });
        return;
    }

    const recipients = buildRecipientList();
    const recipient = recipients[0] || buildRecipient();
    const subject = buildSubject(assunto);
    const html = buildHtmlBody({ nome, email, telefone, assunto, mensagem, source, pageUrl });
    const text = buildTextBody({ nome, email, telefone, assunto, mensagem, source, pageUrl });

    const warnings = [];
    let savedToDatabase = false;
    let emailed = false;

    try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('contactos')
            .insert([{
                nome,
                email,
                telefone: telefone || null,
                assunto,
                mensagem
            }]);

        if (error) {
            throw error;
        }

        savedToDatabase = true;
    } catch (error) {
        warnings.push({
            channel: 'database',
            message: error?.message || 'Nao foi possivel guardar a mensagem na base de dados.'
        });
    }

    try {
        await sendTemplateEmail({
            to: recipients.length > 0 ? recipients : recipient,
            subject,
            html,
            text,
            preheader: `Novo contacto de ${nome}`,
            replyTo: email
        });
        emailed = true;
    } catch (error) {
        warnings.push({
            channel: 'email',
            message: error?.message || 'Nao foi possivel enviar o email de notificacao.'
        });
    }

    if (!savedToDatabase && !emailed) {
        sendJson(res, 500, {
            error: 'CONTACT_SUBMISSION_FAILED',
            message: 'Nao foi possivel enviar a mensagem. Tente novamente mais tarde.',
            warnings
        });
        return;
    }

    sendJson(res, 200, {
        ok: true,
        message: 'Mensagem enviada com sucesso. Entraremos em contacto brevemente.',
        savedToDatabase,
        emailed,
        warnings
    });
};
