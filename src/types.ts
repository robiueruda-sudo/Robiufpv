import * as THREE from 'three';

export interface DroneState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularVelocity: THREE.Vector3;
  throttle: number;
  armed: boolean;
  crashed: boolean;
}

export interface ControlInput {
  throttle: number;   // -1 to 1 (relative change)
  roll: number;       // -1 to 1
  pitch: number;      // -1 to 1
  yaw: number;        // -1 to 1
}
