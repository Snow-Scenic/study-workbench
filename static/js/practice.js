// practice.js — 练习流程：开始练习、洗牌、完成页、全部做完弹窗、新一轮
'use strict';

function startPractice() {
    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    const aq = window.allQuestions || (typeof allQuestions !== 'undefined' ? allQuestions : []);
    const qb = window.questionBank || (typeof questionBank !== 'undefined' ? questionBank : {});
    const ai = window.answeredIds || (typeof answeredIds !== 'undefined' ? answeredIds : new Set());
    const secKey = window.currentSection || (typeof currentSection !== 'undefined' ? currentSection : 'all');

    let source = [];
    if (secKey === '__wrong__') {
        const filterElem = document.getElementById('wrongFilter');
        const selectedOptions = filterElem ? Array.from(filterElem.selectedOptions).map(o => o.value) : ['all'];
        let filtered = aq.filter(q => wr.hasOwnProperty(q.id));
        if (!selectedOptions.includes('all')) {
            filtered = filtered.filter(q => {
                const rec = wr[q.id];
                return rec && selectedOptions.includes(String(rec.wrongCount));
            });
        }
        source = filtered;
        window.currentMode = 'review';
        if (typeof currentMode !== 'undefined') currentMode = 'review';
    } else if (secKey === 'all') {
        source = [...aq];
        window.currentMode = 'practice';
        if (typeof currentMode !== 'undefined') currentMode = 'practice';
    } else {
        const sec = qb[secKey];
        source = sec ? (sec.questions || []).map(q => ({ ...q, sectionKey: secKey, sectionLabel: sec.label })) : [...aq];
        window.currentMode = 'practice';
        if (typeof currentMode !== 'undefined') currentMode = 'practice';
    }
    const pNew = document.getElementById('priorityNew');
    if (pNew && pNew.checked && currentMode === 'practice') {
        const unanswered = source.filter(q => !ai.has(q.id));
        if (unanswered.length === 0) {
            showAllDoneModal(source.length);
            return;
        }
        practiceQuestions = shuffleArray(source);
        window.practiceQuestions = practiceQuestions;
        // 起始位置定位到第一道未做题
        const firstUnansweredIdx = practiceQuestions.findIndex(q => !ai.has(q.id));
        currentQuestionIndex = firstUnansweredIdx >= 0 ? firstUnansweredIdx : 0;
        window.currentQuestionIndex = currentQuestionIndex;
    } else {
        practiceQuestions = shuffleArray(source);
        window.practiceQuestions = practiceQuestions;
        currentQuestionIndex = 0;
        window.currentQuestionIndex = 0;
    }
    answeredMap = {};
    window.answeredMap = answeredMap;
    matchState = {}; // M7：新练习轮不沿用上一轮配对（同轮翻页保留）
    window.matchState = matchState;
    qAnimDir = '';
    window.qAnimDir = qAnimDir;
    const btnStart = document.getElementById('btnStart');
    if (btnStart) btnStart.style.display = 'none';
    const pText = document.getElementById('progressText');
    if (pText) pText.textContent = `共 ${practiceQuestions.length} 题 | 第 ${currentQuestionIndex + 1}/${practiceQuestions.length} 题`;
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderCurrentQuestion === 'function') renderCurrentQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function finishPractice() {
    const total = practiceQuestions.length;
    // L3：区分正确/错误/未答三态，空队列不显示 NaN%。
    const correct = Object.values(answeredMap).filter(v => v === 'correct').length;
    const wrong = Object.values(answeredMap).filter(v => v === 'wrong').length;
    const unanswered = total - correct - wrong;
    if (total === 0) {
        hideNotePanel();
        document.getElementById('questionsContainer').innerHTML = `
        <div class="question-card finish-card">
          <h2>本轮没有题目</h2>
          <div class="score-detail"><p>当前分类下暂无可练习的题目。可切换分类或重新导入题库。</p></div>
          <div class="finish-actions">
            <button class="btn btn-outline" onclick="switchSection('all')">${window.UI ? UI.icon('book') : ''} 全部题库</button>
          </div>
        </div>`;
        document.getElementById('progressText').textContent = '练习已完成';
        document.getElementById('btnStart').style.display = 'inline-flex';
        document.getElementById('btnStart').innerHTML = `${window.UI ? UI.icon('repeat') : ''} 重新练习`;
        currentMode = 'idle';
        updateStats();
        updateProgressUI();
        return;
    }
    const pct = Math.round((correct + wrong > 0 ? correct / (correct + wrong) : 0) * 100);
    hideNotePanel();
    document.getElementById('questionsContainer').innerHTML = `
    <div class="question-card finish-card">
      <h2>练习完成</h2>
      <div class="score-ring" style="--pct:${pct};"><span class="ring-score">${pct}%</span></div>
      <div class="ornament-divider"></div>
      <div class="score-detail">
        共 <strong>${total}</strong> 题 ·
        正确 <strong style="color:var(--success);">${correct}</strong> ·
        错误 <strong style="color:var(--danger);">${wrong}</strong> ·
        未答 <strong style="color:var(--muted,#888);">${unanswered}</strong>
      </div>
      ${unanswered > 0 ? '<p class="muted" style="margin:4px 0 0;">存在未作答的题目，重新练习或复习错题可补上。</p>' : ''}
      <div class="finish-actions">
        <button class="btn btn-primary" onclick="startPractice()">${window.UI ? UI.icon('repeat') : ''} 重新练习</button>
        <button class="btn btn-outline" onclick="reviewWrong()">${window.UI ? UI.icon('repeat') : ''} 复习错题 (${Object.keys(window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {})).length})</button>
        <button class="btn btn-outline" onclick="switchSection('all')">${window.UI ? UI.icon('book') : ''} 全部题库</button>
      </div>
    </div>`;
    document.getElementById('progressText').textContent = '练习已完成';
    document.getElementById('btnStart').style.display = 'inline-flex';
    document.getElementById('btnStart').innerHTML = `${window.UI ? UI.icon('repeat') : ''} 重新练习`;
    cleanupWrongRecords();
    currentMode = 'idle';
    updateStats();
    updateProgressUI();
}

