// matching.js — 匹配题交互（点击配对、取消配对、提交判分）
'use strict';

function selectMatchItem(side, idx, qId) {
    if (answeredMap[qId]) return;
    if (!matchState[qId]) matchState[qId] = { selectedLeft: null, selectedRight: null, pairs: [] };
    const state = matchState[qId];
    // 点击已配对的项 → 取消配对
    const pairIdx = state.pairs.findIndex(p => p[side === 'left' ? 0 : 1] === idx);
    if (pairIdx >= 0) {
        state.pairs.splice(pairIdx, 1);
        state.selectedLeft = null;
        state.selectedRight = null;
        renderCurrentQuestion();
        return;
    }
    if (side === 'left') state.selectedLeft = idx;
    else state.selectedRight = idx;
    // 两侧都选中 → 形成配对
    if (state.selectedLeft !== null && state.selectedRight !== null) {
        state.pairs = state.pairs.filter(p => p[0] !== state.selectedLeft && p[1] !== state.selectedRight);
        state.pairs.push([state.selectedLeft, state.selectedRight]);
        state.selectedLeft = null;
        state.selectedRight = null;
    }
    renderCurrentQuestion();
}

function submitMatching(qId) {
    if (answeredMap[qId]) return;
    const q = practiceQuestions.find(q => q.id === qId);
    const state = matchState[qId];
    const sortPairs = arr => [...arr].sort((a, b) => a[0] - b[0]);
    const sorted = sortPairs(state.pairs);
    const correct = sortPairs(q.ans);
    const equal = sorted.length === correct.length && sorted.every((p, i) => p[0] === correct[i][0] && p[1] === correct[i][1]);
    finishAnswer(qId, equal);
    renderCurrentQuestion();
}
