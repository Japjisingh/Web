#!/usr/bin/env node
/*
 * Glidepath Companion bridge (Node 22+, no dependencies).
 *
 *   node bridge.mjs            serve http://localhost:8787 (this computer only)
 *   node bridge.mjs --lan      also allow a tablet on the home network (no authentication!)
 *
 * Environment: PORT (8787), XPLANE_HOST (127.0.0.1), XPLANE_PORT (8086).
 *
 * It connects to X-Plane's built-in web API, resolves dataref ids by name, subscribes over
 * WebSocket and streams normalized samples (~10 Hz) to browsers with Server-Sent Events:
 *   GET  /events        event: status  {state:'connecting'|'connected'|'not_found', version, api, hint}
 *                       event: sample  {ias, alt, agl, vs, hdg, lat, lon, rpm, flaps, ground, ... , fail:{...}}
 *   POST /api/failure   {name:'engine'|'alternator'|'vacuum'|'pitot'|'static', on:true|false}
 *   POST /api/command   {name:'fix_all'|'pause'}
 *   GET  /api/status
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import * as XP from './xplane-protocol.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');
const LAN = process.argv.includes('--lan');
const PORT = Number(process.env.PORT || 8787);
const BIND = LAN ? '0.0.0.0' : '127.0.0.1';
const XHOST = process.env.XPLANE_HOST || '127.0.0.1';
const XPORT = Number(process.env.XPLANE_PORT || XP.DEFAULT_PORT);
const XBASE = `http://${XHOST.includes(':') ? `[${XHOST}]` : XHOST}:${XPORT}`;
const QUIET = process.env.GPC_QUIET === '1';
const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 19), ...a); };

if (typeof WebSocket !== 'function' || typeof fetch !== 'function') {
  console.error('This bridge needs Node.js 22 or later (global fetch and WebSocket).');
  process.exit(1);
}

/* ------------------------------------------------------------------ X-Plane link */

const link = {
  status: { state: 'connecting', target: `${XHOST}:${XPORT}` },
  ws: null, api: null, version: null,
  idToKey: new Map(),      // dataref id -> { key, fail: bool }
  keyToRef: {},            // DATAREFS key -> { id, index }
  failRefs: {},            // FAILURES key -> { id }
  cmdIds: {},              // COMMANDS key -> id
  raw: {}, failRaw: {},
  reqId: 1, pending: new Map(),
  lastUpdate: 0, missing: [],
};

function setStatus(s) {
  link.status = s;
  broadcast('status', s);
  if (s.state === 'connected') log(`Connected to X-Plane ${s.version || '(version unknown)'} via web API ${s.api}${s.missing?.length ? ` - not found: ${s.missing.join(', ')}` : ''}`);
  else if (s.state === 'not_found') log(`X-Plane not found at ${XHOST}:${XPORT}: ${s.detail || ''}`);
}

let backoff = 1000;
async function connectLoop() {
  for (;;) {
    try {
      await connectOnce();
      backoff = 1000;
    } catch (err) {
      setStatus({ state: 'not_found', hint: XP.NOT_FOUND_HINT, detail: err.message, retryInMs: backoff });
    }
    await new Promise(r => setTimeout(r, backoff));
    backoff = Math.min(backoff * 2, 10000);
    setStatus({ state: 'connecting', target: `${XHOST}:${XPORT}` });
  }
}

/** Resolves when the WebSocket closes (normal reconnect path); throws if setup fails. */
async function connectOnce() {
  setStatus({ state: 'connecting', target: `${XHOST}:${XPORT}` });
  const det = await XP.detectApi(XBASE);
  link.api = det.api; link.version = det.xpVersion;

  const drNames = [...new Set([...Object.values(XP.DATAREFS).map(d => d.name), ...Object.values(XP.FAILURES).map(f => f.name)])];
  const found = await XP.lookupDatarefs(XBASE, link.api, drNames);
  link.idToKey.clear(); link.keyToRef = {}; link.failRefs = {}; link.missing = [];
  const subs = [];
  for (const [key, d] of Object.entries(XP.DATAREFS)) {
    const f = found.get(d.name);
    if (!f) { link.missing.push(d.name); if (d.required) throw new Error(`required dataref not found: ${d.name}`); continue; }
    link.keyToRef[key] = { id: f.id, index: d.index };
    link.idToKey.set(String(f.id), { key, fail: false });
    subs.push({ id: f.id, index: d.index });
  }
  for (const [key, d] of Object.entries(XP.FAILURES)) {
    const f = found.get(d.name);
    if (!f) { link.missing.push(d.name); continue; }
    link.failRefs[key] = { id: f.id };
    link.idToKey.set(String(f.id), { key, fail: true });
    subs.push({ id: f.id });
  }
  try {
    const cmds = await XP.lookupCommands(XBASE, link.api, Object.values(XP.COMMANDS).map(c => c.name));
    link.cmdIds = {};
    for (const [key, c] of Object.entries(XP.COMMANDS)) { const f = cmds.get(c.name); if (f) link.cmdIds[key] = f.id; }
  } catch { link.cmdIds = {}; }

  const ws = new WebSocket(XP.wsUrl(XHOST, XPORT, link.api));
  link.ws = ws;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => { reject(new Error('WebSocket did not open within 5 s')); try { ws.close(); } catch {} }, 5000);
    ws.addEventListener('open', () => { clearTimeout(t); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('WebSocket error')); }, { once: true });
  });
  link.raw = {}; link.failRaw = {};
  ws.addEventListener('message', ev => onWsMessage(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')));
  const sub = await request(id => XP.msgSubscribe(id, subs));
  if (!sub.ok) throw new Error(`subscribe refused: ${sub.error}`);
  setStatus({ state: 'connected', version: link.version, api: link.api, missing: link.missing });
  await new Promise(resolve => ws.addEventListener('close', resolve, { once: true }));
  link.ws = null;
  for (const p of link.pending.values()) p.resolve({ ok: false, error: 'connection closed' });
  link.pending.clear();
  log('X-Plane connection closed; reconnecting');
}

function onWsMessage(text) {
  const m = XP.parseMessage(text);
  if (m.kind === 'update') {
    for (const [id, v] of Object.entries(m.values)) {
      const k = link.idToKey.get(String(id));
      if (!k) continue;
      if (k.fail) link.failRaw[k.key] = v; else link.raw[k.key] = v;
    }
    link.lastUpdate = Date.now();
  } else if (m.kind === 'result') {
    const p = link.pending.get(m.reqId);
    if (p) { link.pending.delete(m.reqId); clearTimeout(p.timer); p.resolve({ ok: m.ok, error: m.error }); }
  }
}

/** Send a request built by make(reqId) and wait for its "result". */
function request(make, timeoutMs = 3000) {
  return new Promise(resolve => {
    if (!link.ws || link.ws.readyState !== 1) return resolve({ ok: false, error: 'not connected to X-Plane' });
    const id = link.reqId++;
    const timer = setTimeout(() => { link.pending.delete(id); resolve({ ok: false, error: 'X-Plane did not reply in time' }); }, timeoutMs);
    link.pending.set(id, { resolve, timer });
    link.ws.send(make(id));
  });
}

/* ------------------------------------------------------------------ SSE */

const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => {
  if (link.status.state !== 'connected' || !clients.size || !link.lastUpdate) return;
  if (Date.now() - link.lastUpdate > 3000 && !(link.raw.paused > 0)) return; // stale
  const s = XP.normalize(link.raw, link.failRaw);
  if (s.lat == null || s.ias == null) return;
  broadcast('sample', s);
}, 100);
setInterval(() => { for (const res of clients) res.write(': keep-alive\n\n'); }, 15000);

