// matching.js — 匹配题交互（点击配对、取消配对、提交判分）
'use strict';

/**
 * 将题库 ans 规范化为二维配对数组 [[左下标, 右下标], ...]。
 * 兼容官方文档一维格式 ans[i]=左 i 对应的右下标（如 [0,1]），
 * 以及内部二维格式 [[0,0],[1,1]]。
 */
function normalizeMatchingAns(ans) {
    if (!Array.isArray(ans) || ans.length === 0) return [];
    // 二维：首元素是数组
    if (Array.isArray(ans[0])) {
        return ans.filter(p => Array.isArray(p) && p.length >= 2)
                  .map(p => [p[0], p[1]]);
    }
    // 一维：ans[i] = 左第 i 项对应的右下标
    return ans.map((r, l) => [l, r]);
}

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
    const correct = sortPairs(normalizeMatchingAns(q.ans));
    const equal = sorted.length === correct.length && sorted.every((p, i) => p[0] === correct[i][0] && p[1] === correct[i][1]);
    finishAnswer(qId, equal);
    renderCurrentQuestion();
}

// 显式挂载到 window
window.selectMatchItem = selectMatchItem;
window.submitMatching = submitMatching;
window.normalizeMatchingAns = normalizeMatchingAns;
