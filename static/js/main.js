// main.js — 应用入口：启动恢复、事件绑定、键盘快捷键
'use strict';

/** 仅在可见练习面板、且键盘未被输入控件或弹层占用时响应。 */
function canUsePracticeShortcut(e) {
    if (currentMode === 'idle' || e.defaultPrevented || e.isComposing || e.keyCode === 229) return false;
    // Alt 导航交给 app-shell；其余组合键交给浏览器/输入控件。
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
    const isEditing = el => el && (el.isContentEditable ||
        (typeof el.closest === 'function' && el.closest('input, textarea, select, [role="textbox"]')));
    if (isEditing(e.target) || isEditing(document.activeElement)) return false;

    const isVisible = el => {
        if (!el || el.hidden || el.getClientRects().length === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
    };
    const panel = document.getElementById('view-practice');
    if (!panel || !panel.classList.contains('active') || !isVisible(panel)) return false;
    if (window.AppShell && typeof window.AppShell.getCurrentView === 'function' &&
        window.AppShell.getCurrentView() !== 'practice') return false;

    // 动态弹窗、常驻历史进度、题库/导入/格式说明及移动端遮罩。
    const layers = document.querySelectorAll('.modal-overlay, .progress-dialog-overlay, ' +
        '.bank-select-screen, .import-screen, .legal-overlay, .drawer-overlay.active, ' +
        'dialog[open], [aria-modal="true"]');
    return !Array.from(layers).some(isVisible);
}

document.addEventListener('keydown', function (e) {
    if (!canUsePracticeShortcut(e)) return;
    if (e.key === 'ArrowRight' || e.key === 'n') {
        e.preventDefault();
        const q = practiceQuestions[currentQuestionIndex];
        if (q && answeredMap[q.id]) nextQuestion();
    }
    if (e.key === 'ArrowLeft' || e.key === 'p') {
        e.preventDefault();
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderCurrentQuestion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) {
        const q = practiceQuestions[currentQuestionIndex];
        if (q && q.type !== 'matching' && !answeredMap[q.id] && num <= q.opts.length) {
            e.preventDefault();
            selectOption(q.id, num - 1, q.type);
        }
    }
});

/**
 * 首页点击“继续练习”快捷动作：记忆题库直达练习，未加载时从 localStorage 恢复或弹窗
 */
function resumeHomePractice() {
    const state = (window.getAppState && window.getAppState()) || {};
    if (state.allQuestions && state.allQuestions.length > 0) {
        if (window.AppShell && typeof window.AppShell.navigate === 'function') window.AppShell.navigate('practice');
        if (state.practiceQuestions && state.practiceQuestions.length > 0) {
            if (typeof renderCurrentQuestion === 'function') renderCurrentQuestion();
        } else if (typeof startPractice === 'function') {
            startPractice();
        }
        return;
    }
    // 尝试从 localStorage 恢复
    if (typeof loadFromLocalStorage === 'function') {
        const name = loadFromLocalStorage();
        if (name && Object.keys(questionBank).length > 0) {
            initAllQuestions();
            tabsIntroPending = true;
            renderSectionTabs();
            updateStats();
            const appTitle = document.getElementById('appTitle');
            if (appTitle) appTitle.textContent = name;
            if (window.AppShell && typeof window.AppShell.navigate === 'function') window.AppShell.navigate('practice');
            if (typeof startPractice === 'function') startPractice();
            return;
        }
    }
    // 未有题库，导航至练习页并弹出题库选择层
    if (window.AppShell && typeof window.AppShell.navigate === 'function') window.AppShell.navigate('practice');
    if (typeof showBankSelectScreen === 'function') showBankSelectScreen();
}
window.resumeHomePractice = resumeHomePractice;

window.addEventListener('load', () => {
    // 恢复主题与阈值设置
    const urlTheme = location.search.indexOf('theme=dark') !== -1 ? 'dark' : (location.search.indexOf('theme=light') !== -1 ? 'light' : null);
    const savedTheme = urlTheme || localStorage.getItem('quiz_theme');
    if (savedTheme) { currentTheme = savedTheme; }
    setTheme(currentTheme);
    const savedThreshold = parseInt(localStorage.getItem('quiz_settings_threshold'));
    if (savedThreshold) {
        removalThreshold = savedThreshold;
        const threshEl = document.getElementById('removeThreshold');
        if (threshEl) threshEl.value = savedThreshold;
    }

    // 尝试静默恢复最近会话（填充首页继续卡片与当前题库状态）
    if (typeof loadFromLocalStorage === 'function') {
        const loadedName = loadFromLocalStorage();
        if (loadedName && Object.keys(questionBank).length > 0) {
            initAllQuestions();
            tabsIntroPending = false;
            renderSectionTabs();
            updateStats();
            const appTitle = document.getElementById('appTitle');
            if (appTitle) appTitle.textContent = loadedName;
            const hName = document.getElementById('homeBankName');
            if (hName) hName.textContent = loadedName;
            const hCount = document.getElementById('homeBankCount');
            if (hCount) hCount.textContent = allQuestions.length + ' 题';
            const hText = document.getElementById('homeProgressText');
            if (hText) hText.textContent = `已就绪 · 共 ${allQuestions.length} 题`;
        }
    }

    if (!window.AppShell || window.AppShell.getCurrentView() === 'practice') {
        const state = (window.getAppState && window.getAppState()) || {};
        if (!state.allQuestions || state.allQuestions.length === 0) {
            showBankSelectScreen();
        }
    } else {
        loadBankList();
    }
});

window.addEventListener('beforeunload', () => {
    saveToLocalStorage();
});
