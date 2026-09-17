// stats.js — 统计面板、错题本记账与维护、阈值设置
'use strict';

/**
 * 记录一次作答结果（三种题型的公共收尾）：
 * 更新总统计、错题本连对计数，并持久化。
 */
function finishAnswer(qId, correct) {
    const am = window.answeredMap || (typeof answeredMap !== 'undefined' ? answeredMap : {});
    am[qId] = correct ? 'correct' : 'wrong';
    window.answeredMap = am;
    if (typeof answeredMap !== 'undefined') answeredMap = am;

    const qs = window.questionStatus || (typeof questionStatus !== 'undefined' ? questionStatus : {});
    // M5：先取历史状态再覆盖，否则本行结果会污染幂等判定（原 :32 恒 false 死分支）
    const previousStatus = qs[qId];
    qs[qId] = correct ? 'correct' : 'wrong';
    window.questionStatus = qs;
    if (typeof questionStatus !== 'undefined') questionStatus = qs;

    const answeredIdsSet = window.answeredIds || (typeof answeredIds !== 'undefined' ? answeredIds : new Set());
    const stats = window.totalStats || (typeof totalStats !== 'undefined' ? totalStats : { totalAnswered: 0, totalCorrect: 0 });

    // totalAnswered：每个题目只计一次（跨会话按 answeredIds 去重）
    if (!answeredIdsSet.has(qId)) {
        answeredIdsSet.add(qId);
        window.answeredIds = answeredIdsSet;
        if (typeof answeredIds !== 'undefined') answeredIds = answeredIdsSet;
        stats.totalAnswered++;
    }
    // 幂等转换：totalCorrect 始终等于“最新结果为 correct”的题目数。
    // 反复答对不重复增计；答对后答错回退 1，保持正确率与当前掌握一致。
    if (correct && previousStatus !== 'correct') {
        stats.totalCorrect++;
    } else if (!correct && previousStatus === 'correct') {
        stats.totalCorrect = Math.max(0, stats.totalCorrect - 1);
    }
    window.totalStats = stats;
    if (typeof totalStats !== 'undefined') totalStats = stats;
    saveToLocalStorage();

    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    if (!correct) {
        if (!wr[qId]) {
            wr[qId] = { wrongCount: 1, consecutiveCorrect: 0 };
        } else {
            wr[qId].wrongCount++;
            wr[qId].consecutiveCorrect = 0; // 答错重置连续正确
        }
    } else {
        if (wr[qId]) wr[qId].consecutiveCorrect++;
    }
    window.wrongRecords = wr;
    if (typeof wrongRecords !== 'undefined') wrongRecords = wr;

    saveToLocalStorage();
    updateWrongCount();
    updateStats();
}

function updateWrongCount() {
    const recs = (typeof wrongRecords !== 'undefined' && wrongRecords) || window.wrongRecords || {};
    const count = Object.keys(recs).length;
    const countEl = document.getElementById('totalWrongCount');
    if (countEl) countEl.textContent = count;
    const canReview = count > 0 && ((typeof wrongReviewEnabled !== 'undefined' ? wrongReviewEnabled : window.wrongReviewEnabled) !== false);
    const isWrongTab = (typeof currentSection !== 'undefined' && currentSection === '__wrong__');
    const btnReview = document.getElementById('btnReview');
    if (btnReview) btnReview.style.display = (canReview && !isWrongTab) ? 'inline-flex' : 'none';
    const btnReset = document.getElementById('btnResetWrong');
    if (btnReset) btnReset.style.display = canReview ? 'inline-flex' : 'none';
}

