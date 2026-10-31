# Glidepath Companion

A training companion for the **X-Plane 12** flight simulator. It reads your flight live from
X-Plane's built-in web API, scores training exercises as you fly, lets an instructor trigger
failures, and produces a debrief with a replay of the flight.

It also has a **demo mode** that needs no simulator and no network: a scripted C172 flies the
exercises (with a few typical student errors) so you can see how scoring and the debrief work.

> **Study aid only.** Glidepath Companion is not a certified flight training device. Its scores do
> not count towards any licence. Speeds and limits are approximate C172S figures from public
> sources. Always follow your aircraft's POH and your instructor.

## What it does

- **Live data strip:** IAS, altitude, height above ground, vertical speed, heading, rpm, flaps, on ground / airborne, plus STALL, LOW VOLTS, LOW VACUUM and ENGINE FAILED annunciators.
- **Exercises with live checks and a running score:**
  - Normal circuit (rotate 55 kt, climb at Vy 74 kt, crosswind turn at 500 ft AGL, 1,000 ft AGL ±100 on downwind, base 70 kt, final 65 kt with full flap, stable by 300 ft, gentle touchdown on the centreline)
  - Steep turns (45° ±5, altitude ±100 ft, airspeed ±10 kt, roll out on heading, both directions)
  - Power-off stall and recovery (safe height, altitude held while slowing, idle power, wings level at the stall, full power within 3 s, height loss 300 ft or less, no secondary stall, climb at Vy)
  - Engine failure after take-off (nose lowered at once, best glide 68 kt, land ahead within 30°, controlled touchdown). Optionally fails the engine for you at 400 ft AGL.
  - ILS / straight-in approach (localiser and glideslope within 1 dot, stable by 500 ft AGL, speed held below 500 ft, touchdown)
- **Instructor panel:** engine, alternator, vacuum, pitot and static failures, and "clear all failures".
  Checks use the aircraft's real flight path, so instrument failures train the student without spoiling the score.
- **Ground-track map** (runway, planned pattern dashed, flown track, aircraft) and **height and airspeed traces** with tolerance bands.
- **Debrief:** score, every check with the moment it happened (select the time to jump the replay there), a replay scrubber, and the flight data as CSV (Export CSV and Copy CSV).

## Requirements

- X-Plane 12.1.1 or later (the version with the built-in web API). 12.1.4+ adds `/api/capabilities` and commands.
- Node.js 22 or later (uses the built-in `fetch` and `WebSocket`; there are no npm packages to install).
- A current browser (Chrome, Edge, Firefox or Safari).

## Setup

1. In X-Plane open **Settings → Network** and allow incoming connections to the web API. It listens on port **8086**.
2. In this folder run:

   ```sh
   node bridge.mjs
   ```

3. Open <http://localhost:8787> on the same computer.
4. Load a C172 on a runway, pick an exercise and fly. The status pill shows **Connected · X-Plane 12.x** when data is flowing.

For the circuit and EFATO exercises the runway is taken from your take-off roll, so start each
exercise lined up on the runway. Press **End and debrief** at any time; most exercises also end
on their own (for example when you stop after landing).

Options (environment variables): `PORT` (default 8787), `XPLANE_HOST` (default 127.0.0.1),
`XPLANE_PORT` (default 8086).

To see the demo without X-Plane, use the **Watch demo flight** switch or open
<http://localhost:8787/?demo=1>. Demo mode makes no network requests.

## Using a tablet (LAN mode)

```sh
node bridge.mjs --lan
```

The bridge then listens on your network and prints an address such as `http://192.168.1.20:8787`
to open on a tablet on the same Wi-Fi.

**Security warning.** Neither X-Plane's web API nor this bridge has any password. In LAN mode
anyone on the same network can watch your flight and trigger failures. Use `--lan` only on a home
network you trust, and stop the bridge when you finish. By default the bridge only accepts
connections from this computer. The bridge refuses cross-site POST requests (Origin check and
JSON-only), so other websites you visit cannot trigger failures through it.

## MSFS 2024

Microsoft Flight Simulator has no built-in web API. Supporting it needs a small Windows helper
built on Microsoft's SimConnect SDK that sends the same normalized samples to the browser. That
helper is **not included**; the companion page itself would not change.

## Files

| File | What it is |
| --- | --- |
| `bridge.mjs` | Local server: serves `public/`, connects to X-Plane, streams samples by Server-Sent Events (`GET /events`), accepts instructor actions (`POST /api/failure`, `POST /api/command`). Reconnects with backoff. |
| `xplane-protocol.mjs` | Everything specific to X-Plane's web API: version detection, REST paths, WebSocket messages, dataref names, failure datarefs, unit conversion. |
| `public/companion.js` | The UI. `mountCompanion(rootEl, { mode: 'live' \| 'demo', eventsUrl, apiBase })`. CSS is injected once and scoped under `.gpc`; colours and fonts come from the host page's custom properties when present. |
| `public/demo-flight.js` | Deterministic scripted C172 flights for demo mode (no network, no DOM). |
| `public/index.html` | Standalone page with light and dark themes and setup notes. |
| `test/mock-xplane.mjs` | Zero-dependency mock of the X-Plane web API (HTTP and a minimal WebSocket server) that flies the demo circuit and records the messages it receives. |
| `test/e2e.mjs` | End-to-end test: mock + bridge + browser (Playwright). |

Run the tests (Playwright and Chromium must be installed globally):

```sh
NODE_PATH=$(npm root -g) node test/e2e.mjs [screenshot-folder]
```

## Known limits and unverified details

The official documentation (<https://developer.x-plane.com/article/x-plane-web-api/> and
<https://developer.x-plane.com/datarefs/>) could not be reached while this was built, and it was
tested only against the mock, not a real X-Plane. All protocol details are in
`xplane-protocol.mjs` and marked `TODO(verify)` where unsure. In particular:

- **Message formats.** `dataref_subscribe_values`, `dataref_update_values`, `dataref_set_values`, `command_set_is_active` and `result` are implemented as described at the top of `xplane-protocol.mjs`. Whether `duration: 0` acts as a single press for commands should be checked.
- **Version detection.** Uses `GET /api/capabilities`, then probes v3 → v2 → v1 (`/datarefs/count`, then a filtered dataref lookup). Commands need v2 or later; on v1 "Clear all failures" writes 0 to each failure dataref instead.
- **Dataref names to confirm:** `sim/flightmodel/position/hpath` (track), `sim/flightmodel/controls/flaprat` (flap ratio; converted to degrees for a 30° C172 flap), `sim/cockpit2/gauges/indicators/suction_1_ratio`, and the failure datarefs `rel_genera0` (alternator), `rel_vacuum`, `rel_pitot`, `rel_static`. The C172 in X-Plane 12 may model some systems with different failure datarefs.
- **ILS needle signs.** The sign convention of `nav1_hdef_dots_pilot` / `nav1_vdef_dots_pilot` is set by `LOC_SIGN` and `GS_SIGN`. If the debrief says "high" when you were low, flip `GS_SIGN`.
- **Runway position in live mode** comes from your take-off roll (or your touchdown for the ILS exercise), because the bridge does not read airport data. The touchdown-zone check is only scored in demo mode.
- Phase detection (crosswind, downwind, base, final) uses your track relative to the runway, so very unusual patterns may be labelled oddly.
- Times in live mode are wall-clock seconds while the sim is not paused; sim-rate changes are not accounted for.
