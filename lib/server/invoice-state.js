function normalizeText(value) {
    return String(value ?? '').trim();
}

function resolveFacturalusaDocumentState(order = {}, meta = {}) {
    const documentNumber = normalizeText(order?.facturalusa_document_number) || normalizeText(meta?.facturalusaDocumentNumber);
    const documentUrl = normalizeText(order?.facturalusa_document_url) || normalizeText(meta?.facturalusaDocumentUrl);
    const paymentStatus = normalizeText(order?.payment_status) || normalizeText(meta?.paymentStatus) || 'pending';
    const status = normalizeText(order?.facturalusa_status) || normalizeText(meta?.facturalusaStatus) || (
        documentNumber || documentUrl
            ? 'emitted'
            : paymentStatus === 'paid'
                ? 'pending'
                : 'not_required'
    );

    return {
        emitted: Boolean(documentNumber || documentUrl),
        documentNumber: documentNumber || null,
        documentUrl: documentUrl || null,
        status
    };
}

function attachIssuedDocumentContext(error, issuedDocument = null) {
    const nextError = error instanceof Error ? error : new Error(String(error || 'Issued document reconciliation failed'));
    nextError.facturalusaIssuedDocument = issuedDocument || null;
    return nextError;
}

module.exports = {
    attachIssuedDocumentContext,
    resolveFacturalusaDocumentState
};
