import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createVehicle } from './vehicle.js';

const canvas = document.querySelector('#game-canvas');
const statusEl = document.querySelector('#status');
const loadingEl = document.querySelector('#loading');
const loadingTitle = document.querySelector('#loading-title');
const loadingDetail = document.querySelector('#loading-detail');
const spinner = document.querySelector('#spinner');
const speedEl = document.querySelector('#speed');
const gearEl = document.querySelector('#gear');
const steerEl = document.querySelector('#steer');

function setStatus(message) {
  statusEl.textContent = message;
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'low-power',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f5f8);

const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 220);
camera.position.set(0, 3, -7);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb4bfce, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 3.0);
sun.position.set(-5, 10, -4);
sun.castShadow = true;
sun.shadow.mapSize.set(768, 768);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 30;
sun.shadow.normalBias = 0.035;
scene.add(sun);
sun.target.position.set(0, 0, 0);
scene.add(sun.target);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(700, 700),
  new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.96, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.position.y = 0;
scene.add(ground);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 10;
world.defaultContactMaterial.friction = 0.55;
world.defaultContactMaterial.restitution = 0;

const groundBody = new CANNON.Body({ mass: 0, material: new CANNON.Material('ground') });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
groundBody.position.set(0, 0, 0);
world.addBody(groundBody);

const vehicle = createVehicle(world, scene, setStatus);
const keys = new Set();
const cameraTarget = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const forward = new THREE.Vector3(0, 0, 1);
const lookAt = new THREE.Vector3();
const clock = new THREE.Clock();
const FIXED_STEP = 1 / 60;
let accumulator = 0;
let lastTime = 0;
let firstRender = true;

function isTypingTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.code === 'KeyR') vehicle.reset();
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) keys.clear();
});

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function updateCamera(dt) {
  const position = vehicle.chassis.position;
  const rotation = vehicle.chassis.quaternion;
  forward.set(0, 0, 1).applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w));
  cameraDesired.set(position.x, position.y + 2.7, position.z).addScaledVector(forward, -6.8);
  cameraTarget.lerp(cameraDesired, 1 - Math.exp(-4.5 * dt));
  camera.position.copy(cameraTarget);
  lookAt.set(position.x, position.y + 0.55, position.z).addScaledVector(forward, 1.8);
  camera.lookAt(lookAt);
}

function updateHud() {
  const telemetry = vehicle.getTelemetry();
  speedEl.textContent = String(telemetry.speedKmh).padStart(3, '0');
  gearEl.textContent = telemetry.gear;
  steerEl.textContent = `${telemetry.steerDegrees > 0 ? '+' : ''}${telemetry.steerDegrees}°`;
}

function animate(now) {
  requestAnimationFrame(animate);
  const elapsed = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
  lastTime = now;
  const dt = Math.min(elapsed || clock.getDelta(), 0.05);

  vehicle.updateControls(keys, dt);
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 4) {
    world.step(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (steps === 4) accumulator = 0;

  vehicle.updateVisuals();
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);

  if (firstRender) {
    firstRender = false;
    loadingTitle.textContent = 'Loading detailed supercar';
    loadingDetail.textContent = 'The ground, physics and driving controls are ready. The attributed model is fetched from its public source.';
  }
}
resize();
setStatus('PHYSICS READY · LOADING CAR MODEL');
requestAnimationFrame(animate);

// Keep the loading card informative if the model host is unavailable. The physics
// fallback remains fully drivable either way.
const loadingTimeout = window.setTimeout(() => {
  if (!vehicle.model.loaded) {
    loadingEl.classList.add('hidden');
    if (vehicle.model.label.includes('unavailable')) {
      setStatus('FALLBACK CAR · MODEL HOST UNAVAILABLE');
    }
  }
}, 12000);

const pollLoading = window.setInterval(() => {
  if (vehicle.model.loaded) {
    loadingEl.classList.add('hidden');
    window.clearInterval(pollLoading);
    window.clearTimeout(loadingTimeout);
  } else if (vehicle.model.label.includes('unavailable')) {
    spinner.style.display = 'none';
    loadingTitle.textContent = 'Drive test ready';
    loadingDetail.textContent = 'The external model could not be reached, so the built-in fallback car is active. WASD still works.';
    loadingEl.classList.add('hidden');
    window.clearInterval(pollLoading);
    window.clearTimeout(loadingTimeout);
  }
}, 250);