function updateStats() {
    const map = (typeof answeredMap !== 'undefined' && answeredMap) || window.answeredMap || {};
    // L1：按结果值统计，而非用 ID 是否含下划线猜测（真实 ID 可能含下划线）。
    const RESULT_VALUES = new Set(['correct', 'wrong']);
    let totalAnswered = 0, correctCount = 0, wrongThisSession = 0;
    for (const [key, val] of Object.entries(map)) {
        if (!RESULT_VALUES.has(val)) continue; // 跳过 id_selected / id_chosen 等非结果缓存
        totalAnswered++;
        if (val === 'correct') correctCount++;
        else wrongThisSession++;
    }
    sessionAnswered = totalAnswered;
    sessionWrong = wrongThisSession;
    window.sessionAnswered = sessionAnswered;
    window.sessionWrong = sessionWrong;

    const elSessionDone = document.getElementById('sessionDoneCount');
    if (elSessionDone) elSessionDone.textContent = sessionAnswered;
    const elSessionWrong = document.getElementById('sessionWrongCount');
    if (elSessionWrong) elSessionWrong.textContent = sessionWrong;
    const elTotalDone = document.getElementById('totalDoneCount');
    if (elTotalDone) elTotalDone.textContent = (window.totalStats && window.totalStats.totalAnswered) || 0;
    const elTotalWrong = document.getElementById('totalWrongCount');
    const recs = (typeof wrongRecords !== 'undefined' && wrongRecords) || window.wrongRecords || {};
    if (elTotalWrong) elTotalWrong.textContent = Object.keys(recs).length;
    const elAccuracy = document.getElementById('accuracy');
    if (elAccuracy) elAccuracy.textContent = totalAnswered > 0
        ? Math.round((correctCount / totalAnswered) * 100) + '%' : '--';

    // 联动更新首页继续学习卡片
    const allQs = (typeof allQuestions !== 'undefined' && allQuestions) || window.allQuestions || [];
    const ansIds = (typeof answeredIds !== 'undefined' && answeredIds) || window.answeredIds || new Set();
    if (document.getElementById('homeProgressFill') && allQs.length > 0) {
        const pct = Math.round((ansIds.size / allQs.length) * 100);
        document.getElementById('homeProgressFill').style.width = pct + '%';
        if (document.getElementById('homeProgressText')) {
            document.getElementById('homeProgressText').textContent = `已完成 ${ansIds.size} / ${allQs.length} 题 (${pct}%)`;
        }
        if (document.getElementById('homeBankCount')) {
            document.getElementById('homeBankCount').textContent = allQs.length + ' 题';
        }
    }
    renderStatsTable();
    updateWrongCount();
}

function getRemovalThreshold() {
    const value = parseInt(window.removalThreshold, 10);
    return Number.isNaN(value) ? 3 : Math.min(10, Math.max(1, value));
}

