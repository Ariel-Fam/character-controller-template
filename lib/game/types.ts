export type Vec3 = [number, number, number];
export type CourseMotion = {
  id: string;
  from: Vec3;
  to: Vec3;
  size: Vec3;
  period: number;
  phase: number;
};
export type CourseHazard = CourseMotion & { kind: "laser" | "dozer" };
export type Level = {
  id: number;
  name: string;
  tag: string;
  difficulty: string;
  par: number;
  spawn: Vec3;
  checkpoints: Vec3[];
  colliders: { position: Vec3; size: Vec3; rotation: number }[];
  ladders: Vec3[];
  rope: Vec3 | null;
  mode?: "course" | "explore";
  bounds?: { min: Vec3; max: Vec3 };
  movingPlatforms?: CourseMotion[];
  hazards?: CourseHazard[];
  revision?: number;
};
export type Settings = {
  volume: number;
  musicVolume: number;
  sfxMuted: boolean;
  musicMuted: boolean;
  character: "runner" | "intergalactron" | "cyberroid" | "cubehelix";
  sensitivity: number;
  shadows: boolean;
  color: string;
};
export type Telemetry = {
  speed: number;
  sprint: boolean;
  motion: string;
  checkpoint: number;
  seconds: number;
  falls: number;
  notice: string;
  flying?: boolean;
  flightGear?: number;
  altitude?: number;
};
export const DEFAULT_SETTINGS: Settings = {
  volume: 0.5,
  musicVolume: 0.3,
  sfxMuted: false,
  musicMuted: false,
  character: "runner",
  sensitivity: 1,
  shadows: true,
  color: "#b64cff",
};
export const INITIAL_TELEMETRY: Telemetry = {
  speed: 0,
  sprint: false,
  motion: "Idle",
  checkpoint: 0,
  seconds: 0,
  falls: 0,
  notice: "Follow the glowing checkpoints in order.",
};
