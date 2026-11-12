"use client";
import { useEffect, useRef, useMemo, useState, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  RigidBody,
  CapsuleCollider,
  useRapier,
  useBeforePhysicsStep,
  type RapierRigidBody,
  type RapierCollider,
} from "@react-three/rapier";
import * as THREE from "three";
import { resolveContact } from "@/lib/game/physics";
import { planetAt, inOpenSpace, flightTarget, canLand, HOVER_HEIGHT, ALTITUDE_STEP, type OrbitPlanet } from "@/lib/game/orbits";
import { FLIGHT_SPEEDS, advanceFlightGear, transportSurfaceFrame } from "@/lib/game/flight";
import { platformCarry } from "@/lib/game/course-motion";
import FlightAvatar from "./FlightAvatar";
import CombatEffects from "./CombatEffects";
import { characterDefinition } from "@/lib/game/characters";
import Avatar, { type AnimationState } from "./Avatar";
import {
  resolveMotion,
  type Move,
} from "@/lib/game/animations";
import type { Level, Settings, Telemetry, Vec3 } from "@/lib/game/types";
const DT = 1 / 60;
export default function Player({
  level,
  settings,
  paused,
  resetToken,
  onUpdate,
  onFinish,
  onPosition,
  isPositionReady,
  planets = [],
}: {
  level: Level;
  settings: Settings;
  paused: boolean;
  resetToken: number;
  onUpdate: (v: Telemetry) => void;
  onFinish: (seconds: number, falls: number) => void;
  onPosition?: (p: Vec3) => void;
  isPositionReady?: (p: Vec3) => boolean;
  planets?: OrbitPlanet[];
}) {
  const definition = characterDefinition(settings.character);
  const MOVES = definition.moves;
  const [flying, setFlying] = useState(false);
  const flight = useRef({
    gear: 0,
    reference: "",
    active: false,
    steps: 0,
    toggle: false,
    strafe: 0,
    ground: level.spawn[1],
    targetY: level.spawn[1] + 0.94 + HOVER_HEIGHT,
    hadGround: true,
    clearance: 3,
    altitudeHoldTime: 0,
    verticalVelocity: 0,
  });
  const surfaceFrame = useRef(new THREE.Quaternion());
  const surfaceUp = useRef(new THREE.Vector3(0, 1, 0));
  const lastSafeUp = useRef(new THREE.Vector3(0, 1, 0));
  const lastSafe = useRef<Vec3>(level.spawn);
  const lastSafePlanet = useRef(false);
  const body = useRef<RapierRigidBody>(null),
    collider = useRef<RapierCollider>(null),
    model = useRef<THREE.Group>(null);
  const { world, rapier } = useRapier();
  const { gl } = useThree();
  const keys = useRef(new Set<string>());
  const padAxes = useRef({x:0,z:0});
  const input = useRef({ jump: false, action: "", reset: false });
  const hazardHit = useRef("");
  const immunity = useRef(0);
  const orbit = useRef({ yaw: 0, pitch: 0.28, distance: 6, snap: true });
  const animation = useRef<AnimationState>({ clip: "Idle_4", epoch: 0 });
  const simulation = useRef({
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: false,
    jumps: 0,
    sprint: false,
    yaw: Math.PI,
    move: undefined as Move | undefined,
    remaining: 0,
    checkpoint: 0,
    seconds: 0,
    falls: 0,
    done: false,
    notice: "Follow the purple beacons in order.",
    noticeTime: 0,
    stepTime: 0,
    anchor: null as Vec3 | null,
    resetToken,
  });
  const controller = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null);
  const audio = useRef<Record<string, HTMLAudioElement>>({});
  const walkingSurface = useRef(false);
  const scratch = useMemo(
    () => ({
      target: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      direction: new THREE.Vector3(),
    }),
    [],
  );
  useEffect(() => {
    const c = world.createCharacterController(0.025);
    c.enableAutostep(0.25, 0.25, true);
    c.enableSnapToGround(0.2);
    c.setMaxSlopeClimbAngle(Math.PI / 4);
    c.setMinSlopeSlideAngle(Math.PI / 3);
    controller.current = c;
    return () => {
      controller.current = null;
      world.removeCharacterController(c);
    };
  }, [world]);
  useEffect(() => {
    for (const name of ["steps", "jump", "landing", "sfxSaiyon"])
      audio.current[name] = new Audio(`/sfx/${name}.mp3`);
    const sounds = audio.current;
    return () => {
      Object.values(sounds).forEach((a) => {
        a.pause();
        a.src = "";
      });
    };
  }, []);
  useEffect(() => {
    for (const [name, a] of Object.entries(audio.current)) {
      a.muted = settings.sfxMuted;
      a.volume = settings.volume * (name === "steps" ? 0.35 : 0.65);
    }
  }, [settings.volume, settings.sfxMuted]);
  useEffect(() => {
    if (!flying) {
      const activation = audio.current.sfxSaiyon;
      if (activation) {
        activation.pause();
        activation.currentTime = 0;
      }
    }
  }, [flying]);
  const sound = (name: string) => {
    const a = audio.current[name];
    if (a && settings.volume > 0 && !settings.sfxMuted) {
      a.volume = settings.volume * (name === "steps" ? 0.35 : 0.65);
      a.currentTime = 0;
      void a.play().catch(() => {});
    }
  };
  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false,
      dragDistance = 0;
    const clear = () => {
      padAxes.current={x:0,z:0};
      keys.current.clear();
      input.current.jump = false;
      input.current.action = "";
      dragging = false;
    };
    const padMove = (event:Event) => {padAxes.current=paused?{x:0,z:0}:(event as CustomEvent<{x:number;z:number}>).detail;};
    const padCamera = (event:Event) => {
      if(paused)return;const {x,y}=(event as CustomEvent<{x:number;y:number}>).detail;
      orbit.current.yaw-=x*2.4*settings.sensitivity;
      orbit.current.pitch=THREE.MathUtils.clamp(orbit.current.pitch+y*1.6*settings.sensitivity,.06,1.15);
    };
    window.addEventListener('parkour:gamepad-move',padMove);
    window.addEventListener('parkour:gamepad-camera',padCamera);
    const down = (e: KeyboardEvent) => {
      if (
        paused ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const key = e.code;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          key,
        )
      )
        e.preventDefault();
      keys.current.add(key);
      if (flight.current.active && (key === "KeyR" || key === "KeyF")) {
        if (!e.repeat) flight.current.targetY += key === "KeyR" ? ALTITUDE_STEP : -ALTITUDE_STEP;
        return;
      }
      if (e.repeat) return;
      if (key === "ShiftLeft" || key === "ShiftRight") {
        if (flight.current.active) flight.current.gear = advanceFlightGear(flight.current.gear);
        else simulation.current.sprint = !simulation.current.sprint;
      }
      if (key === "Digit4") flight.current.toggle = true;
      if (flight.current.active) {
        if (key === "KeyA") flight.current.strafe -= 0.6096;
        if (key === "KeyD") flight.current.strafe += 0.6096;
        return;
      }
      if (key === "Space") input.current.jump = true;
      if (key === "KeyR") input.current.reset = true;
      const move = MOVES.find(
        (m) => key === (/\d/.test(m.key) ? `Digit${m.key}` : `Key${m.key}`),
      );
      if (move) input.current.action = move.key;
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const pointerDown = (e: PointerEvent) => {
      if (!paused && [0, 2].includes(e.button)) {
        dragging = true;
        dragDistance = 0;
      }
    };
    const pointerUp = () => {
      dragging = false;
    };
    const move = (e: MouseEvent) => {
      if (paused || (!dragging && document.pointerLockElement !== canvas))
        return;
      dragDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
      orbit.current.yaw -= e.movementX * 0.003 * settings.sensitivity;
      orbit.current.pitch = THREE.MathUtils.clamp(
        orbit.current.pitch + e.movementY * 0.003 * settings.sensitivity,
        0.06,
        1.15,
      );
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.current.distance = THREE.MathUtils.clamp(
        orbit.current.distance + e.deltaY * 0.006,
        2.5,
        12,
      );
    };
    const lock = () => {
      if (
        !paused &&
        dragDistance < 5 &&
        document.pointerLockElement !== canvas
      ) {
        try {
          void canvas.requestPointerLock()?.catch(() => {});
        } catch {}
      }
    };
    const menu = (e: Event) => e.preventDefault();
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    canvas.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("mousemove", move);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("click", lock);
    canvas.addEventListener("contextmenu", menu);
    return () => {
      clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("mousemove", move);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener('parkour:gamepad-move',padMove);
      window.removeEventListener('parkour:gamepad-camera',padCamera);
      canvas.removeEventListener("click", lock);
      canvas.removeEventListener("contextmenu", menu);
    };
  }, [gl, paused, settings.sensitivity, MOVES]);
  useEffect(() => {
    // A new rig must never inherit a move or animation from the previous rig.
    simulation.current.move = undefined;
    simulation.current.remaining = 0;
    simulation.current.anchor = null;
    input.current.action = "";
    animation.current = { clip: definition.automatic.idle, epoch: animation.current.epoch + 1 };
  }, [definition]);
  const respawn = () => {
    const s = simulation.current;
    const p =
      level.mode === "explore" || lastSafePlanet.current
        ? lastSafe.current
        : s.checkpoint
          ? level.checkpoints[s.checkpoint - 1]
          : level.spawn;
    flight.current.active = false;
    flight.current.steps = 0;
    flight.current.toggle = false;
    setFlying(false);
    const up = lastSafePlanet.current ? lastSafeUp.current : new THREE.Vector3(0, 1, 0);
    const spawn = new THREE.Vector3(...p).addScaledVector(up, 1.05);
    body.current?.setTranslation(spawn, true);
    body.current?.setNextKinematicTranslation(spawn);
    s.vx = 0;
    s.vy = 0;
    s.vz = 0;
    s.jumps = 0;
    s.move = undefined;
    s.remaining = 0;
    s.anchor = null;
    s.grounded = false;
    immunity.current = 1.25;
    hazardHit.current = "";
    orbit.current.snap = true;
    s.falls++;
    input.current.reset = false;
  };
  useBeforePhysicsStep(() => {
    const b = body.current,
      c = collider.current,
      cc = controller.current,
      s = simulation.current;
    walkingSurface.current = false;
    if (!b || !c || !cc || paused || s.done) return;
    immunity.current = Math.max(0, immunity.current - DT);
    if (hazardHit.current && immunity.current === 0) {
      const reason = hazardHit.current;
      respawn();
      s.notice = `${reason}. Returned to your last checkpoint.`;
      s.noticeTime = 3;
      return;
    }
    hazardHit.current = "";
    if (input.current.reset || resetToken !== s.resetToken) {
      if (resetToken !== s.resetToken) { lastSafe.current = level.spawn; lastSafePlanet.current = false; }
      s.resetToken = resetToken;
      respawn();
      return;
    }
    const p = b.translation();
    onPosition?.([p.x, p.y, p.z]);
    const f = flight.current;
    const currentPlanet = planetAt(planets, [p.x,p.y,p.z], 24);
    const up = surfaceUp.current;
    if (currentPlanet) up.set(p.x-currentPlanet.position[0],p.y-currentPlanet.position[1],p.z-currentPlanet.position[2]).normalize();
    else up.set(0,1,0);
    transportSurfaceFrame(surfaceFrame.current, up);
    b.setRotation(surfaceFrame.current, true);
    b.setNextKinematicRotation(surfaceFrame.current);
    cc.setUp(up);
    const altitude = currentPlanet ? new THREE.Vector3(p.x,p.y,p.z).distanceTo(new THREE.Vector3(...currentPlanet.position)) : p.y;
    const reference = currentPlanet?.id ?? "";
    if (reference !== f.reference) {
      const previous = planets.find(planet=>planet.id===f.reference);
      const previousAltitude = previous ? new THREE.Vector3(p.x,p.y,p.z).distanceTo(new THREE.Vector3(...previous.position)) : p.y;
      f.targetY += altitude - previousAltitude;
      f.reference = reference;
      f.hadGround = false;
    }
    const altitudeInput = Number(keys.current.has("KeyR")) - Number(keys.current.has("KeyF"));
    const verticalSpeed = inOpenSpace(level,[p.x,p.y,p.z]) ? 24 : 8;
    if (f.active && altitudeInput) {
      f.altitudeHoldTime += DT;
      // Follow the current position while held, so blocked movement never
      // queues an ascent/descent that continues after releasing the key.
      if (f.altitudeHoldTime > .18)
        f.targetY = altitude + altitudeInput * verticalSpeed / 6;
    } else {
      // Ease to a nearby stop after a hold; a short tap still travels two feet.
      if (f.active && f.altitudeHoldTime > .18)
        f.targetY = altitude + f.verticalVelocity * .1;
      f.altitudeHoldTime = 0;
    }
    const groundHit =
      f.active || f.toggle
        ? world.castRayAndGetNormal(
            new rapier.Ray(
              { x: p.x+up.x*.2, y: p.y+up.y*.2, z: p.z+up.z*.2 },
              { x: -up.x, y: -up.y, z: -up.z },
            ),
            4000,
            true,
            rapier.QueryFilterFlags.EXCLUDE_SENSORS,
            undefined,
            c,
            b,
          )
        : null;
    const landingGround = groundHit && new THREE.Vector3().copy(groundHit.normal).dot(up) > 0.55
      ? altitude + 0.2 - groundHit.timeOfImpact : null;
    if (landingGround !== null) {
      const following = f.hadGround && f.steps === 0 && Math.abs(landingGround-f.ground)<2 &&
        Math.abs(f.targetY-(f.ground+.94+HOVER_HEIGHT))<.05;
      f.ground = landingGround;
      if (following) f.targetY = landingGround+.94+HOVER_HEIGHT;
    }
    f.hadGround = landingGround !== null;
    f.targetY = flightTarget(f.targetY, landingGround);
    f.steps = landingGround === null ? f.steps : Math.max(0,Math.round((f.targetY-.94-landingGround-HOVER_HEIGHT)/ALTITUDE_STEP));
    f.clearance = landingGround === null ? Math.round((altitude-.94)/.3048) : Math.max(3,Math.round((f.targetY-.94-landingGround)/.3048));
    if (f.toggle) {
      f.toggle = false;
      if (!f.active && groundHit) {
        f.active = true;
        f.steps = 0;
        f.targetY = altitude + HOVER_HEIGHT;
        f.gear = 0;
        f.verticalVelocity = 0;
        f.altitudeHoldTime = 0;
        setFlying(true);
        sound("sfxSaiyon");
        s.move = undefined;
        s.anchor = null;
        s.vx = s.vy = s.vz = 0;
      } else if (
        f.active &&
        canLand(altitude, landingGround)
      ) {
        f.active = false;
        setFlying(false);
        s.vy = 0;
        s.grounded = false;
        lastSafePlanet.current = !!planetAt(planets,[p.x,p.y,p.z]);
        const landing = new THREE.Vector3(p.x,p.y,p.z).addScaledVector(up,-(altitude-landingGround!));
        lastSafe.current = landing.toArray() as Vec3;
        lastSafeUp.current.copy(up);
      } else {
        s.notice = "Descend with F to 3 ft above a surface, then press 4 to land.";
        s.noticeTime = 3;
      }
    }
    if (f.active) {
      const k = keys.current,
        forward =
          Number(k.has("KeyW") || k.has("ArrowUp")) -
          Number(k.has("KeyS") || k.has("ArrowDown")) - padAxes.current.z;
      const yaw = orbit.current.yaw,
        speed = FLIGHT_SPEEDS[f.gear],
        step = THREE.MathUtils.clamp(f.strafe, -0.12, 0.12);
      f.strafe -= step;
      const mx = -Math.sin(yaw) * forward * speed * DT + Math.cos(yaw) * (step+padAxes.current.x*speed*DT);
      const mz = -Math.cos(yaw) * forward * speed * DT - Math.sin(yaw) * (step+padAxes.current.x*speed*DT);
      const target = f.targetY;
      const desiredVertical = THREE.MathUtils.clamp((target-altitude)*6,-verticalSpeed,verticalSpeed);
      f.verticalVelocity = THREE.MathUtils.lerp(f.verticalVelocity,desiredVertical,1-Math.exp(-10*DT));
      const my = Math.sign(f.verticalVelocity) === Math.sign(target-altitude)
        ? Math.sign(f.verticalVelocity)*Math.min(Math.abs(f.verticalVelocity*DT),Math.abs(target-altitude))
        : f.verticalVelocity*DT;
      const displacement = new THREE.Vector3(mx,my,mz).applyQuaternion(surfaceFrame.current);
      if (isPositionReady && !isPositionReady([p.x + displacement.x, p.y + displacement.y, p.z + displacement.z])) {
        s.notice = "Preparing the next sector…";
        s.noticeTime = 1;
        return;
      }
      cc.computeColliderMovement(
        c,
        displacement,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      );
      const d = cc.computedMovement();
      b.setNextKinematicTranslation({
        x: p.x + d.x,
        y: p.y + d.y,
        z: p.z + d.z,
      });
      s.yaw = yaw + Math.PI;
      s.vx = mx / DT;
      s.vz = mz / DT;
      s.vy = 0;
      s.grounded = false;
      s.move = undefined;
      s.noticeTime = Math.max(0, s.noticeTime - DT);
      if (level.mode !== "explore") s.seconds += DT;
      // Flight cannot collect parkour checkpoints.
      return;
    }
    if (currentPlanet) {
      const k = keys.current;
      const local = new THREE.Vector3(
        Number(k.has("KeyD")||k.has("ArrowRight"))-Number(k.has("KeyA")||k.has("ArrowLeft"))+padAxes.current.x,
        0,
        Number(k.has("KeyS")||k.has("ArrowDown"))-Number(k.has("KeyW")||k.has("ArrowUp"))+padAxes.current.z,
      );
      const moving = local.lengthSq()>0;
      if(local.length()>1)local.normalize();
      local.applyAxisAngle(new THREE.Vector3(0,1,0),orbit.current.yaw);
      if (moving) s.yaw = Math.atan2(local.x,local.z);
      s.remaining = Math.max(0,s.remaining-DT);
      if (!s.remaining) s.move=undefined;
      const requested = MOVES.find(m=>m.key===input.current.action);
      input.current.action="";
      if (requested && s.grounded && s.remaining===0 && !["climb","ladder","rope","vault","wall","dive"].includes(requested.kind)) {
        s.move=requested; if(requested.combat)s.yaw=orbit.current.yaw+Math.PI; s.remaining=requested.duration; animation.current.epoch++;
        if (requested.kind==="jump") input.current.jump=true;
        if (requested.kind==="flip") {s.vy=9.8;s.grounded=false;s.jumps=1;sound("jump");}
      }
      if (input.current.jump && (s.grounded||s.jumps<2)) {
        s.move=definition.jump; s.remaining=definition.jump.duration;
        animation.current.epoch++; s.vy=9.8; s.grounded=false; s.jumps++; sound("jump");
      }
      input.current.jump=false;
      const speed=s.sprint?8:4;
      const stationary=s.move&&["dance","kick"].includes(s.move.kind);
      const gain=1-Math.exp(-DT*(s.grounded?14:5));
      s.vx+=((stationary?0:local.x*speed)-s.vx)*gain;
      s.vz+=((stationary?0:local.z*speed)-s.vz)*gain;
      s.vy-=23*DT;
      const displacement=new THREE.Vector3(s.vx,s.vy,s.vz).multiplyScalar(DT).applyQuaternion(surfaceFrame.current);
      cc.computeColliderMovement(c,displacement,rapier.QueryFilterFlags.EXCLUDE_SENSORS);
      const delta=cc.computedMovement();
      const contact=resolveContact(cc.computedGrounded(),s.vy*DT,new THREE.Vector3().copy(delta).dot(up),s.vy,false);
      const wasGrounded=s.grounded;
      s.grounded=contact.grounded; s.vy=contact.vy;
      if (s.grounded) {
        if (!wasGrounded) sound("landing");
        if (!wasGrounded && s.move?.kind === "jump") { s.move = undefined; s.remaining = 0; }
        s.jumps=0;
        lastSafePlanet.current=true;
        lastSafe.current=new THREE.Vector3(p.x,p.y,p.z).addScaledVector(up,-.945).toArray() as Vec3;
        lastSafeUp.current.copy(up);
      }
      const next=new THREE.Vector3(p.x+delta.x,p.y+delta.y,p.z+delta.z);
      if (!isPositionReady || isPositionReady(next.toArray() as Vec3)) {
        b.setNextKinematicTranslation(next);
        const tangent = new THREE.Vector3().copy(delta);
        tangent.addScaledVector(up, -tangent.dot(up));
        walkingSurface.current = moving && tangent.length() > .001;
      }
      animation.current.clip=resolveMotion(s.grounded,s.vy,Math.hypot(s.vx,s.vz)>.3,s.sprint,s.move,definition.automatic);
      animation.current.duration=s.move?.duration;
      animation.current.elapsed=s.move?s.move.duration-s.remaining:0;
      s.noticeTime=Math.max(0,s.noticeTime-DT);
      if (level.mode!=="explore") s.seconds+=DT;
      return;
    }
    const onPlanet = planetAt(planets,[p.x,p.y,p.z]);
    const outside = !onPlanet && (level.bounds
      ? p.y < level.bounds.min[1] - 8 ||
        p.x < level.bounds.min[0] - 8 ||
        p.x > level.bounds.max[0] + 8 ||
        p.z < level.bounds.min[2] - 8 ||
        p.z > level.bounds.max[2] + 8
      : p.y < -6 || Math.abs(p.x) > 18 || p.z > 12 || p.z < -58);
    // Missing a jump in the rear atrium drops into the reset zone.
    if (
      outside ||
      (!onPlanet && level.mode !== "explore" &&
        (level.revision ?? 0) >= 2 &&
        p.z < -55 &&
        p.y < -2)
    ) {
      respawn();
      return;
    }
    if (level.mode !== "explore") s.seconds += DT;
    s.remaining = Math.max(0, s.remaining - DT);
    s.noticeTime = Math.max(0, s.noticeTime - DT);
    if (s.remaining <= 0 && !(s.anchor && ["climb", "ladder"].includes(s.move?.kind ?? ""))) {
      s.move = undefined;
      s.anchor = null;
    }
    const k = keys.current;
    let ix =
      Number(k.has("KeyD") || k.has("ArrowRight")) -
      Number(k.has("KeyA") || k.has("ArrowLeft")) + padAxes.current.x;
    let iz =
      Number(k.has("KeyS") || k.has("ArrowDown")) -
      Number(k.has("KeyW") || k.has("ArrowUp")) + padAxes.current.z;
    const length = Math.hypot(ix, iz);
    if (length > 1) {
      ix /= length;
      iz /= length;
    }
    const oy = orbit.current.yaw,
      dx = ix * Math.cos(oy) + iz * Math.sin(oy),
      dz = iz * Math.cos(oy) - ix * Math.sin(oy);
    if (length && s.move?.kind === "dance") {
      s.move = undefined;
      s.remaining = 0;
    }
    if (length && !s.anchor)
      s.yaw = THREE.MathUtils.lerp(
        s.yaw,
        s.yaw +
          Math.atan2(
            Math.sin(Math.atan2(dx, dz) - s.yaw),
            Math.cos(Math.atan2(dx, dz) - s.yaw),
          ),
        0.2,
      );
    const fx = Math.sin(s.yaw),
      fz = Math.cos(s.yaw);
    const requested = MOVES.find((m) => m.key === input.current.action);
    input.current.action = "";
    let jump = input.current.jump;
    input.current.jump = false;
    const notify = (message: string) => {
      s.notice = message;
      s.noticeTime = 2.5;
    };
    const start = (m: Move) => {
      s.anchor = null;
      s.move = m;
      if(m.combat)s.yaw=orbit.current.yaw+Math.PI;
      s.remaining = m.duration;
      animation.current.epoch++;
    };
    if (requested && s.remaining < 0.15) {
      const kind = requested.kind;
      const wall = world.castRayAndGetNormal(
        new rapier.Ray(
          { x: p.x, y: p.y - 0.35, z: p.z },
          { x: fx, y: 0, z: fz },
        ),
        1.5,
        true,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        c,
        b,
      );
      if (kind === "jump") jump = true;
      else if (kind === "dive") {
        if (!s.grounded) {
          start(requested);
          s.vy = Math.min(s.vy, -5);
        } else notify("Jump first to dive.");
      } else if (kind === "wall") {
        if (wall) {
          start(requested);
          s.vy = 9;
          s.vx = -fx * 5;
          s.vz = -fz * 5;
          s.grounded = false;
          s.jumps = 1;
          sound("jump");
        } else notify("Face a wall within reach.");
      } else if (kind === "vault" || kind === "climb") {
        const obstacle = level.colliders.find(
          (o) =>
            Math.abs(p.x + fx * 1.1 - o.position[0]) < o.size[0] / 2 + 0.3 &&
            Math.abs(p.z + fz * 1.1 - o.position[2]) < o.size[2] / 2 + 0.3 &&
            o.position[1] + o.size[1] / 2 > p.y - 0.6 &&
            o.position[1] + o.size[1] / 2 < p.y + 1.7,
        );
        // Imported environments use triangle colliders: probe the actual ledge surface.
        const surface =
          level.mode === "explore" && wall
            ? world.castRayAndGetNormal(
                new rapier.Ray(
                  { x: p.x + fx * 1.1, y: p.y + 2.2, z: p.z + fz * 1.1 },
                  { x: 0, y: -1, z: 0 },
                ),
                3,
                true,
                undefined,
                undefined,
                c,
                b,
              )
            : null;
        const surfaceY =
          surface && surface.normal.y > 0.65
            ? p.y + 2.2 - surface.timeOfImpact
            : undefined;
        const top = obstacle
          ? obstacle.position[1] + obstacle.size[1] / 2
          : surfaceY;
        if (top !== undefined && top > p.y - 0.6 && top < p.y + 1.7 && wall) {
          start(requested);
          s.vy = kind === "vault" ? 7.5 : 0;
          if (kind === "climb") {
            const normal = new THREE.Vector3(wall.normal.x, 0, wall.normal.z).normalize();
            if (normal.lengthSq() < 0.5) {
              s.move = undefined;
              s.remaining = 0;
              notify("Face the vertical side of the ledge.");
              return;
            }
            const lateral = requested.key === "H" ? -0.45 : 0.45;
            const edgeX = p.x + fx * wall.timeOfImpact;
            const edgeZ = p.z + fz * wall.timeOfImpact;
            // Probe the requested side step so a narrow ledge cannot pull us past its corner.
            const sideOrigin = {
              x: edgeX + normal.x * 0.6 + normal.z * lateral,
              y: top - 0.2,
              z: edgeZ + normal.z * 0.6 - normal.x * lateral,
            };
            const side = world.castRayAndGetNormal(
              new rapier.Ray(sideOrigin, { x: -normal.x, y: 0, z: -normal.z }),
              1, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, c, b,
            );
            const supported = side && side.normal.x * normal.x + side.normal.z * normal.z > 0.9;
            const targetX = supported ? sideOrigin.x - normal.x * side.timeOfImpact : edgeX;
            const targetZ = supported ? sideOrigin.z - normal.z * side.timeOfImpact : edgeZ;
            s.anchor = [targetX + normal.x * 0.44, top - 0.65, targetZ + normal.z * 0.44];
            s.yaw = Math.atan2(-normal.x, -normal.z);
            s.vx = s.vz = 0;
            notify("Stay on the ledge. H / K move sideways; Space releases.");
          }
          s.grounded = false;
          s.jumps = 1;
          sound("jump");
        } else notify("Face a reachable ledge or low wall.");
      } else if (kind === "ladder") {
        const ladder = level.ladders.find(
          (l) => Math.hypot(l[0] - p.x, l[2] - p.z) < 1.6,
        );
        if (ladder) {
          start(requested);
          // Authored rails rise 4.5 m from their base, facing the spawn side (+Z).
          s.anchor = [ladder[0], ladder[1] + 4.5 - 0.65, ladder[2] + 0.44];
          s.yaw = Math.PI;
          s.vx = s.vy = s.vz = 0;
          notify("Climbing the ladder face. Space releases.");
        } else
          notify(
            level.mode === "explore"
              ? "This map has no designated ladder grips. Use H / K on reachable ledges."
              : "Move to a yellow ladder near the entrance.",
          );
      } else if (kind === "rope") {
        if (
          level.rope &&
          Math.hypot(p.x - level.rope[0], p.z - level.rope[2]) < 1.5 &&
          p.y > 1.6
        ) {
          start(requested);
          s.anchor = [level.rope[0], level.rope[1], level.rope[2]];
        } else
          notify(
            level.mode === "explore"
              ? "There is no designated rope grip here."
              : "Jump within reach of the rope near the entrance.",
          );
      } else if (s.grounded) {
        start(requested);
        if (kind === "flip") {
          s.vy = 10;
          s.grounded = false;
          s.jumps = 1;
          sound("jump");
        }
      } else notify("Land before starting this move.");
    }
    if (jump && (s.grounded || s.jumps < 2 || s.anchor)) {
      s.anchor = null;
      start(definition.jump);
      s.vy = 9.8;
      s.grounded = false;
      s.jumps++;
      sound("jump");
    }
    let speed = s.sprint ? 8 : 4;
    if (s.move?.kind === "charge") speed = 11;
    const forced = s.move && ["vault", "charge"].includes(s.move.kind);
    const stationary = s.move && ["dance", "kick"].includes(s.move.kind);
    const tx = stationary ? 0 : forced ? fx * speed : dx * speed,
      tz = stationary ? 0 : forced ? fz * speed : dz * speed;
    const accel = 1 - Math.exp(-DT * (s.grounded ? 14 : 5));
    s.vx += (tx - s.vx) * accel;
    s.vz += (tz - s.vz) * accel;
    s.vy -= 23 * DT;
    let mx = s.vx * DT,
      my = s.vy * DT,
      mz = s.vz * DT;
    if (s.anchor) {
      const gain = s.move?.kind === "rope" ? 8 : 6;
      const rising = s.move?.kind !== "rope" && p.y < s.anchor[1] - 0.08;
      const attachedToFace = s.move?.kind === "climb" || s.move?.kind === "ladder";
      mx = rising && !attachedToFace ? 0 : (s.anchor[0] - p.x) * gain * DT;
      my = THREE.MathUtils.clamp((s.anchor[1] - p.y) * gain, -4, 4) * DT;
      mz = rising && !attachedToFace ? 0 : (s.anchor[2] - p.z) * gain * DT;
      s.vx = s.vz = 0;
      s.vy = 0;
    }
    // Ride the supporting kinematic deck in all three axes. Excluding that
    // deck from this sweep avoids its old pose blocking a descending lift.
    const support =
      s.grounded && s.vy <= 0 && !s.anchor
        ? world.castRayAndGetNormal(
            new rapier.Ray(p, { x: 0, y: -1, z: 0 }),
            1.15,
            true,
            rapier.QueryFilterFlags.EXCLUDE_SENSORS,
            undefined,
            c,
            b,
          )
        : null;
    const platform =
      support?.normal.y && support.normal.y > 0.7
        ? support.collider.parent()
        : null;
    const riding = !!(
      platform?.userData as { movingPlatform?: boolean } | undefined
    )?.movingPlatform;
    let carryY = 0;
    if (riding && platform && support) {
      const current = platform.translation(),
        next = platform.nextTranslation();
      const carry = platformCarry(current, next, support.timeOfImpact);
      mx += carry.x;
      mz += carry.z;
      carryY = carry.y;
    }
    cc.computeColliderMovement(
      c,
      { x: mx, y: riding ? carryY : my, z: mz },
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      riding && support
        ? (other) => other.handle !== support.collider.handle
        : undefined,
    );
    const delta = cc.computedMovement(),
      wasGrounded = s.grounded;
    const contact = resolveContact(
      cc.computedGrounded() || (riding && Math.abs(delta.y - carryY) < 0.01),
      my,
      delta.y - (riding ? carryY : 0),
      s.vy,
      !!s.anchor,
    );
    s.grounded = contact.grounded;
    if (s.grounded) {
      if (!wasGrounded && s.vy < -2) sound("landing");
      if (!wasGrounded && s.move?.kind === "jump") { s.move = undefined; s.remaining = 0; }
      s.vy = 0;
      s.jumps = 0;
    }
    s.vy = contact.vy;
    if (
      isPositionReady &&
      !isPositionReady([p.x + delta.x, p.y + delta.y, p.z + delta.z])
    ) {
      s.notice = "Preparing the next sector…";
      s.noticeTime = 1;
      return;
    }
    b.setNextKinematicTranslation({
      x: p.x + delta.x,
      y: p.y + delta.y,
      z: p.z + delta.z,
    });
    if (s.grounded) {
      lastSafePlanet.current = !!onPlanet;
      if (level.mode === "explore" || onPlanet)
        lastSafe.current = [p.x, p.y - 0.945, p.z];
    }
    walkingSurface.current = length > 0 && Math.hypot(delta.x, delta.z) > .001;
    const next = level.checkpoints[s.checkpoint];
    if (
      next &&
      Math.hypot(p.x - next[0], p.z - next[2]) < 1.5 &&
      Math.abs(p.y - 0.95 - next[1]) < 0.6 &&
      s.grounded
    ) {
      s.checkpoint++;
      notify(
        s.checkpoint === level.checkpoints.length
          ? "Course complete!"
          : `Checkpoint ${s.checkpoint} secured.`,
      );
      if (s.checkpoint === level.checkpoints.length) {
        s.done = true;
        onFinish(s.seconds, s.falls);
      }
    }
    animation.current.clip = resolveMotion(
      s.grounded,
      s.vy,
      Math.hypot(s.vx, s.vz) > 0.3,
      s.sprint,
      s.move,
      definition.automatic,
    );
    animation.current.duration = s.move?.duration;
    animation.current.elapsed = s.move ? s.move.duration-s.remaining : 0;
  });
  const reportTime = useRef(0);
  useFrame(({ camera }, dt) => {
    const b = body.current;
    if (!b) return;
    const p = b.translation(),
      s = simulation.current,
      o = orbit.current;
    // Physics supplies actual surface travel; rendering may run faster than physics.
    const k = keys.current;
    const movingInput = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].some(key => k.has(key)) || Math.hypot(padAxes.current.x, padAxes.current.z) > .1;
    const walking = !paused && !s.done && !flight.current.active && s.grounded && !s.move && movingInput && walkingSurface.current && !settings.sfxMuted && settings.volume > 0;
    if (walking) {
      s.stepTime += Math.min(dt, .05);
      if (s.stepTime > (s.sprint ? .25 : .43)) { sound("steps"); s.stepTime = 0; }
    } else {
      const steps = audio.current.steps;
      if (steps && !steps.paused) { steps.pause(); steps.currentTime = 0; }
      s.stepTime = 0;
    }
    if (model.current) model.current.rotation.y = s.yaw;
    scratch.target.set(p.x, p.y, p.z).addScaledVector(surfaceUp.current,.25);
    scratch.direction.set(
      Math.sin(o.yaw) * Math.cos(o.pitch),
      Math.sin(o.pitch),
      Math.cos(o.yaw) * Math.cos(o.pitch),
    );
    scratch.direction.applyQuaternion(surfaceFrame.current);
    camera.up.copy(surfaceUp.current);
    // Pull the camera in before walls, excluding the player's own capsule.
    const hit = world.castRay(
      new rapier.Ray(scratch.target, scratch.direction),
      o.distance,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      collider.current ?? undefined,
      b,
    );
    const distance = hit ? Math.max(0.6, hit.timeOfImpact - 0.25) : o.distance;
    scratch.desired
      .copy(scratch.direction)
      .multiplyScalar(distance)
      .add(scratch.target);
    if (o.snap) {
      camera.position.copy(scratch.desired);
      o.snap = false;
    } else
      camera.position.lerp(
        scratch.desired,
        1 - Math.exp(-Math.min(dt, 0.05) * 12),
      );
    camera.lookAt(scratch.target);
    reportTime.current += dt;
    if (reportTime.current > 0.1) {
      reportTime.current = 0;
      onUpdate({
        speed: Math.hypot(s.vx, s.vz),
        sprint: s.sprint,
        flying: flight.current.active,
        flightGear: flight.current.gear + 1,
        altitude: flight.current.clearance,
        motion: flight.current.active
          ? "Flying"
          : (MOVES.find((m) => m.clip === animation.current.clip)?.name ??
            {
              Idle_4: "Idle",
              Idle_6: "Idle",
              CyberIdle: "Idle",
              Walking: "Walking",
              Running: "Sprinting",
              Fall2: "Falling",
            }[animation.current.clip] ??
            "Jump"),
        checkpoint: s.checkpoint,
        seconds: s.seconds,
        falls: s.falls,
        notice:
          s.noticeTime > 0
            ? s.notice
            : flight.current.active
              ? `R / F: altitude (hold to travel) · Shift: gear ${flight.current.gear+1}/4 · 4: land 3 ft above a surface`
              : planetAt(planets,[p.x,p.y,p.z])
                ? "Planet surface · Explore on foot · 4 launches flight · R returns to safe ground"
                : level.mode === "explore"
                  ? "Explore freely. 4 activates flight. R returns to safe ground."
                  : "Follow the purple beacons in order. 4 flies to the orbiting worlds.",
      });
    }
  });
  return (
    <>
    <CombatEffects model={model} state={animation} body={body} settings={settings} paused={paused} flying={flying}/>
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[level.spawn[0], level.spawn[1] + 1, level.spawn[2]]}
    >
      <CapsuleCollider
        ref={collider}
        args={[0.6, 0.32]}
        onIntersectionEnter={({ other }) => {
          const reason = other.rigidBodyObject?.userData.hazard;
          if (typeof reason === "string" && immunity.current === 0)
            hazardHit.current = reason;
        }}
      />
      <group ref={model} position={[0, -0.94, 0]}>
        <Suspense
          fallback={
            <Avatar
              character={settings.character}
              state={animation}
              paused={paused}
            />
          }
        >
          {flying ? (
            <FlightAvatar paused={paused} />
          ) : (
            <Avatar
              key={settings.character}
              character={settings.character}
              state={animation}
              paused={paused}
            />
          )}
        </Suspense>
      </group>
    </RigidBody>
    </>
  );
}
