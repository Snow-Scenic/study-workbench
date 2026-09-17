// import-ui.js — 手动导入界面（本地 JSON 文件导入、替换/合并）
'use strict';

function showImportScreen() {
    const el = document.getElementById('importScreen');
    if (el) el.classList.add('active');
}

function hideImportScreen() {
    const el = document.getElementById('importScreen');
    if (el) el.classList.remove('active');
}

function onFileSelected(input) {
    const nameEl = document.getElementById('fileName');
    if (nameEl) nameEl.textContent = input.files[0] ? input.files[0].name : '';
    const errEl = document.getElementById('importError');
    if (errEl) errEl.style.display = 'none';
}

function showImportDialog() {
    const qb = window.questionBank || (typeof questionBank !== 'undefined' ? questionBank : {});
    if (Object.keys(qb).length > 0) {
        showModal('导入新题库', '<p>已有题库数据，如何处理？</p>', null, [
            { label: '替换当前题库', cls: 'btn-danger', action: () => { importMode = 'replace'; window.importMode = 'replace'; if (typeof closeModal === 'function') closeModal(); showImportScreen(); } },
            { label: '合并到现有题库', cls: 'btn-success', action: () => { importMode = 'merge'; window.importMode = 'merge'; if (typeof closeModal === 'function') closeModal(); showImportScreen(); } },
        ]);
    } else {
        importMode = 'replace';
        window.importMode = 'replace';
        showImportScreen();
    }
}

function handleImport() {
    const fileInput = document.getElementById('importFile');
    const errEl = document.getElementById('importError');
    if (!fileInput.files[0]) {
        if (errEl) { errEl.textContent = '请先选择文件'; errEl.style.display = 'block'; }
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        let data;
        try {
            data = JSON.parse(e.target.result);
        } catch (err) {
            if (errEl) { errEl.textContent = 'JSON 解析失败：' + err.message; errEl.style.display = 'block'; }
            return;
        }
        const validator = window.validateBankData || (typeof validateBankData === 'function' ? validateBankData : null) || (typeof _safeValidateBank === 'function' ? _safeValidateBank : null);
        const result = validator ? validator(data) : { error: '题库数据校验失败' };
        if (result.error) {
            if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
            return;
        }
        const curMode = window.importMode || (typeof importMode !== 'undefined' ? importMode : 'replace');
        if (typeof applyValidatedBank === 'function') applyValidatedBank(result.validated, curMode);
        const wrongRevCb = document.getElementById('enableWrongReview');
        if (wrongRevCb) {
            window.wrongReviewEnabled = wrongRevCb.checked;
            if (typeof wrongReviewEnabled !== 'undefined') wrongReviewEnabled = wrongRevCb.checked;
        }
        persistImportedBank(data);   // 后台存档到服务器，下次启动免重复导入
        if (typeof afterBankLoaded === 'function') {
            afterBankLoaded(data.meta.name, result.totalQ);
        }
        // 与题库选择页一致：导入完成后直接开始练习，避免题卡被空态覆盖。
        if (typeof startPractice === 'function') startPractice();
    };
    reader.readAsText(fileInput.files[0]);
}

/** 将导入的题库异步保存到服务器 question_banks 目录；失败静默（不影响本次练习） */
function persistImportedBank(data) {
    try {
        fetch('/api/banks/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).catch(() => {});
    } catch (e) { /* 忽略 */ }
}

// 显式挂载到 window，保证跨文件与内联 onclick 调用稳定
window.showImportScreen = showImportScreen;
window.hideImportScreen = hideImportScreen;
window.onFileSelected = onFileSelected;
window.showImportDialog = showImportDialog;
window.handleImport = handleImport;
window.persistImportedBank = persistImportedBank;
