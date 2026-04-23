import * as THREE from 'three';
import { DroneState, ControlInput } from './types';

const GRAVITY = -9.81;
const MASS = 0.8; // kg
const KT = 12.0; // thrust coefficient per motor
const DRAG_LINEAR = 0.15;
const DRAG_ANGULAR = 4.5;
const MAX_ANGULAR_ACCEL = 18.0;
const CRASH_VELOCITY_THRESHOLD = 6.0;
const ARM_LENGTH = 0.18; // meters from center to motor

// Motor indices: [front-right, back-right, back-left, front-left]
// CW: 0, 2 (front-right, back-left) | CCW: 1, 3 (back-right, front-left)
const MOTOR_SPIN_DIR = [1, -1, 1, -1]; // 1=CW, -1=CCW

export class Drone {
  private state: DroneState;
  private mesh: THREE.Group;
  private propDiscs: THREE.Mesh[] = [];
  private propRotations: number[] = [0, 0, 0, 0];
  private motorThrottles: number[] = [0, 0, 0, 0];

  // Internal throttle target (0-1)
  private throttleLevel = 0;

  constructor() {
    this.state = {
      position: new THREE.Vector3(0, 2, 0),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
      angularVelocity: new THREE.Vector3(),
      throttle: 0,
      armed: false,
      crashed: false,
    };
    this.mesh = this.buildMesh();
  }

  private buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // Central body (carbon fiber look)
    const bodyGeo = new THREE.BoxGeometry(0.15, 0.04, 0.10);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.6,
      metalness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    // Top plate accent
    const topGeo = new THREE.BoxGeometry(0.13, 0.01, 0.09);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.7 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.025;
    group.add(top);

    // Camera mount (front)
    const camGeo = new THREE.BoxGeometry(0.025, 0.025, 0.015);
    const camMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const cam = new THREE.Mesh(camGeo, camMat);
    cam.position.set(0.065, 0.01, 0);
    group.add(cam);

