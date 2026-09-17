import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const plain = value => JSON.parse(JSON.stringify(value));
function setup({ store = new Map(), answeredMap = {}, questionStatus = {}, answeredIds = [],
    totalStats = { totalAnswered: 0, totalCorrect: 0 }, wrongRecords = {} } = {}) {
    const elements = new Map();
    const c = vm.createContext({
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', value: '', innerHTML: '', classList: { remove() {}, toggle() {} } });
                return elements.get(id);
            },
            querySelector: () => null, querySelectorAll: () => [],
            body: { appendChild() {}, insertAdjacentHTML() {} }, activeElement: null,
        },
        localStorage: { getItem: () => null, setItem: () => {} },
        alert() {}, confirm: () => true, scrollTo() {}, shuffleArray: arr => [...arr],
    });
    c.window = c;
    for (const file of ['state.js', 'storage.js', 'bank-loader.js', 'practice.js', 'question-render.js', 'stats.js']) {
        vm.runInContext(readFileSync(new URL(`../static/js/${file}`, import.meta.url), 'utf8'), c);
    }
    c.realUpdateStats = c.updateStats;
    c.updateStats = () => {};
    c.updateProgressUI = () => {};
    c.updateWrongCount = () => {};
    c.renderSectionTabs = () => {};
    c.renderStatsTable = () => {};
    c.renderCurrentQuestion = () => {};
    c.cleanupWrongRecords = () => {};
    c.console = { warn() {}, error() {} };
    c.AppShell = { navigate: view => c._navigated = view };
    Object.assign(c, { answeredMap, questionStatus, totalStats });
    c.answeredIds = new Set(answeredIds);
    c.wrongRecords = wrongRecords;
    c.practiceQuestions = [{ id: 'math:1', type: 'single', q: 'Q1', opts: ['a', 'b'] },
        { id: 'math:2', type: 'single', q: 'Q2', opts: ['a', 'b'] }];
    c.allQuestions = [...c.practiceQuestions];
    return { c, elements };
}
function answer(c, id, correct) {
    c.finishAnswer(id, correct);
}

test('M6: threshold entry clamps values, synchronizes controls and persists', () => {
    const { c, elements } = setup();
    const writes = new Map();
    c.localStorage.setItem = (key, value) => writes.set(key, String(value));
    for (const [input, expected] of [['7', 7], ['-1', 1], ['99', 10], ['invalid', 3]]) {
        assert.equal(c.setThresholdValue(input), expected);
        assert.equal(c.removalThreshold, expected);
        assert.equal(Number(elements.get('removeThreshold').value), expected);
        assert.equal(Number(elements.get('thresholdInput').value), expected);
        assert.equal(writes.get('quiz_settings_threshold'), String(expected));
    }
    const html = readFileSync(new URL('../templates/index.html', import.meta.url), 'utf8');
    assert.match(html, /id="removeThreshold"[^>]*onchange="setThresholdValue\(this.value\)"/);
});

test('bank statistics and settings render even when removalThreshold is undeclared', () => {
    const c = vm.createContext({ currentBankName: '示例题库' });
    c.window = c;
    c.showModal = (_title, html) => { c.modalHTML = html; };
    vm.runInContext(readFileSync(new URL('../static/js/stats.js', import.meta.url), 'utf8'), c);
    assert.equal(vm.runInContext('typeof removalThreshold', c), 'undefined');
    assert.match(c.getStatsDashboardHTML(false), /3 次/);
    c.setThreshold();
    assert.match(c.modalHTML, /value="3"/);
    for (const [value, expected] of [[7, 7], ['invalid', 3], [99, 10], [0, 1]]) {
        c.removalThreshold = value;
        assert.match(c.getStatsDashboardHTML(false), new RegExp(`${expected} 次`));
        c.setThreshold();
        assert.match(c.modalHTML, new RegExp(`value="${expected}"`));
    }
});

test('M5: repeated correct answers are idempotent', () => {
    const { c } = setup();
    for (let i = 0; i < 5; i++) answer(c, 'math:1', true);
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 1, totalCorrect: 1 });
    assert.equal(c.questionStatus['math:1'], 'correct');
});

