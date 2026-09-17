// navigation.js — 分类标签页（含箭头展开抽屉）、翻页、侧边栏导航、错题筛选联动
'use strict';

function buildSectionTabsHtml() {
    const aq = window.allQuestions || (typeof allQuestions !== 'undefined' ? allQuestions : []);
    const ai = window.answeredIds || (typeof answeredIds !== 'undefined' ? answeredIds : new Set());
    const qb = window.questionBank || (typeof questionBank !== 'undefined' ? questionBank : {});
    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    const secKey = window.currentSection || (typeof currentSection !== 'undefined' ? currentSection : 'all');
    const reviewEnabled = (window.wrongReviewEnabled !== undefined ? window.wrongReviewEnabled : (typeof wrongReviewEnabled !== 'undefined' ? wrongReviewEnabled : true));

    const allUnanswered = aq.filter(q => !ai.has(q.id)).length;
    let html = `<button class="section-tab ${secKey === 'all' ? 'active' : ''}" onclick="switchSection('all')">全部题库<span class="badge">${allUnanswered}</span></button>`;
    for (const [key, sec] of Object.entries(qb)) {
        const unansweredCount = (sec.questions || []).filter(q => !ai.has(q.id)).length;
        html += `<button class="section-tab ${secKey === key ? 'active' : ''}" onclick="switchSection('${key}')">${sec.label}<span class="badge">${unansweredCount}</span></button>`;
    }
    const wrongCount = Object.keys(wr).length;
    if ((wrongCount > 0 && reviewEnabled) || secKey === '__wrong__') {
        const iconRepeat = window.UI ? UI.icon('repeat') : '';
        html += `<button class="section-tab ${secKey === '__wrong__' ? 'active' : ''}" onclick="switchSection('__wrong__')">${iconRepeat} 错题复习<span class="badge">${wrongCount}</span></button>`;
    }
    return html;
}

var tabsIntroPending = window.tabsIntroPending = (typeof window.tabsIntroPending !== 'undefined' ? window.tabsIntroPending : true);

function renderSectionTabs() {
    const html = buildSectionTabsHtml();
    const row = document.getElementById('sectionTabs');
    const grid = document.getElementById('tabsDrawerGrid');
    if (window.tabsIntroPending && row) {
        row.classList.add('tabs-intro');
        if (grid) grid.classList.add('tabs-intro');
        setTimeout(() => {
            if (row) row.classList.remove('tabs-intro');
            if (grid) grid.classList.remove('tabs-intro');
        }, 1100);
        window.tabsIntroPending = false;
        tabsIntroPending = false;
    }
    if (row) row.innerHTML = html;
    if (grid) grid.innerHTML = html;
    updateTabsUI();
}

/* ===== 标签溢出时的展开抽屉 ===== */
let tabsDrawerOpen = false;

function toggleTabsDrawer(state) {
    tabsDrawerOpen = (typeof state === 'boolean') ? state : !tabsDrawerOpen;
    const drawer = document.getElementById('tabsDrawer');
    const row = document.getElementById('sectionTabsRow');
    const btn = document.getElementById('tabsToggle');
    if (drawer) drawer.classList.toggle('open', tabsDrawerOpen);
    if (row) row.classList.toggle('open', tabsDrawerOpen);
    if (btn) btn.classList.toggle('open', tabsDrawerOpen);
}

/** 检测标签是否溢出：溢出才显示展开箭头与右缘渐隐提示 */
function updateTabsUI() {
    const row = document.getElementById('sectionTabsRow');
    const tabs = document.getElementById('sectionTabs');
    const btn = document.getElementById('tabsToggle');
    if (!row || !tabs || !btn) return;
    const overflow = tabs.scrollWidth > tabs.clientWidth + 4;
    btn.style.display = overflow ? 'flex' : 'none';
    row.classList.toggle('has-overflow', overflow);
    if (!overflow && tabsDrawerOpen) toggleTabsDrawer(false);
}

window.addEventListener('resize', updateTabsUI);

