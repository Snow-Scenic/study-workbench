// stats.js — 统计面板、错题本记账与维护、阈值设置
'use strict';

/**
 * 记录一次作答结果（三种题型的公共收尾）：
 * 更新总统计、错题本连对计数，并持久化。
 */
function finishAnswer(qId, correct) {
    answeredMap[qId] = correct ? 'correct' : 'wrong';
    answeredIds.add(qId);
    if (correct) {
        totalStats.totalAnswered++;
        totalStats.totalCorrect++;
    } else {
        totalStats.totalAnswered++;
    }
    saveToLocalStorage();

    if (!correct) {
        if (!wrongRecords[qId]) {
            wrongRecords[qId] = { wrongCount: 1, consecutiveCorrect: 0 };
        } else {
            wrongRecords[qId].wrongCount++;
            wrongRecords[qId].consecutiveCorrect = 0; // 答错重置连续正确
        }
    } else {
        if (wrongRecords[qId]) wrongRecords[qId].consecutiveCorrect++;
    }

    saveToLocalStorage();
    updateWrongCount();
    updateStats();
}

function updateWrongCount() {
    const count = Object.keys(wrongRecords).length;
    document.getElementById('totalWrongCount').textContent = count;
    document.getElementById('btnReview').style.display = (count > 0 && wrongReviewEnabled) ? 'inline-block' : 'none';
    document.getElementById('btnResetWrong').style.display = (count > 0 && wrongReviewEnabled) ? 'inline-block' : 'none';
}

function updateStats() {
    const totalAnswered = Object.keys(answeredMap).filter(k => !k.includes('_')).length;
    let correctCount = 0;
    let wrongThisSession = 0;
    for (const [key, val] of Object.entries(answeredMap)) {
        if (key.includes('_')) continue;
        if (val === 'correct') correctCount++;
        else if (val === 'wrong') wrongThisSession++;
    }
    sessionAnswered = totalAnswered;
    sessionWrong = wrongThisSession;

    document.getElementById('sessionDoneCount').textContent = sessionAnswered;
    document.getElementById('sessionWrongCount').textContent = sessionWrong;
    document.getElementById('totalDoneCount').textContent = totalStats.totalAnswered;
    document.getElementById('totalWrongCount').textContent = Object.keys(wrongRecords).length;
    document.getElementById('accuracy').textContent = totalAnswered > 0
        ? Math.round((correctCount / totalAnswered) * 100) + '%' : '--';

    updateWrongCount();
}

function resetWrong() {
    wrongRecords = {};
    updateWrongCount();
    renderSectionTabs();
    saveToLocalStorage();
    if (currentSection === '__wrong__') switchSection('all');
}

/** 移除达到"连续答对阈值"的错题记录 */
function cleanupWrongRecords() {
    for (const id in wrongRecords) {
        if (wrongRecords[id].consecutiveCorrect >= removalThreshold) {
            delete wrongRecords[id];
        }
    }
    saveToLocalStorage();
    updateWrongCount();
}

function setThreshold() {
    showModal('⚙️ 阈值设置',
        `<p style="margin-bottom:12px;">连续答对多少次后自动从错题集中移除？</p>
         <input type="number" id="thresholdInput" value="${removalThreshold}" min="1" max="10" class="input-num">`,
        () => {
            const input = document.getElementById('thresholdInput');
            let val = parseInt(input.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 10) val = 10;
            removalThreshold = val;
            saveToLocalStorage();
        }
    );
}

function showStats() {
    const totalAnswered = Object.keys(answeredMap).filter(k => !k.includes('_')).length;
    const correct = Object.values(answeredMap).filter(v => v === 'correct').length;
    const pct = totalAnswered ? Math.round(correct / totalAnswered * 100) : 0;
    const wrongCount = Object.keys(wrongRecords).length;
    showModal('📊 详细统计',
        `<table class="stats-table">
            <tr><td>📝 总题数</td><td>${allQuestions.length}</td></tr>
            <tr><td>✅ 已答题</td><td>${totalAnswered}</td></tr>
            <tr><td>🎯 正确</td><td style="color:var(--success);">${correct}</td></tr>
            <tr><td>❌ 错题</td><td style="color:var(--danger);">${wrongCount}</td></tr>
            <tr><td>📊 正确率</td><td style="color:${pct >= 80 ? 'var(--success)' : 'var(--danger)'};">${pct}%</td></tr>
        </table>`
    );
}

// ===== 错题复习范围选择弹窗 =====

function reviewWrong() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const levelCounts = {};
    for (const rec of Object.values(wrongRecords)) {
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
            <span class="cb-count">${Object.keys(wrongRecords).length} 题</span>
        </label>
    </div>`;

    const modalHTML = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal modal-md" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>🔁 选择错题复习范围</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                ${checkboxesHTML}
                <div class="modal-footer" style="margin-bottom:8px;">
                    <button class="btn btn-outline btn-sm" onclick="selectAllLevels(true)">全选</button>
                    <button class="btn btn-outline btn-sm" onclick="selectAllLevels(false)">全不选</button>
                </div>
                <button class="btn btn-primary" style="width:100%;" onclick="startFilteredReview()">🚀 开始复习</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function startFilteredReview() {
    const allChecked = document.getElementById('cb-all-wrong').checked;
    const selectedLevels = allChecked ? null :
        Array.from(document.querySelectorAll('.level-cb:checked')).map(cb => parseInt(cb.value));

    const filteredIds = [];
    for (const [id, rec] of Object.entries(wrongRecords)) {
        if (allChecked || selectedLevels.includes(rec.wrongCount)) {
            filteredIds.push(id);
        }
    }

    document.querySelector('.modal-overlay').remove();

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
    qAnimDir = '';
    practiceQuestions = shuffleArray(practiceQuestions);
    document.getElementById('btnStart').style.display = 'none';
    renderCurrentQuestion();
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
    allWrongCb.checked = false;
    allWrongCb.closest('.checkbox-card').classList.remove('checked');
}
