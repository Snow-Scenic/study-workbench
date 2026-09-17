// bank-select.js — 题库选择界面（启动首屏）与服务器题库加载
'use strict';

function showBankSelectScreen() {
    const bss = document.getElementById('bankSelectScreen');
    if (bss) bss.style.display = 'flex';
    if (typeof hideImportScreen === 'function') {
        hideImportScreen();
    } else {
        const imp = document.getElementById('importScreen');
        if (imp) imp.classList.remove('active');
    }
    loadBankList();
}

function loadBankList() {
    const container = document.getElementById('bankCards');
    const mainBanks = document.getElementById('banksListContainer');
    const loadingHtml = '<p class="muted" style="font-size:0.85rem;padding:12px 4px;">加载中...</p>';
    if (container) container.innerHTML = loadingHtml;
    if (mainBanks) mainBanks.innerHTML = loadingHtml;

    fetch('/scan?_t=' + Date.now()).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }).then(files => {
        if (!Array.isArray(files) || files.length === 0) {
            const emptyHtml =
                '<div style="text-align:center;padding:24px 16px;">' +
                '<p class="muted" style="font-size:0.88rem;margin-bottom:12px;">暂无题库。可立即导入本地 JSON 题库文件。</p>' +
                '<div style="display:flex;flex-direction:column;gap:8px;max-width:260px;margin:0 auto;">' +
                `<button class="btn btn-primary btn-sm" onclick="showImportDialog()">${window.UI ? UI.icon('upload') : ''} 导入题库</button>` +
                `<button class="btn btn-outline btn-sm" onclick="openFormatGuide()">${window.UI ? UI.icon('file-text') : ''} 查看导入格式说明</button>` +
                '</div></div>';
            if (container) container.innerHTML = emptyHtml;
            if (mainBanks) mainBanks.innerHTML = emptyHtml;
            return;
        }
        const listHtml = files.map(f => {
            const kb = Math.max(1, Math.round((f.size || 0) / 1024));
            const iconBook = window.UI ? UI.icon('book') : '';
            const iconArrow = window.UI ? UI.icon('chevron-right') : '→';
            const safeFile = (f.file || '').replace(/'/g, "\\'");
            const safeName = (f.name || f.file || '未命名题库').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const qCount = f.count !== undefined ? f.count : 0;
            return `<div class="bank-item" onclick="selectBank('${safeFile}')">
                <span class="bi-icon">${iconBook}</span>
                <span class="bi-info">
                    <span class="bi-name">${safeName}</span>
                    <span class="bi-desc">自定义题库 · ${kb} KB</span>
                </span>
                <span class="bi-count">${qCount} 题</span>
                <span class="bi-arrow">${iconArrow}</span>
            </div>`;
        }).join('');
        if (container) container.innerHTML = listHtml;
        if (mainBanks) mainBanks.innerHTML = listHtml;
    }).catch(err => {
        const errorHtml = '<p class="muted" style="font-size:0.85rem;color:var(--danger,#d93025);padding:12px 4px;">题库加载失败，请刷新重试 (' + (err && err.message ? err.message : '网络异常') + ')</p>';
        if (container) container.innerHTML = errorHtml;
        if (mainBanks) mainBanks.innerHTML = errorHtml;
    });
}

let _pendingBank = null;

function _safeValidateBank(data) {
    if (window.validateBankData && typeof window.validateBankData === 'function') {
        return window.validateBankData(data);
    }
    if (typeof validateBankData === 'function') {
        return validateBankData(data);
    }
    return { error: '题库校验模块尚未加载，请刷新后重试' };
}

