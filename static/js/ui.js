// ui.js — 界面基础能力：主题切换、通用弹窗
'use strict';

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

function toggleTheme() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    saveToLocalStorage();
}

/**
 * 通用弹窗。
 * @param {string} title 标题
 * @param {string} msg 正文 HTML
 * @param {Function|null} onConfirm 单确认按钮回调（自动关闭弹窗）
 * @param {Array|null} buttons 自定义按钮 [{label, cls, action}]
 */
function showModal(title, msg, onConfirm, buttons) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    let footerHTML;
    if (buttons) {
        footerHTML = '<div class="modal-footer">' + buttons.map((b, i) =>
            `<button class="btn ${b.cls || 'btn-outline'} btn-sm" id="modalBtn${i}">${b.label}</button>`
        ).join('') + '</div>';
    } else if (onConfirm) {
        footerHTML = `<div class="modal-footer">
             <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
             <button class="btn btn-primary btn-sm" id="modalConfirmBtn">确认</button>
           </div>`;
    } else {
        footerHTML = `<div class="modal-footer">
             <button class="btn btn-primary btn-sm" onclick="this.closest('.modal-overlay').remove()">确定</button>
           </div>`;
    }

    const div = document.createElement('div');
    div.innerHTML = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal modal-sm" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">${msg}</div>
                ${footerHTML}
            </div>
        </div>`;
    document.body.appendChild(div);

    if (buttons) {
        buttons.forEach((b, i) => {
            document.getElementById('modalBtn' + i).addEventListener('click', () => { b.action(); });
        });
    } else if (onConfirm) {
        document.getElementById('modalConfirmBtn').addEventListener('click', () => {
            onConfirm();
            const overlay = document.querySelector('.modal-overlay');
            if (overlay) overlay.remove();
        });
    }
}
