import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
    const elements = new Map();
    const store = new Map();
    const c = vm.createContext({
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, { style: {}, classList: { remove() {}, toggle() {} } });
                return elements.get(id);
            },
            querySelector() { return null; },
        },
        localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
        confirm: () => true,
        scrollTo() {},
    });
    c.window = c;
    for (const file of ['state.js', 'storage.js', 'bank-loader.js', 'practice.js', 'question-render.js', 'bank-select.js']) {
        vm.runInContext(readFileSync(new URL(`../static/js/${file}`, import.meta.url), 'utf8'), c);
    }
    for (const name of ['updateStats', 'renderSectionTabs', 'updateProgressUI']) c[name] = () => {};
    c.questionBank = { old: { label: 'Old', questions: [{ id: 'same', type: 'single', q: 'Old?', opts: ['yes'], ans: 0 }] } };
    c.currentBankName = 'Old';
    c.initAllQuestions();
    c.practiceQuestions = [...c.allQuestions];
    c.currentSection = 'old';
    c.currentMode = 'practice';
    c.currentQuestionIndex = 5;
    c.answeredMap = { same: 'wrong' };
    c.answeredIds.add('same');
    c.matchState = { same: { pairs: [[0, 0]] } };
    c.questionStatus = { same: 'wrong' };
    c.wrongRecords = { same: { wrongCount: 1 } };
    c.totalStats = { totalAnswered: 8, totalCorrect: 4 };
    c.sessionAnswered = 4;
    c.sessionWrong = 2;
    c.qAnimDir = 'next';
    return { c, store, elements };
}
const newBank = () => ({ fresh: { label: 'New', questions: [{ id: 'same', type: 'single', q: 'New?', opts: ['yes'], ans: 0 }] } });

test('replacement clears old queue, classifications, coverage and answer state before saving', () => {
    const { c, store } = setup();
    c.applyValidatedBank(newBank(), 'replace');
    assert.equal(c.currentSection, 'all');
    assert.equal(c.currentMode, 'idle');
    assert.equal(c.currentQuestionIndex, 0);
    for (const name of ['practiceQuestions', 'allQuestions']) assert.equal(c[name].length, 0);
    for (const name of ['answeredMap', 'questionStatus', 'matchState', 'wrongRecords']) assert.deepEqual(plain(c[name]), {});
    assert.equal(c.answeredIds.size, 0);
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 0, totalCorrect: 0 });
    assert.equal(c.sessionAnswered, 0);
    assert.equal(c.sessionWrong, 0);
    assert.equal(c.qAnimDir, '');
    c.afterBankLoaded('New', 1);
    assert.equal(c.allQuestions[0].q, 'New?');
    assert.equal(store.get('quiz_bankName'), 'New');
    assert.equal(JSON.parse(store.get('quiz_questionBank')).fresh.questions[0].q, 'New?');
    assert.equal(store.get('quiz_questionStatus'), '{}');
});

test('progress inspection is read-only even with a different stored bank', () => {
    const { c, store } = setup();
    store.set('quiz_bankName', 'New');
    store.set('quiz_questionStatus', '{"new":"correct"}');
    const previous = c.questionStatus;
    assert.deepEqual(plain(c.loadProgressOnly().questionStatus), { new: 'correct' });
    assert.equal(c.questionStatus, previous);
});

test('continue restores target progress after reset, before persistence', () => {
    const { c, store } = setup();
    store.set('quiz_bankName', 'New');
    store.set('quiz_questionStatus', '{"same":"correct"}');
    store.set('quiz_answeredIds', '["same"]');
    store.set('quiz_totalStats', '{"totalAnswered":1,"totalCorrect":1}');
    c.pendingFixture = { validated: newBank(), name: 'New', totalQ: 1 };
    vm.runInContext('_pendingBank = pendingFixture', c);
    c.startPractice = () => {};
    c.continueWithProgress();
    assert.deepEqual(plain(c.questionStatus), { same: 'correct' });
    assert.equal(c.answeredIds.has('same'), true);
    assert.equal(c.currentSection, 'all');
    assert.equal(store.get('quiz_questionStatus'), '{"same":"correct"}');
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 1, totalCorrect: 1 });
});

test('start from scratch does not carry statistics from the active bank', () => {
    const { c, store } = setup();
    c.pendingFixture = { validated: newBank(), name: 'New', totalQ: 1 };
    vm.runInContext('_pendingBank = pendingFixture', c);
    c.startPractice = () => {};
    c.startFromScratch();
    assert.deepEqual(plain(c.totalStats), { totalAnswered: 0, totalCorrect: 0 });
    assert.equal(store.get('quiz_questionStatus'), '{}');
});

test('new round resets coverage and matching state but retains bank, wrong book and lifetime statistics', () => {
    const { c, store } = setup();
    const bank = c.questionBank, wrong = c.wrongRecords, totals = c.totalStats;
    c.startNewRound();
    assert.equal(c.questionBank, bank);
    assert.equal(c.wrongRecords, wrong);
    assert.equal(c.totalStats, totals);
    assert.equal(c.currentMode, 'idle');
    assert.equal(c.practiceQuestions.length, 0);
    assert.equal(c.answeredIds.size, 0);
    assert.deepEqual(plain(c.matchState), {});
    assert.deepEqual(plain(c.answeredMap), {});
    assert.deepEqual(plain(c.questionStatus), {});
    assert.equal(store.get('quiz_questionStatus'), '{}');
});

test('merge retains existing answer state', () => {
    const { c } = setup();
    const status = c.questionStatus;
    c.applyValidatedBank({ fresh: { label: 'New', questions: [{ id: 'unique' }] } }, 'merge');
    assert.equal(c.questionStatus, status);
    assert.equal(c.answeredIds.has('same'), true);
});

test('note auto-open marker resets when banks reuse an id', () => {
    const { c, elements } = setup();
    vm.runInContext("noteAutoDone = 'same'; notePanelFor = 'same'; noteOpen = true;", c);
    c.resetAnswerState();
    c.answeredMap.same = 'wrong';
    c.updateNotePanel({ id: 'same', analysis: 'new explanation' });
    assert.equal(vm.runInContext('noteOpen', c), true);
    assert.ok(elements.get('notePanel').innerHTML.includes('new explanation'));
});

test('question rendering falls back safely when the WebView global type map is unavailable', () => {
    const { c, elements } = setup();
    c.TYPE_MAP = undefined;
    c.refreshSidebar = () => {};
    c.practiceQuestions = [{
        id: 'scope-safe', type: 'single', q: 'Scope safe?',
        opts: ['yes', 'no'], ans: 0, sectionLabel: 'Runtime'
    }];
    c.currentQuestionIndex = 0;
    c.currentMode = 'practice';
    c.renderCurrentQuestion();
    const html = elements.get('questionsContainer').innerHTML;
    assert.ok(html.includes('单选题'));
    assert.ok(html.includes('Scope safe?'));
});
