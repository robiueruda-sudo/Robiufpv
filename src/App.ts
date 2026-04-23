import * as THREE from 'three';
import { Drone } from './Drone';
import { Environment } from './Environment';
import { Controls } from './Controls';
import { HUD } from './HUD';
import { Audio } from './Audio';

export class App {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private drone: Drone;
  private environment: Environment;
  private controls: Controls;
  private hud: HUD;
  private audio: Audio;

  private lastTime = 0;
  private elapsed = 0;
  private animFrameId = 0;
  private wasArmed = false;
  private wasCrashed = false;

  constructor(container: HTMLElement, hudCanvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8ab0c8, 0.008);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Camera (FPV)
    this.camera = new THREE.PerspectiveCamera(
      90, // Wide FOV for FPV feel
      window.innerWidth / window.innerHeight,
      0.01,
      800
    );

    // Modules
    this.drone = new Drone();
    this.environment = new Environment(this.scene);
    this.controls = new Controls();
    this.hud = new HUD(hudCanvas);
    this.audio = new Audio();

    // Add drone mesh to scene
    this.scene.add(this.drone.getDroneMesh());

    // Resize handler
    window.addEventListener('resize', this.onResize.bind(this));
  }

  start(): void {
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame(this.onFrame.bind(this));
  }

  private onFrame(now: number): void {
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamp dt to avoid spiral of death on tab switch
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    this.loop(dt);

    this.animFrameId = requestAnimationFrame(this.onFrame.bind(this));
  }

  private loop(dt: number): void {
    const state = this.drone.getState();

    // --- Reset ---
    if (this.controls.shouldReset()) {
      this.drone.reset();
      this.hud.resetBattery();
      this.wasCrashed = false;
      return;
    }

    // --- Arm toggle ---
    if (this.controls.consumeToggleArm()) {
      if (!state.crashed) {
        if (state.armed) {
          this.drone.disarm();
        } else {
          this.drone.arm();
        }
      }
    }

    // --- Crash detection ---
    if (state.crashed && !this.wasCrashed) {
      this.wasCrashed = true;
      this.audio.playCrash();
    }

    // --- Input & physics ---
    const input = this.controls.getInput();
    this.drone.update(dt, input);

    // --- Environment ---
    this.environment.update(dt, this.elapsed);

    // --- Audio ---
    this.audio.update(state);

    // --- Camera ---
    this.updateCamera();

    // --- HUD ---
    this.hud.update(state, dt);
    this.hud.draw(state);

    // --- Render ---
    this.renderer.render(this.scene, this.camera);

    this.wasArmed = state.armed;
  }

  private updateCamera(): void {
    const state = this.drone.getState();

    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(state.rotation);

    // Camera mount is at +X on the drone mesh, but Three.js cameras look along -Z.
    // Rotating -90° around Y maps the camera's -Z look direction onto the drone's +X (forward).
    const faceForward = new THREE.Quaternion();
    faceForward.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);

    // 15° upward tilt (in camera local space) — like a real FPV camera mount
    const tiltUp = new THREE.Quaternion();
    tiltUp.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(15));

    this.camera.quaternion.copy(quaternion).multiply(faceForward).multiply(tiltUp);

    // Position: offset forward and slightly up along drone's local axes
    const localOffset = new THREE.Vector3(0.05, 0.02, 0);
    localOffset.applyQuaternion(quaternion);
    this.camera.position.copy(state.position).add(localOffset);
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.hud.resize();
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
    this.audio.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }

  // Expose for debugging
  getWasArmed(): boolean {
    return this.wasArmed;
  }
}
