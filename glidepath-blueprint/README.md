# Glidepath blueprint

The product blueprint page with its working 3D prototypes:

- VOR, ILS, holding, globe, wing, engine, storm and PFD learning scenes
- the GP-172 light-aircraft sim
- the X-Plane companion demo
- the generic twin-jet procedure trainer (cockpit preparation, flight computer set-up, automatic and manual engine start, engine fire drills, pushback, taxi, take-off, rejected take-off and climb-out with a simplified autopilot)

All three.js (WebGL2). The page bundles into one `app.js` file.

## Build

```bash
npm install
./build.sh            # all scenes -> dist/index.html + dist/app.js
./build.sh jet dist-jet   # one scene only
```

Open `dist/index.html` through any static server (e.g. `npx serve dist`).
`src/s-companion.js` imports from `../glidepath-companion/public/`, so keep both folders side by side.

## Layout

- `src/core.js` – shared stage (renderer, post-processing, labels, UI helpers)
- `src/s-*.js` – one file per scene; `src/boot.js` lazy-starts each `[data-scene]`
- `src/sim/` – light-aircraft flight model, world, volumetric clouds, weather, sound, VR, cockpit
- `src/jet/` – jet trainer: `systems.js` (systems model, no three.js), `flows.js` (steps, scenarios, scoring), `checklists.js` (written challenge-and-response normal checklists, runner, checklist-trainer stations), `avionics.js` (autopilot panel, EFIS, radios, transponder and a simplified flight computer, no three.js), `navdata.js` (fictional airports, waypoints and navaids), `layout.js` (airport geometry, taxi route, frames), `fdm.js` (ground and flight dynamics, no three.js), `autoflight.js` (simplified AP / A/THR / FMA, no three.js), `exterior.js` (outside model and tug), `deck.js` / `panel.js` / `displays.js` (3D flight deck), `shell.js` (windows, frames, sidewalls, consoles, seats, contact shadows, windscreen reflections), `airport.js` (apron, terminal, taxiway and runway lights), `hud.js` (overlay UI)
- `assets/` – earth textures for the globe scene

## Tests

Playwright with the system Chromium (`NODE_PATH=$(npm root -g)`):

```bash
node tests/test.js                     # screenshot + console check per scene
node tests/test.js p-sim,p-jet         # selected scenes
node tests/phone.js                    # 390 px layout, no horizontal overflow
node tests/jet/logic.mjs               # jet systems and flows (Node only)
node tests/jet/fdm.mjs                 # jet ground / flight dynamics, autopilot, taxi and take-off scenario (Node only)
./build.sh jet dist-jet && node tests/jet/browser-logic.js   # flows driven in the page
```

## Not certified

This is for familiarisation only. It is not an approved training device, and it uses no manufacturer's or operator's procedures or names.
