#!/usr/bin/env node
/*
 * Mock of the X-Plane 12 web API subset that bridge.mjs uses (zero dependencies).
 * HTTP:  GET /api/capabilities, GET /api/v3/datarefs/count, GET /api/v3/datarefs?filter[name]=...,
 *        GET /api/v3/commands?filter[name]=...
 * WS:    ws://host:port/api/v3 - dataref_subscribe_values, dataref_set_values, command_set_is_active,
 *        replies "result", pushes dataref_update_values at 10 Hz.
 * Test:  GET /mock/log (messages received), POST /mock/close (drop WS clients to test reconnects).
 * The flight comes from public/demo-flight.js (circuit), run at MOCK_SPEED x real time.
 *
 *   node test/mock-xplane.mjs [port]        default port 8086
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDemoFlight, STEP } from '../public/demo-flight.js';

const FT = 0.3048, KT = 1.943844;
// Independent copy of the names (so a typo in xplane-protocol.mjs shows up as "not found").
const TABLE = {
  'sim/flightmodel/position/indicated_airspeed': s => s.ias,
  'sim/cockpit2/gauges/indicators/airspeed_kts_pilot': s => s.iasInd,
  'sim/flightmodel/position/elevation': s => s.alt * FT,
  'sim/cockpit2/gauges/indicators/altitude_ft_pilot': s => s.altInd,
  'sim/flightmodel/position/y_agl': s => s.agl * FT,
  'sim/flightmodel/position/vh_ind_fpm': s => s.vs,
  'sim/cockpit2/gauges/indicators/vvi_fpm_pilot': s => s.vsInd,
  'sim/flightmodel/position/mag_psi': s => s.hdg,
  'sim/flightmodel/position/hpath': s => s.trk,
  'sim/flightmodel/position/psi': s => s.hdg,
  'sim/flightmodel/position/theta': s => s.pitch,
  'sim/flightmodel/position/phi': s => s.bank,
  'sim/flightmodel/position/latitude': s => s.lat,
  'sim/flightmodel/position/longitude': s => s.lon,
  'sim/flightmodel/position/groundspeed': s => s.gs / KT,
  'sim/cockpit2/engine/indicators/engine_speed_rpm': s => [s.rpm, 0, 0, 0, 0, 0, 0, 0],
  'sim/flightmodel/controls/flaprat': s => s.flaps / 30,
  'sim/flightmodel/failures/onground_any': s => (s.ground ? 1 : 0),
  'sim/cockpit2/controls/yoke_pitch_ratio': () => 0,
  'sim/cockpit2/controls/yoke_roll_ratio': () => 0,
  'sim/cockpit2/controls/yoke_heading_ratio': () => 0,
  'sim/cockpit2/engine/actuators/throttle_ratio_all': s => s.thr,
  'sim/cockpit2/electrical/bus_volts': s => [s.volts, 0, 0, 0, 0, 0],
  'sim/cockpit2/gauges/indicators/suction_1_ratio': s => s.suction,
  'sim/flightmodel/failures/stallwarning': s => (s.stall ? 1 : 0),
  'sim/cockpit2/radios/indicators/nav1_hdef_dots_pilot': s => -s.loc,
  'sim/cockpit2/radios/indicators/nav1_vdef_dots_pilot': s => -s.gsd,
  'sim/time/paused': () => 0,
};
const FAIL = {
  'sim/operation/failures/rel_engfai0': 'engine',
  'sim/operation/failures/rel_genera0': 'alternator',
  'sim/operation/failures/rel_vacuum': 'vacuum',
  'sim/operation/failures/rel_pitot': 'pitot',
  'sim/operation/failures/rel_static': 'static',
};
const CMDS = ['sim/operation/fix_all_systems', 'sim/operation/pause_toggle'];

export function startMock({ port = 8086, speed = Number(process.env.MOCK_SPEED || 3), host = '127.0.0.1' } = {}) {
  const ids = new Map(); // name -> id
  let next = 1000000001;
  for (const n of [...Object.keys(TABLE), ...Object.keys(FAIL)]) ids.set(n, next++);
  const cmdIds = new Map(CMDS.map(n => [n, next++]));
  const byId = new Map([...ids].map(([n, i]) => [i, n]));
  const cmdById = new Map([...cmdIds].map(([n, i]) => [i, n]));
  const log = [];
  let flight = createDemoFlight('circuit');
  let acc = 0, last = Date.now();
  const clients = new Set();

  const tick = setInterval(() => {
    const now = Date.now(); acc += (now - last) / 1000 * speed; last = now;
    while (acc >= STEP) { flight.step(STEP); acc -= STEP; }
    if (flight.done) flight = createDemoFlight('circuit');
    const s = flight.sample(), f = flight.failures;
    for (const c of clients) {
      if (!c.subs.size) continue;
      const data = {};
      for (const [id, index] of c.subs) {
        const name = byId.get(id);
        let v = TABLE[name] ? TABLE[name](s) : (f[FAIL[name]] ? 6 : 0);
        if (Array.isArray(v) && index != null) v = [v[index]];
        data[id] = v;
      }
      sendFrame(c.sock, JSON.stringify({ type: 'dataref_update_values', data }));
    }
  }, 100);

  const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = u.pathname.match(/^\/api\/(v\d)\/(.*)$/);
    if (u.pathname === '/api/capabilities') return json(res, 200, { api: { versions: ['v1', 'v2', 'v3'] }, 'x-plane': { version: '12.1.4' } });
    if (u.pathname === '/mock/log') return json(res, 200, log);
    if (u.pathname === '/mock/close' && req.method === 'POST') { for (const c of clients) c.sock.destroy(); clients.clear(); return json(res, 200, { ok: true }); }
    if (m && m[2] === 'datarefs/count') return json(res, 200, { data: ids.size });
    if (m && m[2] === 'datarefs') {
      const names = u.searchParams.getAll('filter[name]');
      log.push({ type: 'http_lookup', names: names.length });
      return json(res, 200, { data: names.filter(n => ids.has(n)).map(n => ({ id: ids.get(n), name: n, value_type: Array.isArray(TABLE[n]?.(flight.sample())) ? 'float_array' : 'float', is_writable: !!FAIL[n] })) });
    }
    if (m && m[2] === 'commands') {
      const names = u.searchParams.getAll('filter[name]');
      return json(res, 200, { data: names.filter(n => cmdIds.has(n)).map(n => ({ id: cmdIds.get(n), name: n, description: n })) });
    }
    json(res, 404, { error_code: 'not_found', error_message: 'no such endpoint' });
  });

  server.on('upgrade', (req, sock) => {
    if (!/^\/api\/v\d$/.test(req.url.split('?')[0]) || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const c = { sock, subs: new Map(), buf: Buffer.alloc(0) };
    clients.add(c);
    log.push({ type: 'ws_open', path: req.url });
    sock.on('data', d => {
      c.buf = Buffer.concat([c.buf, d]);
      for (;;) {
        const f = readFrame(c.buf); if (!f) break;
        c.buf = c.buf.subarray(f.used);
        if (f.op === 8) { sock.end(); clients.delete(c); return; }
        if (f.op === 9) { sock.write(frame(f.payload, 10)); continue; }
        if (f.op === 1) onMessage(c, f.payload.toString('utf8'));
      }
    });
    sock.on('close', () => clients.delete(c));
    sock.on('error', () => clients.delete(c));
  });

  function onMessage(c, text) {
    let m; try { m = JSON.parse(text); } catch { return; }
    const reply = (ok, err) => sendFrame(c.sock, JSON.stringify(ok ? { req_id: m.req_id, type: 'result', success: true } : { req_id: m.req_id, type: 'result', success: false, error_code: 'invalid', error_message: err }));
    if (m.type === 'dataref_subscribe_values') {
      const list = m.params?.datarefs || [];
      if (list.some(d => !byId.has(d.id))) return reply(false, 'unknown dataref id');
      for (const d of list) c.subs.set(d.id, d.index ?? null);
      log.push({ type: m.type, count: list.length });
      return reply(true);
    }
    if (m.type === 'dataref_set_values') {
      for (const d of m.params?.datarefs || []) {
        const name = byId.get(d.id);
        log.push({ type: m.type, name, value: d.value });
        if (FAIL[name]) flight.setFailure(FAIL[name], d.value >= 6);
      }
      return reply(true);
    }
    if (m.type === 'command_set_is_active') {
      for (const cmd of m.params?.commands || []) {
        const name = cmdById.get(cmd.id);
        log.push({ type: m.type, name, is_active: cmd.is_active, duration: cmd.duration });
        if (name === 'sim/operation/fix_all_systems' && cmd.is_active) for (const k of Object.values(FAIL)) flight.setFailure(k, false);
      }
      return reply(true);
    }
    reply(false, `unsupported type ${m.type}`);
  }

  return new Promise(resolve => server.listen(port, host, () => resolve({
    port: server.address().port, log,
    close: () => { clearInterval(tick); for (const c of clients) c.sock.destroy(); server.close(); },
  })));
}

/* minimal RFC 6455 framing (text/close/ping, no extensions, no fragmentation) */
function frame(payload, op = 1) {
  const len = payload.length;
  const head = len < 126 ? Buffer.from([0x80 | op, len]) : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | op; b[1] = 127; b.writeBigUInt64BE(BigInt(len), 2); return b; })();
  return Buffer.concat([head, payload]);
}
function sendFrame(sock, text) { if (!sock.destroyed) sock.write(frame(Buffer.from(text, 'utf8'))); }
function readFrame(buf) {
  if (buf.length < 2) return null;
  const op = buf[0] & 15, masked = buf[1] & 128;
  let len = buf[1] & 127, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  const mask = masked ? buf.subarray(off, off + 4) : null; if (masked) off += 4;
  if (buf.length < off + len) return null;
  const payload = Buffer.from(buf.subarray(off, off + len));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  return { op, payload, used: off + len };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || process.env.MOCK_PORT || 8086);
  startMock({ port }).then(m => console.log(`Mock X-Plane web API on http://127.0.0.1:${m.port} (ws /api/v3), flight at ${process.env.MOCK_SPEED || 3}x`));
}
