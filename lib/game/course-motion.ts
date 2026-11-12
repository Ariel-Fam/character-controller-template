import type { CourseMotion, Vec3 } from "./types";

/** Fixed-step ping-pong motion with smooth turnarounds and no accumulated drift. */
export function coursePosition(motion: CourseMotion, seconds: number): Vec3 {
  const t =
    (1 - Math.cos((seconds / motion.period + motion.phase) * Math.PI * 2)) / 2;
  return motion.from.map(
    (start, axis) => start + (motion.to[axis] - start) * t,
  ) as Vec3;
}

export function platformCarry(
  current: { x: number; y: number; z: number },
  next: { x: number; y: number; z: number },
  supportDistance: number,
) {
  return {
    x: next.x - current.x,
    y: next.y - current.y + 0.945 - supportDistance,
    z: next.z - current.z,
  };
}
