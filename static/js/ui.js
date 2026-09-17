// ui.js — 界面基础能力：主题切换、通用弹窗
'use strict';

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    const toggleBtns = document.querySelectorAll('.theme-toggle, .theme-btn');
    toggleBtns.forEach(btn => {
        if (window.UI) {
            btn.innerHTML = UI.icon(theme === 'dark' ? 'sun' : 'moon');
        }
    });
    // 同步到 pywebview 桌面原生标题栏 DWM，确保无黑框
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.set_theme === 'function') {
        window.pywebview.api.set_theme(theme === 'dark');
    }
}

function triggerThemeWave() {
    let wave = document.getElementById('themeCurtainWave');
    if (!wave) {
        wave = document.createElement('div');
        wave.id = 'themeCurtainWave';
        wave.className = 'theme-curtain-wave';
        document.body.appendChild(wave);
    }
    wave.classList.remove('animating');
    void wave.offsetWidth;
    wave.classList.add('animating');
    setTimeout(() => {
        if (wave) wave.classList.remove('animating');
    }, 650);
}

function toggleTheme() {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // 触发屏幕顶部流光扫描波，呈现自上而下的冲刷渐变质感
    triggerThemeWave();

    // 激活全页面与复杂组件（雨课堂、控制台、题库列表、统计图等）的平滑过渡状态
    document.documentElement.classList.add('theme-transitioning');

    const apply = () => {
        setTheme(nextTheme);
        saveToLocalStorage();
    };

    if (typeof document.startViewTransition === 'function') {
        const transition = document.startViewTransition(() => {
            apply();
        });
        transition.finished.finally(() => {
            setTimeout(() => {
                document.documentElement.classList.remove('theme-transitioning');
            }, 80);
        });
    } else {
        apply();
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transitioning');
        }, 550);
    }
}

/**
 * 通用弹窗。
 * @param {string} title 标题
 * @param {string} msg 正文 HTML
 * @param {Function|null} onConfirm 单确认按钮回调（自动关闭弹窗）
 * @param {Array|null} buttons 自定义按钮 [{label, cls, action}]
 */
/**
 * 关闭当前弹窗（带流体收缩与反向背景焦点过渡动画）
 * @param {HTMLElement} [el]
 */
function closeModal(el) {
    // 仅针对动态创建的弹窗；常驻层（如历史进度 progress-dialog-overlay）不在此列
    const overlay = el ? (el.classList && el.classList.contains('modal-overlay') ? el : el.closest('.modal-overlay'))
                       : document.querySelector('.modal-overlay:not(.progress-dialog-overlay)');
    if (!overlay || overlay._closing) return;
    overlay._closing = true;
    overlay.classList.add('closing');
    setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 220);
}

/**
 * 通用弹窗（支持 Origin-Aware 从源按钮生长）。
 * @param {string} title 标题
 * @param {string} msg 正文 HTML
 * @param {Function|null} onConfirm 单确认按钮回调（自动关闭弹窗）
 * @param {Array|null} buttons 自定义按钮 [{label, cls, action}]
 * @param {HTMLElement|null} triggerEl 触发源元素（用于原点计算）
 */
function showModal(title, msg, onConfirm, buttons, triggerEl) {
    // 只清理动态弹窗；常驻的 #progressOverlay 已用专属 class，不会命中
    const existing = document.querySelector('.modal-overlay:not(.progress-dialog-overlay)');
    if (existing) existing.remove();

    // 确定动效原点 (Origin-Aware Expand)
    let originX = '50%';
    let originY = '50%';
    const src = triggerEl || (document.activeElement && document.activeElement !== document.body ? document.activeElement : null);
    if (src && typeof src.getBoundingClientRect === 'function') {
        const r = src.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
            originX = Math.round(r.left + r.width / 2) + 'px';
            originY = Math.round(r.top + r.height / 2) + 'px';
        }
    }

    let footerHTML;
    if (buttons) {
        footerHTML = '<div class="modal-footer">' + buttons.map((b, i) =>
            `<button class="btn ${b.cls || 'btn-outline'} btn-sm" id="modalBtn${i}">${b.label}</button>`
        ).join('') + '</div>';
    } else if (onConfirm) {
        footerHTML = `<div class="modal-footer">
             <button class="btn btn-outline btn-sm" onclick="closeModal(this)">取消</button>
             <button class="btn btn-primary btn-sm" id="modalConfirmBtn">确认</button>
           </div>`;
    } else {
        footerHTML = `<div class="modal-footer">
             <button class="btn btn-primary btn-sm" onclick="closeModal(this)">确定</button>
           </div>`;
    }

    const iconClose = window.UI ? UI.icon('x') : '&times;';
    const modalSizeCls = msg.includes('stats-dashboard') ? 'modal-stats' : 'modal-sm';
    const div = document.createElement('div');
    div.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(this)">
            <div class="modal ${modalSizeCls}" style="--modal-origin: ${originX} ${originY};" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="closeModal(this)">${iconClose}</button>
                </div>
                <div class="modal-body">${msg}</div>
                ${footerHTML}
            </div>
        </div>`;
    const overlayNode = div.firstElementChild;
    document.body.appendChild(overlayNode);

    if (buttons) {
        buttons.forEach((b, i) => {
            document.getElementById('modalBtn' + i).addEventListener('click', () => { b.action(); });
        });
    } else if (onConfirm) {
        document.getElementById('modalConfirmBtn').addEventListener('click', () => {
            onConfirm();
            closeModal(overlayNode);
        });
    }
}

// 显式挂载到 window，保证内联 onclick 与跨模块调用稳定
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.showModal = showModal;
window.closeModal = closeModal;

