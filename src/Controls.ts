import { ControlInput } from './types';

export class Controls {
  private keys: Set<string> = new Set();
  private armPressed = false;
  private resetPressed = false;
  private gpResetPressed = false;
  private _shouldReset = false;
  private _toggleArm = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);

    if (e.code === 'Space' && !this.armPressed) {
      this.armPressed = true;
      this._toggleArm = true;
    }

    if (e.code === 'KeyR' && !this.resetPressed) {
      this.resetPressed = true;
      this._shouldReset = true;
    }

    // Prevent default scrolling for arrow keys and space
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
    if (e.code === 'Space') this.armPressed = false;
    if (e.code === 'KeyR') this.resetPressed = false;
  }

  getInput(): ControlInput {
    let throttle = 0;
    let roll = 0;
    let pitch = 0;
    let yaw = 0;

    // Check gamepad first
    const gamepads = navigator.getGamepads?.() ?? [];
    let hasGamepad = false;

    for (const gp of gamepads) {
      if (!gp) continue;
      hasGamepad = true;

      // Left stick: Y=throttle, X=yaw
      const leftY  = -gp.axes[1]; // invert so up = positive
      const leftX  =  gp.axes[0];
      // Right stick: Y=pitch, X=roll
      const rightY = -gp.axes[3]; // invert
      const rightX =  gp.axes[2];

      const deadzone = 0.08;
      throttle = Math.abs(leftY)  > deadzone ? leftY  : 0;
      yaw      = Math.abs(leftX)  > deadzone ? leftX  : 0;
      pitch    = Math.abs(rightY) > deadzone ? rightY : 0;
      roll     = Math.abs(rightX) > deadzone ? rightX : 0;

      // Cross (button 0) = arm/disarm
      if (gp.buttons[0]?.pressed && !this.armPressed) {
        this.armPressed = true;
        this._toggleArm = true;
      } else if (!gp.buttons[0]?.pressed) {
        this.armPressed = false;
      }

      // Options (button 9) = reset
      if (gp.buttons[9]?.pressed && !this.gpResetPressed) {
        this.gpResetPressed = true;
        this._shouldReset = true;
      } else if (!gp.buttons[9]?.pressed) {
        this.gpResetPressed = false;
      }

      break;
    }

    if (!hasGamepad) {
      // Keyboard input
      // W/S = throttle up/down
      if (this.keys.has('KeyW')) throttle =  1;
      if (this.keys.has('KeyS')) throttle = -1;

      // A/D = yaw left/right
      if (this.keys.has('KeyA')) yaw = -1;
      if (this.keys.has('KeyD')) yaw =  1;

      // Arrow Up/Down = pitch
      if (this.keys.has('ArrowUp'))   pitch =  1;
      if (this.keys.has('ArrowDown')) pitch = -1;

      // Arrow Left/Right = roll
      if (this.keys.has('ArrowLeft'))  roll = -1;
      if (this.keys.has('ArrowRight')) roll =  1;
    }

    return { throttle, roll, pitch, yaw };
  }

  consumeToggleArm(): boolean {
    const val = this._toggleArm;
    this._toggleArm = false;
    return val;
  }

  shouldReset(): boolean {
    const val = this._shouldReset;
    this._shouldReset = false;
    return val;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
  }
}
