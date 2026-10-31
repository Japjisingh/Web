#!/usr/bin/env node
/*
 * End-to-end test: mock X-Plane -> bridge.mjs -> browser (Playwright + Chromium).
 *   NODE_PATH=$(npm root -g) node test/e2e.mjs [screenshot-dir]
 * Checks: status shows Connected, live values update, a failure toggle and "clear all" reach the
 * mock, the bridge reconnects after X-Plane drops, cross-site POSTs are refused, "not found" state,
 * every demo exercise runs to a debrief, no horizontal overflow at 390 px, no console errors.
 * Screenshots: demo (light, dark, 390 px) and live states.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { startMock } from './mock-xplane.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || process.env.SHOTS || path.join(ROOT, 'test', 'shots'));
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000, step = 150) { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }

function startBridge(xport) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'bridge.mjs')], { env: { ...process.env, PORT: '0', XPLANE_PORT: String(xport) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const onData = d => { out += d; const m = out.match(/http:\/\/localhost:(\d+)/); if (m) resolve({ proc: p, port: +m[1], out: () => out }); };
    p.stdout.on('data', onData); p.stderr.on('data', d => { out += d; });
    p.on('exit', code => reject(new Error(`bridge exited ${code}: ${out}`)));
    setTimeout(() => reject(new Error('bridge did not start: ' + out)), 8000);
  });
}

const mock = await startMock({ port: 0, speed: 4 });
const bridge = await startBridge(mock.port);
const lonely = await startBridge(1); // nothing listens on port 1 -> "X-Plane not found"
const base = `http://127.0.0.1:${bridge.port}`;
console.log(`mock X-Plane :${mock.port}  bridge :${bridge.port}  screenshots -> ${OUT}`);

const browser = await chromium.launch();
const errors = [];
const watch = (page, tag) => {
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${tag}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${tag} PAGEERROR: ${e.message}`));
};

try {
  /* ---------------- live mode */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); watch(page, 'live');
  await page.goto(base + '/');
  const status = await until(async () => { const t = await page.textContent('.gpc-status'); return /Connected · X-Plane 12/.test(t) ? t : null; });
  ok(!!status, `status pill shows "${(status || await page.textContent('.gpc-status')).trim()}"`);
  const read = () => page.evaluate(() => [...document.querySelectorAll('.gpc-tile [data-v]')].map(n => n.textContent).join('|'));
  await until(async () => (await read()).split('|')[0] !== '-', 5000);
  const v1 = await read();
  const changed = await until(async () => { const v = await read(); return v !== v1 ? v : null; }, 8000);
  ok(!!changed, `live values update (${v1}  ->  ${changed})`);
  const ias = await until(async () => { const v = parseFloat((await read()).split('|')[0]); return v > 20 ? v : null; }, 15000);
  ok(!!ias, `IAS rises on the take-off roll (${ias} kt)`);

  await page.click('[data-fail=engine]');
  const got = await until(() => mock.log.find(e => e.type === 'dataref_set_values' && e.name === 'sim/operation/failures/rel_engfai0' && e.value === 6));
  ok(!!got, 'engine failure toggle reached X-Plane (rel_engfai0 = 6)');
  ok(await until(async () => (await page.getAttribute('[data-fail=engine]', 'aria-checked')) === 'true'), 'engine switch shows Failed');
  ok(await until(async () => (await page.textContent('[data-a=eng]')) && (await page.getAttribute('[data-a=eng]', 'class')).includes('gpc-on')), 'ENGINE FAILED annunciator lit from X-Plane read-back');
  await page.screenshot({ path: path.join(OUT, 'live-connected.png'), fullPage: false });
  await page.click('[data-r=fixAll]');
  ok(!!await until(() => mock.log.find(e => e.type === 'command_set_is_active' && e.name === 'sim/operation/fix_all_systems')), '"Clear all failures" sent sim/operation/fix_all_systems');

  const xs = await fetch(base + '/api/failure', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://evil.example' }, body: '{"name":"engine","on":true}' });
  ok(xs.status === 403, `cross-site POST refused (HTTP ${xs.status})`);
  const tp = await fetch(base + '/api/failure', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"name":"engine","on":true}' });
  ok(tp.status === 415, `non-JSON POST refused (HTTP ${tp.status})`);

  await fetch(`http://127.0.0.1:${mock.port}/mock/close`, { method: 'POST' });
  const dropped = await until(async () => !/Connected/.test(await page.textContent('.gpc-status')), 4000, 50);
  const back = await until(async () => /Connected/.test(await page.textContent('.gpc-status')), 12000);
  ok(!!back, `bridge reconnects after X-Plane drops the connection${dropped ? ' (status left Connected, then returned)' : ''}`);

  await page.click('[data-b=end]');
  ok(await page.isVisible('[data-r=debrief]'), 'live "End and debrief" opens the debrief');
  ok(await page.isVisible('[data-d=export]') && await page.isVisible('[data-d=copy]'), 'live debrief offers Export CSV and Copy CSV');
  await ctx.close();

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage(); watch(p2, 'notfound');
  await p2.goto(`http://127.0.0.1:${lonely.port}/`);
  const nf = await until(async () => /X-Plane not found/.test(await p2.textContent('.gpc-status')));
  ok(!!nf && await p2.isVisible('.gpc-hint'), 'no X-Plane: status says "X-Plane not found" and shows the fix');
  await p2.screenshot({ path: path.join(OUT, 'live-not-found.png') });
  await ctx2.close();

  /* ---------------- demo mode */
  const shots = [
    { name: 'demo-light', w: 1280, scheme: 'light' },
    { name: 'demo-dark', w: 1280, scheme: 'dark' },
    { name: 'demo-390', w: 390, scheme: 'light' },
  ];
  for (const s of shots) {
    const c = await browser.newContext({ viewport: { width: s.w, height: 900 }, colorScheme: s.scheme, deviceScaleFactor: s.w < 500 ? 2 : 1 });
    const p = await c.newPage(); watch(p, s.name);
    await p.goto(base + '/?demo=1');
    await p.click('[data-speed="8"]');
    await until(async () => /Downwind/.test(await p.textContent('[data-r=phase]')), 30000);
    await sleep(2500);
    await p.screenshot({ path: path.join(OUT, `${s.name}-flight.png`), fullPage: s.w < 500 });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow <= 0, `${s.name}: no horizontal overflow (${overflow}px)`);
    await p.click('[data-b=skip]');
    await p.waitForSelector('[data-r=debrief]:not([hidden])');
    await sleep(400);
    await p.click('.gpc-time');
    await sleep(300);
    await p.screenshot({ path: path.join(OUT, `${s.name}-debrief.png`), fullPage: true });
    if (s.name === 'demo-light') {
      await c.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
      await p.click('[data-d=copy]');
      const m = await until(async () => (await p.textContent('[data-d=msg]')).trim());
      ok(/Copied|Ctrl\+C/.test(m || ''), `Copy CSV works or falls back to selectable text ("${m}")`);
    }
    await c.close();
  }

  /* demo: instructor failures change the simulated data */
  {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage(); watch(p, 'demo-failures');
    await p.goto(base + '/?demo=1');
    await p.click('[data-speed="8"]');
    await until(async () => /Downwind/.test(await p.textContent('[data-r=phase]')), 30000);
    await p.click('[data-fail=static]');
    const altFrozen = await p.textContent('[data-t=alt] [data-v]');
    await sleep(1500);
    ok(await p.getAttribute('[data-t=alt]', 'class').then(c => c.includes('gpc-bad')) && (await p.textContent('[data-t=vs] [data-v]')) === '0', `static blocked: altimeter frozen at ${altFrozen} ft, VSI 0, tiles flagged`);
    await p.click('[data-fail=engine]');
    const rpm = await until(async () => { const v = parseFloat((await p.textContent('[data-t=rpm] [data-v]')).replace(/,/g, '')); return v < 1200 ? v : null; }, 8000);
    ok(!!rpm, `engine failure: rpm falls to ${rpm} (windmilling) and the demo glides`);
    await sleep(1500);
    await p.screenshot({ path: path.join(OUT, 'demo-engine-failure.png') });
    await p.click('[data-b=skip]');
    ok(!!await p.waitForSelector('[data-r=debrief]:not([hidden])', { timeout: 10000 }), 'demo with failures still ends in a debrief');
    await sleep(600);
    await p.screenshot({ path: path.join(OUT, 'demo-engine-failure-debrief.png'), fullPage: true });
    await c.close();
  }

  /* every exercise runs to a debrief */
  const c3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p3 = await c3.newPage(); watch(p3, 'exercises');
  await p3.goto(base + '/?demo=1');
  for (const ex of ['circuit', 'steep', 'stall', 'efato', 'ils']) {
    await p3.click(`[data-ex=${ex}]`);
    await sleep(200);
    await p3.click('[data-b=skip]');
    await p3.waitForSelector('[data-r=debrief]:not([hidden])');
    const res = await p3.evaluate(() => ({
      score: document.querySelector('[data-r=debrief] .gpc-score b').textContent,
      rows: [...document.querySelectorAll('[data-r=debrief] .gpc-chk')].map(li => `${li.dataset.st.padEnd(6)} ${li.querySelector('.gpc-chk-l').childNodes[0].textContent} - ${li.querySelector('.gpc-chk-n').textContent}`),
    }));
    const missed = res.rows.filter(r => r.startsWith('missed')).length;
    ok(missed === 0, `${ex}: debrief ${res.score}, ${res.rows.length} checks, none missed`);
    res.rows.forEach(r => console.log('        ' + r));
    if (ex === 'efato' || ex === 'steep') await p3.screenshot({ path: path.join(OUT, `demo-${ex}-debrief.png`) });
  }
  await c3.close();
} catch (err) {
  console.error(err); failures++;
} finally {
  ok(errors.length === 0, `no console errors or warnings${errors.length ? ': ' + errors.slice(0, 8).join(' | ') : ''}`);
  await browser.close();
  bridge.proc.kill(); lonely.proc.kill(); mock.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}
