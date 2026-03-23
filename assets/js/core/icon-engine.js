(function () {
    const SOCIAL_ICON_MAP = {
        facebook: 'mdi:facebook',
        instagram: 'mdi:instagram',
        linkedin: 'mdi:linkedin'
    };

    function resolveIconName(name) {
        if (!name) return 'lucide:circle-help';
        const normalized = String(name).trim().toLowerCase();
        if (SOCIAL_ICON_MAP[normalized]) {
            return SOCIAL_ICON_MAP[normalized];
        }
        return `lucide:${normalized}`;
    }

    function replaceOneIcon(node) {
        if (!node || node.tagName !== 'I') {
            return;
        }

        const iconName = node.getAttribute('data-lucide');
        if (!iconName) {
            return;
        }

        const iconify = document.createElement('iconify-icon');
        iconify.setAttribute('icon', resolveIconName(iconName));

        const className = node.getAttribute('class');
        if (className) {
            iconify.setAttribute('class', className);
        }

        const style = node.getAttribute('style');
        if (style) {
            iconify.setAttribute('style', style);
        }

        const ariaLabel = node.getAttribute('aria-label');
        if (ariaLabel) {
            iconify.setAttribute('aria-label', ariaLabel);
        }

        if (node.getAttribute('aria-hidden') === 'true') {
            iconify.setAttribute('aria-hidden', 'true');
        } else {
            iconify.setAttribute('aria-hidden', 'true');
            iconify.setAttribute('focusable', 'false');
        }

        node.replaceWith(iconify);
    }

    function createIcons(options) {
        const root = options && options.root ? options.root : document;
        const icons = root.querySelectorAll('i[data-lucide]');
        icons.forEach(replaceOneIcon);
    }

    window.lucide = {
        createIcons
    };
})();
