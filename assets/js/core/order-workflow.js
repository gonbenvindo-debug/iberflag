(function (global) {
    const META_MARKER = '[IBERFLAG_META]';

    const ORDER_WORKFLOW_STEPS = [
        {
            value: 'pendente_confirmacao',
            label: 'Pendente de Confirmacao',
            grade: '1',
            description: 'Encomenda recebida e a aguardar validacao inicial.'
        },
        {
            value: 'aguarda_pagamento',
            label: 'Aguarda Pagamento',
            grade: '2',
            description: 'A aguardar confirmacao de pagamento para avancar.'
        },
        {
            value: 'arte_em_validacao',
            label: 'Arte em Validacao',
            grade: '3',
            description: 'Ficheiros e artes em revisao pre-producao.'
        },
        {
            value: 'producao',
            label: 'Em Producao',
            grade: '4',
            description: 'Material em impressao e fabricacao.'
        },
        {
            value: 'acabamento',
            label: 'Acabamentos',
            grade: '5',
            description: 'Corte, costura, ilhoses e controlo de qualidade.'
        },
        {
            value: 'embalagem',
            label: 'Embalagem',
            grade: '6',
            description: 'Pedido preparado para expedicao.'
        },
        {
            value: 'expedida',
            label: 'Expedida',
            grade: '7',
            description: 'Encomenda entregue ao transportador.'
        },
        {
            value: 'entregue',
            label: 'Entregue',
            grade: '8',
            description: 'Encomenda concluida com sucesso.'
        },
        {
            value: 'cancelada',
            label: 'Cancelada',
            grade: '9',
            description: 'Encomenda cancelada.'
        }
    ];

    const WORKFLOW_BADGE_COLORS = {
        pendente_confirmacao: 'warning',
        aguarda_pagamento: 'warning',
        arte_em_validacao: 'info',
        producao: 'info',
        acabamento: 'info',
        embalagem: 'info',
        expedida: 'warning',
        entregue: 'success',
        cancelada: 'danger'
    };

    const WORKFLOW_TO_LEGACY_STATUS = {
        pendente_confirmacao: 'pendente',
        aguarda_pagamento: 'pendente',
        arte_em_validacao: 'processando',
        producao: 'processando',
        acabamento: 'processando',
        embalagem: 'processando',
        expedida: 'processando',
        entregue: 'concluido',
        cancelada: 'cancelado'
    };

    const LEGACY_TO_WORKFLOW_STATUS = {
        pendente: 'pendente_confirmacao',
        processando: 'producao',
        concluido: 'entregue',
        cancelado: 'cancelada'
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

    function normalizeOrderMeta(meta) {
        const source = (meta && typeof meta === 'object') ? meta : {};
        const workflowStatus = typeof source.workflowStatus === 'string' && source.workflowStatus.trim()
            ? source.workflowStatus.trim()
            : 'pendente_confirmacao';

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

        const statusHistory = Array.isArray(source.statusHistory)
            ? source.statusHistory
                .filter((entry) => entry && typeof entry === 'object' && entry.status)
                .map((entry) => ({
                    status: String(entry.status),
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
        const normalized = String(statusValue || '').trim();
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
        const normalized = String(statusValue || '').trim();
        const foundIndex = ORDER_WORKFLOW_STEPS.findIndex((step) => step.value === normalized);
        if (foundIndex === -1) {
            return '';
        }

        return String(ORDER_WORKFLOW_STEPS[foundIndex].grade || foundIndex + 1);
    }

    function getWorkflowStatusLabelWithGrade(statusValue) {
        const label = getWorkflowStatusLabel(statusValue);
        const grade = getWorkflowStatusGrade(statusValue);
        return grade ? `${label} - Grau ${grade}` : label;
    }

    function getWorkflowStatusColor(statusValue) {
        return WORKFLOW_BADGE_COLORS[String(statusValue || '').trim()] || 'info';
    }

    function getLegacyStatusFromWorkflow(workflowStatus) {
        return WORKFLOW_TO_LEGACY_STATUS[String(workflowStatus || '').trim()] || 'processando';
    }

    function getWorkflowStatusFromLegacy(legacyStatus) {
        return LEGACY_TO_WORKFLOW_STATUS[String(legacyStatus || '').trim()] || 'pendente_confirmacao';
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
            status: nextStatus,
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
            pending: 'A emitir',
            blocked: 'Bloqueada',
            error: 'Erro de faturação',
            not_required: 'Ainda não aplicável'
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
            not_required: 'info'
        };
        return colors[normalized] || 'info';
    };
    global.buildSvgDataUrl = buildSvgDataUrl;
})(window);