test('M5: correct-then-wrong keeps totals consistent with current statuses', () => {
    const { c } = setup();
    answer(c, 'math:1', true);
    answer(c, 'math:1', false);
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 1, totalCorrect: 0 });
    answer(c, 'math:1', true);
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 1, totalCorrect: 1 });
    // 不满足单调正确率；但统计必须和“当前掌握状态”一致：正确 1 / 已答 1。
    assert.equal(c.totalStats.totalCorrect / c.totalStats.totalAnswered, 1);
});

test('M5: cross-session answered ids keep totals deduplicated', () => {
    const { c } = setup({ answeredIds: ['math:1'], questionStatus: { 'math:1': 'wrong' },
        totalStats: { totalAnswered: 1, totalCorrect: 0 } });
    answer(c, 'math:1', true);
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 1, totalCorrect: 1 });
    answer(c, 'math:1', true);
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 1, totalCorrect: 1 });
});

test('L1: session stats key on result values, not id underscores', () => {
    const { c } = setup({ answeredMap: { 'math:1': 'correct', 'math:1_selected': [0, 1],
        'math:1_chosen': 1, 'math:2': 'wrong', 'review_2': 'correct' } });
    const el = { style: {}, textContent: '', value: '', innerHTML: '', classList: { remove() {}, toggle() {} } };
    c.document.getElementById = id => id === 'homeProgressFill' ? null : el;
    // 恢复真实 updateStats：setup 的桩会掩盖统计实现。
    c.updateStats = c.realUpdateStats;
    c.updateStats();
    assert.equal(c.sessionAnswered, 3);
    assert.equal(c.sessionWrong, 1);
    assert.equal(c.window.sessionAnswered, 3);
});

test('L2: storage failure inside finishAnswer does not abort grading', () => {
    const { c } = setup();
    c.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    let warned = '';
    c.console.warn = msg => { warned += msg; };
    answer(c, 'math:1', false);
    assert.equal(c.answeredMap['math:1'], 'wrong');
    assert.deepEqual(plain(c.wrongRecords), { 'math:1': { wrongCount: 1, consecutiveCorrect: 0 } });
    assert.ok(warned.includes('存储'));
    c.finishAnswer('math:1', true);
    assert.equal(c.questionStatus['math:1'], 'correct');
});

test('M7: starting a round clears stale matching pairs but page turns keep them', () => {
    const { c } = setup();
    c.matchState['math:1'] = { pairs: [[0, 0]] };
    c.startPractice();
    assert.deepEqual(plain(c.matchState), {});
    c.matchState['math:2'] = { pairs: [[0, 0]] };
    c.currentQuestionIndex = 1;
    c.renderCurrentQuestion();
    assert.deepEqual(plain(c.matchState), { 'math:2': { pairs: [[0, 0]] } });
});

test('M8: filtered review opens the practice view', () => {
    const { c } = setup();
    c.wrongRecords['math:1'] = { wrongCount: 2, consecutiveCorrect: 0 };
    c._fixtures = { cb: { checked: true }, cards: [] };
    vm.runInContext('_fixtures', c);
    // 桩掉弹窗查询与关闭，聚焦视图导航行为。
    c.document.getElementById = id => id === 'cb-all-wrong' ? c._fixtures.cb : null;
    c.document.querySelectorAll = () => [];
    c.closeModal = () => {};
    c.startFilteredReview();
    assert.equal(c._navigated, 'practice');
    assert.equal(c.currentMode, 'review');
    assert.equal(c.practiceQuestions.length, 1);
});

test('L3: finish page counts correct, wrong and unanswered separately; empty queue has no NaN', () => {
    const { c, elements } = setup();
    c.currentQuestionIndex = 0;
    c.answeredMap = { 'math:1': 'correct' }; // math:2 未答
    c.finishPractice();
    let html = elements.get('questionsContainer').innerHTML;
    assert.ok(html.includes('正确 <strong') && html.includes('>1<'));
    assert.ok(html.includes('错误') && html.includes('未答'));
    assert.ok(!html.includes('NaN'));
    c.practiceQuestions = [];
    c.finishPractice();
    html = elements.get('questionsContainer').innerHTML;
    assert.ok(html.includes('本轮没有题目') || html.includes('空队列'), html);
    assert.ok(!html.includes('NaN'));
});