/* ------------------------------------------------------------------ HTTP */

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const SEC_HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'SAMEORIGIN' };

function sendJson(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SEC_HEADERS });
  res.end(JSON.stringify(obj));
}

/** Reject cross-site requests: a web page on another site must not be able to trigger failures. */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl or same-origin navigation
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

async function readJson(req, limit = 4096) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > limit) throw new Error('body too large'); }
  return JSON.parse(body || '{}');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      res.write('retry: 2000\n\n');
      res.write(`event: status\ndata: ${JSON.stringify(link.status)}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/api/status' && req.method === 'GET') return sendJson(res, 200, { ...link.status, clients: clients.size, lan: LAN });
    if (url.pathname === '/api/failure' || url.pathname === '/api/command') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'use POST' });
      if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'cross-site request refused' });
      if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return sendJson(res, 415, { ok: false, error: 'send JSON' });
      const body = await readJson(req);
      if (url.pathname === '/api/failure') {
        const f = XP.FAILURES[body.name];
        if (!f) return sendJson(res, 400, { ok: false, error: `unknown failure "${body.name}"` });
        const ref = link.failRefs[body.name];
        if (!ref) return sendJson(res, 503, { ok: false, error: link.status.state === 'connected' ? `${f.name} not available in this X-Plane` : 'not connected to X-Plane' });
        const value = body.on ? XP.FAIL_ON : XP.FAIL_OFF;
        const r = await request(id => XP.msgSetValues(id, [{ id: ref.id, value }]));
        log(`failure ${body.name} -> ${value}: ${r.ok ? 'ok' : r.error}`);
        if (r.ok) link.failRaw[body.name] = value;
        return sendJson(res, r.ok ? 200 : 502, { ok: r.ok, error: r.error || undefined, name: body.name, on: !!body.on });
      }
      const c = XP.COMMANDS[body.name];
      if (!c) return sendJson(res, 400, { ok: false, error: `unknown command "${body.name}"` });
      const cid = link.cmdIds[body.name];
      if (cid == null) {
        if (body.name === 'fix_all' && Object.keys(link.failRefs).length) { // v1 fallback: clear each failure dataref
          const r = await request(id => XP.msgSetValues(id, Object.values(link.failRefs).map(f => ({ id: f.id, value: XP.FAIL_OFF }))));
          return sendJson(res, r.ok ? 200 : 502, { ok: r.ok, error: r.error || undefined });
        }
        return sendJson(res, 503, { ok: false, error: 'command not available (needs web API v2 or later)' });
      }
      const r = await request(id => XP.msgCommand(id, cid, true, 0));
      log(`command ${c.name}: ${r.ok ? 'ok' : r.error}`);
      return sendJson(res, r.ok ? 200 : 502, { ok: r.ok, error: r.error || undefined });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
    // static files
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) return sendJson(res, 403, { ok: false, error: 'forbidden' });
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain', ...SEC_HEADERS }); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', ...SEC_HEADERS });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
  }
});

server.on('error', err => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Set PORT=... to use another.` : err.message);
  process.exit(1);
});
server.listen(PORT, BIND, () => {
  const port = server.address().port;
  console.log(`Glidepath Companion bridge`);
  console.log(`  Open http://localhost:${port} in a browser on this computer.`);
  console.log(`  Reading X-Plane at ${XHOST}:${XPORT}`);
  if (LAN) {
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log(`  LAN mode: on a tablet open ${ips.map(ip => `http://${ip}:${port}`).join(' or ') || `http://<this-computer>:${port}`}`);
    console.log('  WARNING: there is no password. Anyone on this network can watch your flight and trigger');
    console.log('           failures. Only use --lan on a home network you trust, and stop the bridge after.');
  }
  connectLoop();
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { for (const res of clients) res.end(); server.close(); process.exit(0); });
