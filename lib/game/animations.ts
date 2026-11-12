export const AUTOMATIC = {
  idle: "Idle_4",
  walk: "Walking",
  run: "Running",
  fall: "Fall2",
};
export type ActionKind =
  | "flip"
  | "wall"
  | "vault"
  | "climb"
  | "ladder"
  | "dive"
  | "rope"
  | "dance"
  | "kick"
  | "charge"
  | "jump";
export type Move = {
  key: string;
  name: string;
  clip: string;
  kind: ActionKind;
  duration: number;
  hint: string;
  retainOnDescent?: boolean;
  loop?: boolean;
  combat?: {kind: "melee" | "laser"; damage: number};
};
export const MOVES: Move[] = [
  {
    key: "V",
    name: "Front flip",
    clip: "_01a19148_1a51_7423_afdc_456891436974",
    kind: "flip",
    duration: 0.95,
    hint: "Jump into a forward rotation",
  },
  {
    key: "B",
    name: "Backflip",
    clip: "Backflip",
    kind: "flip",
    duration: 1.05,
    hint: "Grounded backward rotation",
  },
  {
    key: "N",
    name: "Flip + hooks",
    clip: "Backflip_and_Hooks",
    kind: "flip",
    duration: 175 / 30,
    retainOnDescent: true,
    hint: "Aerial freestyle combination",
  },
  {
    key: "M",
    name: "Wall flip",
    clip: "Wall_Flip",
    kind: "wall",
    duration: 2,
    retainOnDescent: true,
    hint: "Face a nearby wall to push off",
  },
  {
    key: "G",
    name: "Vault + roll",
    clip: "Parkour_Vault_with_Roll",
    kind: "vault",
    duration: 62 / 30,
    retainOnDescent: true,
    hint: "Face a low obstacle to vault",
  },
  {
    key: "H",
    name: "Climb left",
    clip: "Hang_and_Climb_Left",
    kind: "climb",
    duration: 62 / 30,
    hint: "Face a ledge to climb left",
  },
  {
    key: "K",
    name: "Climb right",
    clip: "Hang_and_Climb_Rght",
    kind: "climb",
    duration: 62 / 30,
    hint: "Face a ledge to climb right",
  },
  {
    key: "L",
    name: "Ladder climb",
    clip: "Slow_Ladder_Climb",
    kind: "ladder",
    duration: 3,
    hint: "Stand at either yellow ladder near spawn",
  },
  {
    key: "T",
    name: "Dive + land",
    clip: "Dive_Down_and_Land",
    kind: "dive",
    duration: 0.9,
    hint: "Dive while airborne",
  },
  {
    key: "Y",
    name: "Vertical dive",
    clip: "Dive_Down_and_Land_1",
    kind: "dive",
    duration: 0.9,
    hint: "Dive while airborne",
  },
  {
    key: "U",
    name: "Twist + land",
    clip: "Dive_Down_and_Land_2",
    kind: "dive",
    duration: 0.9,
    hint: "Dive while airborne",
  },
  {
    key: "I",
    name: "Rope hang",
    clip: "Upside_Down_Rope_Hang",
    kind: "rope",
    duration: 2.8,
    hint: "Jump near the hanging rope; Space releases",
  },
  {
    key: "7",
    name: "Breakdance",
    clip: "Breakdance_1990",
    kind: "dance",
    duration: 4,
    hint: "Grounded freestyle; movement cancels",
  },
  {
    key: "8",
    name: "Double kick",
    clip: "Double_kick_forward",
    kind: "kick",
    duration: 1.2,
    hint: "Grounded freestyle kick",
  },
  {
    key: "9",
    name: "Forward charge",
    clip: "Standard_Forward_Charge",
    kind: "charge",
    duration: 1,
    hint: "Grounded burst of speed",
  },
  {
    key: "0",
    name: "Regular jump",
    clip: "Regular_Jump",
    kind: "jump",
    duration: 0.8,
    hint: "Same as Space; two jumps available",
  },
];
export function resolveMotion(
  grounded: boolean,
  vy: number,
  moving: boolean,
  sprint: boolean,
  move?: Move,
  automatic = AUTOMATIC,
) {
  // Uncontrolled descent uses Fall2. Deliberate dives and attached traversal keep their authored pose.
  if (
    !grounded &&
    vy < -0.8 &&
    !move?.retainOnDescent &&
    move?.kind !== "rope" &&
    move?.kind !== "ladder" &&
    move?.kind !== "climb" &&
    move?.kind !== "dive"
  )
    return automatic.fall;
  if (move) return move.clip;
  if (!grounded) return "Regular_Jump";
  return moving ? (sprint ? automatic.run : automatic.walk) : automatic.idle;
}
