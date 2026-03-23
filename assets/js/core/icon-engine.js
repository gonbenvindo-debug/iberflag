(() => {
    // Provide an immediate safe lucide API so inline calls never throw.
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        return;
    }

    const pendingCalls = [];
    const stub = {
        createIcons(options) {
            pendingCalls.push(options || {});
        }
    };

    window.lucide = stub;

    const scriptId = 'lucide-cdn-script';
    if (document.getElementById(scriptId)) {
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/lucide@latest';
    script.defer = true;

    script.onload = () => {
        const realLucide = window.lucide;
        if (!realLucide || realLucide === stub || typeof realLucide.createIcons !== 'function') {
            return;
        }

        pendingCalls.forEach((options) => {
            try {
                realLucide.createIcons(options);
            } catch (error) {
                console.warn('Falha ao aplicar icones Lucide:', error);
            }
        });
        pendingCalls.length = 0;
    };

    script.onerror = () => {
        console.warn('Nao foi possivel carregar o Lucide via CDN.');
    };

    document.head.appendChild(script);
})();