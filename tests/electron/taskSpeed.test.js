'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute() {}
    addEventListener() {}
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  }
  const document = { activeElement: null, createElement: tag => new Element(tag) };
  const window = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/electron/renderer/taskSpeed'), 'utf8'), {
    window, document, setTimeout: () => 1, clearTimeout() {}
  });
  const container = new Element('div');
  const text = node => [node.textContent || '', ...node.children.map(text)].join(' ');
  return { create: options => window.TokenMonitorTaskSpeed.createPanel({ container,
    visible: () => true, t: key => key, formatTokens: String, ...options }), text: () => text(container) };
}

test('a new task panel with no sessions displays empty instead of loading', async () => {
  const { create, text } = harness();
  let calls = 0;
  const panel = create({ getSessions: () => [], fetchStats: async () => { calls++; } });
  panel.render();
  await panel.refresh(true);
  assert.match(text(), /detailEmpty/);
  assert.doesNotMatch(text(), /detailLoading/);
  assert.equal(calls, 0);
});

test('an empty session snapshot preserves a previously loaded result', async () => {
  const { create, text } = harness();
  let sessions = [{ key: 'codex:fixture' }];
  const panel = create({ getSessions: () => sessions,
    fetchStats: async () => ({ sessions: [{ key: 'codex:fixture', client: 'codex', title: 'saved result',
      speed: 25, tasks: [], measuredCount: 1, taskCount: 1, outputTokens: 50, durationMs: 2000 }] }) });
  await panel.refresh(true);
  const loaded = text();
  assert.match(loaded, /25 tok\/s/);
  sessions = [];
  await panel.refresh(true);
  assert.equal(text(), loaded);
});
