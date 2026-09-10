// question-render.js — 当前题目的渲染（六种题型 + 右栏解析）
'use strict';

function renderCurrentQuestion() {
    if (practiceQuestions.length === 0) { finishPractice(); return; }
    if (currentQuestionIndex >= practiceQuestions.length) { finishPractice(); return; }
    const q = practiceQuestions[currentQuestionIndex];
    document.getElementById('progressText').textContent =
        `共 ${practiceQuestions.length} 题 | 第 ${currentQuestionIndex + 1}/${practiceQuestions.length} 题 | ${q.sectionLabel || ''}`;

    const [typeLabel, typeClass] = TYPE_MAP[q.type] || ['', ''];
    const answered = answeredMap[q.id];
    const isMulti = q.type === 'multi';
    const selectedAnswers = isMulti ? (answeredMap[q.id + '_selected'] || []) : [];

    let bodyHtml = '';
    let feedback = '';

    if (q.type === 'matching') {
        ({ bodyHtml, feedback } = renderMatching(q, answered));
    } else {
        ({ bodyHtml, feedback } = renderOptions(q, answered, isMulti, selectedAnswers));
    }

        const animClass = qAnimDir === 'next' ? 'anim-next' : (qAnimDir === 'prev' ? 'anim-prev' : '');
    qAnimDir = '';

    document.getElementById('questionsContainer').innerHTML = `
    <div class="question-card ${animClass} ${answered ? 'answered ' : ''}${answered === 'correct' ? 'correct' : (answered === 'wrong' ? 'wrong' : '')}">
      <div class="q-meta"><span class="q-type ${typeClass}">${typeLabel}</span><span class="q-number">#${currentQuestionIndex + 1}</span></div>
      <div class="q-text">${q.q}</div>
      ${bodyHtml}
      ${feedback}
      ${renderCardFooter(q, answered, isMulti)}
    </div>`;
    const card = document.querySelector('.question-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    refreshSidebar();
    updateNotePanel(q);
    updateProgressUI();
}

/** 顶部进度条联动 */
function updateProgressUI() {
    const fill = document.getElementById('progressFill');
    const header = document.querySelector('.header');
    if (!fill || !header) return;
    if (currentMode !== 'idle' && practiceQuestions.length > 0) {
        fill.style.width = ((currentQuestionIndex + 1) / practiceQuestions.length * 100) + '%';
        header.classList.add('practicing');
    } else {
        fill.style.width = '0%';
        header.classList.remove('practicing');
    }
}

/** 匹配题渲染 */
function renderMatching(q, answered) {
    const state = matchState[q.id] || { selectedLeft: null, selectedRight: null, pairs: [] };
    const leftLetters = 'abcdefghijklmnopqrstuvwxyz';
    const rightLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let leftHtml = '', rightHtml = '';

    q.left.forEach((item, idx) => {
        let cls = 'matching-item';
        if (answered) {
            const userPair = state.pairs.find(p => p[0] === idx);
            if (userPair) {
                const correctPair = q.ans.find(p => p[0] === idx);
                cls += (correctPair && correctPair[1] === userPair[1]) ? ' correct-pair' : ' wrong-pair';
            }
        } else {
            if (state.selectedLeft === idx) cls += ' selected';
            if (state.pairs.some(p => p[0] === idx)) cls += ' paired';
        }
        const click = answered ? '' : `onclick="selectMatchItem('left',${idx},'${q.id}')"`;
        leftHtml += `<div class="${cls}" ${click}>${leftLetters[idx]}. ${item}</div>`;
    });
    q.right.forEach((item, idx) => {
        let cls = 'matching-item';
        if (answered) {
            const userPair = state.pairs.find(p => p[1] === idx);
            if (userPair) {
                const correctPair = q.ans.find(p => p[1] === idx);
                cls += (correctPair && correctPair[0] === userPair[0]) ? ' correct-pair' : ' wrong-pair';
            }
        } else {
            if (state.selectedRight === idx) cls += ' selected';
            if (state.pairs.some(p => p[1] === idx)) cls += ' paired';
        }
        const click = answered ? '' : `onclick="selectMatchItem('right',${idx},'${q.id}')"`;
        rightHtml += `<div class="${cls}" ${click}>${rightLetters[idx]}. ${item}</div>`;
    });

    let bodyHtml = `<div class="matching-container${answered ? ' answered' : ''}"><div class="matching-left">${leftHtml}</div><div class="matching-right">${rightHtml}</div></div>`;
    if (!answered && state.pairs.length === q.left.length) {
        bodyHtml += `<div class="matching-submit"><button class="btn btn-success btn-sm" onclick="submitMatching('${q.id}')">确认配对</button></div>`;
    }
    let feedback = '';
    if (answered) {
        const correct = answered === 'correct';
        feedback = `<div class="feedback show ${correct ? 'correct-fb' : 'wrong-fb'}">${correct ? '✅ 全部正确！' : '❌ 存在错误配对。'}</div>`;
    }
    return { bodyHtml, feedback };
}

/** 选项题渲染（single/multi/judge/TF/en_single） */
function renderOptions(q, answered, isMulti, selectedAnswers) {
    let optHtml = '';
    q.opts.forEach((opt, idx) => {
        let cls = '';
        if (answered) {
            const correct = Array.isArray(q.ans) ? q.ans : [q.ans];
            if (correct.includes(idx)) cls += ' correct-answer';
            if (isMulti && selectedAnswers.includes(idx) && !correct.includes(idx)) cls += ' wrong-answer';
            if (!isMulti && idx === answeredMap[q.id + '_chosen'] && idx !== q.ans) cls += ' wrong-answer';
        } else {
            if (isMulti && selectedAnswers.includes(idx)) cls += ' selected';
            else if (!isMulti && answeredMap[q.id + '_chosen'] === idx) cls += ' selected';
        }
        const letter = String.fromCharCode(65 + idx);
        const click = answered ? '' : `onclick="selectOption('${q.id}',${idx},'${q.type}')"`;
        const icon = answered ? renderResultIcon(q, idx, isMulti, selectedAnswers) : '';
        optHtml += `<li class="option-item ${cls}" ${click}><span class="option-letter">${letter}</span><span>${opt}</span>${icon}</li>`;
    });
    const bodyHtml = `<ul class="options-list">${optHtml}</ul>`;

    let feedback = '';
    if (answered) {
        const correct = answered === 'correct';
        const ansText = isMulti
            ? (Array.isArray(q.ans) ? q.ans.map(a => String.fromCharCode(65 + a)).join('、') : String.fromCharCode(65 + q.ans))
            : String.fromCharCode(65 + q.ans);
        feedback = `<div class="feedback show ${correct ? 'correct-fb' : 'wrong-fb'}">${correct ? '✅ 回答正确！' : '❌ 回答错误。'} ${!correct ? `<span class="correct-answer-text">正确答案：${ansText}</span>` : ''}</div>`;
    }
    return { bodyHtml, feedback };
}

/** 已作答选项右侧的 ✅/❌ 图标 */
function renderResultIcon(q, idx, isMulti, selectedAnswers) {
    if (isMulti) {
        if (Array.isArray(q.ans) && q.ans.includes(idx)) return '<span class="result-icon">✅</span>';
        if (selectedAnswers.includes(idx)) return '<span class="result-icon">❌</span>';
        return '';
    }
    if (idx === q.ans) return '<span class="result-icon">✅</span>';
    if (answeredMap[q.id + '_chosen'] === idx) return '<span class="result-icon">❌</span>';
    return '';
}

/** 题库是否带解析内容（解析/速记/翻译） */
function hasNoteContent(q) {
    return !!(q && (q.analysis || q.memo || q.q_trans));
}

/** 卡片底部：导航按钮或（多选题）提交按钮；已作答且题库带解析时出现展开箭头 */
function renderCardFooter(q, answered, isMulti) {
    if (answered) {
        const prevBtn = currentQuestionIndex > 0
            ? '<button class="btn btn-outline btn-sm" onclick="prevQuestion()">⬅️ 上一题</button>'
            : '<span></span>';
        const noteBtn = hasNoteContent(q)
            ? '<button class="btn btn-outline btn-sm note-trigger' + (noteOpen ? ' open' : '')
            + '" onclick="toggleNotePanel()">📄 解析<span class="nt-icon">❯</span></button>'
            : '';
        return '<div class="card-nav">'
            + prevBtn
            + '<div class="card-nav-right">' + noteBtn
            + '<button class="btn btn-primary btn-sm" onclick="nextQuestion()">下一题 ➡️</button></div></div>';
    }
    if (isMulti) {
        return '<div class="multi-submit">'
            + `<button class="btn btn-success btn-sm" onclick="submitMulti('${q.id}')">确认提交</button></div>`;
    }
    return '';
}

/** 解析面板：题目右侧滑出；答错自动展开，答对手动点箭头（spec D6/D7 演进版） */
let noteOpen = false;
let notePanelFor = '';
let noteAutoDone = '';

function updateNotePanel(q) {
    const panel = document.getElementById('notePanel');
    if (!panel) return;
    if (q && notePanelFor !== q.id) { noteOpen = false; notePanelFor = q.id; noteAutoDone = ''; }
    const hasContent = q && hasNoteContent(q) && answeredMap[q.id];
    if (!hasContent) {
        hideNotePanel();
        syncNoteTrigger();
        return;
    }
    if (answeredMap[q.id] === 'wrong' && noteAutoDone !== q.id) {
        noteOpen = true;
        noteAutoDone = q.id;
    }
    panel.innerHTML =
        '<div class="np-title">📝 解析</div>' +
        (q.analysis ? `<div class="np-section"><span class="label">💡 解析</span>${q.analysis}</div>` : '') +
        (q.memo ? `<div class="np-section"><span class="label">🎯 速记</span>${q.memo}</div>` : '') +
        (q.q_trans ? `<div class="np-section"><span class="label">📝 翻译</span>${q.q_trans}</div>` : '') +
        `<button class="btn btn-outline btn-sm np-btn" onclick="toggleNotePanel()">${noteOpen ? '收起 ▲' : '📄 查看解析'}</button>`;
    panel.classList.toggle('show', noteOpen);
    syncNoteTrigger();
}

function toggleNotePanel() {
    noteOpen = !noteOpen;
    const q = practiceQuestions[currentQuestionIndex];
    if (q) updateNotePanel(q);
}

/** 收起并清空解析面板（切分类 / 重新开始时调用） */
function hideNotePanel() {
    noteOpen = false;
    const panel = document.getElementById('notePanel');
    if (panel) { panel.classList.remove('show'); panel.innerHTML = ''; }
}

/** 同步卡片底部箭头方向（开→◀ 收起，关→▶ 展开） */
function syncNoteTrigger() {
    const btn = document.querySelector('.question-card .note-trigger');
    if (btn) btn.classList.toggle('open', noteOpen);
}
