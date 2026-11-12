"use client";
import { useMemo, useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { prepareModel } from "@/lib/game/model-utils";
const AURA_SPEED = 4;
export default function FlightAvatar({ paused }: { paused: boolean }) {
  const source = useGLTF("/model/gokuSS11-FlyingPose.glb");
  const { model, bounds } = useMemo(
    () => prepareModel(source.scene),
    [source.scene],
  );
  const aura = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const scale = 1.85 / (bounds.max.y - bounds.min.y),
    center = bounds.getCenter(new THREE.Vector3());
  useFrame((_, dt) => {
    if (!paused) elapsed.current += dt * AURA_SPEED;
    if (aura.current) {
      const pulse = 1 + Math.sin(elapsed.current * 3.8) * 0.07;
      aura.current.scale.set(0.8 * pulse, 1.25 * pulse, 0.65 * pulse);
      (aura.current.material as THREE.ShaderMaterial).uniforms.time.value =
        elapsed.current;
    }
  });
  useEffect(
    () => () => {
      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = (o as THREE.Mesh).material;
          (Array.isArray(m) ? m : [m]).forEach((v) => v.dispose());
        }
      });
    },
    [model],
  );
  return (
    <group>
      <group
        scale={scale}
        position={[-center.x * scale, -bounds.min.y * scale, -center.z * scale]}
      >
        <primitive object={model} dispose={null} />
      </group>
      <mesh ref={aura} position={[0, 0.95, 0]} renderOrder={2}>
        <sphereGeometry args={[1, 24, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          uniforms={{ time: { value: 0 } }}
          vertexShader={`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`}
          fragmentShader={`uniform float time;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),1.6);float pulse=.75+.25*sin(time*3.8);gl_FragColor=vec4(.55,.08,1.,rim*.38*pulse);}`}
        />
      </mesh>
    </group>
  );
}