function switchSection(key) {
    cleanupWrongRecords();
    currentSection = key;
    currentMode = 'idle';
    currentQuestionIndex = 0;
    practiceQuestions = [];
    answeredMap = {};
    if (tabsDrawerOpen) toggleTabsDrawer(false);   // 选完自动收回
    hideNotePanel();
    renderSectionTabs();
    const iconPlay = window.UI ? UI.icon('play') : '';
    document.getElementById('questionsContainer').innerHTML =
        `<div class="empty-state"><span class="es-icon">${iconPlay}</span><p>点击下方 <strong>"开始练习"</strong> 按钮开始做题</p></div>`;
    document.getElementById('btnStart').style.display = 'inline-flex';
    document.getElementById('btnStart').innerHTML = `${iconPlay} 开始练习`;
    document.getElementById('progressText').textContent = '准备开始练习';

    // 错题复习分类下显示筛选控件并调整底栏布局
    const isWrong = key === '__wrong__';
    const groupWrongFilters = document.getElementById('groupWrongFilters');
    const priorityLabel = document.getElementById('priorityLabel');
    const btnThresholdModal = document.getElementById('btnThresholdModal');
    const groupWrongReview = document.getElementById('groupWrongReview');
    const bottomBar = document.getElementById('bottomBar');

    if (groupWrongFilters) groupWrongFilters.style.display = isWrong ? 'inline-flex' : 'none';
    if (priorityLabel) priorityLabel.style.display = isWrong ? 'none' : 'inline-flex';
    if (btnThresholdModal) btnThresholdModal.style.display = isWrong ? 'none' : 'inline-flex';
    if (groupWrongReview && isWrong) groupWrongReview.style.display = 'none';
    if (bottomBar) bottomBar.classList.toggle('has-wrong-filters', isWrong);
    if (isWrong) {
        document.getElementById('btnStart').innerHTML = `${window.UI ? UI.icon('repeat') : ''} 开始复习`;
    }

    updateStats();
    updateProgressUI();
}

function onFilterChange() {
    // 在错题复习中修改筛选条件 → 回到准备状态重新选择
    if (currentSection === '__wrong__') {
        switchSection('__wrong__');
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        qAnimDir = 'prev';
        currentQuestionIndex--;
        renderCurrentQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function nextQuestion() {
    qAnimDir = 'next';
    if (document.getElementById('priorityNew').checked && currentMode === 'practice') {
        // 跳到下一道未做题
        let found = -1;
        for (let i = currentQuestionIndex + 1; i < practiceQuestions.length; i++) {
            if (!answeredIds.has(practiceQuestions[i].id)) { found = i; break; }
        }
        if (found === -1) {
            for (let i = 0; i < currentQuestionIndex; i++) {
                if (!answeredIds.has(practiceQuestions[i].id)) { found = i; break; }
            }
        }
        if (found === -1) {
            showAllDoneModal(practiceQuestions.length);
            return;
        }
        currentQuestionIndex = found;
        renderCurrentQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        currentQuestionIndex++;
        if (currentQuestionIndex >= practiceQuestions.length) finishPractice();
        else { renderCurrentQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
}

function refreshSidebar() {
    const container = document.getElementById('sidebarContent');
    if (!practiceQuestions.length) {
        container.innerHTML = '<div class="sidebar-empty">无题目</div>';
        return;
    }
    let html = '';
    const pq = window.practiceQuestions || (typeof practiceQuestions !== 'undefined' ? practiceQuestions : []);
    const am = window.answeredMap || (typeof answeredMap !== 'undefined' ? answeredMap : {});
    const ai = window.answeredIds || (typeof answeredIds !== 'undefined' ? answeredIds : new Set());
    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    const curIdx = window.currentQuestionIndex || (typeof currentQuestionIndex !== 'undefined' ? currentQuestionIndex : 0);

    pq.forEach((q, idx) => {
        let cls = 'gray';
        // 优先用当前会话状态，其次用持久化数据
        if (am[q.id] === 'correct') cls = 'green';
        else if (am[q.id] === 'wrong') cls = 'red';
        else if (ai.has(q.id)) {
            const rec = wr[q.id];
            cls = (rec && rec.consecutiveCorrect === 0) ? 'red' : 'green';
        }
        if (idx === curIdx) cls += ' active';
        html += `<div class="sidebar-item ${cls}" onclick="jumpToQuestion(${idx})">${idx + 1}</div>`;
    });
    container.innerHTML = html;
}

function jumpToQuestion(idx) {
    qAnimDir = '';
    currentQuestionIndex = idx;
    renderCurrentQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 显式挂载到 window
window.switchSection = switchSection;
window.renderSectionTabs = renderSectionTabs;
window.toggleTabsDrawer = toggleTabsDrawer;
window.updateTabsUI = updateTabsUI;
window.onFilterChange = onFilterChange;
window.prevQuestion = prevQuestion;
window.nextQuestion = nextQuestion;
window.refreshSidebar = refreshSidebar;
window.jumpToQuestion = jumpToQuestion;

