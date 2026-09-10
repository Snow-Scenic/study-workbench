// main.js — 应用入口：启动恢复、事件绑定、键盘快捷键
'use strict';

document.addEventListener('keydown', function (e) {
    if (currentMode === 'idle') return;
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

window.addEventListener('load', () => {
    // 恢复主题与阈值设置（进度恢复改为选题库后弹窗抉择，见 bank-select.js）
    const savedTheme = localStorage.getItem('quiz_theme');
    if (savedTheme) { currentTheme = savedTheme; }
    setTheme(currentTheme);
    const savedThreshold = parseInt(localStorage.getItem('quiz_settings_threshold'));
    if (savedThreshold) { removalThreshold = savedThreshold; document.getElementById('removeThreshold').value = savedThreshold; }

    showBankSelectScreen();
});

window.addEventListener('beforeunload', () => {
    saveToLocalStorage();
});
