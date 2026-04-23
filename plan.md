# FPV Drone Simulator — Batch Plan

## Summary

The repo is empty. We're building a full browser-based FPV drone simulator from scratch using:
- **Vite** — fast dev server + bundler
- **Three.js** — 3D rendering (scene, terrain, drone mesh, lighting, sky)
- **Cannon-es** — physics engine (rigid body dynamics, aerodynamics)
- Vanilla TypeScript/JS

The simulator will have:
- First-person cockpit/FPV camera
- Realistic multi-rotor physics (pitch, roll, yaw, throttle)
- Procedural terrain with obstacles (trees, pylons, gates)
- Keyboard + gamepad controls
- HUD overlay (speed, altitude, battery, attitude indicator, crosshair)
- Particle effects (prop wash dust, crash sparks)
- Ambient + motor audio

All modules export a clean class-based API. The `src/main.ts` entry wires them together.

## Module Boundaries (shared interfaces)

```
DroneState = { position: Vector3, rotation: Euler, velocity: Vector3, throttle: number, armed: boolean }
ControlInput = { throttle: number, roll: number, pitch: number, yaw: number }
```

## Work Units

| # | Title | Files | Description |
|---|-------|-------|-------------|
| 1 | Project Foundation | `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.ts`, `src/types.ts` | Vite+Three.js project scaffold, shared types, render loop, camera setup |
| 2 | Drone Physics | `src/Drone.ts`, `src/Physics.ts` | Multi-rotor rigid body physics using cannon-es, thrust/drag model |
| 3 | Environment | `src/Environment.ts`, `src/Terrain.ts`, `src/Sky.ts` | Procedural terrain, sky gradient, obstacles (trees, gates, pylons), lighting |
| 4 | Controls | `src/Controls.ts`, `src/Gamepad.ts` | Keyboard WASD/arrows + gamepad API input, mode 2 mapping |
| 5 | HUD | `src/HUD.ts`, `src/styles.css` | Canvas 2D HUD overlay: speed, altitude, attitude indicator, battery, armed status |
| 6 | Audio & Effects | `src/Audio.ts`, `src/Effects.ts` | Web Audio API motor sounds, particle system for prop wash + crash |
| 7 | Integration & Polish | `src/App.ts` | Wires all modules, game loop, crash/reset logic, performance tuning |

## E2E Test Recipe

```
cd /home/user/Robiufpv
npm install
npm run dev
# Verify: dev server starts on http://localhost:5173, no console errors
# Open browser, see 3D environment, press Space to arm, WASD/arrows to fly
```

Since workers can't open a browser, they should:
1. Run `npm install` (or `npm ci`)
2. Run `npm run build` — verify it exits 0 with no TypeScript errors
3. Optionally run `npm run dev &` and curl localhost:5173 to confirm server starts

## Worker Instructions Template

See Phase 2 agent prompts below.
