// ===== CONTACT FORM LOGIC =====

const CONTACT_ENDPOINT = '/api/contact';

function normalizeContactSource(form) {
    return String(
        form?.dataset?.contactSource
        || form?.getAttribute('data-contact-source')
        || form?.id
        || window.location.pathname
        || 'contact-form'
    ).trim();
}

function readFormField(form, ...names) {
    for (const name of names) {
        const safeName = String(name).replace(/"/g, '\\"');
        const element = form?.elements?.namedItem?.(name) || form?.querySelector?.(`[name="${safeName}"]`);
        if (!element) continue;

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
            const value = String(element.value || '').trim();
            if (value) return value;
        }
    }

    return '';
}

function getContactSubmitButton(form) {
    return form?.querySelector('button[type="submit"]');
}

function notifyContact(message, type) {
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }

    window.alert(message);
}

function renderContactLoadingState(button) {
    if (!button) return '';
    const previous = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<div class="spinner mx-auto"></div>';
    return previous;
}

function restoreContactButton(button, previousHtml) {
    if (!button) return;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = previousHtml || button.innerHTML;
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function buildContactPayload(form) {
    const nome = readFormField(form, 'nome', 'nome_completo', 'name');
    const email = readFormField(form, 'email', 'contact_email');
    const telefone = readFormField(form, 'telefone', 'phone', 'telemovel', 'telemóvel');
    const assunto = readFormField(form, 'assunto', 'subject', 'produto', 'product', 'tema');
    const mensagem = readFormField(form, 'mensagem', 'message', 'descricao', 'texto');

    return {
        nome,
        email,
        telefone,
        assunto,
        mensagem,
        subject: assunto,
        message: mensagem,
        source: normalizeContactSource(form),
        pageUrl: window.location.href,
        pagePath: window.location.pathname
    };
}

async function submitContactForm(form) {
    const submitBtn = getContactSubmitButton(form);
    const previousHtml = renderContactLoadingState(submitBtn);

    try {
        const response = await fetch(CONTACT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(buildContactPayload(form))
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (Array.isArray(payload.missingFields) && payload.missingFields.length > 0) {
                throw new Error(`Campos em falta: ${payload.missingFields.join(', ')}.`);
            }
            throw new Error(payload.message || 'Nao foi possivel enviar a mensagem.');
        }

        form.reset();
        notifyContact(
            payload.message || 'Mensagem enviada com sucesso! Entraremos em contacto brevemente.',
            'success'
        );
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        notifyContact(
            error?.message || 'Erro ao enviar mensagem. Por favor, tente novamente.',
            'error'
        );
    } finally {
        restoreContactButton(submitBtn, previousHtml);
    }
}

function wireContactForm(form) {
    if (!(form instanceof HTMLFormElement) || form.dataset.contactBound === '1') {
        return;
    }

    form.dataset.contactBound = '1';
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitContactForm(form);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-contact-form], #contact-form, .homepage-inline-form').forEach(wireContactForm);
});
