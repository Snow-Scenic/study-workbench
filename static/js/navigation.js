// navigation.js — 分类标签页（含箭头展开抽屉）、翻页、侧边栏导航、错题筛选联动
'use strict';

function buildSectionTabsHtml() {
    const allUnanswered = allQuestions.filter(q => !answeredIds.has(q.id)).length;
    let html = `<button class="section-tab ${currentSection === 'all' ? 'active' : ''}" onclick="switchSection('all')">全部题库<span class="badge">${allUnanswered}</span></button>`;
    for (const [key, sec] of Object.entries(questionBank)) {
        const unansweredCount = sec.questions.filter(q => !answeredIds.has(q.id)).length;
        html += `<button class="section-tab ${currentSection === key ? 'active' : ''}" onclick="switchSection('${key}')">${sec.label}<span class="badge">${unansweredCount}</span></button>`;
    }
    const wrongCount = Object.keys(wrongRecords).length;
    if ((wrongCount > 0 && wrongReviewEnabled) || currentSection === '__wrong__') {
        html += `<button class="section-tab ${currentSection === '__wrong__' ? 'active' : ''}" onclick="switchSection('__wrong__')">🔁 错题复习<span class="badge">${wrongCount}</span></button>`;
    }
    return html;
}

let tabsIntroPending = true;   // 每次装载题库后的首次标签渲染播放入场动画，之后切换分类不再重播

function renderSectionTabs() {
    const html = buildSectionTabsHtml();
    const row = document.getElementById('sectionTabs');
    const grid = document.getElementById('tabsDrawerGrid');
    if (tabsIntroPending && row) {
        row.classList.add('tabs-intro');
        if (grid) grid.classList.add('tabs-intro');
        setTimeout(() => {
            if (row) row.classList.remove('tabs-intro');
            if (grid) grid.classList.remove('tabs-intro');
        }, 1100);
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
    document.getElementById('questionsContainer').innerHTML =
        '<div class="empty-state"><span class="es-icon">👆</span>点击下方 <strong>"开始练习"</strong> 按钮开始做题</div>';
    document.getElementById('btnStart').style.display = 'inline-block';
    document.getElementById('btnStart').textContent = '🚀 开始练习';
    document.getElementById('progressText').textContent = '准备开始练习';

    // 错题复习分类下显示筛选控件
    const isWrong = key === '__wrong__';
    document.getElementById('wrongFilter').style.display = isWrong ? 'inline-block' : 'none';
    document.getElementById('thresholdLabel').style.display = isWrong ? 'inline-block' : 'none';

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
    practiceQuestions.forEach((q, idx) => {
        let cls = 'gray';
        // 优先用当前会话状态，其次用持久化数据
        if (answeredMap[q.id] === 'correct') cls = 'green';
        else if (answeredMap[q.id] === 'wrong') cls = 'red';
        else if (answeredIds.has(q.id)) {
            const rec = wrongRecords[q.id];
            cls = (rec && rec.consecutiveCorrect === 0) ? 'red' : 'green';
        }
        if (idx === currentQuestionIndex) cls += ' active';
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
