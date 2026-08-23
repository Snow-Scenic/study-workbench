// hub.js — 学习工作台交互（公告开关）
'use strict';

(function () {
    const t = localStorage.getItem('quiz_theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
    // ?clean 参数：跳过使用须知（供截图/演示场景）
    if (new URLSearchParams(location.search).has('clean')) {
        const el = document.getElementById('legalOverlay');
        if (el) el.style.display = 'none';
    }
})();

function ackLegal() {
    const el = document.getElementById('legalOverlay');
    if (!el) return;
    el.classList.add('closing');               // 淡出过渡，避免生硬消失
    setTimeout(() => { el.style.display = 'none'; }, 320);
}
