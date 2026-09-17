import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source = name => readFileSync(new URL(`../static/js/${name}`, import.meta.url), 'utf8');
test('merge deduplicates old IDs and IDs repeated across newly added categories', () => {
    const c = vm.createContext({ alert() {} }); c.window = c;
    vm.runInContext(source('bank-loader.js'), c);
    c.questionBank = { old: { label: 'Old', questions: [{ id: 'a' }] } };
    c.applyValidatedBank({
        first: { label: 'First', questions: [{ id: 'a' }, { id: 'b' }] },
        second: { label: 'Second', questions: [{ id: 'b' }, { id: 'c' }] },
    }, 'merge');
    assert.deepEqual(Array.from(Object.values(c.questionBank).flatMap(cat => cat.questions.map(q => q.id))), ['a', 'b', 'c']);
});
test('template has import cancellation and a single maximize binding', () => {
    const html = readFileSync(new URL('../templates/index.html', import.meta.url), 'utf8');
    assert.match(html, /onclick="hideImportScreen\(\)">取消导入/);
    assert.doesNotMatch(html.match(/<header class="topbar"[^>]*>/)[0], /ondblclick/);
    assert.match(source('app-shell.js'), /addEventListener\('dblclick'/);
});
const bank = { meta: { name: 'Imported' }, categories: { s: { label: 'Section', questions: [
    { id: 'q1', type: 'single', q: 'Question', opts: ['A'], ans: 0 },
] } } };
test('duplicate IDs through import are rejected clearly without replacing the current bank', () => {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { style: {}, textContent: '' });
        return elements.get(id);
    };
    element('importFile').files = [{}];
    const duplicateBank = structuredClone(bank);
    duplicateBank.categories.second = { label: 'Second', questions: [structuredClone(bank.categories.s.questions[0])] };
    let started = false, archived = false;
    const c = vm.createContext({
        document: { getElementById: element },
        FileReader: class { readAsText() { this.onload({ target: { result: JSON.stringify(duplicateBank) } }); } },
        startPractice: () => { started = true; },
        fetch: () => { archived = true; return Promise.resolve({ ok: true }); },
    });
    c.window = c;
    for (const file of ['state.js', 'bank-loader.js', 'import-ui.js']) vm.runInContext(source(file), c);
    const original = { old: { label: 'Old', questions: [] } };
    c.questionBank = original;
    c.handleImport();
    assert.equal(element('importError').style.display, 'block');
    assert.match(element('importError').textContent, /ID 重复：q1/);
    assert.equal(c.questionBank, original);
    assert.equal(started, false);
    assert.equal(archived, false);
});

test('manual import starts practice after load finalization even on same route', () => {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { style: {}, classList: { remove() {} }, innerHTML: '' });
        return elements.get(id);
    };
    element('importFile').files = [{}];
    const c = vm.createContext({
        document: { getElementById: element },
        FileReader: class { readAsText() { this.onload({ target: { result: JSON.stringify(bank) } }); } },
        saveToLocalStorage() {},
        fetch: () => Promise.resolve({ ok: true }),
    });
    c.window = c;
    for (const file of ['state.js', 'bank-loader.js', 'import-ui.js']) vm.runInContext(source(file), c);
    let started = 0;
    c.AppShell = { navigate: () => {} }; // same route: no lifecycle hook
    c.startPractice = () => { started++; element('questionsContainer').innerHTML = 'QUESTION CARD'; };
    c.handleImport();
    assert.equal(started, 1);
    assert.equal(element('questionsContainer').innerHTML, 'QUESTION CARD');
    assert.equal(c.currentBankName, 'Imported');
    assert.equal(c.allQuestions.length, 1);
});
