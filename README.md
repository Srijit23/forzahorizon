# Forza Horizon-style driving prototype

A lightweight browser-based 3D driving prototype. The first milestone is a white studio ground, a detailed sports-car model, a physics-driven chassis, synchronized wheel assemblies and responsive keyboard driving.

## Run locally

Install a current Node.js LTS release, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production build:

```bash
npm run build
npm run preview
```

## Controls

- **W / Arrow Up:** accelerate
- **S / Arrow Down:** brake while moving forward, then reverse
- **A / D / Arrow Left / Arrow Right:** steer
- **Space / Shift:** brake
- **R:** reset the car

The physics loop runs at a fixed 60 Hz. It uses a rigid-body chassis and cannon-es `RaycastVehicle` with four spring/damper wheels. Steering is smoothed and its maximum angle decreases with speed. The visual wheel transforms are updated from the physics simulation after each step.

## Vehicle asset and license

The initial high-detail car is **Spectral GT RS**, an original fictional sports-car asset released under **CC0 1.0**. It is not an official Lamborghini model or manufacturer asset. Its 4.7 MB GLB is currently loaded from its public source repository:

- Model source: https://github.com/JaronKBragg7337/spectral-gt-rs
- Direct GLB: https://raw.githubusercontent.com/JaronKBragg7337/spectral-gt-rs/main/spectral_gt_rs_game_ready.glb
- License: https://creativecommons.org/publicdomain/zero/1.0/

The model includes separate named wheel parts. The loader reparents the four wheel assemblies into physics-driven groups so that the tires roll and the front wheels steer with the vehicle controller. If the asset host is offline or blocked by a network filter, the prototype falls back to a simple built-in car shape so the driving loop can still be tested.

**Next asset task:** replace the fictional CC0 supercar with a properly licensed downloadable Lamborghini-style model once its redistribution and use terms are confirmed. Do not describe the current model as a Lamborghini.

## Performance decisions

- WebGL renderer, low-power preference, antialiasing disabled, pixel ratio capped at 1.25.
- One directional shadow light with a modest shadow map.
- A large white ground plane, simple scene and no expensive post-processing.
- Four raycast wheels rather than four extra dynamic wheel rigid bodies.

## Current scope

This is the first driving prototype, not a complete Forza Horizon clone. Traffic, an open world, audio, damage, multiple vehicles, gamepad support and mobile controls are out of scope until vehicle handling and wheel alignment are validated on target hardware.
