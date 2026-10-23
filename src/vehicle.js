import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Detailed Huracán Performante exterior derivative. The source model's
// license and attribution are documented in README.md.
const MODEL_URL =
  'https://raw.githubusercontent.com/seemorecodez/philadelphia-violent/main/public/models/huracan-performante.glb';
const STATIC_WHEEL_COMPONENTS = new Set([
  'Circle', 'Circle.001', 'Circle.002', 'Circle.003', 'Circle.005',
]);

// Centers measured from the model's published metadata. +Z is forward, +Y up.
// Left/right labels follow the asset metadata's coordinate convention.
const WHEEL_POINTS = [
  [ 0.7488, -0.24,  1.1679],
  [-0.7488, -0.24,  1.1679],
  [ 0.7423, -0.24, -1.3776],
  [-0.7423, -0.24, -1.3776],
];

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04, ...options });
}

function createFallbackBody(parent) {
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x94d52d, metalness: 0.55, roughness: 0.25, clearcoat: 0.85, clearcoatRoughness: 0.2,
  });
  const dark = makeMaterial(0x101722, { roughness: 0.28, metalness: 0.15 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x192534, roughness: 0.12, metalness: 0.25, transmission: 0.08, transparent: true, opacity: 0.96,
  });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xeaf5ff, emissive: 0xd8eaff, emissiveIntensity: 1.1 });
  const red = new THREE.MeshStandardMaterial({ color: 0xf02536, emissive: 0x6e0712, emissiveIntensity: 0.55 });
  const addBox = (size, position, material, bevel = false) => {
    const geometry = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // +Z is the forward direction in the physics and render scenes.
  addBox([1.78, 0.36, 3.72], [0, -0.33, -0.02], paint);
  addBox([1.65, 0.22, 1.1], [0, -0.18, 1.37], paint);
  const cabin = addBox([1.22, 0.42, 1.42], [0, -0.03, -0.12], glass);
  cabin.scale.set(1, 1, 1);
  addBox([1.48, 0.10, 0.86], [0, -0.02, -0.69], paint);
  addBox([1.84, 0.07, 0.22], [0, -0.49, 1.81], dark);
  for (const x of [-0.61, 0.61]) {
    addBox([0.3, 0.065, 0.08], [x, -0.19, 1.84], lamp);
    addBox([0.29, 0.06, 0.075], [x, -0.22, -1.86], red);
    addBox([0.16, 0.1, 0.34], [x * 1.46, -0.22, -0.12], dark);
  }
  const wing = addBox([1.55, 0.07, 0.22], [0, 0.13, -1.75], dark);
  wing.rotation.x = -0.035;
}

function makeWheelVisual(scene) {
  const root = new THREE.Group();
  const tireMaterial = makeMaterial(0x15181d, { roughness: 0.92 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xbac2ce, metalness: 0.84, roughness: 0.29 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x313b49, metalness: 0.78, roughness: 0.35 });
  const caliperMaterial = new THREE.MeshStandardMaterial({ color: 0xe43c40, metalness: 0.28, roughness: 0.42 });
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.324, 0.324, 0.18, 28, 1), tireMaterial);
  tire.geometry.rotateZ(Math.PI / 2);
  tire.castShadow = true;
  tire.receiveShadow = true;
  root.add(tire);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.022, 24), rimMaterial);
    rim.geometry.rotateZ(Math.PI / 2);
    rim.position.x = side * 0.078;
    root.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.176, 0.176, 0.014, 24), darkMaterial);
    disc.geometry.rotateZ(Math.PI / 2);
    disc.position.x = side * 0.064;
    root.add(disc);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16), rimMaterial);
    hub.geometry.rotateZ(Math.PI / 2);
    hub.position.x = side * 0.086;
    root.add(hub);
    for (let i = 0; i < 5; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.17, 0.035), rimMaterial);
      spoke.position.x = side * 0.082;
      spoke.rotation.x = (Math.PI * 2 * i) / 5;
      root.add(spoke);
    }
  }
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.15, 0.11), caliperMaterial);
  caliper.position.set(0.072, 0.09, 0.055);
  root.add(caliper);
  scene.add(root);
  return root;
}

