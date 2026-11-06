/* Fictional navigation data for the trainer. Every airport, waypoint and navaid here is made up (ZZ.. codes),
   positions are in nautical miles east / north of the departure airport reference point. Not real-world data. */

export const AIRPORTS = {
  ZZAA: { e: 0, n: 0, elev: 420, name: 'GLIDEPATH FIELD', rwys: { '27R': { hdg: 274, a: [1.05, -0.32], b: [-0.62, -0.20], ils: { f: 109.9, id: 'IZZA' } }, '09L': { hdg: 94, a: [-0.62, -0.20], b: [1.05, -0.32] }, '27L': { hdg: 274, a: [1.0, -0.55], b: [-0.45, -0.45] }, '09R': { hdg: 94, a: [-0.45, -0.45], b: [1.0, -0.55] } } },
  ZZBB: { e: -182, n: 41, elev: 160, name: 'WESTPORT', rwys: { '09': { hdg: 94, a: [-182.8, 41.05], b: [-181.2, 40.95], ils: { f: 110.3, id: 'IZZB' } }, '27': { hdg: 274, a: [-181.2, 40.95], b: [-182.8, 41.05] } } },
  ZZAC: { e: -58, n: -44, elev: 900, name: 'RIDGE', rwys: {} },
  ZZAD: { e: 34, n: 66, elev: 60, name: 'NORTHBAY', rwys: {} },
  ZZAE: { e: -121, n: 79, elev: 1200, name: 'HIGHMOOR', rwys: {} }
};
/* the route the flight plan uses between ZZAA and ZZBB (any direction of entry is accepted, the route is fixed) */
export const ROUTE = [
  { id: 'GPX01', e: -11.5, n: 1.2, cstr: '5000' }, { id: 'GPX02', e: -34, n: 7.5, cstr: 'FL100' }, { id: 'GPX03', e: -79, n: 19 },
  { id: 'GPX04', e: -129, n: 31 }, { id: 'GPX05', e: -164, n: 37.5, cstr: 'FL120' }
];
export const WPTS = [{ id: 'ZW101', e: -21, n: -14 }, { id: 'ZW102', e: -48, n: 26 }, { id: 'ZW103', e: 11, n: -28 }, { id: 'ZW104', e: -96, n: -9 }, { id: 'ZW105', e: -6, n: 17 }, { id: 'ZW106', e: -3.5, n: -6 }];
export const VORS = [{ id: 'ZZV', f: 115.7, e: -7.5, n: 4.6 }, { id: 'ZBV', f: 113.3, e: -175, n: 43 }, { id: 'ZCV', f: 117.2, e: -54, n: -31 }];
export const NDBS = [{ id: 'ZA', f: 352, e: 5.5, n: -2.2 }, { id: 'ZK', f: 410, e: -101, n: 11 }];
/* where the aircraft is parked (stand 12 at ZZAA) and which way it points */
export const AC = { e: 0.42, n: 0.18, hdg: 274 };
export const MAGVAR = 0;

export const brg = (from, to) => ((Math.atan2(to.e - from.e, to.n - from.n) * 180 / Math.PI) + 360) % 360;
export const dist = (a, b) => Math.hypot(b.e - a.e, b.n - a.n);
/** full list of route points for a flight plan (departure runway end, route, arrival runway threshold) */
export function routePoints(f) {
  if (!f.from || !f.to) return [];
  const A = AIRPORTS[f.from], B = AIRPORTS[f.to];
  const pts = [];
  const dr = f.depRwy && A.rwys[f.depRwy];
  pts.push(dr ? { id: f.from + f.depRwy, e: dr.b[0], n: dr.b[1], rwy: true } : { id: f.from, e: A.e, n: A.n });
  const fwd = f.from === 'ZZAA' && f.to === 'ZZBB', rev = f.from === 'ZZBB' && f.to === 'ZZAA';
  if (fwd) pts.push(...ROUTE); else if (rev) pts.push(...[...ROUTE].reverse());
  const ar = f.arrRwy && B.rwys[f.arrRwy];
  pts.push(ar ? { id: f.to + f.arrRwy, e: ar.a[0], n: ar.a[1], rwy: true, dest: true } : { id: f.to, e: B.e, n: B.n, dest: true });
  return pts;
}
export function routeLength(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]); return d; }
