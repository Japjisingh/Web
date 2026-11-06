/* Weather: wind with low-level gradient, gusts, turbulence (felt by the flight model), visibility, cloud,
   time of day, and a generated METAR (ICAO "no location" indicator ZZZZ) with a plain-English decode. */
const D2R = Math.PI / 180, KT = 0.514444;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const COVER = { SKC: 0, FEW: 0.2, SCT: 0.4, BKN: 0.68, OVC: 0.97 };
export const COVER_TXT = { SKC: 'no cloud', FEW: 'few clouds (1–2 oktas)', SCT: 'scattered cloud (3–4 oktas)', BKN: 'broken cloud (5–7 oktas)', OVC: 'overcast (8 oktas)' };
export const TOD = {
  dawn: { label: 'Dawn', z: '0615', elev: 4, az: 95, T: [9, 8] },
  day: { label: 'Day', z: '1230', elev: 42, az: 150, T: [22, 12] },
  dusk: { label: 'Dusk', z: '1810', elev: 2.5, az: 262, T: [19, 13] },
  night: { label: 'Night', z: '2245', elev: -16, az: 300, T: [14, 11] }
};
export const PRESETS = {
  cavok: { label: 'CAVOK calm', dir: 0, spd: 0, gust: 0, turb: 0, vis: 20000, cover: 'SKC', base: 5000, tod: 'day' },
  xwind: { label: 'Gusty crosswind', dir: 270, spd: 15, gust: 10, turb: 1, vis: 12000, cover: 'SCT', base: 3500, tod: 'day' },
  low: { label: 'Low cloud', dir: 180, spd: 6, gust: 0, turb: 1, vis: 4000, cover: 'BKN', base: 1000, tod: 'day' },
  night: { label: 'Night VFR', dir: 330, spd: 5, gust: 0, turb: 0, vis: 12000, cover: 'FEW', base: 4000, tod: 'night' }
};

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function createWeather() {
  const w = { dir: 0, spd: 0, gust: 0, turb: 0, vis: 20000, cover: 'SKC', base: 5000, tod: 'day', g: 0, gTarget: 0, gTimer: 0, tu: [0, 0, 0], tp: 0, gustNow: 0 };
  w.apply = p => { Object.assign(w, { dir: p.dir, spd: p.spd, gust: p.gust, turb: p.turb, vis: p.vis, cover: p.cover, base: p.base, tod: p.tod }); };
  /** advance gust + turbulence processes and write the airmass velocity at the aircraft into s.windNow (m/s, world) and s.turbP */
  w.update = (dt, s, agl) => {
    // gusts: random target level every 2-6 s, smoothed
    w.gTimer -= dt; if (w.gTimer <= 0) { w.gTimer = 2 + Math.random() * 4; w.gTarget = Math.random() < 0.55 ? Math.random() : Math.random() * 0.3; }
    w.g += (w.gTarget - w.g) * Math.min(1, dt * 0.9);
    const hf = clamp(Math.log(Math.max(agl, 0.6) / 0.03) / Math.log(120 / 0.03), 0.35, 1);   // log wind profile near the ground
    const sp = (w.spd + w.gust * w.g) * hf * KT; w.gustNow = (w.spd + w.gust * w.g) * hf;
    const to = (w.dir + 180) * D2R;                                                          // wind blows towards dir + 180
    // turbulence: Ornstein-Uhlenbeck on three axes + roll disturbance
    const sigma = [0, 0.7, 1.5][w.turb] + w.gust * 0.04 + (agl < 300 ? w.spd * 0.015 : 0);
    const tau = [1.6, 0.9, 1.6];
    for (let i = 0; i < 3; i++) w.tu[i] += -w.tu[i] / tau[i] * dt + sigma * Math.sqrt(2 * dt / tau[i]) * gauss();
    w.tp += -w.tp / 0.45 * dt + sigma * 0.022 * Math.sqrt(2 * dt / 0.45) * gauss();
    const vfac = clamp(agl / 60, 0.1, 1);
    s.windNow.set(Math.sin(to) * sp + w.tu[0], w.tu[1] * 0.7 * vfac, -Math.cos(to) * sp + w.tu[2]);
    s.turbP = w.tp;
  };
  /** METAR + decode for the current conditions */
  w.metar = () => {
    const tod = TOD[w.tod];
    const r10 = v => Math.round(v / 10) * 10;
    let wind;
    if (w.spd < 1) wind = '00000KT';
    else { const d = r10(w.dir) % 360 || 360; wind = String(d).padStart(3, '0') + String(Math.round(w.spd)).padStart(2, '0') + (w.gust >= 10 ? 'G' + String(Math.round(w.spd + w.gust)).padStart(2, '0') : '') + 'KT'; }
    const visM = w.vis >= 10000 ? 9999 : w.vis >= 5000 ? Math.floor(w.vis / 1000) * 1000 : w.vis >= 800 ? Math.floor(w.vis / 100) * 100 : Math.floor(w.vis / 50) * 50;
    const wx = w.vis < 1000 ? ' FG' : w.vis < 5000 ? ' BR' : '';
    const cavok = w.vis >= 10000 && (w.cover === 'SKC' || w.base >= 5000);
    const cl = w.cover === 'SKC' ? 'NSC' : w.cover + String(Math.round(w.base / 100)).padStart(3, '0');
    const [T, Td] = w.vis < 5000 ? [tod.T[0] - 3, tod.T[0] - 4] : tod.T;
    const code = `METAR ZZZZ 31${tod.z}Z ${wind} ${cavok ? 'CAVOK' : String(visM).padStart(4, '0') + wx + ' ' + cl} ${String(T).padStart(2, '0')}/${String(Td).padStart(2, '0')} Q1013`;
    const wTxt = w.spd < 1 ? 'Calm wind' : `Wind from ${String(r10(w.dir) % 360 || 360).padStart(3, '0')}° at ${Math.round(w.spd)} kt${w.gust >= 10 ? `, gusting ${Math.round(w.spd + w.gust)} kt` : ''}`;
    const vTxt = cavok ? 'CAVOK: visibility 10 km or more and no significant cloud below 5,000 ft' : `visibility ${visM === 9999 ? '10 km or more' : visM >= 5000 ? visM / 1000 + ' km' : visM + ' m'}${wx === ' BR' ? ' in mist' : wx === ' FG' ? ' in fog' : ''}, ${w.cover === 'SKC' ? 'no significant cloud' : COVER_TXT[w.cover] + ' at ' + (Math.round(w.base / 100) * 100).toLocaleString('en-GB') + ' ft'}`;
    const decode = `${wTxt} · ${vTxt} · temperature ${T} °C, dew point ${Td} °C · QNH 1013 hPa. ZZZZ means no location indicator.`;
    return { code, decode };
  };
  /** head/crosswind on a runway heading (deg) */
  w.components = rwy => { const a = (w.dir - rwy) * D2R; return { head: w.spd * Math.cos(a), cross: w.spd * Math.sin(a) }; };
  return w;
}