function getStatsDashboardHTML(isModal) {
    const am = window.answeredMap || (typeof answeredMap !== 'undefined' ? answeredMap : {});
    const ai = window.answeredIds || (typeof answeredIds !== 'undefined' ? answeredIds : new Set());
    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    const qs = window.questionStatus || (typeof questionStatus !== 'undefined' ? questionStatus : {});
    const aq = window.allQuestions || (typeof allQuestions !== 'undefined' ? allQuestions : []);
    const ts = window.totalStats || (typeof totalStats !== 'undefined' ? totalStats : { totalAnswered: 0, totalCorrect: 0 });
    const totalQuestions = aq.length;

    // 综合当前活跃会话与持久化历史，判定题库中每道题的状态
    let bankAnswered = 0;
    let bankCorrect = 0;
    let bankWrong = 0;
    const typeMap = {};

    aq.forEach(q => {
        const t = q.type || '其他题型';
        if (!typeMap[t]) typeMap[t] = { total: 0, answered: 0, correct: 0 };
        typeMap[t].total++;

        let isDone = false;
        let isCorrect = false;

        if (am[q.id]) {
            isDone = true;
            isCorrect = (am[q.id] === 'correct');
        } else if (qs[q.id]) {
            isDone = true;
            isCorrect = (qs[q.id] === 'correct');
        } else if (ai.has(q.id)) {
            isDone = true;
            if (wr[q.id] && wr[q.id].consecutiveCorrect === 0) {
                isCorrect = false;
            } else {
                isCorrect = true;
            }
        }

        if (isDone) {
            bankAnswered++;
            if (isCorrect) bankCorrect++;
            else bankWrong++;

            typeMap[t].answered++;
            if (isCorrect) typeMap[t].correct++;
        }
    });

    const unattempted = Math.max(0, totalQuestions - bankAnswered);
    const pct = bankAnswered ? Math.round((bankCorrect / bankAnswered) * 100) : 0;
    const coverage = totalQuestions ? Math.round((bankAnswered / totalQuestions) * 100) : 0;
    const wrongCount = Object.keys(wr).length;

    // SVG 环形进度偏移计算 (周长 251.33)
    const strokeDash = 251.33;
    const strokeOffset = bankAnswered > 0 ? (strokeDash * (1 - pct / 100)) : strokeDash;
    const pctColor = pct >= 80 ? 'var(--success)' : (pct >= 60 ? 'var(--accent)' : 'var(--danger)');

    // 比例条各段宽度
    const correctW = totalQuestions > 0 ? Math.round((bankCorrect / totalQuestions) * 100) : 0;
    const wrongW = totalQuestions > 0 ? Math.round((bankWrong / totalQuestions) * 100) : 0;
    const unattemptedW = Math.max(0, 100 - correctW - wrongW);

    // 统计各题型的作答情况
    let typeStatsHTML = '';
    if (!isModal && aq.length > 0) {
        const typeKeys = Object.keys(typeMap);
        if (typeKeys.length > 0) {
            typeStatsHTML = `<div class="stats-breakdown-card">
                <div class="stats-breakdown-title">各题型掌握度分析</div>`;
            typeKeys.forEach(tName => {
                const item = typeMap[tName];
                const tPct = item.total > 0 ? Math.round((item.answered / item.total) * 100) : 0;
                typeStatsHTML += `
                    <div class="type-breakdown-row">
                        <span class="type-name" title="${tName}">${tName}</span>
                        <div class="type-bar-track">
                            <div class="type-bar-fill" style="width: ${tPct}%"></div>
                        </div>
                        <span class="type-stats-num mono">${item.answered}/${item.total}</span>
                    </div>`;
            });
            typeStatsHTML += `</div>`;
        }
    }

    const displayedCumulative = Math.max(ts.totalAnswered || 0, bankAnswered);
    const displayedCorrect = Math.max(ts.totalCorrect || 0, bankCorrect);

    return `
    <div class="stats-dashboard">
        <div class="stats-hero">
            <div class="stats-donut-box">
                <svg viewBox="0 0 100 100" class="stats-donut-svg">
                    <circle cx="50" cy="50" r="40" class="donut-bg"></circle>
                    <circle cx="50" cy="50" r="40" class="donut-fg" style="stroke-dashoffset: ${strokeOffset}; stroke: ${pctColor};"></circle>
                </svg>
                <div class="donut-center-text">
                    <span class="donut-pct mono">${bankAnswered > 0 ? pct + '%' : '--'}</span>
                    <span class="donut-lbl">正确率</span>
                </div>
            </div>
            <div class="stats-hero-info">
                <div class="stats-bank-title">${currentBankName || '未加载题库'}</div>
                <div class="stats-progress-label">已作答 ${bankAnswered} / ${totalQuestions} 题 · 题库覆盖率 ${coverage}%</div>
                <div class="stats-ratio-bar">
                    <div class="ratio-seg correct" style="width: ${correctW}%" title="正确 ${bankCorrect} 题"></div>
                    <div class="ratio-seg wrong" style="width: ${wrongW}%" title="错误 ${bankWrong} 题"></div>
                    <div class="ratio-seg unattempted" style="width: ${unattemptedW}%" title="未做 ${unattempted} 题"></div>
                </div>
                <div class="stats-legend">
                    <span class="legend-item"><i class="dot dot-green"></i> 正确 <b>${bankCorrect}</b></span>
                    <span class="legend-item"><i class="dot dot-red"></i> 错误 <b>${bankWrong}</b></span>
                    <span class="legend-item"><i class="dot dot-gray"></i> 未做 <b>${unattempted}</b></span>
                </div>
            </div>
        </div>

        <div class="stats-kpi-grid">
            <div class="stats-kpi-card">
                <span class="kpi-label">累计作答</span>
                <span class="kpi-value mono">${displayedCumulative}</span>
                <span class="kpi-sub">历史总作答</span>
            </div>
            <div class="stats-kpi-card kpi-success">
                <span class="kpi-label">答对题数</span>
                <span class="kpi-value mono">${displayedCorrect}</span>
                <span class="kpi-sub">已扎实掌握</span>
            </div>
            <div class="stats-kpi-card kpi-danger">
                <span class="kpi-label">错题收录</span>
                <span class="kpi-value mono">${wrongCount}</span>
                <span class="kpi-sub">待重点巩固</span>
            </div>
            <div class="stats-kpi-card kpi-accent">
                <span class="kpi-label">移出阈值</span>
                <span class="kpi-value mono">${getRemovalThreshold()} 次</span>
                <span class="kpi-sub">连对自动移出</span>
            </div>
        </div>

        ${typeStatsHTML}
    </div>`;
}

