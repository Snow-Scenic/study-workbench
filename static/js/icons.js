/**
 * icons.js — 轻量级 16px 矢量 SVG 图标系统
 * 采用 2026 统一 1.6px 细线描边风格，零外部依赖，全面取代 UI 中的 Emoji。
 */
(function () {
    'use strict';

    const ICONS = {
        'book': '<path d="M2 3h9a2 2 0 0 1 2 2v8a2 2 0 0 0-2-2H2z"/><path d="M14 3h-9a2 2 0 0 0-2 2v8a2 2 0 0 1 2-2h9z"/>',
        'book-open': '<path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H8v11H4.5A2.5 2.5 0 0 0 2 15.5z"/><path d="M14 4.5A2.5 2.5 0 0 0 11.5 2H8v11h3.5A2.5 2.5 0 0 1 14 15.5z"/>',
        'graduation-cap': '<path d="M2 6.5l6-3.5 6 3.5-6 3.5z"/><path d="M4 7.7v4.3c0 1.5 1.8 2.5 4 2.5s4-1 4-2.5V7.7"/><path d="M14 8.5v3"/>',
        'play': '<polygon points="4 3 13 8 4 13 4 3" fill="currentColor" stroke="none"/>',
        'repeat': '<path d="m11 1 3 3-3 3"/><path d="M2 7a4 4 0 0 1 4-4h8"/><path d="m5 15-3-3 3-3"/><path d="M14 9a4 4 0 0 1-4 4H2"/>',
        'bar-chart': '<line x1="12" y1="13" x2="12" y2="7"/><line x1="8" y1="13" x2="8" y2="3"/><line x1="4" y1="13" x2="4" y2="10"/>',
        'sliders': '<line x1="3" y1="5" x2="9" y2="5"/><line x1="13" y1="5" x2="15" y2="5"/><circle cx="11" cy="5" r="2"/><line x1="3" y1="11" x2="5" y2="11"/><line x1="9" y1="11" x2="15" y2="11"/><circle cx="7" cy="11" r="2"/>',
        'file-text': '<path d="M9 2H4a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V6.5L9 2z"/><polyline points="9 2 9 6.5 13.5 6.5"/><line x1="5.5" y1="9" x2="10.5" y2="9"/><line x1="5.5" y1="11.5" x2="9" y2="11.5"/>',
        'upload': '<path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="11 5 8 2 5 5"/><line x1="8" y1="2" x2="8" y2="10"/>',
        'home': '<path d="M2 6.5 8 2l6 4.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/><polyline points="6 14 6 8.5 10 8.5 10 14"/>',
        'power': '<path d="M12.5 4.5a6 6 0 1 1-9 0"/><line x1="8" y1="2" x2="8" y2="8"/>',
        'check': '<polyline points="3 8.5 6.5 12 13 4.5"/>',
        'x': '<line x1="3.5" y1="3.5" x2="12.5" y2="12.5"/><line x1="12.5" y1="3.5" x2="3.5" y2="12.5"/>',
        'chevron-right': '<polyline points="6 3.5 10.5 8 6 12.5"/>',
        'chevron-left': '<polyline points="10 3.5 5.5 8 10 12.5"/>',
        'chevron-down': '<polyline points="3.5 6 8 10.5 12.5 6"/>',
        'chevron-up': '<polyline points="3.5 10 8 5.5 12.5 10"/>',
        'arrow-right': '<line x1="2.5" y1="8" x2="13.5" y2="8"/><polyline points="9.5 4 13.5 8 9.5 12"/>',
        'trash': '<polyline points="2 4 14 4"/><path d="M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4"/><line x1="6.5" y1="7" x2="6.5" y2="11"/><line x1="9.5" y1="7" x2="9.5" y2="11"/><path d="M3.5 4l.8 8.5a1.5 1.5 0 0 0 1.5 1.5h4.4a1.5 1.5 0 0 0 1.5-1.5L12.5 4"/>',
        'sun': '<circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/><line x1="3" y1="3" x2="4.5" y2="4.5"/><line x1="11.5" y1="11.5" x2="13" y2="13"/><line x1="3" y1="13" x2="4.5" y2="11.5"/><line x1="11.5" y1="4.5" x2="13" y2="3"/>',
        'moon': '<path d="M12.5 9.5A5.5 5.5 0 1 1 6.5 3.5 4.5 4.5 0 0 0 12.5 9.5z"/>',
        'alert-circle': '<circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/>',
        'target': '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><line x1="8" y1="2" x2="8" y2="4"/><line x1="8" y1="12" x2="8" y2="14"/><line x1="2" y1="8" x2="4" y2="8"/><line x1="12" y1="8" x2="14" y2="8"/>',
        'globe': '<circle cx="8" cy="8" r="6"/><line x1="2" y1="8" x2="14" y2="8"/><path d="M8 2a9 9 0 0 1 3 6 9 9 0 0 1-3 6 9 9 0 0 1 3-6z"/>',
        'info': '<circle cx="8" cy="8" r="6"/><line x1="8" y1="7.5" x2="8" y2="11.5"/><circle cx="8" cy="5" r="0.5" fill="currentColor"/>',
        'terminal': '<polyline points="3 4 7 8 3 12"/><line x1="9" y1="12" x2="13" y2="12"/>',
        'zap': '<polygon points="9 1 3 9 8 9 7 15 13 7 8 7 9 1" fill="none"/>'
    };

    const UI = window.UI = window.UI || {};

    UI.icon = function (name, extraClass, size) {
        const body = ICONS[name] || ICONS['info'];
        const cls = extraClass ? 'ui-icon ' + extraClass : 'ui-icon';
        const s = size || 16;
        return `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    };

    UI.renderIcons = function (root) {
        const scope = root || document;
        const nodes = scope.querySelectorAll('[data-icon]');
        nodes.forEach(function (node) {
            const name = node.getAttribute('data-icon');
            const cls = node.getAttribute('data-icon-class') || '';
            const size = parseInt(node.getAttribute('data-icon-size') || '16', 10);
            node.innerHTML = UI.icon(name, cls, size);
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { UI.renderIcons(); });
    } else {
        UI.renderIcons();
    }
})();
