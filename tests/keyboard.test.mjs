import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../static/js/main.js', import.meta.url), 'utf8');
function element(options = {}) {
    return {
        hidden: false, active: true, display: 'block', visibility: 'visible', rects: [{}],
        isContentEditable: false, editing: false,
        classList: { contains: () => true },
        closest(selector) {
            assert.equal(selector, 'input, textarea, select, [role="textbox"]');
            return this.editing ? this : null;
        },
        getClientRects() { return this.rects; },
        ...options,
    };
}
function setup() {
    const listeners = {};
    const panel = element();
    const body = element();
    const calls = [];
    const env = { view: 'practice', panel, layers: [] };
    const document = {
        activeElement: body,
        addEventListener(name, fn) { listeners[name] = fn; },
        getElementById(id) { assert.equal(id, 'view-practice'); return env.panel; },
        querySelectorAll(selector) {
            // Check the actual app's layer protocols are all included.
            for (const layer of ['.modal-overlay', '.progress-dialog-overlay', '.bank-select-screen',
                '.import-screen', '.legal-overlay', '.drawer-overlay.active', 'dialog[open]', '[aria-modal="true"]']) {
                assert.ok(selector.includes(layer), layer);
            }
            return env.layers;
        },
    };
    const context = vm.createContext({
        document, currentMode: 'practice', currentQuestionIndex: 1,
        practiceQuestions: [{ id: 'q0', type: 'single', opts: ['a', 'b'] },
            { id: 'q1', type: 'single', opts: ['a', 'b'] }],
        answeredMap: {},
        nextQuestion: () => calls.push('next'),
        renderCurrentQuestion: () => calls.push('render'),
        selectOption: (...args) => calls.push(args),
        scrollTo: () => calls.push('scroll'),
        addEventListener() {},
        getComputedStyle: el => el,
        AppShell: { getCurrentView: () => env.view },
    });
    context.window = context;
    vm.runInContext(source, context, { filename: 'static/js/main.js' });
    return { context, document, calls, env, key(key, overrides = {}) {
        const event = { key, target: body, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }, ...overrides };
        listeners.keydown(event);
        return event;
    } };
}
function blocked(configure, overrides = {}) {
    for (const key of ['1', 'ArrowLeft', 'p', 'ArrowRight', 'n']) {
        const h = setup();
        h.context.answeredMap.q1 = 'correct';
        if (key === '1') delete h.context.answeredMap.q1;
        configure(h);
        const e = h.key(key, overrides);
        assert.deepEqual(h.calls, []);
        assert.equal(h.context.currentQuestionIndex, 1);
        assert.equal(e.defaultPrevented, !!overrides.defaultPrevented);
    }
}

test('input, textarea, select and textbox targets or focus do not trigger shortcuts', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'DIV']) {
        blocked(h => { h.document.activeElement = element({ tagName, editing: true }); });
        blocked(() => {}, { target: element({ tagName, editing: true }) });
    }
});
test('contenteditable including inherited editable children is ignored', () => {
    blocked(() => {}, { target: element({ isContentEditable: true }) });
    blocked(h => { h.document.activeElement = element({ isContentEditable: true }); });
});
test('all modifier keys, IME and already handled events are ignored', () => {
    for (const flag of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing', 'defaultPrevented']) {
        blocked(() => {}, { [flag]: true });
    }
    blocked(() => {}, { keyCode: 229 });
});
test('non-practice app routes cannot alter hidden practice state', () => {
    for (const view of ['home', 'banks', 'review', 'stats', 'settings', 'yuketang']) {
        blocked(h => { h.env.view = view; });
    }
});
test('missing, inactive or hidden practice panels are ignored even with practice route', () => {
    blocked(h => { h.env.panel = null; });
    blocked(h => { h.env.panel.classList.contains = () => false; });
    for (const options of [{ hidden: true }, { rects: [] }, { display: 'none' },
        { visibility: 'hidden' }, { visibility: 'collapse' }]) {
        blocked(h => Object.assign(h.env.panel, options));
    }
});
test('visible blocking layers suppress all shortcuts, including a later layer after a hidden one', () => {
    blocked(h => { h.env.layers = [element({ display: 'none', rects: [] }), element()]; });
});
test('hidden persistent layers do not disable legal number shortcuts', () => {
    const h = setup();
    h.env.layers = [element({ display: 'none', rects: [] }), element({ visibility: 'hidden' })];
    assert.equal(h.key('2').defaultPrevented, true);
    assert.deepEqual(h.calls, [['q1', 1, 'single']]);
});
test('number shortcuts retain multi-select and review-mode behavior; invalid choices do nothing', () => {
    const h = setup();
    h.context.currentMode = 'review';
    h.context.practiceQuestions[1].type = 'multi';
    assert.equal(h.key('1').defaultPrevented, true);
    assert.deepEqual(h.calls, [['q1', 0, 'multi']]);
    h.calls.length = 0;
    for (const key of ['0', '9', 'x']) assert.equal(h.key(key).defaultPrevented, false);
    h.context.practiceQuestions[1].type = 'matching';
    assert.equal(h.key('1').defaultPrevented, false);
    h.context.practiceQuestions[1].type = 'single';
    h.context.answeredMap.q1 = 'correct';
    assert.equal(h.key('1').defaultPrevented, false);
    assert.deepEqual(h.calls, []);
});
test('unmodified previous and next shortcuts retain their existing behavior', () => {
    for (const key of ['ArrowLeft', 'p']) {
        const h = setup();
        assert.equal(h.key(key).defaultPrevented, true);
        assert.equal(h.context.currentQuestionIndex, 0);
        assert.deepEqual(h.calls, ['render', 'scroll']);
    }
    for (const key of ['ArrowRight', 'n']) {
        const h = setup();
        h.key(key);
        assert.deepEqual(h.calls, []);
        h.context.answeredMap.q1 = 'correct';
        assert.equal(h.key(key).defaultPrevented, true);
        assert.deepEqual(h.calls, ['next']);
    }
});
test('idle mode is ignored', () => {
    blocked(h => { h.context.currentMode = 'idle'; });
});