    // Camera lens
    const lensGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x222266, roughness: 0.1, metalness: 0.9 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.078, 0.01, 0);
    group.add(lens);

    // Arms and motors
    const armPositions = [
      { x:  ARM_LENGTH, z:  ARM_LENGTH, angle: -Math.PI / 4 },
      { x: -ARM_LENGTH, z:  ARM_LENGTH, angle:  Math.PI / 4 },
      { x: -ARM_LENGTH, z: -ARM_LENGTH, angle: -Math.PI / 4 },
      { x:  ARM_LENGTH, z: -ARM_LENGTH, angle:  Math.PI / 4 },
    ];

    const armMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.3 });
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 });

    const ledColors = [0x00ff00, 0x00ff00, 0xff0000, 0xff0000]; // front: green, back: red
    const ledPositions = [
      { x:  ARM_LENGTH * 1.05, z:  ARM_LENGTH * 1.05 }, // front-right
      { x: -ARM_LENGTH * 1.05, z:  ARM_LENGTH * 1.05 }, // back-right
      { x: -ARM_LENGTH * 1.05, z: -ARM_LENGTH * 1.05 }, // back-left
      { x:  ARM_LENGTH * 1.05, z: -ARM_LENGTH * 1.05 }, // front-left
    ];

    for (let i = 0; i < 4; i++) {
      const ap = armPositions[i];

      // Arm
      const armLen = Math.sqrt(ap.x * ap.x + ap.z * ap.z) * 2 * 0.9;
      const armGeo = new THREE.BoxGeometry(armLen, 0.012, 0.018);
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(ap.x / 2, 0, ap.z / 2);
      arm.rotation.y = ap.angle;
      arm.castShadow = true;
      group.add(arm);

      // Motor mount
      const mountGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.022, 12);
      const mount = new THREE.Mesh(mountGeo, motorMat);
      mount.position.set(ap.x, 0.002, ap.z);
      mount.castShadow = true;
      group.add(mount);

      // Prop disc (translucent spinning)
      const propGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.003, 24);
      const propMat = new THREE.MeshStandardMaterial({
        color: 0x88aaff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
      const prop = new THREE.Mesh(propGeo, propMat);
      prop.position.set(ap.x, 0.018, ap.z);
      group.add(prop);
      this.propDiscs.push(prop);

      // Prop blades
      for (let b = 0; b < 2; b++) {
        const bladeGeo = new THREE.BoxGeometry(0.13, 0.002, 0.018);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.y = (b * Math.PI) / 2;
        prop.add(blade);
      }

      // LED
      const ledGeo = new THREE.SphereGeometry(0.005, 6, 6);
      const ledMat = new THREE.MeshStandardMaterial({
        color: ledColors[i],
        emissive: ledColors[i],
        emissiveIntensity: 1.5,
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      const lp = ledPositions[i];
      led.position.set(lp.x, 0.01, lp.z);
      group.add(led);
    }

    group.castShadow = true;
    group.receiveShadow = false;

    return group;
  }

  update(dt: number, input: ControlInput): void {
    if (this.state.crashed) return;
    if (!this.state.armed) {
      // Slowly settle to ground if unarmed
      this.state.velocity.y += GRAVITY * dt;
      this.state.position.addScaledVector(this.state.velocity, dt);
      if (this.state.position.y <= 0) {
        this.state.position.y = 0;
        this.state.velocity.set(0, 0, 0);
        this.state.angularVelocity.set(0, 0, 0);
      }
      this.syncMesh();
      return;
    }

    // Update throttle level (sticky throttle)
    this.throttleLevel = THREE.MathUtils.clamp(
      this.throttleLevel + input.throttle * dt * 1.2,
      0, 1
    );

    // Compute per-motor throttles for differential thrust
    // Motor order: [front-right, back-right, back-left, front-left]
    // Roll:  right = motors 0,1 down, left = motors 2,3 down (positive roll = right)
    // Pitch: forward = motors 0,3 increase (positive pitch = nose down / forward tilt)
    // Yaw:   CW pair (0,2) vs CCW pair (1,3)
    const roll  = THREE.MathUtils.clamp(input.roll,  -1, 1);
    const pitch = THREE.MathUtils.clamp(input.pitch, -1, 1);
    const yaw   = THREE.MathUtils.clamp(input.yaw,   -1, 1);

    const rollAmt  = roll  * 0.3;
    const pitchAmt = pitch * 0.3;
    const yawAmt   = yaw   * 0.15;

    // front-right, back-right, back-left, front-left
    this.motorThrottles[0] = this.throttleLevel - pitchAmt - rollAmt + yawAmt; // FR: CW
    this.motorThrottles[1] = this.throttleLevel + pitchAmt - rollAmt - yawAmt; // BR: CCW
    this.motorThrottles[2] = this.throttleLevel + pitchAmt + rollAmt + yawAmt; // BL: CW
    this.motorThrottles[3] = this.throttleLevel - pitchAmt + rollAmt - yawAmt; // FL: CCW

    for (let i = 0; i < 4; i++) {
      this.motorThrottles[i] = THREE.MathUtils.clamp(this.motorThrottles[i], 0, 1);
    }

    const totalThrottle = this.motorThrottles.reduce((a, b) => a + b, 0) / 4;
    this.state.throttle = totalThrottle;

    // Total thrust (world up direction rotated by drone orientation)
    const totalThrust = KT * totalThrottle * totalThrottle * MASS;

    // Drone's local up in world space
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(this.state.rotation);
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);

    // Forces
    const thrustForce = localUp.multiplyScalar(totalThrust / MASS);
    const gravityForce = new THREE.Vector3(0, GRAVITY, 0);
    const dragForce = this.state.velocity.clone().multiplyScalar(-DRAG_LINEAR);

    const totalForce = thrustForce.add(gravityForce).add(dragForce);

    // Update velocity and position
    this.state.velocity.addScaledVector(totalForce, dt);
    this.state.position.addScaledVector(this.state.velocity, dt);

    // Torques for rotation (angular acceleration)
    // Differential thrust creates roll/pitch torques
    // front motors - back motors = pitch torque
    // right motors - left motors = roll torque
    const frontThrust = (this.motorThrottles[0] + this.motorThrottles[3]) / 2;
    const backThrust  = (this.motorThrottles[1] + this.motorThrottles[2]) / 2;
    const rightThrust = (this.motorThrottles[0] + this.motorThrottles[1]) / 2;
    const leftThrust  = (this.motorThrottles[2] + this.motorThrottles[3]) / 2;

    // CW motors (0,2) - CCW motors (1,3) = yaw torque
    const cwThrust  = (this.motorThrottles[0] + this.motorThrottles[2]) / 2;
    const ccwThrust = (this.motorThrottles[1] + this.motorThrottles[3]) / 2;

    // Local-space angular acceleration
    const pitchAccel = (frontThrust - backThrust)  * MAX_ANGULAR_ACCEL * 2;
    const rollAccel  = (rightThrust - leftThrust)   * MAX_ANGULAR_ACCEL * 2;
    const yawAccel   = (cwThrust - ccwThrust)        * MAX_ANGULAR_ACCEL;

    const angularAccel = new THREE.Vector3(pitchAccel, yawAccel, -rollAccel);

    // Apply angular drag
    const angDrag = this.state.angularVelocity.clone().multiplyScalar(-DRAG_ANGULAR);
    this.state.angularVelocity.addScaledVector(angularAccel, dt);
    this.state.angularVelocity.addScaledVector(angDrag, dt);

    // Update rotation via euler integration
    this.state.rotation.x += this.state.angularVelocity.x * dt;
    this.state.rotation.y += this.state.angularVelocity.y * dt;
    this.state.rotation.z += this.state.angularVelocity.z * dt;

    // Clamp pitch/roll to avoid gimbal flip
    this.state.rotation.x = THREE.MathUtils.clamp(this.state.rotation.x, -Math.PI / 2.2, Math.PI / 2.2);
    this.state.rotation.z = THREE.MathUtils.clamp(this.state.rotation.z, -Math.PI / 2.2, Math.PI / 2.2);

    // Ground collision
    if (this.state.position.y <= 0) {
      const impactSpeed = -this.state.velocity.y;
      if (impactSpeed > CRASH_VELOCITY_THRESHOLD) {
        this.state.crashed = true;
        this.state.position.y = 0;
        this.state.velocity.set(0, 0, 0);
      } else {
        this.state.position.y = 0;
        this.state.velocity.y = Math.max(0, this.state.velocity.y);
        this.state.velocity.x *= 0.7;
        this.state.velocity.z *= 0.7;
        this.state.angularVelocity.multiplyScalar(0.5);
      }
    }

    // Prop animation
    for (let i = 0; i < 4; i++) {
      const spinSpeed = this.motorThrottles[i] * 35 * MOTOR_SPIN_DIR[i];
      this.propRotations[i] += spinSpeed * dt;
      this.propDiscs[i].rotation.y = this.propRotations[i];
    }

    this.syncMesh();
  }

  private syncMesh(): void {
    this.mesh.position.copy(this.state.position);
    this.mesh.rotation.copy(this.state.rotation);
  }

  getState(): DroneState {
    return this.state;
  }

  getDroneMesh(): THREE.Group {
    return this.mesh;
  }

  reset(): void {
    this.state.position.set(0, 2, 0);
    this.state.velocity.set(0, 0, 0);
    this.state.rotation.set(0, 0, 0);
    this.state.angularVelocity.set(0, 0, 0);
    this.state.throttle = 0;
    this.state.armed = false;
    this.state.crashed = false;
    this.throttleLevel = 0;
    this.motorThrottles = [0, 0, 0, 0];
    this.syncMesh();
  }

  arm(): void {
    this.state.armed = true;
  }

  disarm(): void {
    this.state.armed = false;
    this.throttleLevel = 0;
  }
}
