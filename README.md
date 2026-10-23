# Forza Horizon-style driving prototype

A lightweight browser-based driving prototype with a detailed Lamborghini Huracán Performante exterior, a white studio ground, four spring/damper raycast wheels, speed-sensitive steering and a smooth chase camera.

## Run locally

Install a current Node.js LTS release, then:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To make a production bundle:

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

## Vehicle implementation

- Three.js WebGL rendering with a near-white ground plane, directional shadows and low-power renderer settings.
- cannon-es rigid-body chassis and `RaycastVehicle` with four suspension/tyre contact points.
- Fixed 60 Hz physics timestep, progressive throttle, coasting drag, reverse transition, braking, smoothed steering and a steering limit that reduces as speed rises.
- Front wheels steer; rear wheels provide drive. The visible wheel assemblies update from the physics transforms after each simulation step.
- The asset's original combined static wheel component meshes are hidden at runtime, and four separate wheel visuals are rendered at the measured tire locations so that rotation and steering remain visible.
- If the external model or Draco decoder cannot be reached, a built-in fallback car remains drivable.

## Vehicle model and attribution

The main car is a prepared exterior derivative of **Lamborghini Huracán Performante**, originally by **George (georgezaky108)**. The creator's listing identifies the work as **Creative Commons Attribution (CC BY)**; the live listing does not specify a version. The prepared derivative and attribution notice are hosted in the public repository below. Full attribution and modification notes are in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md).

- Source and attribution listing: https://blendswap.com/blend/20021
- Original creator post: https://blenderartists.org/t/lamborghini-huracan-performante/692996
- Prepared GLB used at runtime: https://github.com/seemorecodez/philadelphia-violent/blob/main/public/models/huracan-performante.glb
- License and geometry metadata: https://github.com/seemorecodez/philadelphia-violent/tree/main/public/models
- CC BY license family: https://creativecommons.org/licenses/by/4.0/

The runtime fetches the model from its public source rather than committing the 2.6 MB binary into this repository. A network connection is required for the detailed model. This is an exterior model without a modeled cabin interior, and it is not an official manufacturer asset or endorsement.

## Performance notes

- Antialiasing off and device pixel ratio capped at 1.25 by default.
- One directional shadow light with a modest shadow map.
- No post-processing or large environment map.
- One chassis and four raycast wheels rather than four additional dynamic wheel bodies.

The chosen Huracán model contains about 711,690 triangles. That is a detailed starting asset, but it still needs profiling on the target machine. If integrated graphics struggle, the next optimization should be a reduced-detail GLB/LOD while preserving the silhouette and wheel behavior.

## Build validation

A GitHub Actions workflow runs `npm install` and `npm run build` on pushes and pull requests to `main`. The execution environment for this change could not access GitHub/NPM directly, so a successful local production build has not yet been independently confirmed.

## Scope

This is milestone one, not a complete Forza Horizon clone. Roads, terrain, traffic, sound, damage, additional vehicles and a larger open world come after driving, wheel alignment and performance are validated.
