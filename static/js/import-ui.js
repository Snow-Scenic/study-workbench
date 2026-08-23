// import-ui.js — 手动导入界面（本地 JSON 文件导入、替换/合并）
'use strict';

function showImportScreen() {
    document.getElementById('importScreen').classList.add('active');
}

function hideImportScreen() {
    const el = document.getElementById('importScreen');
    if (el) el.classList.remove('active');
}

function onFileSelected(input) {
    document.getElementById('fileName').textContent = input.files[0] ? input.files[0].name : '';
    document.getElementById('importError').style.display = 'none';
}

function showImportDialog() {
    if (Object.keys(questionBank).length > 0) {
        showModal('📥 导入新题库', '<p>已有题库数据，如何处理？</p>', null, [
            { label: '替换当前题库', cls: 'btn-danger', action: () => { importMode = 'replace'; document.querySelector('.modal-overlay').remove(); showImportScreen(); } },
            { label: '合并到现有题库', cls: 'btn-success', action: () => { importMode = 'merge'; document.querySelector('.modal-overlay').remove(); showImportScreen(); } },
        ]);
    } else {
        importMode = 'replace';
        showImportScreen();
    }
}

function handleImport() {
    const fileInput = document.getElementById('importFile');
    const errEl = document.getElementById('importError');
    if (!fileInput.files[0]) { errEl.textContent = '请先选择文件'; errEl.style.display = 'block'; return; }
    const reader = new FileReader();
    reader.onload = function (e) {
        let data;
        try { data = JSON.parse(e.target.result); } catch (err) { errEl.textContent = 'JSON 解析失败：' + err.message; errEl.style.display = 'block'; return; }
        const result = validateBankData(data);
        if (result.error) { errEl.textContent = result.error; errEl.style.display = 'block'; return; }
        applyValidatedBank(result.validated, importMode);
        wrongReviewEnabled = document.getElementById('enableWrongReview').checked;
        persistImportedBank(data);   // 后台存档到服务器，下次启动免重复导入
        afterBankLoaded(data.meta.name, result.totalQ);
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
