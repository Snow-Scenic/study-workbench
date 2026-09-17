// answer.js — 选项题答题逻辑（单选/判断/TF/英文单选即时判分，多选题提交判分）
'use strict';

function selectOption(qId, optIdx, type) {
    if (answeredMap[qId]) return;
    if (type === 'multi') {
        let sel = answeredMap[qId + '_selected'] || [];
        const idx = sel.indexOf(optIdx);
        if (idx >= 0) sel.splice(idx, 1); else sel.push(optIdx);
        answeredMap[qId + '_selected'] = sel;
        renderCurrentQuestion();
    } else {
        answeredMap[qId + '_chosen'] = optIdx;
        const q = practiceQuestions.find(q => q.id === qId);
        const correct = (optIdx === q.ans);
        finishAnswer(qId, correct);
        renderCurrentQuestion();
    }
}

function submitMulti(qId) {
    if (answeredMap[qId]) return;
    const q = practiceQuestions.find(q => q.id === qId);
    const sel = answeredMap[qId + '_selected'] || [];
    const correct = Array.isArray(q.ans) ? q.ans : [q.ans];
    const sortedSel = [...sel].sort(), sortedAns = [...correct].sort();
    const equal = sortedSel.length === sortedAns.length && sortedSel.every((v, i) => v === sortedAns[i]);
    finishAnswer(qId, equal);
    renderCurrentQuestion();
}

// 显式挂载到 window
window.selectOption = selectOption;
window.submitMulti = submitMulti;

