// practice.js — 练习流程：开始练习、洗牌、完成页、全部做完弹窗、新一轮
'use strict';

function startPractice() {
    let source = [];
    if (currentSection === '__wrong__') {
        const filterElem = document.getElementById('wrongFilter');
        const selectedOptions = Array.from(filterElem.selectedOptions).map(o => o.value);
        let filtered = allQuestions.filter(q => wrongRecords.hasOwnProperty(q.id));
        if (!selectedOptions.includes('all')) {
            filtered = filtered.filter(q => {
                const rec = wrongRecords[q.id];
                return rec && selectedOptions.includes(String(rec.wrongCount));
            });
        }
        source = filtered;
        currentMode = 'review';
    } else if (currentSection === 'all') {
        source = [...allQuestions];
        currentMode = 'practice';
    } else {
        const sec = questionBank[currentSection];
        source = sec ? sec.questions.map(q => ({ ...q, sectionKey: currentSection, sectionLabel: sec.label })) : [...allQuestions];
        currentMode = 'practice';
    }
    if (document.getElementById('priorityNew').checked && currentMode === 'practice') {
        const unanswered = source.filter(q => !answeredIds.has(q.id));
        if (unanswered.length === 0) {
            showAllDoneModal(source.length);
            return;
        }
        practiceQuestions = shuffleArray(source);
        // 起始位置定位到第一道未做题
        const firstUnansweredIdx = practiceQuestions.findIndex(q => !answeredIds.has(q.id));
        currentQuestionIndex = firstUnansweredIdx >= 0 ? firstUnansweredIdx : 0;
    } else {
        practiceQuestions = shuffleArray(source);
        currentQuestionIndex = 0;
    }
    answeredMap = {};
    qAnimDir = '';
    document.getElementById('btnStart').style.display = 'none';
    document.getElementById('progressText').textContent = `共 ${practiceQuestions.length} 题 | 第 ${currentQuestionIndex + 1}/${practiceQuestions.length} 题`;
    updateStats();
    renderCurrentQuestion();
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
    const correct = Object.values(answeredMap).filter(v => v === 'correct').length;
    const pct = Math.round(correct / total * 100);
    hideNotePanel();
    document.getElementById('questionsContainer').innerHTML = `
    <div class="question-card finish-card">
      <h2>练习完成</h2>
      <div class="score-ring" style="--pct:${pct};"><span class="ring-score">${pct}%</span></div>
      <div class="ornament-divider">❖</div>
      <div class="score-detail">
        共 <strong>${total}</strong> 题 |
        正确 <strong style="color:var(--success);">${correct}</strong> |
        错误 <strong style="color:var(--danger);">${total - correct}</strong>
      </div>
      <div class="finish-actions">
        <button class="btn btn-primary" onclick="startPractice()">🔄 重新练习</button>
        <button class="btn btn-outline" onclick="reviewWrong()">🔁 复习错题(${Object.keys(wrongRecords).length})</button>
        <button class="btn btn-outline" onclick="switchSection('all')">📋 返回全部</button>
      </div>
    </div>`;
    document.getElementById('progressText').textContent = '练习已完成';
    document.getElementById('btnStart').style.display = 'inline-block';
    document.getElementById('btnStart').textContent = '🔄 重新练习';
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
                    <h3>🎉 本轮题目已全部完成</h3>
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
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();

    answeredIds.clear();
    answeredMap = {};
    saveToLocalStorage();

    currentMode = 'idle';
    currentQuestionIndex = 0;
    practiceQuestions = [];

    document.getElementById('btnStart').style.display = 'inline-block';
    document.getElementById('btnStart').textContent = '🚀 开始练习';
    document.getElementById('progressText').textContent = '准备开始练习';
    hideNotePanel();
    document.getElementById('questionsContainer').innerHTML =
        '<div class="empty-state">已重置做题记录，点击"开始练习"继续</div>';

    updateStats();
    renderSectionTabs();
    updateProgressUI();
}
