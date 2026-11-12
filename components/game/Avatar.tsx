"use client";
/* eslint-disable react-hooks/immutability -- Three animation objects are intentionally mutable. */
import { useMemo, useRef, useEffect, type RefObject } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { prepareModel } from "@/lib/game/model-utils";
import { prepareAnimationClips } from "@/lib/game/animation-clips";
import { characterDefinition, type CharacterId } from "@/lib/game/characters";
export type AnimationState = { clip: string; epoch: number; duration?: number; elapsed?: number };
export default function Avatar({
  state,
  paused,
  character,
}: {
  state: RefObject<AnimationState>;
  paused: boolean;
  character: CharacterId;
}) {
  const definition = characterDefinition(character);
  const source = useGLTF(definition.model + (character === "intergalactron" ? "?revision=fall2" : ""));
  const { model, bounds } = useMemo(
    () => prepareModel(source.scene),
    [source.scene],
  );
  const clips = useMemo(
    () => prepareAnimationClips(source.animations, character),
    [source.animations, character],
  );
  const { actions, mixer } = useAnimations(clips, model);
  useEffect(() => {
    mixer.timeScale = paused ? 0 : 1;
  }, [mixer, paused]);
  const previous = useRef<THREE.AnimationAction | null>(null);
  const epoch = useRef(-1);
  const scale = 1.85 / Math.max(bounds.max.y - bounds.min.y, 0.01);
  const center = bounds.getCenter(new THREE.Vector3());
  useFrame(() => {
    const next = state.current;
    const action = actions[next.clip] ?? (next.clip === "Regular_Jump" ? actions[definition.jump.clip] : actions[definition.automatic.idle]);
    if (
      !action ||
      (previous.current === action && epoch.current === next.epoch)
    )
      return;
    const auto = Object.values(definition.automatic).includes(next.clip);
    const move = definition.moves.find(m => m.clip === next.clip);
    const looping = auto || !!move?.loop;
    action
      .reset()
      .setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, looping ? Infinity : 1);
    action.clampWhenFinished = !looping;
    const duration =
      next.duration ??
      definition.moves.find((m) => m.clip === next.clip)?.duration;
    action
      .setEffectiveTimeScale(
        !looping && duration ? action.getClip().duration / duration : 1,
      )
      .setEffectiveWeight(1)
      .play();
    if (previous.current && previous.current !== action)
      action.crossFadeFrom(previous.current, next.clip === definition.automatic.walk || next.clip === definition.automatic.run ? 0.08 : 0.18, false);
    else action.fadeIn(0.12);
    previous.current = action;
    epoch.current = next.epoch;
  });
  useEffect(
    () => () => {
      mixer.stopAllAction();
      const materials = new Set<THREE.Material>();
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh)
          (Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          ).forEach((m) => materials.add(m));
        if ((o as THREE.SkinnedMesh).isSkinnedMesh)
          (o as THREE.SkinnedMesh).skeleton.dispose();
      });
      materials.forEach((m) => m.dispose());
    },
    [model, mixer],
  );
  return (
    <group
      scale={scale}
      position={[-center.x * scale, -bounds.min.y * scale, -center.z * scale]}
    >
      <primitive object={model} dispose={null} />
    </group>
  );
}
