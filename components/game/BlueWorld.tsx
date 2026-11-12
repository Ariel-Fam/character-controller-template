"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import Player from "./Player";
import { CombatProvider } from "./Combat";
import type { Level, Settings, Telemetry } from "@/lib/game/types";

const level: Level = {
  id: 0, name: "Blue playground", tag: "TEMPLATE", difficulty: "Free play",
  par: 0, spawn: [0, 0, 0], checkpoints: [], ladders: [], rope: null,
  mode: "explore", bounds: { min: [-250, 0, -250], max: [250, 200, 250] },
  colliders: [{ position: [0, -1, 0], size: [520, 2, 520], rotation: 0 }],
};
function LoadingOverlay() {
  const { active, progress } = useProgress();
  return active ? <div className="loading" role="status">Loading character… {Math.round(progress)}%</div> : null;
}
export default function BlueWorld({settings, paused, resetToken, onUpdate}: {
  settings: Settings; paused: boolean; resetToken: number; onUpdate: (value: Telemetry) => void;
}) {
  return <><Canvas shadows camera={{position: [0, 3, 6], fov: 58, far: 1200}} dpr={[1, 1.5]}>
    <color attach="background" args={["#388ddd"]} />
    <fog attach="fog" args={["#388ddd", 35, 180]} />
    <hemisphereLight args={["#ffffff", "#4475aa", 2]} />
    <directionalLight position={[8, 16, 6]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-0.0005} />
    <Suspense fallback={null}>
      <CombatProvider settings={settings} paused={paused}>
        <Physics paused={paused} timeStep={1 / 60}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[260, 1, 260]} position={[0, -1, 0]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[520, 520]} />
              <meshStandardMaterial color="#287ac8" roughness={1} />
            </mesh>
          </RigidBody>
          <Player level={level} settings={settings} paused={paused} resetToken={resetToken} onUpdate={onUpdate} onFinish={() => {}} />
        </Physics>
      </CombatProvider>
    </Suspense>
  </Canvas><LoadingOverlay /></>;
}