function renderStatsTable() {
    const slot = document.getElementById('statsTableSlot');
    if (!slot) return;
    slot.innerHTML = getStatsDashboardHTML(false);
}

function resetWrong() {
    wrongRecords = {};
    window.wrongRecords = wrongRecords;
    updateWrongCount();
    if (typeof renderSectionTabs === 'function') renderSectionTabs();
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    if (typeof currentSection !== 'undefined' && currentSection === '__wrong__' && typeof switchSection === 'function') {
        switchSection('all');
    }
}

/** 移除达到"连续答对阈值"的错题记录 */
function cleanupWrongRecords() {
    const recs = (typeof wrongRecords !== 'undefined' && wrongRecords) || window.wrongRecords || {};
    const thresh = getRemovalThreshold();
    for (const id in recs) {
        if (recs[id] && recs[id].consecutiveCorrect >= thresh) {
            delete recs[id];
        }
    }
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    updateWrongCount();
}

/** M6：错题移除阈值唯一写入口——校验 1-10、更新状态、同步底栏与弹窗控件后持久化。 */
function setThresholdValue(value) {
    let val = parseInt(value, 10);
    if (Number.isNaN(val)) val = 3;              // 非数字回退默认值
    val = Math.min(10, Math.max(1, val));
    window.removalThreshold = val;
    if (typeof removalThreshold !== 'undefined') removalThreshold = val;
    const bar = document.getElementById('removeThreshold');
    if (bar && bar.value !== String(val)) bar.value = val;
    const modalInput = document.getElementById('thresholdInput');
    if (modalInput && modalInput.value !== String(val)) modalInput.value = val;
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    return val;
}

function setThreshold() {
    showModal('阈值设置',
        `<p style="margin-bottom:12px;">连续答对多少次后自动从错题集中移除？</p>
         <input type="number" id="thresholdInput" value="${getRemovalThreshold()}" min="1" max="10" class="input-num">`,
        () => {
            setThresholdValue(document.getElementById('thresholdInput').value);
        }
    );
}

function showStats() {
    showModal('学习数据分析 · 详细统计', getStatsDashboardHTML(true));
}

// ===== 错题复习范围选择弹窗 =====

