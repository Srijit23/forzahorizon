import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Original, detailed CC0 sports-car model (not a branded Lamborghini model).
// The source project and license are documented in README.md.
const MODEL_URL =
  'https://raw.githubusercontent.com/JaronKBragg7337/spectral-gt-rs/main/spectral_gt_rs_game_ready.glb';

const WHEEL_LABELS = ['Front_Left', 'Front_Right', 'Rear_Left', 'Rear_Right'];
const WHEEL_POINTS = [
  [-0.91, -0.16,  1.28],
  [ 0.91, -0.16,  1.28],
  [-0.91, -0.16, -1.28],
  [ 0.91, -0.16, -1.28],
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
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.486, 0.486, 0.22, 28, 1), tireMaterial);
  tire.geometry.rotateZ(Math.PI / 2);
  tire.castShadow = true;
  tire.receiveShadow = true;
  root.add(tire);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.026, 24), rimMaterial);
    rim.geometry.rotateZ(Math.PI / 2);
    rim.position.x = side * 0.105;
    root.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.016, 24), darkMaterial);
    disc.geometry.rotateZ(Math.PI / 2);
    disc.position.x = side * 0.087;
    root.add(disc);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 16), rimMaterial);
    hub.geometry.rotateZ(Math.PI / 2);
    hub.position.x = side * 0.126;
    root.add(hub);
    for (let i = 0; i < 5; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.25, 0.045), rimMaterial);
      spoke.position.x = side * 0.12;
      spoke.rotation.x = (Math.PI * 2 * i) / 5;
      root.add(spoke);
    }
  }
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.14), caliperMaterial);
  caliper.position.set(0.095, 0.13, 0.08);
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
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.86, 0.28, 2.12)));
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
      radius: 0.486,
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
  const model = { loaded: false, label: 'Loading CC0 sports-car model', source: MODEL_URL };

  function reset() {
    chassis.position.set(0, 0.82, 0);
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
    const gltf = await loader.loadAsync(MODEL_URL);
    const assetRoot = new THREE.Group();
    assetRoot.rotation.y = -Math.PI / 2; // Original asset faces +X; game forward is +Z.
    assetRoot.scale.setScalar(0.9);
    assetRoot.add(gltf.scene);

    // Calibrate in an isolated coordinate space before parenting to the moving
    // chassis. This avoids a model-load race if the player starts driving early.
    assetRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(assetRoot);
    const center = bounds.getCenter(new THREE.Vector3());
    assetRoot.position.set(-center.x, -0.72 - bounds.min.y, -center.z);
    visualRoot.add(assetRoot);
    visualRoot.updateMatrixWorld(true);

    const rootInverse = visualRoot.matrixWorld.clone().invert();
    const wheelParts = new Map(WHEEL_LABELS.map((label) => [label, []]));
    const partMatrices = new Map();

    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const match = object.name.match(/^(Front|Rear)_(Left|Right)_/i);
      if (!match) return;
      const label = `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}_${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}`;
      if (!wheelParts.has(label)) return;
      object.updateWorldMatrix(true, false);
      const localMatrix = rootInverse.clone().multiply(object.matrixWorld);
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const partBounds = object.geometry.boundingBox.clone().applyMatrix4(localMatrix);
      if (!partMatrices.has(label)) {
        partMatrices.set(label, []);
      }
      partMatrices.get(label).push({ object, localMatrix, partBounds });
      wheelParts.get(label).push(partBounds);
    });

    let detailedWheelCount = 0;
    for (let i = 0; i < WHEEL_LABELS.length; i += 1) {
      const label = WHEEL_LABELS[i];
      const parts = partMatrices.get(label) || [];
      if (parts.length === 0) continue;
      const assemblyBounds = new THREE.Box3();
      for (const part of parts) assemblyBounds.union(part.partBounds);
      const anchor = assemblyBounds.getCenter(new THREE.Vector3());
      const inverseAnchor = new THREE.Matrix4().makeTranslation(-anchor.x, -anchor.y, -anchor.z);
      const dynamicWheel = new THREE.Group();
      scene.add(dynamicWheel);

      for (const part of parts) {
        const child = part.object;
        const localToWheel = inverseAnchor.clone().multiply(part.localMatrix);
        child.removeFromParent();
        dynamicWheel.add(child);
        child.matrixAutoUpdate = false;
        child.matrix.copy(localToWheel);
        child.matrix.decompose(child.position, child.quaternion, child.scale);
        child.matrixAutoUpdate = false;
      }

      wheelVisuals[i].removeFromParent();
      wheelVisuals[i] = dynamicWheel;
      detailedWheelCount += 1;
    }

    fallbackRoot.removeFromParent();
    model.loaded = true;
    model.label = 'Detailed CC0 sports-car model loaded';
    setStatus('MODEL READY · RAYCAST VEHICLE ACTIVE');
    return { clips: gltf.animations?.length || 0, detailedWheelCount };
  }

  loadModel()
    .then(({ clips, detailedWheelCount }) => {
      model.label = 'Detailed CC0 model · wheel assemblies linked to physics';
      setStatus(`MODEL READY · ${detailedWheelCount}/4 DYNAMIC WHEELS · ${clips} ANIMATIONS`);
    })
    .catch((error) => {
      console.warn('External car asset could not be loaded; using the built-in fallback car.', error);
      model.label = 'Fallback car active; model download unavailable';
      setStatus('FALLBACK CAR · CHECK MODEL NETWORK ACCESS');
    });

  return { chassis, vehicle, visualRoot, updateControls, updateVisuals, getTelemetry, reset, model };
}
