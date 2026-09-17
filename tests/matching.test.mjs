import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function loadMatching() {
    const context = vm.createContext({
        answeredMap: {}, matchState: {}, practiceQuestions: [],
    });
    context.window = context;
    for (const file of ['matching.js', 'question-render.js']) {
        vm.runInContext(readFileSync(new URL(`../static/js/${file}`, import.meta.url), 'utf8'), context);
    }
    // Keep these tests independent of DOM layout and statistics persistence.
    context.renderCurrentQuestion = () => {};
    context.finishAnswer = (id, correct) => {
        context.answeredMap[id] = correct ? 'correct' : 'wrong';
    };
    return context;
}

// Standalone validator and normal script order share one validation implementation.
for (const validatorFile of ['bank-loader.js', 'state.js + bank-loader.js']) {
    test(`import validation: ${validatorFile}`, () => {
        const c = vm.createContext({});
        c.window = c;
        for (const file of validatorFile.split(' + ')) {
            vm.runInContext(readFileSync(new URL(`../static/js/${file}`, import.meta.url), 'utf8'), c);
        }
        const validate = ans => c.validateBankData({
            meta: { name: 'Matching' }, categories: { m: { label: 'Matching', questions: [
                { id: 'm1', type: 'matching', q: 'Pair', left: ['a', 'b'], right: ['A', 'B'], ans },
            ] } },
        });
        for (const ans of [[1, 0], [[0, 1], [1, 0]]]) assert.equal(validate(ans).totalQ, 1);
        for (const ans of [[-1, 0], [2, 0], ['1', 0], [0.5, 0], [0], [[0, 2], [1, 0]], [[-1, 0]], [[0, '1']]]) {
            assert.ok(validate(ans).error, JSON.stringify(ans));
        }
    });
}

const plain = value => JSON.parse(JSON.stringify(value));
for (const [name, input, expected] of [
    ['demo 1D', [1, 2, 0], [[0, 1], [1, 2], [2, 0]]],
    ['template 1D', [0, 1], [[0, 0], [1, 1]]],
    ['two left indices targeting zero', [0, 0], [[0, 0], [1, 0]]],
    ['single 2D pair', [[0, 0]], [[0, 0]]],
    ['multiple 2D pairs', [[0, 0], [1, 1]], [[0, 0], [1, 1]]],
    ['empty', [], []],
]) {
    test(`normalization: ${name}`, () => {
        const c = loadMatching();
        const before = plain(input);
        assert.deepEqual(plain(c.normalizeMatchingAns(input)), expected);
        assert.deepEqual(input, before);
    });
}

for (const ans of [[1, 0], [[0, 1], [1, 0]]]) {
    for (const correct of [true, false]) {
        test(`${Array.isArray(ans[0]) ? '2D' : '1D'} grading and rendering: ${correct ? 'correct' : 'wrong'}`, () => {
            const c = loadMatching();
            const q = { id: 'match-test', type: 'matching', left: ['a', 'b'], right: ['A', 'B'], ans };
            c.practiceQuestions = [q];
            // Reverse insertion order also exercises order-independent grading.
            const pairs = correct ? [[1, 0], [0, 1]] : [[1, 1], [0, 0]];
            c.matchState[q.id] = { selectedLeft: null, selectedRight: null, pairs };
            c.submitMatching(q.id);
            const result = correct ? 'correct' : 'wrong';
            assert.equal(c.answeredMap[q.id], result);
            assert.deepEqual(c.matchState[q.id].pairs, pairs);
            const { bodyHtml } = c.renderMatching(q, result);
            assert.equal((bodyHtml.match(new RegExp(` ${result}-pair`, 'g')) || []).length, 4);
            assert.ok(!bodyHtml.includes(correct ? 'wrong-pair' : 'correct-pair'));
            assert.ok(!bodyHtml.includes('onclick='));
        });
    }
}