function reviewWrong() {
    // 只清理动态弹窗；常驻的 #progressOverlay 已用专属 class，不会命中
    const existing = document.querySelector('.modal-overlay:not(.progress-dialog-overlay)');
    if (existing) existing.remove();

    let originX = '50%', originY = '50%';
    const src = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    if (src && typeof src.getBoundingClientRect === 'function') {
        const r = src.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
            originX = Math.round(r.left + r.width / 2) + 'px';
            originY = Math.round(r.top + r.height / 2) + 'px';
        }
    }

    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    const levelCounts = {};
    for (const rec of Object.values(wr)) {
        const wc = rec.wrongCount;
        levelCounts[wc] = (levelCounts[wc] || 0) + 1;
    }
    const sortedLevels = Object.keys(levelCounts).map(Number).sort((a, b) => a - b);

    let checkboxesHTML = '<div class="modal-body" style="max-height:50vh;overflow-y:auto;">';
    let i = 0;
    sortedLevels.forEach(lv => {
        i++;
        checkboxesHTML += `
            <label class="checkbox-card checked" style="animation:slideIn 0.3s ease;animation-delay:${i * 0.05}s">
                <input type="checkbox" class="level-cb" value="${lv}" checked
                    onchange="this.closest('.checkbox-card').classList.toggle('checked', this.checked)">
                <span>错误 <strong>${lv}</strong> 次</span>
                <span class="cb-count">${levelCounts[lv]} 题</span>
            </label>`;
    });

    checkboxesHTML += `
        <label class="checkbox-card all-wrong" style="animation:slideIn 0.3s ease;animation-delay:${i * 0.05}s">
            <input type="checkbox" id="cb-all-wrong"
                onchange="toggleAllWrong(this); this.closest('.checkbox-card').classList.toggle('checked', this.checked)">
            <span>全部错题（不限次数）</span>
            <span class="cb-count">${Object.keys(wr).length} 题</span>
        </label>
    </div>`;

    const iconPlay = window.UI ? UI.icon('play') : '';
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(this)">
            <div class="modal modal-md" style="--modal-origin: ${originX} ${originY};" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>选择错题复习范围</h3>
                    <button class="modal-close" onclick="closeModal(this)">&times;</button>
                </div>
                ${checkboxesHTML}
                <div class="modal-footer" style="margin-bottom:8px;">
                    <button class="btn btn-outline btn-sm" onclick="selectAllLevels(true)">全选</button>
                    <button class="btn btn-outline btn-sm" onclick="selectAllLevels(false)">全不选</button>
                </div>
                <button class="btn btn-primary" style="width:100%;" onclick="startFilteredReview()">${iconPlay} 开始复习</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function startFilteredReview() {
    const allChecked = document.getElementById('cb-all-wrong').checked;
    const selectedLevels = allChecked ? null :
        Array.from(document.querySelectorAll('.level-cb:checked')).map(cb => parseInt(cb.value));

    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    const filteredIds = [];
    for (const [id, rec] of Object.entries(wr)) {
        if (allChecked || selectedLevels.includes(rec.wrongCount)) {
            filteredIds.push(id);
        }
    }

    if (typeof closeModal === 'function') closeModal();
    else {
        const ov = document.querySelector('.modal-overlay:not(.progress-dialog-overlay)');
        if (ov) ov.remove();
    }

    if (filteredIds.length === 0) {
        showModal('提示', '没有符合条件的错题！');
        return;
    }

    practiceQuestions = allQuestions.filter(q => filteredIds.includes(q.id));
    if (practiceQuestions.length === 0) {
        showModal('提示', '题库中找不到对应题目');
        return;
    }

    currentSection = '__wrong__';
    currentMode = 'review';
    currentQuestionIndex = 0;
    answeredMap = {};
    matchState = {}; // M7：筛选复习同样不沿用旧配对
    qAnimDir = '';
    practiceQuestions = shuffleArray(practiceQuestions);
    const btnStart = document.getElementById('btnStart');
    if (btnStart) btnStart.style.display = 'none';
    renderCurrentQuestion();
    // M8：队列渲染在 view-practice 的容器里，必须切回练习视图，否则停留在复习说明页。
    if (window.AppShell && typeof window.AppShell.navigate === 'function') window.AppShell.navigate('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleAllWrong(cb) {
    document.querySelectorAll('.level-cb').forEach(c => {
        c.checked = false;
        c.closest('.checkbox-card').classList.remove('checked');
    });
    document.getElementById('cb-all-wrong').closest('.checkbox-card').classList.toggle('checked', cb.checked);
}

function selectAllLevels(select) {
    document.querySelectorAll('.level-cb').forEach(cb => {
        cb.checked = select;
        cb.closest('.checkbox-card').classList.toggle('checked', select);
    });
    const allWrongCb = document.getElementById('cb-all-wrong');
    if (allWrongCb) {
        allWrongCb.checked = false;
        const card = allWrongCb.closest('.checkbox-card');
        if (card) card.classList.remove('checked');
    }
}

// 显式挂载到 window
window.finishAnswer = finishAnswer;
window.updateWrongCount = updateWrongCount;
window.updateStats = updateStats;
window.showStats = showStats;
window.setThreshold = setThreshold;
window.setThresholdValue = setThresholdValue;
window.cleanupWrongRecords = cleanupWrongRecords;
window.startFilteredReview = startFilteredReview;
window.toggleAllWrong = toggleAllWrong;
window.selectAllLevels = selectAllLevels;
window.reviewWrong = reviewWrong;
window.resetWrong = resetWrong;
window.renderStatsTable = renderStatsTable;
window.getStatsDashboardHTML = getStatsDashboardHTML;

