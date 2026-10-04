'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCodexTasks, summarize } = require('../../src/shared/taskSpeed');
const event = (timestamp, payload) => JSON.stringify({ timestamp, type: 'event_msg', payload });

test('one user task includes all model requests, ignores duplicate usage, and uses its real execution duration', () => {
  const usage = (output) => ({ type: 'token_count', info: {
    total_token_usage: { output_tokens: output },
    last_token_usage: { input_tokens: 10000, output_tokens: 20 }
  } });
  const tasks = parseCodexTasks([
    event('2026-10-04T10:00:00Z', usage(100)),
    event('2026-10-04T10:01:00Z', { type: 'task_started', turn_id: 'a' }),
    event('2026-10-04T10:01:00Z', { type: 'user_message', message: 'first task' }),
    event('2026-10-04T10:01:01Z', usage(120)),
    event('2026-10-04T10:01:02Z', usage(120)),
    event('2026-10-04T10:01:03Z', usage(140)),
    event('2026-10-04T10:01:04Z', { type: 'task_complete', turn_id: 'a', duration_ms: 4000 }),
    event('2026-10-04T12:00:00Z', { type: 'task_started', turn_id: 'b' }),
    event('2026-10-04T12:00:00Z', { type: 'user_message', message: 'second task' }),
    event('2026-10-04T12:00:02Z', usage(180)),
    event('2026-10-04T12:00:04Z', { type: 'task_complete', turn_id: 'b', duration_ms: 4000 })
  ].join('\n'));
  const result = summarize(tasks);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.outputTokens, 80);
  assert.equal(result.durationMs, 8000);
  assert.equal(result.speed, 10);
});

test('conversation averages use summed output and elapsed time rather than averaging speeds', () => {
  const result = summarize([
    { status: 'completed', outputTokens: 1000, durationMs: 10000, tokensAvailable: true },
    { status: 'completed', outputTokens: 1000, durationMs: 100000, tokensAvailable: true },
    { status: 'completed', outputTokens: 0, durationMs: 10000, tokensAvailable: false }
  ]);
  assert.equal(result.speed, 2000 / 110);
  assert.equal(result.measuredCount, 2);
  assert.equal(result.tasks[2].speed, null);
});

test('a running task reports elapsed execution time and does not include gaps between tasks', () => {
  const result = summarize([{ status: 'running', startedAt: 1000, outputTokens: 20, tokensAvailable: true }], 3000);
  assert.equal(result.tasks[0].speed, 10);
  assert.equal(result.speed, null);
  assert.equal(result.tasks[0].durationMs, 2000);
});
