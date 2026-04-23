(function (global) {
    const META_MARKER = '[IBERFLAG_META]';
    const i18nText = (value) => global.IberFlagI18n?.translateText
        ? global.IberFlagI18n.translateText(value)
        : value;

    const ORDER_WORKFLOW_STEPS = [
        {
            value: 'em_preparacao',
            label: i18nText('Em Preparação'),
            description: i18nText('Encomenda recebida e em preparação inicial.')
        },
        {
            value: 'em_producao',
            label: i18nText('Em Produção'),
            description: i18nText('Material em produção e acabamento.')
        },
        {
            value: 'expedido',
            label: i18nText('Expedido'),
            description: i18nText('Encomenda entregue ao transportador.')
        },
        {
            value: 'entregue',
            label: i18nText('Entregue'),
            description: i18nText('Encomenda concluída com sucesso.')
        }
    ];

    const WORKFLOW_BADGE_COLORS = {
        em_preparacao: 'warning',
        em_producao: 'info',
        expedido: 'warning',
        entregue: 'success'
    };

    const WORKFLOW_TO_LEGACY_STATUS = {
        em_preparacao: 'pendente',
        em_producao: 'processando',
        expedido: 'processando',
        entregue: 'concluido'
    };

    const LEGACY_TO_WORKFLOW_STATUS = {
        pendente: 'em_preparacao',
        processando: 'em_producao',
        concluido: 'entregue',
        cancelado: 'em_preparacao'
    };

    const WORKFLOW_STATUS_ALIASES = {
        pendente_confirmacao: 'em_preparacao',
        aguarda_pagamento: 'em_preparacao',
        arte_em_validacao: 'em_preparacao',
        producao: 'em_producao',
        acabamento: 'em_producao',
        embalagem: 'em_producao',
        expedida: 'expedido',
        cancelada: 'em_preparacao'
    };

    function safeParseJson(input) {
        if (typeof input !== 'string' || !input.trim()) {
            return null;
        }

        try {
            return JSON.parse(input);
        } catch (error) {
            return null;
        }
    }

    function normalizeWorkflowStatusValue(statusValue) {
        const normalized = String(statusValue || '').trim();
        if (!normalized) {
            return 'em_preparacao';
        }

        return WORKFLOW_STATUS_ALIASES[normalized] || normalized;
    }

    function normalizeOrderMeta(meta) {
        const source = (meta && typeof meta === 'object') ? meta : {};
        const workflowStatus = typeof source.workflowStatus === 'string' && source.workflowStatus.trim()
            ? normalizeWorkflowStatusValue(source.workflowStatus)
            : 'em_preparacao';

        const trackingCode = typeof source.trackingCode === 'string' ? source.trackingCode.trim() : '';
        const trackingUrl = typeof source.trackingUrl === 'string' ? source.trackingUrl.trim() : '';
        const paymentStatus = typeof source.paymentStatus === 'string' ? source.paymentStatus.trim() : '';
        const paymentProvider = typeof source.paymentProvider === 'string' ? source.paymentProvider.trim() : '';
        const paymentMethod = typeof source.paymentMethod === 'string' ? source.paymentMethod.trim() : '';
        const stripeSessionId = typeof source.stripeSessionId === 'string' ? source.stripeSessionId.trim() : '';
        const stripePaymentIntent = typeof source.stripePaymentIntent === 'string' ? source.stripePaymentIntent.trim() : '';
        const facturalusaCustomerCode = typeof source.facturalusaCustomerCode === 'string' ? source.facturalusaCustomerCode.trim() : '';
        const facturalusaDocumentNumber = typeof source.facturalusaDocumentNumber === 'string' ? source.facturalusaDocumentNumber.trim() : '';
        const facturalusaDocumentUrl = typeof source.facturalusaDocumentUrl === 'string' ? source.facturalusaDocumentUrl.trim() : '';
        const facturalusaLastError = typeof source.facturalusaLastError === 'string' ? source.facturalusaLastError.trim() : '';
        const facturalusaStatus = typeof source.facturalusaStatus === 'string' && source.facturalusaStatus.trim()
            ? source.facturalusaStatus.trim()
            : (facturalusaDocumentNumber ? 'emitted' : facturalusaLastError ? 'blocked' : '');
        const facturalusaLastAttemptAt = typeof source.facturalusaLastAttemptAt === 'string' ? source.facturalusaLastAttemptAt.trim() : '';
        const fiscalSnapshot = source.fiscalSnapshot && typeof source.fiscalSnapshot === 'object'
            ? source.fiscalSnapshot
            : {};
        const vatValidation = source.vatValidation && typeof source.vatValidation === 'object'
            ? source.vatValidation
            : {};
        const fiscalDivergence = source.fiscalDivergence && typeof source.fiscalDivergence === 'object'
            ? source.fiscalDivergence
            : { diverged: false, fields: [], reason: '' };

        const statusHistory = Array.isArray(source.statusHistory)
            ? source.statusHistory
                .filter((entry) => entry && typeof entry === 'object' && entry.status)
                .map((entry) => ({
                    status: normalizeWorkflowStatusValue(entry.status),
                    at: entry.at ? String(entry.at) : new Date().toISOString(),
                    note: entry.note ? String(entry.note) : ''
                }))
            : [];

        const itemSnapshots = Array.isArray(source.itemSnapshots)
            ? source.itemSnapshots
                .filter((entry) => entry && typeof entry === 'object')
                .map((entry) => ({
                    designId: entry.designId ? String(entry.designId) : '',
                    produtoId: Number(entry.produtoId) || null,
                    nome: entry.nome ? String(entry.nome) : 'Produto',
                    quantidade: Math.max(1, Number.parseInt(entry.quantidade || 1, 10) || 1),
                    precoUnitario: Number(entry.precoUnitario || 0),
                    imagem: entry.imagem ? String(entry.imagem) : '',
                    designPreview: entry.designPreview ? String(entry.designPreview) : '',
                    design: entry.design ? String(entry.design) : ''
                }))
            : [];

        return {
            workflowStatus,
            trackingCode,
            trackingUrl,
            paymentStatus,
            paymentProvider,
            paymentMethod,
            stripeSessionId,
            stripePaymentIntent,
            facturalusaCustomerCode,
            facturalusaDocumentNumber,
            facturalusaDocumentUrl,
            facturalusaLastError,
            facturalusaStatus,
            facturalusaLastAttemptAt,
            fiscalSnapshot,
            vatValidation,
            fiscalDivergence,
            statusHistory,
            itemSnapshots
        };
    }

    function splitOrderNotesAndMeta(rawNotes) {
        const notesText = typeof rawNotes === 'string' ? rawNotes : '';
        const markerIndex = notesText.lastIndexOf(META_MARKER);

        if (markerIndex === -1) {
            return {
                publicNotes: notesText.trim(),
                meta: normalizeOrderMeta(null)
            };
        }

        const publicNotes = notesText.slice(0, markerIndex).trim();
        const jsonText = notesText.slice(markerIndex + META_MARKER.length).trim();
        const parsedMeta = safeParseJson(jsonText);

        return {
            publicNotes,
            meta: normalizeOrderMeta(parsedMeta)
        };
    }

    function buildOrderNotesWithMeta(publicNotes, meta) {
        const cleanNotes = typeof publicNotes === 'string' ? publicNotes.trim() : '';
        const normalizedMeta = normalizeOrderMeta(meta);
        const serializedMeta = `${META_MARKER}${JSON.stringify(normalizedMeta)}`;

        return cleanNotes ? `${cleanNotes}\n\n${serializedMeta}` : serializedMeta;
    }

    function getWorkflowStatusLabel(statusValue) {
        const normalized = normalizeWorkflowStatusValue(statusValue);
        const found = ORDER_WORKFLOW_STEPS.find((step) => step.value === normalized);

        if (found) {
            return found.label;
        }

        if (!normalized) {
            return 'Sem estado';
        }

        return normalized
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function getWorkflowStatusGrade(statusValue) {
        return '';
    }

    function getWorkflowStatusLabelWithGrade(statusValue) {
        return getWorkflowStatusLabel(statusValue);
    }

    function getWorkflowStatusColor(statusValue) {
        return WORKFLOW_BADGE_COLORS[normalizeWorkflowStatusValue(statusValue)] || 'info';
    }

    function getLegacyStatusFromWorkflow(workflowStatus) {
        return WORKFLOW_TO_LEGACY_STATUS[normalizeWorkflowStatusValue(workflowStatus)] || 'processando';
    }

    function getWorkflowStatusFromLegacy(legacyStatus) {
        return LEGACY_TO_WORKFLOW_STATUS[String(legacyStatus || '').trim()] || 'em_preparacao';
    }

    function deriveWorkflowStatus(order) {
        const split = splitOrderNotesAndMeta(order?.notas || '');
        const statusFromMeta = split.meta.workflowStatus;

        if (statusFromMeta) {
            return statusFromMeta;
        }

        return getWorkflowStatusFromLegacy(order?.status || 'pendente');
    }

    function appendWorkflowHistory(meta, nextStatus, note) {
        const normalized = normalizeOrderMeta(meta);
        normalized.statusHistory.push({
            status: normalizeWorkflowStatusValue(nextStatus),
            at: new Date().toISOString(),
            note: typeof note === 'string' ? note.trim() : ''
        });

        return normalized;
    }

    function getTrackingDetails(order) {
        const split = splitOrderNotesAndMeta(order?.notas || '');
        const meta = split.meta;

        const trackingCode =
            order?.tracking_codigo ||
            order?.codigo_tracking ||
            order?.tracking_code ||
            order?.tracking ||
            meta.trackingCode ||
            '';

        const trackingUrl =
            order?.tracking_url ||
            order?.url_tracking ||
            order?.tracking_link ||
            meta.trackingUrl ||
            '';

        return {
            trackingCode: String(trackingCode || ''),
            trackingUrl: String(trackingUrl || '')
        };
    }

    function buildSvgDataUrl(svgMarkup) {
        if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) {
            return '';
        }

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
    }

    global.ORDER_WORKFLOW_STEPS = ORDER_WORKFLOW_STEPS;
    global.normalizeOrderMeta = normalizeOrderMeta;
    global.splitOrderNotesAndMeta = splitOrderNotesAndMeta;
    global.buildOrderNotesWithMeta = buildOrderNotesWithMeta;
    global.getWorkflowStatusLabel = getWorkflowStatusLabel;
    global.getWorkflowStatusGrade = getWorkflowStatusGrade;
    global.getWorkflowStatusLabelWithGrade = getWorkflowStatusLabelWithGrade;
    global.getWorkflowStatusColor = getWorkflowStatusColor;
    global.normalizeWorkflowStatusValue = normalizeWorkflowStatusValue;
    global.getLegacyStatusFromWorkflow = getLegacyStatusFromWorkflow;
    global.getWorkflowStatusFromLegacy = getWorkflowStatusFromLegacy;
    global.deriveWorkflowStatus = deriveWorkflowStatus;
    global.appendWorkflowHistory = appendWorkflowHistory;
    global.getTrackingDetails = getTrackingDetails;
    global.getFacturalusaStatus = function getFacturalusaStatus(order) {
        const split = splitOrderNotesAndMeta(order?.notas || '');
        const meta = split.meta || {};
        const status = String(meta.facturalusaStatus || '').trim();
        if (status) return status;
        const rowStatus = String(order?.facturalusa_status || '').trim();
        if (rowStatus) return rowStatus;
        if (meta.facturalusaDocumentNumber) return 'emitted';
        if (order?.facturalusa_document_number) return 'emitted';
        if (meta.facturalusaLastError) return 'blocked';
        const paymentStatus = String(meta.paymentStatus || order?.payment_status || '').trim();
        return paymentStatus === 'paid' ? 'pending' : 'not_required';
    };
    global.getFacturalusaStatusLabel = function getFacturalusaStatusLabel(status) {
        const normalized = String(status || '').trim();
        const labels = {
            emitted: 'Fatura emitida',
            pending: 'Faturação pendente',
            blocked: 'Requer atenção',
            error: 'Erro de faturação',
            not_required: 'Ainda não aplicável',
            pending_manual_review: 'Revisão fiscal'
        };
        return labels[normalized] || (normalized ? normalized.replace(/_/g, ' ') : 'Sem estado');
    };
    global.getFacturalusaStatusColor = function getFacturalusaStatusColor(status) {
        const normalized = String(status || '').trim();
        const colors = {
            emitted: 'success',
            pending: 'warning',
            blocked: 'danger',
            error: 'danger',
            not_required: 'info',
            pending_manual_review: 'warning'
        };
        return colors[normalized] || 'info';
    };
    global.buildSvgDataUrl = buildSvgDataUrl;
})(window);