function showAllDoneModal(totalCount) {
    const sectionLabel = currentSection === 'all' ? '全部题库' :
        (questionBank[currentSection] ? questionBank[currentSection].label : '全部题库');

    const overlay = document.createElement('div');
    overlay.innerHTML = `
        <div class="modal-overlay">
            <div class="modal modal-sm" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>本轮题目已全部完成</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-strong-line">
                        <strong>${sectionLabel}</strong> 共 ${totalCount} 题已全部做完！
                    </p>
                    <p class="modal-muted-line">
                        是否开启新的做题记录？（错题本将保留）
                    </p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline btn-sm" onclick="this.closest('.modal-overlay').remove()">取消</button>
                    <button class="btn btn-primary btn-sm" onclick="startNewRound()">开启新的做题记录</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function startNewRound() {
    // 只移除本函数创建的"全部做完"弹窗，避免误删常驻历史进度层
    const modal = document.querySelector('.modal-overlay:not(.progress-dialog-overlay)');
    if (modal) modal.remove();

    answeredIds.clear();
    answeredMap = {};
    matchState = {};
    window.questionStatus = {};
    sessionAnswered = 0;
    sessionWrong = 0;
    qAnimDir = '';
    currentMode = 'idle';
    currentQuestionIndex = 0;
    practiceQuestions = [];
    saveToLocalStorage();

    document.getElementById('btnStart').style.display = 'inline-flex';
    document.getElementById('btnStart').innerHTML = `${window.UI ? UI.icon('play') : ''} 开始练习`;
    document.getElementById('progressText').textContent = '准备开始练习';
    hideNotePanel();
    document.getElementById('questionsContainer').innerHTML =
        '<div class="empty-state">已重置做题记录，点击"开始练习"继续</div>';

    updateStats();
    renderSectionTabs();
    updateProgressUI();
}

// 显式挂载到 window
window.startPractice = startPractice;
window.shuffleArray = shuffleArray;
window.finishPractice = finishPractice;
window.showAllDoneModal = showAllDoneModal;
window.startNewRound = startNewRound;