export function createVehicle(world, scene, setStatus) {
  const chassis = new CANNON.Body({
    mass: 1450,
    material: new CANNON.Material('car-chassis'),
    position: new CANNON.Vec3(0, 0.72, 0),
    linearDamping: 0.025,
    angularDamping: 0.42,
    allowSleep: false,
  });
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.84, 0.24, 1.98)));
  chassis.updateMassProperties();

  // Cannon's raycast vehicle uses +Z forward for this scene.
  const vehicle = new CANNON.RaycastVehicle({
    chassisBody: chassis,
    indexForwardAxis: 2,
    indexRightAxis: 0,
    indexUpAxis: 1,
  });

  WHEEL_POINTS.forEach(([x, y, z], index) => {
    vehicle.addWheel({
      radius: 0.324,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(x, y, z),
      suspensionStiffness: 34,
      suspensionRestLength: 0.16,
      maxSuspensionTravel: 0.22,
      frictionSlip: 5.3,
      dampingRelaxation: 2.3,
      dampingCompression: 4.6,
      maxSuspensionForce: 18000,
      rollInfluence: 0.08,
      isFrontWheel: index < 2,
    });
  });
  vehicle.addToWorld(world);

  const visualRoot = new THREE.Group();
  scene.add(visualRoot);
  const fallbackRoot = new THREE.Group();
  visualRoot.add(fallbackRoot);
  createFallbackBody(fallbackRoot);

  let wheelVisuals = WHEEL_POINTS.map(() => makeWheelVisual(scene));
  const model = { loaded: false, label: 'Loading Lamborghini Huracán Performante model', source: MODEL_URL };

  function reset() {
    chassis.position.set(0, 0.72, 0);
    chassis.quaternion.set(0, 0, 0, 1);
    chassis.velocity.set(0, 0, 0);
    chassis.angularVelocity.set(0, 0, 0);
    chassis.force.set(0, 0, 0);
    chassis.torque.set(0, 0, 0);
    for (const info of vehicle.wheelInfos) {
      info.rotation = 0;
      info.deltaRotation = 0;
      info.steering = 0;
      info.engineForce = 0;
      info.brake = 0;
    }
  }

  function updateControls(keys, dt) {
    const signedSpeed = vehicle.currentVehicleSpeedKmHour / 3.6;
    const forward = keys.has('KeyW') || keys.has('ArrowUp');
    const reverse = keys.has('KeyS') || keys.has('ArrowDown');
    const handBrake = keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight');
    const steerInput =
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);

    const speedFactor = THREE.MathUtils.clamp(Math.abs(signedSpeed) / 42, 0, 1);
    const maxSteerAngle = THREE.MathUtils.lerp(0.49, 0.135, speedFactor);
    updateControls.steer = THREE.MathUtils.damp(updateControls.steer, steerInput, 7.5, dt);
    const steerAngle = updateControls.steer * maxSteerAngle;

    vehicle.setSteeringValue(steerAngle, 0);
    vehicle.setSteeringValue(steerAngle, 1);
    vehicle.setSteeringValue(0, 2);
    vehicle.setSteeringValue(0, 3);

    let engineForce = 0;
    let brakeForce = handBrake ? 9000 : 0;
    const maxForwardSpeed = 50; // 180 km/h target, in metres per second.

    if (!handBrake && forward) {
      if (signedSpeed < -0.8) {
        brakeForce = 6500;
      } else if (signedSpeed < maxForwardSpeed) {
        engineForce = -6200;
      }
    } else if (!handBrake && reverse) {
      if (signedSpeed > 0.8) {
        brakeForce = 6500;
      } else if (signedSpeed > -9) {
        engineForce = 3000;
      }
    }

    for (let i = 0; i < 4; i += 1) {
      vehicle.applyEngineForce(i >= 2 ? engineForce : 0, i);
      vehicle.setBrake(brakeForce, i);
    }

    // A small quadratic drag keeps coasting and top-speed behavior controlled.
    const velocity = chassis.velocity;
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    if (horizontalSpeed > 0.1) {
      const drag = 1.35 * horizontalSpeed;
      chassis.applyForce(new CANNON.Vec3(-velocity.x * drag, 0, -velocity.z * drag), chassis.position);
    }
  }
  updateControls.steer = 0;

  function updateVisuals() {
    visualRoot.position.set(chassis.position.x, chassis.position.y, chassis.position.z);
    visualRoot.quaternion.set(chassis.quaternion.x, chassis.quaternion.y, chassis.quaternion.z, chassis.quaternion.w);
    for (let i = 0; i < 4; i += 1) {
      vehicle.updateWheelTransform(i);
      const transform = vehicle.wheelInfos[i].worldTransform;
      wheelVisuals[i].position.set(transform.position.x, transform.position.y, transform.position.z);
      wheelVisuals[i].quaternion.set(
        transform.quaternion.x,
        transform.quaternion.y,
        transform.quaternion.z,
        transform.quaternion.w,
      );
    }
  }

  function getTelemetry() {
    const speed = vehicle.currentVehicleSpeedKmHour;
    const forward = speed > 1.2;
    const reverse = speed < -1.2;
    return {
      speedKmh: Math.round(Math.abs(speed)),
      signedSpeed: speed,
      gear: forward ? 'D' : reverse ? 'R' : 'N',
      steerDegrees: Math.round(updateControls.steer * 28),
      groundedWheels: vehicle.numWheelsOnGround,
    };
  }

  async function loadModel() {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);

    let gltf;
    try {
      gltf = await loader.loadAsync(MODEL_URL);
    } finally {
      dracoLoader.dispose();
    }

    // Published asset coordinates are already +Y up and +Z forward, normalized
    // to 4.506 m long, with the tires at y=0. The physics root sits at y=0.72.
    const assetRoot = new THREE.Group();
    assetRoot.position.y = -0.72;
    assetRoot.add(gltf.scene);
    visualRoot.add(assetRoot);
    visualRoot.updateMatrixWorld(true);

    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      // These nodes combine the four static wheel assemblies into shared meshes.
      // Hide them and render one separate, physics-driven assembly per wheel.
      if (STATIC_WHEEL_COMPONENTS.has(object.name)) object.visible = false;
    });

    fallbackRoot.removeFromParent();
    model.loaded = true;
    model.label = 'Lamborghini Huracán Performante model loaded';
    setStatus('HURACÁN READY · 4 PHYSICS-DRIVEN WHEELS');
    return { clips: gltf.animations?.length || 0, detailedWheelCount: 4 };
  }

  loadModel()
    .then(({ clips, detailedWheelCount }) => {
      model.label = 'Huracán model · four physics-driven wheel visuals';
      setStatus(`HURACÁN READY · ${detailedWheelCount}/4 DYNAMIC WHEELS`);
    })
    .catch((error) => {
      console.warn('External car asset could not be loaded; using the built-in fallback car.', error);
      model.label = 'Fallback car active; model download unavailable';
      setStatus('FALLBACK CAR · CHECK MODEL NETWORK ACCESS');
    });

  return { chassis, vehicle, visualRoot, updateControls, updateVisuals, getTelemetry, reset, model };
}
