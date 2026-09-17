import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('persistent progress overlay has its own class and layout', () => {
    const template = source('templates/index.html');
    const tag = template.match(/<div\b[^>]*id="progressOverlay"[^>]*>/)?.[0];
    assert.ok(tag);
    const classes = tag.match(/class="([^"]*)"/)[1].split(/\s+/);
    assert.ok(classes.includes('progress-dialog-overlay'));
    assert.ok(!classes.includes('modal-overlay'));
    assert.match(source('static/css/components.css'), /\.progress-dialog-overlay\s*\{[^}]*position:\s*fixed/s);
});

test('generic modal replacement and close leave persistent progress overlay untouched', () => {
    const nodes = [];
    function node(classes) {
        const n = {
            classes: new Set(classes),
            classList: { contains: name => n.classes.has(name), add: name => n.classes.add(name) },
            remove() { const i = nodes.indexOf(n); if (i >= 0) nodes.splice(i, 1); },
            closest(selector) { return selector === '.modal-overlay' && n.classes.has('modal-overlay') ? n : null; },
        };
        n.parentNode = { removeChild(child) { child.remove(); } };
        return n;
    }
    const progress = node(['progress-dialog-overlay']);
    nodes.push(progress);
    const body = { appendChild: n => nodes.push(n) };
    const c = vm.createContext({
        document: {
            body, activeElement: null,
            querySelector(selector) {
                assert.equal(selector, '.modal-overlay:not(.progress-dialog-overlay)');
                return nodes.find(n => n.classes.has('modal-overlay') && !n.classes.has('progress-dialog-overlay')) || null;
            },
            createElement() { return { firstElementChild: node(['modal-overlay']) }; },
        },
        setTimeout: fn => fn(),
    });
    c.window = c;
    vm.runInContext(source('static/js/ui.js'), c);
    c.showModal('First', 'body');
    const first = nodes[1];
    c.showModal('Second', 'body');
    assert.ok(!nodes.includes(first));
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0], progress);
    c.closeModal();
    assert.deepEqual(nodes, [progress]);
    c.closeModal(progress);
    assert.deepEqual(nodes, [progress]);
});

test('other dynamic cleanup paths explicitly exclude persistent overlay', () => {
    for (const file of ['static/js/stats.js', 'static/js/practice.js']) {
        const text = source(file);
        assert.ok(text.includes("querySelector('.modal-overlay:not(.progress-dialog-overlay)')"));
        assert.ok(!text.includes("querySelector('.modal-overlay')"));
    }
});
