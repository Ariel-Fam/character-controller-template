import * as THREE from 'three';

// Metres per second: Shift cycles back to normal after four presses.
export const FLIGHT_SPEEDS = [6, 10, 60 / 3.6, 32] as const;
export function advanceFlightGear(gear: number) { return (gear + 1) % FLIGHT_SPEEDS.length; }

/** Parallel transport keeps the controls continuous across both planet poles. */
export function transportSurfaceFrame(frame: THREE.Quaternion, up: THREE.Vector3) {
  const previousUp = new THREE.Vector3(0, 1, 0).applyQuaternion(frame);
  return frame.premultiply(new THREE.Quaternion().setFromUnitVectors(previousUp, up)).normalize();
}
