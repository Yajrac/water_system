import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/auth/auth.js', import.meta.url), 'utf8');
const coordinator = source.slice(source.indexOf('let initialRequests ='), source.indexOf('// Keep navigation visible'));

test('one initial skeleton spans session and chained page requests, then stays gone on refresh', async () => {
  const events = {};
  const pending = [];
  const timers = new Map();
  let timerId = 0;
  let revealed = 0;
  const context = vm.createContext({
    AdminAPI: { request: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
    document: {
      readyState: 'loading',
      addEventListener: (name, handler) => { events[name] = handler; },
      documentElement: { classList: { remove: () => { revealed++; } } },
    },
    setTimeout: (handler) => { timers.set(++timerId, handler); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(coordinator, context);
  const flush = () => {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach((callback) => callback());
  };
  const session = vm.runInContext('AdminAPI.request("/auth/me")', context);
  events.DOMContentLoaded();
  pending.shift().resolve({ user: { role: 'admin' } });
  await session;
  vm.runInContext('initialSessionReady = true; finishInitialLoading()', context);
  const first = vm.runInContext('AdminAPI.request("/barangays")', context);
  flush();
  assert.equal(revealed, 0);
  const next = first.then(() => vm.runInContext('AdminAPI.request("/customers")', context));
  pending.shift().resolve([]);
  await first;
  await Promise.resolve();
  flush();
  assert.equal(revealed, 0, 'dependent data request still loading');
  pending.shift().resolve([]);
  await next;
  flush();
  assert.equal(revealed, 1);
  const refresh = vm.runInContext('AdminAPI.request("/customers")', context);
  pending.shift().resolve([]);
  await refresh;
  flush();
  assert.equal(revealed, 1, 'refresh never restarts initial skeleton');
});

test('failed initial data requests release the skeleton for the page error and retry UI', async () => {
  let revealed = false;
  const timers = new Map();
  let id = 0;
  const context = vm.createContext({
    AdminAPI: { request: async () => { throw new Error('offline'); } },
    document: {
      readyState: 'complete', addEventListener() {},
      documentElement: { classList: { remove: () => { revealed = true; } } },
    },
    setTimeout: (handler) => { timers.set(++id, handler); return id; },
    clearTimeout: (key) => timers.delete(key),
  });
  vm.runInContext(coordinator, context);
  vm.runInContext('initialSessionReady = true', context);
  await assert.rejects(vm.runInContext('AdminAPI.request("/customers")', context), /offline/);
  [...timers.values()].forEach((handler) => handler());
  assert.equal(revealed, true);
});

test('dashboard uses its original skeleton through session and data, preserving content on refresh', async () => {
  let verify;
  let reply;
  let placeholders = 0;
  let renders = 0;
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', disabled: false,
      setAttribute() {}, removeAttribute() {}, addEventListener() {},
      replaceChildren() {}, add() {}, querySelector() { return null; },
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    AdminAuth: { ready: new Promise((resolve) => { verify = resolve; }) },
    AdminAPI: { request: () => new Promise((resolve) => { reply = resolve; }) },
    document: { getElementById: element },
    AdminUI: { message() {} },
    Skeleton: { start() { placeholders++; return () => {}; } },
    Option: function () {},
    renderDashboard() { renders++; }, renderDashboardCharts() {},
  });
  vm.runInContext(readFileSync(new URL('../js/dashboard/dashboard-init.js', import.meta.url), 'utf8'), context);
  assert.equal(placeholders, 4, 'native dashboard skeleton starts before session check completes');
  verify({ role: 'admin' });
  await new Promise(setImmediate);
  assert.equal(renders, 0);
  reply({ currentYear: 2026, availableYears: [2026], period: { year: 2026 } });
  await new Promise(setImmediate);
  assert.equal(renders, 1);
  const refresh = vm.runInContext('startDashboard()', context);
  await new Promise(setImmediate);
  assert.equal(placeholders, 4, 'refresh keeps rendered dashboard instead of replacing it with skeletons');
  reply({ currentYear: 2026, availableYears: [2026], period: { year: 2026 } });
  await refresh;
  assert.equal(renders, 2);
});
