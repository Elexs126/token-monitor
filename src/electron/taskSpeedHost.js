'use strict';
const { Worker } = require('node:worker_threads');
let worker;
let sequence = 0;
const pending = new Map();

function readTaskSpeedStats(args) {
  if (!worker) {
    worker = new Worker(require.resolve('../shared/taskSpeedWorker'));
    worker.unref();
    worker.on('message', ({ id, result, error }) => {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      clearTimeout(request.timer);
      if (error) request.reject(new Error(error)); else request.resolve(result);
    });
    worker.on('error', error => {
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
      pending.clear();
      worker = null;
    });
    worker.on('exit', () => {
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Task reader stopped')); }
      pending.clear();
      worker = null;
    });
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Task speed data timed out'));
    }, 60000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, args });
  });
}
module.exports = { readTaskSpeedStats };
