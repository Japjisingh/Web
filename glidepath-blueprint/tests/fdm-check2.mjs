import { createAircraft, createControls, step, setGround, setFlight, KT, FT, AC, trimFor } from '../src/sim/fdm.js';
const ground = () => 0, dt = 1 / 120, D2R = Math.PI / 180;
// take-off: rotate at 55 to 8 deg attitude hold
let s = createAircraft(), c = createControls(); setGround(s, c, { x: 0, z: 560, hdg: 0, ground });
for (let i = 0; i < 240; i++) step(s, c, dt, ground);
const z0 = s.pos.z; c.throttle = 1; let t = 0, d55 = null, lo = null, rot = false, maxPitch = 0;
while (t < 50) { step(s, c, dt, ground); t += dt;
  c.yaw = Math.max(-1, Math.min(1, -s.pos.x * 0.08 - (((s.hdg + 180) % 360) - 180) * 0.2));
  if (s.ias >= 55) rot = true; if (d55 === null && s.ias >= 55) d55 = z0 - s.pos.z;
  if (rot) c.pitch = Math.max(-1, Math.min(1, 0.12 * (8 - s.pitch) - 0.8 * s.w.x));
  maxPitch = Math.max(maxPitch, s.pitch);
  if (rot && !lo && !s.onGround) lo = { d: z0 - s.pos.z, ias: s.ias, t };
  if (lo && t > lo.t + 20) break; if (s.crashed) break; }
console.log('static rpm check | to 55 kt', d55?.toFixed(0), 'm | liftoff', lo?.d.toFixed(0), 'm at', lo?.ias.toFixed(0), 'kt in', lo?.t.toFixed(1), 's | 20 s later alt', s.agl.toFixed(0), 'ft ias', s.ias.toFixed(0), 'vs', s.vs.toFixed(0), 'maxPitch', maxPitch.toFixed(1), s.crashed ? s.crashReason : '');
s = createAircraft(); c = createControls(); setGround(s, c, { x: 0, z: 560, hdg: 0, ground }); c.throttle = 1; c.park = true; for (let i = 0; i < 600; i++) step(s, c, dt, ground); console.log('full-power static rpm (parked)', Math.round(s.rpm), 'moved', (560 - s.pos.z).toFixed(2), 'm');
// hands-off trimmed tests
function handsOff(label, opts, fail = false, secs = 60) {
  const s = createAircraft(), c = createControls(); const tr = setFlight(s, c, opts); if (fail) { s.failed = true; s.running = false; }
  const vs = [], ias = [];
  for (let i = 0; i < 120 * secs; i++) { c.roll = -s.bank * 0.02; step(s, c, dt, ground); if (i > 120 * (secs - 20)) { vs.push(s.vs); ias.push(s.ias); } }
  const av = a => a.reduce((x, y) => x + y) / a.length;
  console.log(label, '| ias', av(ias).toFixed(1), 'vs', av(vs).toFixed(0), 'fpm | thr', c.throttle.toFixed(2), 'trim', tr.trim.toFixed(3), 'rpm', Math.round(s.rpm), s.crashed ? s.crashReason : '');
}
// climb: find gamma at full power for 74 kt
let lo2 = 0, hi2 = 0.3; for (let i = 0; i < 40; i++) { const g = (lo2 + hi2) / 2; const tr = trimFor(74 * KT, g, 300, 0); tr.throttle < 0.999 ? lo2 = g : hi2 = g; }
console.log('predicted Vy climb at full power', (74 * KT * Math.sin(lo2) / FT * 60).toFixed(0), 'fpm');
handsOff('Vy 74 kt full power', { x: 0, z: 0, h: 300, hdg: 0, Vkt: 74, gamma: lo2, throttle: 1 });
handsOff('Cruise 105 kt level', { x: 0, z: 0, h: 900, hdg: 0, Vkt: 105 });
lo2 = -0.3; hi2 = 0; for (let i = 0; i < 40; i++) { const g = (lo2 + hi2) / 2; const tr = trimFor(68 * KT, g, 900, 0); tr.throttle > 0.0001 ? hi2 = g : lo2 = g; }
handsOff('Glide 68 kt engine dead', { x: 0, z: 0, h: 1500, hdg: 0, Vkt: 68, gamma: hi2, throttle: 0 }, true);
// max level speed
let a = 90, b = 140; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; trimFor(m * KT, 0, 900, 0).throttle < 0.999 ? a = m : b = m; } console.log('max level speed 3000 ft (trim calc)', a.toFixed(0), 'kt');