function selectBank(filename) {
    fetch('/banks/' + encodeURIComponent(filename)).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }).then(data => {
        const result = _safeValidateBank(data);
        if (result.error) { alert(result.error); return; }
        const name = (data.meta && data.meta.name) || filename;
        const prog = typeof loadProgressOnly === 'function' ? loadProgressOnly() : null;
        if (prog && prog.name === name && prog.answeredIds && prog.answeredIds.size > 0) {
            _pendingBank = { validated: result.validated, totalQ: result.totalQ, name };
            showProgressDialog(prog);
        } else {
            if (typeof applyValidatedBank === 'function') {
                applyValidatedBank(result.validated, 'replace');
            }
            if (typeof afterBankLoaded === 'function') {
                afterBankLoaded(name, result.totalQ);
            }
            if (typeof startPractice === 'function') startPractice();
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
    const acc = prog.totalStats && prog.totalStats.totalAnswered > 0
        ? Math.round(prog.totalStats.totalCorrect / prog.totalStats.totalAnswered * 100) + '%' : '--';
    const wrongCount = Object.keys(prog.wrongRecords || {}).length;
    document.getElementById('pdBody').innerHTML =
        `<div class="pd-row pd-total"><span>总进度</span><b>${matched}/${_pendingBank.totalQ}</b></div>` +
        `<div class="pd-row"><span>累计正确率</span><b>${acc}</b></div>` +
        `<div class="pd-row"><span>错题本</span><b>${wrongCount} 题</b></div>` +
        rows;
    document.getElementById('progressOverlay').style.display = 'flex';
}

function hideProgressDialog() {
    const po = document.getElementById('progressOverlay');
    if (po) po.style.display = 'none';
}

function continueWithProgress() {
    const p = _pendingBank;
    if (!p) {
        hideProgressDialog();
        return;
    }
    const prog = (typeof loadProgressOnly === 'function' ? loadProgressOnly() : null) || {};
    if (typeof applyValidatedBank === 'function') applyValidatedBank(p.validated, 'replace');
    window.answeredIds = prog.answeredIds || new Set();
    if (typeof answeredIds !== 'undefined') answeredIds = window.answeredIds;
    window.wrongRecords = prog.wrongRecords || {};
    if (typeof wrongRecords !== 'undefined') wrongRecords = window.wrongRecords;
    window.questionStatus = prog.questionStatus || {};
    window.totalStats = prog.totalStats || { totalAnswered: 0, totalCorrect: 0 };
    if (typeof totalStats !== 'undefined') totalStats = window.totalStats;
    window.wrongReviewEnabled = prog.wrongReviewEnabled !== undefined ? prog.wrongReviewEnabled : true;
    if (typeof wrongReviewEnabled !== 'undefined') wrongReviewEnabled = window.wrongReviewEnabled;
    hideProgressDialog();
    if (typeof afterBankLoaded === 'function') afterBankLoaded(p.name, p.totalQ);
    if (typeof startPractice === 'function') startPractice();
}

function startFromScratch() {
    if (!confirm('将清空该题库的已做记录与错题本，且不可恢复。确定？')) return;
    const p = _pendingBank;
    if (!p) {
        hideProgressDialog();
        return;
    }
    // 从头开始必须使用目标题库的新状态，不能带入当前（可能是另一题库）的统计。
    if (typeof applyValidatedBank === 'function') applyValidatedBank(p.validated, 'replace');
    hideProgressDialog();
    if (typeof afterBankLoaded === 'function') afterBankLoaded(p.name, p.totalQ);
    if (typeof startPractice === 'function') startPractice();
}

function shutdownServer() {
    if (confirm('确定要关闭程序吗？')) {
        const isDesktop = document.body.classList.contains('desktop-mode') ||
                          document.documentElement.classList.contains('desktop-mode') ||
                          !!window.pywebview ||
                          typeof window.desktopClose === 'function';

        if (isDesktop && typeof window.desktopClose === 'function') {
            fetch('/shutdown').catch(() => {}).finally(() => {
                window.desktopClose();
            });
            setTimeout(() => {
                if (typeof window.desktopClose === 'function') window.desktopClose();
            }, 150);
            return;
        }

        const closedMsg = '<div class="app-closed">程序已退出，您可以关闭此页面。</div>';
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

// 显式挂载到 window，保证跨模块调用与内联 onclick 绝不丢失
window.showBankSelectScreen = showBankSelectScreen;
window.loadBankList = loadBankList;
window.selectBank = selectBank;
window.showProgressDialog = showProgressDialog;
window.hideProgressDialog = hideProgressDialog;
window.continueWithProgress = continueWithProgress;
window.startFromScratch = startFromScratch;
window.shutdownServer = shutdownServer;
