// bank-select.js — 题库选择界面（启动首屏）与服务器题库加载
'use strict';

function showBankSelectScreen() {
    document.getElementById('bankSelectScreen').style.display = 'flex';
    hideImportScreen();
    loadBankList();
}

function loadBankList() {
    const container = document.getElementById('bankCards');
    container.innerHTML = '<p class="muted" style="font-size:0.85rem;">加载中...</p>';

    fetch('/scan').then(r => r.json()).then(files => {
        if (files.length === 0) {
            container.innerHTML =
                '<p class="muted" style="font-size:0.85rem;">暂无题库。可立即导入本地 JSON 题库文件。</p>' +
                '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">' +
                '<button class="btn btn-primary" onclick="showImportDialog()">📥 导入题库</button>' +
                '<button class="btn btn-outline btn-sm" onclick="openFormatGuide()">📋 查看导入格式说明</button>' +
                '</div>';
            return;
        }
        container.innerHTML = files.map(f => {
            const kb = Math.max(1, Math.round(f.size / 1024));
            return `<div class="bank-item" onclick="selectBank('${f.file}')">
                <span class="bi-icon">📕</span>
                <span class="bi-info">
                    <span class="bi-name">${f.name}</span>
                    <span class="bi-desc">自定义导入题库 · ${kb} KB</span>
                </span>
                <span class="bi-count">${f.count} 题</span>
                <span class="bi-arrow">➜</span>
            </div>`;
        }).join('');
    }).catch(() => {
        container.innerHTML = '<p class="muted" style="font-size:0.85rem;">加载失败，请刷新重试</p>';
    });
}

let _pendingBank = null;

function selectBank(filename) {
    fetch('/banks/' + encodeURIComponent(filename)).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }).then(data => {
        const result = validateBankData(data);
        if (result.error) { alert(result.error); return; }
        const name = (data.meta && data.meta.name) || filename;
        const prog = loadProgressOnly();
        if (prog && prog.name === name && prog.answeredIds.size > 0) {
            _pendingBank = { validated: result.validated, totalQ: result.totalQ, name };
            showProgressDialog(prog);
        } else {
            applyValidatedBank(result.validated, 'replace');
            afterBankLoaded(name, result.totalQ);
        }
    }).catch(err => { alert('加载失败：' + err.message); });
}

function showProgressDialog(prog) {
    let matched = 0;
    let rows = '';
    for (const sec of Object.values(_pendingBank.validated)) {
        const done = sec.questions.filter(q => prog.answeredIds.has(q.id)).length;
        matched += done;
        rows += `<div class="pd-row"><span>${sec.label}</span><b>${done}/${sec.questions.length}</b></div>`;
    }
    const acc = prog.totalStats.totalAnswered > 0
        ? Math.round(prog.totalStats.totalCorrect / prog.totalStats.totalAnswered * 100) + '%' : '--';
    const wrongCount = Object.keys(prog.wrongRecords).length;
    document.getElementById('pdBody').innerHTML =
        `<div class="pd-row pd-total"><span>📊 总进度</span><b>${matched}/${_pendingBank.totalQ}</b></div>` +
        `<div class="pd-row"><span>✅ 累计正确率</span><b>${acc}</b></div>` +
        `<div class="pd-row"><span>❌ 错题本</span><b>${wrongCount} 题</b></div>` +
        rows;
    document.getElementById('progressOverlay').style.display = 'flex';
}

function hideProgressDialog() {
    document.getElementById('progressOverlay').style.display = 'none';
}

function continueWithProgress() {
    const p = _pendingBank;
    const prog = loadProgressOnly();
    applyValidatedBank(p.validated, 'replace');          // 内部 resetAnswerState 后装新库
    answeredIds = prog.answeredIds;                       // 映射存档状态（D5：服务器题为结构源，
    wrongRecords = prog.wrongRecords;                     //   存档中不属于本题库的 id 在统计时自然失配忽略）
    totalStats = prog.totalStats;
    wrongReviewEnabled = prog.wrongReviewEnabled;
    hideProgressDialog();
    afterBankLoaded(p.name, p.totalQ);
}

function startFromScratch() {
    if (!confirm('将清空该题库的已做记录与错题本，且不可恢复。确定？')) return;
    const p = _pendingBank;
    const keepStats = totalStats;
    applyValidatedBank(p.validated, 'replace');           // resetAnswerState 即彻底重置（D6）
    totalStats = keepStats;
    hideProgressDialog();
    afterBankLoaded(p.name, p.totalQ);
}

function shutdownServer() {
    if (confirm('确定要关闭程序吗？')) {
        const closedMsg = '<div class="app-closed">👋 程序已关闭，可以关闭此页面。</div>';
        fetch('/shutdown').then(() => {
            document.body.innerHTML = closedMsg;
        }).catch(() => {
            document.body.innerHTML = closedMsg;
        });
    }
}

if (document.getElementById('pdContinueBtn')) {
    document.getElementById('pdContinueBtn').onclick = continueWithProgress;
    document.getElementById('pdRestartBtn').onclick = startFromScratch;
    document.getElementById('pdCancelBtn').onclick = hideProgressDialog;
}
