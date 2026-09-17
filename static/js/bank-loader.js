// bank-loader.js — 题库数据核心：扁平化、校验、应用（三处重复逻辑的唯一实现）
'use strict';

/** 将 questionBank 展开为带分类信息的扁平数组，并更新总题数显示 */
function initAllQuestions() {
    const qb = window.questionBank || (typeof questionBank !== 'undefined' ? questionBank : {});
    const aq = [];
    for (const [key, section] of Object.entries(qb)) {
        if (section && Array.isArray(section.questions)) {
            section.questions.forEach(q => {
                aq.push({ ...q, sectionKey: key, sectionLabel: section.label });
            });
        }
    }
    window.allQuestions = aq;
    if (typeof allQuestions !== 'undefined') allQuestions = aq;
    const countEl = document.getElementById('totalCount');
    if (countEl) countEl.textContent = aq.length;
}

/**
 * 校验并清洗题库 JSON。
 * @returns {{validated: Object, totalQ: number}|null} 无有效题目时返回 null
 */
function validateBankData(data) {
    if (!data || typeof data !== 'object') return { error: '题库数据格式无效' };
    if (!data.meta || !data.meta.name) return { error: '缺少 meta.name 字段' };
    if (!data.categories || Object.keys(data.categories).length === 0) return { error: '缺少 categories 或为空' };
    const validated = {};
    const seenIds = new Set();
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
                // 一维格式：ans[i] = 右下标，需在 left 长度范围内；二维格式：每项为 [l, r]
                const oneD = q.ans.length > 0 && !Array.isArray(q.ans[0]);
                if (oneD) {
                    if (q.ans.length !== q.left.length) continue;
                    if (q.ans.some(r => !Number.isInteger(r) || r < 0 || r >= q.right.length)) continue;
                } else {
                    if (q.ans.some(p => !Array.isArray(p) || p.length < 2 ||
                        !Number.isInteger(p[0]) || p[0] < 0 || p[0] >= q.left.length ||
                        !Number.isInteger(p[1]) || p[1] < 0 || p[1] >= q.right.length)) continue;
                }
            } else {
                if (!Array.isArray(q.opts) || q.ans === undefined) continue;
            }
            const id = String(q.id);
            if (seenIds.has(id)) return { error: '题目 ID 重复：' + id };
            seenIds.add(id);
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
    const qb = window.questionBank || (typeof questionBank !== 'undefined' ? questionBank : {});
    if (mode === 'merge' && Object.keys(qb).length > 0) {
        let dupCount = 0;
        const existingIds = new Set();
        for (const cat of Object.values(qb)) {
            for (const q of (cat.questions || [])) existingIds.add(String(q.id));
        }
        for (const [key, cat] of Object.entries(validated)) {
            const newQs = cat.questions.filter(q => {
                const id = String(q.id);
                if (existingIds.has(id)) { dupCount++; return false; }
                existingIds.add(id);
                return true;
            });
            if (qb[key]) qb[key].questions.push(...newQs);
            else if (newQs.length) qb[key] = { ...cat, questions: newQs };
        }
        window.questionBank = qb;
        if (typeof questionBank !== 'undefined') questionBank = qb;
        if (dupCount > 0) alert('跳过了 ' + dupCount + ' 个重复ID的题目');
    } else {
        resetAnswerState();
        window.questionBank = validated;
        if (typeof questionBank !== 'undefined') questionBank = validated;
    }
}

/** 换题库/重置时原子化清空全部练习态：作答、队列、分类、模式、状态与匹配交互 */
function resetAnswerState() {
    window.wrongRecords = {};
    if (typeof wrongRecords !== 'undefined') wrongRecords = window.wrongRecords;
    window.answeredIds = new Set();
    if (typeof answeredIds !== 'undefined') answeredIds = window.answeredIds;
    window.totalStats = { totalAnswered: 0, totalCorrect: 0 };
    if (typeof totalStats !== 'undefined') totalStats = window.totalStats;
    window.answeredMap = {};
    if (typeof answeredMap !== 'undefined') answeredMap = window.answeredMap;
    window.matchState = {};
    if (typeof matchState !== 'undefined') matchState = window.matchState;
    window.questionStatus = {};
    window.practiceQuestions = [];
    window.allQuestions = [];
    window.currentQuestionIndex = 0;
    window.currentSection = 'all';
    window.currentMode = 'idle';
    window.qAnimDir = '';
    window.sessionAnswered = 0;
    window.sessionWrong = 0;
    if (typeof hideNotePanel === 'function') hideNotePanel();
}

/** 装载题库后的公共收尾：保存、渲染界面、显示欢迎信息 */
function afterBankLoaded(bankName, totalQ) {
    initAllQuestions();
    const curTheme = window.currentTheme || (typeof currentTheme !== 'undefined' ? currentTheme : 'light');
    if (typeof setTheme === 'function') setTheme(curTheme);
    window.currentBankName = bankName;
    if (typeof currentBankName !== 'undefined') currentBankName = bankName;
    const isEng = bankName.includes('英语');
    window.isEnglishBank = isEng;
    if (typeof isEnglishBank !== 'undefined') isEnglishBank = isEng;
    // 名称和题库必须一起持久化，否则重载时会把新库记录标为旧库。
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    const titleEl = document.getElementById('appTitle');
    if (titleEl) titleEl.textContent = bankName;
    window.tabsIntroPending = true;
    if (typeof tabsIntroPending !== 'undefined') tabsIntroPending = true;
    if (typeof renderSectionTabs === 'function') renderSectionTabs();
    if (typeof updateStats === 'function') updateStats();
    const bss = document.getElementById('bankSelectScreen');
    if (bss) bss.style.display = 'none';
    if (typeof hideImportScreen === 'function') hideImportScreen();

    // 同步更新首页最近学习卡片
    if (document.getElementById('homeBankName')) document.getElementById('homeBankName').textContent = bankName;
    if (document.getElementById('homeBankCount')) document.getElementById('homeBankCount').textContent = totalQ + ' 题';
    if (document.getElementById('homeProgressText')) document.getElementById('homeProgressText').textContent = '已就绪 · 点击继续练习';

    if (window.AppShell && typeof window.AppShell.navigate === 'function') {
        window.AppShell.navigate('practice');
    }

    const iconBook = (window.UI && typeof window.UI.icon === 'function') ? window.UI.icon('book') : '';
    const qc = document.getElementById('questionsContainer');
    if (qc) {
        qc.innerHTML =
            `<div class="empty-state"><span class="es-icon">${iconBook}</span>已载入 <strong>${bankName}</strong>（${totalQ} 题），点击下方 <strong>"开始练习"</strong></div>`;
    }
}

// 显式挂载到全局 window，确保跨模块与桌面 WebView2 异步加载下的绝对可用性
window.initAllQuestions = initAllQuestions;
window.validateBankData = validateBankData;
window.applyValidatedBank = applyValidatedBank;
window.resetAnswerState = resetAnswerState;
window.afterBankLoaded = afterBankLoaded;
