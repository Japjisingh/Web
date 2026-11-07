/* Airport layout shared by the 3D world, the flight model, the map displays and the flows. No three.js.
   Scene frame: x right, y up, z aft; the cockpit sits at the origin while parked (nose along -z, heading 309).
   Airport frame (s, n): s along the runway / terminal axis U, n across it along N (+n is to the right of +s).
   All figures are made up for a fictional airport (ZZAA). */
const D2R = Math.PI / 180;
const TH = 35 * D2R;
export const U = { x: -Math.sin(TH), z: -Math.cos(TH) };   // runway axis (+s = take-off direction, runway 27R)
export const N = { x: Math.cos(TH), z: -Math.sin(TH) };    // across: towards the taxiway and runway
export const A0 = { x: -24, z: 0 };                          // a point on the terminal facade line (n = 0)
export const GROUND = -3.4;                                  // ground height below the cockpit floor (parked)
export const HDG0 = 309;                                     // compass heading of the scene -z axis
export const YAW_RWY = TH;                                   // scene yaw of +U
export const ELEV_FT = 420;                                  // field elevation
export const QNH = 1009;
export const WIND = { from: 250, kt: 8 };                    // steady wind from the weather report
export const METAR = 'ZZAA 250/08KT 9999 FEW030 15/09 Q1009';
/* airframe reference: main-gear point on the ground (body origin), cockpit floor origin relative to it */
export const COCKPIT = { y: 3.4, z: -15.3 };
export const WHEELBASE = 12.6;

export const P = (s, n) => ({ x: A0.x + U.x * s + N.x * n, z: A0.z + U.z * s + N.z * n });
export const toSN = (x, z) => { const dx = x - A0.x, dz = z - A0.z; return { s: dx * U.x + dz * U.z, n: dx * N.x + dz * N.z }; };
export const hdgOfYaw = yaw => ((HDG0 - yaw / D2R) % 360 + 360) % 360;
export const yawOfHdg = hdg => (HDG0 - hdg) * D2R;
/* direction of an airport-frame heading a (radians, 0 = +s, 90° = +n) as a scene yaw */
export const yawOfA = a => YAW_RWY - a;
/* scene metres → east / north in nautical miles from the parked position (map displays) */
const NORTH = { x: -Math.sin(HDG0 * D2R), z: -Math.cos(HDG0 * D2R) }, EAST = { x: -Math.sin((HDG0 - 90) * D2R), z: -Math.cos((HDG0 - 90) * D2R) };
export const STAND_EN = { e: 0.42, n: 0.18 };
export const toEN = (x, z) => ({ e: STAND_EN.e + (x * EAST.x + z * EAST.z) / 1852, n: STAND_EN.n + (x * NORTH.x + z * NORTH.z) / 1852 });

/* ---- runway, taxiway, holding point ---- */
export const RWY = { n: 200, s0: -600, s1: 2700, w: 45 };     // 3300 m x 45 m, threshold 27R at s0
export const TWY = { n: 62, s0: -620, s1: 900, w: 23 };
export const HOLD = { s: -570, n: 140 };                      // stop bar across the link to the runway
/* parked main-gear point and heading (airport-frame angle) */
export const PARK = { ...toSN(0, -COCKPIT.z), a: TH };        // nose 35° from +s towards +n (yaw 0)
export const PUSH_END = { s: -48, n: 2, a: Math.PI / 2 };

/* centre-line polyline for the main-gear point: pushback curve, then the taxi route to the runway */
function cubic(p0, p1, p2, p3, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push({ s: u * u * u * p0.s + 3 * u * u * t * p1.s + 3 * u * t * t * p2.s + t * t * t * p3.s, n: u * u * u * p0.n + 3 * u * u * t * p1.n + 3 * u * t * t * p2.n + t * t * t * p3.n }); } return out; }
export const PUSH_PATH = cubic(PARK, { s: PARK.s - 0.819 * 14, n: PARK.n - 0.574 * 14 }, { s: PUSH_END.s, n: PUSH_END.n + 12 }, PUSH_END, 40);
function line(a, b, step = 3) { const d = Math.hypot(b.s - a.s, b.n - a.n), k = Math.max(1, Math.round(d / step)), o = []; for (let i = 1; i <= k; i++) o.push({ s: a.s + (b.s - a.s) * i / k, n: a.n + (b.n - a.n) * i / k }); return o; }
function arc(c, r, a0, a1, step = 3) { const k = Math.max(2, Math.round(Math.abs(a1 - a0) * r / step)), o = []; for (let i = 1; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; o.push({ s: c.s + r * Math.cos(a), n: c.n + r * Math.sin(a) }); } return o; }
export const TAXI_PATH = (() => {
  const p = [{ s: PUSH_END.s, n: PUSH_END.n }];
  p.push(...line(p[p.length - 1], { s: -48, n: 32 }));
  p.push(...arc({ s: -78, n: 32 }, 30, 0, Math.PI / 2));                 // left onto the taxiway (heading -s)
  p.push(...line(p[p.length - 1], { s: -540, n: 62 }));
  p.push(...arc({ s: -540, n: 92 }, 30, -Math.PI / 2, -Math.PI));        // right onto the link (heading +n)
  p.push(...line(p[p.length - 1], { s: -570, n: 165 }));
  p.push(...arc({ s: -535, n: 165 }, 35, Math.PI, Math.PI / 2));         // right onto the runway (heading +s)
  p.push(...line(p[p.length - 1], { s: -400, n: RWY.n }, 6));
  return p;
})();
export const LINEUP = { s: -520, n: RWY.n, a: 0 };
/* distance along a polyline and lateral offset of a point (for guidance and scoring) */
export function nearest(path, s, n) {
  let best = { d: 1e9, i: 0, along: 0, off: 0 }, along = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.s - a.s, dn = b.n - a.n, L = Math.hypot(dx, dn) || 1e-6;
    const t = Math.max(0, Math.min(1, ((s - a.s) * dx + (n - a.n) * dn) / (L * L))), ps = a.s + dx * t, pn = a.n + dn * t, d = Math.hypot(s - ps, n - pn);
    if (d < best.d) best = { d, i, along: along + t * L, off: ((s - a.s) * dn - (n - a.n) * dx) / L, dir: Math.atan2(dn, dx) };
    along += L;
  }
  best.total = along; return best;
}
