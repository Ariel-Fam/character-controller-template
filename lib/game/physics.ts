/** Match the two rails and fourteen rungs authored in scripts/build_levels.py. */
export function ladderColliders([x, y, z]: readonly [number, number, number]) {
  const boxes: { position: [number, number, number]; size: [number, number, number] }[] = [];
  for (const side of [-1, 1])
    boxes.push({ position: [x + side * 0.45, y + 2.25, z], size: [0.11, 4.5, 0.11] });
  for (let rung = 0; rung < 14; rung++)
    boxes.push({ position: [x, y + rung * 0.32 + 0.2, z], size: [0.9, 0.09, 0.09] });
  return boxes;
}

/** Rapier can report retained floor contact on the first upward step beside a wall. */
export function resolveContact(
  reportedGrounded: boolean,
  desiredY: number,
  actualY: number,
  verticalVelocity: number,
  attached: boolean,
) {
  const grounded = reportedGrounded && desiredY <= 0 && !attached;
  const hitCeiling = desiredY > 0 && actualY < desiredY * 0.5;
  return { grounded, vy: grounded || hitCeiling ? 0 : verticalVelocity };
}
