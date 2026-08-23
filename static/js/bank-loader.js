// bank-loader.js — 题库数据核心：扁平化、校验、应用（三处重复逻辑的唯一实现）
'use strict';

/** 将 questionBank 展开为带分类信息的扁平数组，并更新总题数显示 */
function initAllQuestions() {
    allQuestions = [];
    for (const [key, section] of Object.entries(questionBank)) {
        section.questions.forEach(q => {
            allQuestions.push({ ...q, sectionKey: key, sectionLabel: section.label });
        });
    }
    document.getElementById('totalCount').textContent = allQuestions.length;
}

/**
 * 校验并清洗题库 JSON。
 * @returns {{validated: Object, totalQ: number}|null} 无有效题目时返回 null
 */
function validateBankData(data) {
    if (!data.meta || !data.meta.name) return { error: '缺少 meta.name 字段' };
    if (!data.categories || Object.keys(data.categories).length === 0) return { error: '缺少 categories 或为空' };
    const validated = {};
    let totalQ = 0;
    for (const [key, cat] of Object.entries(data.categories)) {
        if (!cat.label || !Array.isArray(cat.questions)) continue;
        const validQuestions = [];
        for (const q of cat.questions) {
            if (!q.id || !q.type || !q.q) continue;
            for (const f of ['analysis', 'memo', 'q_trans']) {
                if (q[f] === null || q[f] === undefined) delete q[f];
                else if (typeof q[f] !== 'string') q[f] = String(q[f]);
            }
            if (q.type === 'matching') {
                if (!Array.isArray(q.left) || !Array.isArray(q.right) || !Array.isArray(q.ans)) continue;
            } else {
                if (!Array.isArray(q.opts) || q.ans === undefined) continue;
            }
            validQuestions.push(q);
        }
        if (validQuestions.length > 0) {
            validated[key] = { label: cat.label, questions: validQuestions };
            totalQ += validQuestions.length;
        }
    }
    if (Object.keys(validated).length === 0) return { error: '没有有效的题目数据' };
    return { validated, totalQ };
}

/**
 * 将校验后的题库应用到全局状态。
 * @param {'replace'|'merge'} mode
 */
function applyValidatedBank(validated, mode) {
    if (mode === 'merge' && Object.keys(questionBank).length > 0) {
        let dupCount = 0;
        const existingIds = new Set();
        for (const cat of Object.values(questionBank)) {
            for (const q of cat.questions) existingIds.add(q.id);
        }
        for (const [key, cat] of Object.entries(validated)) {
            if (questionBank[key]) {
                const newQs = cat.questions.filter(q => {
                    if (existingIds.has(q.id)) { dupCount++; return false; }
                    return true;
                });
                questionBank[key].questions.push(...newQs);
            } else {
                questionBank[key] = cat;
            }
        }
        if (dupCount > 0) alert('跳过了 ' + dupCount + ' 个重复ID的题目');
    } else {
        resetAnswerState();
        questionBank = validated;
    }
}

/** 清空与题目相关的作答状态（换题库/重置时调用） */
function resetAnswerState() {
    wrongRecords = {};
    answeredIds = new Set();
    totalStats = { totalAnswered: 0, totalCorrect: 0 };
    answeredMap = {};
    matchState = {};
}

/** 装载题库后的公共收尾：保存、渲染界面、显示欢迎信息 */
function afterBankLoaded(bankName, totalQ) {
    saveToLocalStorage();
    initAllQuestions();
    setTheme(currentTheme);
    currentBankName = bankName;
    isEnglishBank = bankName.includes('英语');
    document.getElementById('appTitle').textContent = bankName;
    tabsIntroPending = true;   // 新题库首次显示：分类标签播放入场动画
    renderSectionTabs();
    updateStats();
    document.getElementById('bankSelectScreen').style.display = 'none';
    hideImportScreen();
    hideNotePanel();
    document.getElementById('questionsContainer').innerHTML =
        `<div class="empty-state"><span class="es-icon">📚</span>已导入 <strong>${bankName}</strong>（${totalQ} 题），点击下方 <strong>"开始练习"</strong></div>`;
}
